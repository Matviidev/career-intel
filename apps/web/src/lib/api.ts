import type { ChatDone, ChatMeta, Job, JobDetail, Resume, Trace } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) throw await toError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

async function toError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  return new ApiError(body.message ?? `Request failed (${res.status})`, res.status, body.error);
}

function upload(input: File | string): RequestInit {
  if (typeof input === 'string') {
    return {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: input }),
    };
  }
  const form = new FormData();
  form.append('file', input);
  return { method: 'POST', body: form };
}

export const api = {
  resume: () => request<{ resume: Resume | null }>('/resume').then((r) => r.resume),
  uploadResume: (input: File | string) => request<{ resume: Resume }>('/resume', upload(input)),
  deleteResume: () => request<void>('/resume', { method: 'DELETE' }),
  jobs: () => request<{ jobs: Job[] }>('/jobs').then((r) => r.jobs),
  job: (id: string) => request<JobDetail>(`/jobs/${id}`),
  addJob: (input: File | string) => request<{ job: Job }>('/jobs', upload(input)),
  deleteJob: (id: string) => request<void>(`/jobs/${id}`, { method: 'DELETE' }),
  trace: (id: string) => request<{ trace: Trace }>(`/traces/${id}`).then((r) => r.trace),
  feedback: (id: string, value: 1 | -1) =>
    request<void>(`/traces/${id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    }),
};

export interface StreamHandlers {
  onMeta(meta: ChatMeta): void;
  onDelta(text: string): void;
  onDone(done: ChatDone): void;
  onError(message: string): void;
}

export interface ChatPayload {
  question: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  pinnedJobs: number[];
}

export async function streamChat(
  payload: ChatPayload,
  handlers: StreamHandlers,
  signal: AbortSignal,
) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) throw await toError(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      dispatch(buffer.slice(0, boundary), handlers);
      buffer = buffer.slice(boundary + 2);
    }
  }
}

export function dispatch(block: string, handlers: StreamHandlers) {
  const event = /^event: (.+)$/m.exec(block)?.[1];
  const raw = /^data: (.+)$/m.exec(block)?.[1];
  if (!event || !raw) return;
  const data = JSON.parse(raw);
  if (event === 'meta') handlers.onMeta(data);
  else if (event === 'delta') handlers.onDelta(data.text);
  else if (event === 'done') handlers.onDone(data);
  else if (event === 'error') handlers.onError(data.message);
}
