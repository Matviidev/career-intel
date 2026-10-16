import { eq } from 'drizzle-orm';
import type { FitService } from '../analysis/fit-service.js';
import type { Db } from '../db/client.js';
import { traces } from '../db/schema.js';
import type { DocumentService } from '../documents/service.js';
import type { ChatTurn, Llm } from '../llm/llm.js';
import { ANSWER_SYSTEM_PROMPT } from '../llm/prompts.js';
import type { Metrics } from '../observability/metrics.js';
import type { RetrievedChunk, Retriever } from '../retrieval/search.js';
import { buildMessages, renderContext, selectWithinBudget, type JobContext } from './context.js';
import { checkCitations, detectInjection, validateQuestion } from './guardrails.js';
import { resolveScope, type ResolvedScope } from './scope.js';

export class NoResumeError extends Error {}

export interface ChatRequest {
  question: string;
  history: ChatTurn[];
  pinnedJobs: number[];
  signal?: AbortSignal;
}

export interface SourceView {
  label: string;
  documentKind: 'resume' | 'job';
  jobNumber: number | null;
  documentTitle: string;
  section: string;
  content: string;
}

export interface ChatEvents {
  onStart(meta: {
    traceId: string;
    scope: ResolvedScope;
    sources: SourceView[];
    flags: string[];
  }): void;
  onDelta(text: string): void;
  onDone(result: { cited: string[]; unknownCitations: string[]; flags: string[] }): void;
}

export interface ChatServiceOptions {
  maxQuestionChars: number;
  contextCharBudget: number;
}

const RESUME_CHUNKS = 6;
const SINGLE_JOB_CHUNKS = 6;
const MULTI_JOB_CHUNKS = 3;

export class ChatService {
  constructor(
    private readonly db: Db,
    private readonly documents: DocumentService,
    private readonly retriever: Retriever,
    private readonly fits: FitService,
    private readonly llm: Llm,
    private readonly metrics: Metrics,
    private readonly options: ChatServiceOptions,
  ) {}

  async answer(request: ChatRequest, events: ChatEvents): Promise<void> {
    const started = performance.now();
    const question = validateQuestion(request.question, this.options.maxQuestionChars);
    const resume = await this.documents.getResume();
    if (!resume) throw new NoResumeError('Upload your resume before asking questions.');

    const jobs = await this.documents.listJobs();
    const scope = resolveScope(
      question,
      jobs.map((j) => ({ id: j.id, number: j.number!, title: j.title, company: j.company })),
      request.pinnedJobs,
    );

    const flags: string[] = [];
    if (detectInjection(question)) flags.push('possible_prompt_injection');
    if (scope.unknownNumbers.length) flags.push('unknown_job_reference');
    if (!jobs.length) flags.push('no_jobs');

    const retrievalStart = performance.now();
    const retrieved = await this.retriever.search(question, {
      documentIds: [resume.id, ...scope.jobs.map((j) => j.id)],
      resumeLimit: RESUME_CHUNKS,
      perJobLimit: scope.jobs.length <= 1 ? SINGLE_JOB_CHUNKS : MULTI_JOB_CHUNKS,
    });
    this.metrics.retrievalDuration.observe((performance.now() - retrievalStart) / 1000);
    const sources = selectWithinBudget(retrieved, this.options.contextCharBudget);

    const jobContexts: JobContext[] = await Promise.all(
      jobs
        .filter((j) => scope.jobs.some((s) => s.id === j.id))
        .map(async (j) => ({
          number: j.number!,
          profile: j.profile,
          fit: await this.fits.fit(resume, j),
        })),
    );

    const [trace] = await this.db
      .insert(traces)
      .values({
        question,
        scope: scope.jobs.map((j) => j.number),
        retrieved: sources.map(toTrace),
        flags,
        model: this.llm.model,
      })
      .returning({ id: traces.id });

    events.onStart({ traceId: trace!.id, scope, sources: sources.map(toView), flags });

    let firstTokenMs: number | null = null;
    const context = renderContext(resume.profile, jobContexts, sources);
    const result = await this.llm.streamAnswer(
      {
        system: ANSWER_SYSTEM_PROMPT,
        messages: buildMessages(request.history, context, question),
        signal: request.signal,
      },
      (delta) => {
        if (firstTokenMs === null) {
          firstTokenMs = Math.round(performance.now() - started);
          this.metrics.chatFirstToken.observe(firstTokenMs / 1000);
        }
        events.onDelta(delta);
      },
    );

    const citations = checkCitations(
      result.text,
      sources.map((s) => s.label),
    );
    if (citations.unknown.length) flags.push('unknown_citation');
    if (!citations.cited.length && sources.length) flags.push('no_citations');
    if (result.refused) flags.push('refused');

    for (const flag of flags) this.metrics.guardrailFlags.inc({ flag });
    if (result.inputTokens) this.metrics.llmTokens.inc({ direction: 'input' }, result.inputTokens);
    if (result.outputTokens)
      this.metrics.llmTokens.inc({ direction: 'output' }, result.outputTokens);
    this.metrics.chatRequests.inc({ outcome: result.refused ? 'refused' : 'ok' });

    await this.db
      .update(traces)
      .set({
        answer: result.text,
        flags,
        model: result.model,
        latencyMs: Math.round(performance.now() - started),
        firstTokenMs,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      })
      .where(eq(traces.id, trace!.id));

    events.onDone({ cited: citations.cited, unknownCitations: citations.unknown, flags });
  }
}

function toTrace(s: RetrievedChunk) {
  return {
    label: s.label,
    chunkId: s.chunkId,
    section: s.section,
    score: s.score,
    vectorRank: s.vectorRank,
    keywordRank: s.keywordRank,
  };
}

function toView(s: RetrievedChunk): SourceView {
  return {
    label: s.label,
    documentKind: s.documentKind,
    jobNumber: s.jobNumber,
    documentTitle: s.documentTitle,
    section: s.section,
    content: s.content,
  };
}
