import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import {
  jobProfileSchema,
  resumeProfileSchema,
  type JobProfile,
  type ResumeProfile,
} from '../domain/profiles.js';
import { ExtractionError, type AnswerRequest, type AnswerResult, type Llm } from './llm.js';
import { JOB_EXTRACTION_PROMPT, RESUME_EXTRACTION_PROMPT } from './prompts.js';

type Effort = 'low' | 'medium' | 'high';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface AnthropicLlmOptions {
  apiKey?: string;
  model: string;
  extractionEffort: Effort;
  chatEffort: Effort;
}

export class AnthropicLlm implements Llm {
  readonly model: string;
  private readonly client: Anthropic;

  constructor(private readonly options: AnthropicLlmOptions) {
    this.model = options.model;
    this.client = new Anthropic({ apiKey: options.apiKey, maxRetries: 3, timeout: 120_000 });
  }

  extractResume(text: string): Promise<ResumeProfile> {
    return this.extract(
      resumeProfileSchema,
      RESUME_EXTRACTION_PROMPT,
      `<resume>\n${text}\n</resume>`,
    );
  }

  extractJob(text: string): Promise<JobProfile> {
    return this.extract(jobProfileSchema, JOB_EXTRACTION_PROMPT, `<job>\n${text}\n</job>`);
  }

  async streamAnswer(
    request: AnswerRequest,
    onDelta: (text: string) => void,
  ): Promise<AnswerResult> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: 8000,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        output_config: { effort: this.options.chatEffort },
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: request.messages,
      },
      { signal: request.signal },
    );

    stream.on('text', (delta) => onDelta(delta));
    const message = await stream.finalMessage();
    const text = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');

    return {
      text,
      model: message.model,
      inputTokens: message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0),
      outputTokens: message.usage.output_tokens,
      refused: message.stop_reason === 'refusal',
    };
  }

  private async extract<T extends z.ZodType>(
    schema: T,
    system: string,
    content: string,
  ): Promise<z.infer<T>> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 8000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: this.options.extractionEffort, format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      throw new ExtractionError(`Could not extract profile (stop_reason=${response.stop_reason})`);
    }
    return response.parsed_output as z.infer<T>;
  }
}
