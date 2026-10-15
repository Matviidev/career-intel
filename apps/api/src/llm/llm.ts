import type { JobProfile, ResumeProfile } from '../domain/profiles.js';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnswerRequest {
  system: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
}

export interface AnswerResult {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  refused: boolean;
}

export interface Llm {
  readonly model: string;
  extractResume(text: string): Promise<ResumeProfile>;
  extractJob(text: string): Promise<JobProfile>;
  streamAnswer(request: AnswerRequest, onDelta: (text: string) => void): Promise<AnswerResult>;
}

export class ExtractionError extends Error {}
