import OpenAI from 'openai';
import { z } from 'zod';
import {
  jobProfileSchema,
  resumeProfileSchema,
  type JobProfile,
  type ResumeProfile,
} from '../domain/profiles.js';
import { ExtractionError, type AnswerRequest, type AnswerResult, type Llm } from './llm.js';
import { JOB_EXTRACTION_PROMPT, RESUME_EXTRACTION_PROMPT } from './prompts.js';

export interface OpenAiLlmOptions {
  baseUrl: string;
  apiKey?: string;
  model: string;
  fallbackModels: string[];
}

export function parseJson(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)?.[1] ?? raw;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new ExtractionError('Model did not return JSON');
  return JSON.parse(fenced.slice(start, end + 1));
}

export class OpenAiLlm implements Llm {
  readonly model: string;
  private readonly client: OpenAI;

  constructor(private readonly options: OpenAiLlmOptions) {
    this.model = options.model;
    this.client = new OpenAI({
      baseURL: options.baseUrl,
      apiKey: options.apiKey,
      maxRetries: 3,
      timeout: 120_000,
    });
  }

  extractResume(text: string): Promise<ResumeProfile> {
    return this.extract(
      'resume_profile',
      resumeProfileSchema,
      RESUME_EXTRACTION_PROMPT,
      `<resume>\n${text}\n</resume>`,
    );
  }

  extractJob(text: string): Promise<JobProfile> {
    return this.extract(
      'job_profile',
      jobProfileSchema,
      JOB_EXTRACTION_PROMPT,
      `<job>\n${text}\n</job>`,
    );
  }

  async streamAnswer(
    request: AnswerRequest,
    onDelta: (text: string) => void,
  ): Promise<AnswerResult> {
    const stream = await this.client.chat.completions.create(
      {
        ...this.routing(),
        max_tokens: 4000,
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: 'system', content: request.system }, ...request.messages],
      },
      { signal: request.signal },
    );

    let text = '';
    let model = this.model;
    let usage: OpenAI.CompletionUsage | undefined;
    for await (const chunk of stream) {
      model = chunk.model || model;
      usage = chunk.usage ?? usage;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        text += delta;
        onDelta(delta);
      }
    }
    return {
      text,
      model,
      inputTokens: usage?.prompt_tokens ?? null,
      outputTokens: usage?.completion_tokens ?? null,
      refused: false,
    };
  }

  private routing() {
    const { model, fallbackModels } = this.options;
    return fallbackModels.length
      ? ({ model, models: [model, ...fallbackModels] } as { model: string })
      : { model };
  }

  private async extract<T extends z.ZodType>(
    name: string,
    schema: T,
    system: string,
    content: string,
  ): Promise<z.infer<T>> {
    const jsonSchema = z.toJSONSchema(schema);
    const response = await this.client.chat.completions.create({
      ...this.routing(),
      max_tokens: 8000,
      response_format: {
        type: 'json_schema',
        json_schema: { name, schema: jsonSchema, strict: false },
      },
      messages: [
        {
          role: 'system',
          content: `${system}\n\nRespond with a single JSON object matching this JSON schema, and nothing else:\n${JSON.stringify(jsonSchema)}`,
        },
        { role: 'user', content },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? '';
    let data: unknown;
    try {
      data = parseJson(raw);
    } catch {
      throw new ExtractionError(`Could not parse ${name} from model output`);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new ExtractionError(`Model output did not match ${name}`);
    return parsed.data;
  }
}
