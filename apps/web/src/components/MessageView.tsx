import clsx from 'clsx';
import { AlertTriangle, Check, Copy, FileSearch, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import type { ChatMessage } from '../lib/types';
import { Answer } from './Answer';
import { IconButton } from './ui';

const FLAG_COPY: Record<string, string> = {
  possible_prompt_injection:
    'Your question looked like an instruction override; documents were still treated as data.',
  unknown_job_reference: 'You referenced a job number that does not exist.',
  unknown_citation: 'The answer cites a source that was not retrieved — double-check that claim.',
  no_citations: 'The answer has no citations; treat it as general advice.',
  no_jobs: 'No job postings saved yet — answers are based on your resume only.',
  refused: 'The model declined to answer this request.',
};

function scopeLabel(message: ChatMessage): string | null {
  const scope = message.meta?.scope;
  if (!scope) return null;
  if (!scope.jobs.length) return 'Resume only';
  const jobs = scope.jobs.map((n) => `#${n}`).join(', ');
  return `Resume + Job${scope.jobs.length > 1 ? 's' : ''} ${jobs}${scope.reason === 'all' ? ' (all)' : ''}`;
}

export function MessageView({
  message,
  active,
  onCite,
  onShowSources,
  onRate,
}: {
  message: ChatMessage;
  active: boolean;
  onCite: (label: string) => void;
  onShowSources: () => void;
  onRate: (value: 1 | -1) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-ink whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    );
  }

  const known = new Set(message.meta?.sources.map((s) => s.label) ?? []);
  const flags = (message.done?.flags ?? message.meta?.flags ?? []).filter((f) => FLAG_COPY[f]);
  const streaming = message.status === 'streaming';

  return (
    <article
      className={clsx(
        'rounded-2xl border bg-surface px-5 py-4',
        active ? 'border-accent/40' : 'border-line',
      )}
    >
      {!message.content && streaming ? (
        <p className="text-sm text-muted">
          {message.meta
            ? `Reading ${message.meta.sources.length} passages…`
            : 'Retrieving from your documents…'}
        </p>
      ) : (
        <Answer content={message.content} streaming={streaming} known={known} onCite={onCite} />
      )}

      {message.error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-miss">
          <AlertTriangle className="size-4" /> {message.error}
        </p>
      )}

      {flags.length > 0 && !streaming && (
        <ul className="mt-3 space-y-1">
          {flags.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 rounded-lg bg-partial-soft px-3 py-1.5 text-xs text-partial"
            >
              <AlertTriangle className="mt-px size-3.5 shrink-0" /> {FLAG_COPY[f]}
            </li>
          ))}
        </ul>
      )}

      {message.meta && !streaming && (
        <footer className="mt-3 flex items-center gap-1 border-t border-line pt-2">
          <span className="mr-auto text-xs text-muted">{scopeLabel(message)}</span>
          <IconButton label="Show sources" onClick={onShowSources}>
            <FileSearch className="size-4" />
          </IconButton>
          <IconButton
            label="Copy answer"
            onClick={() => {
              void navigator.clipboard.writeText(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-4 text-match" /> : <Copy className="size-4" />}
          </IconButton>
          <IconButton
            label="Helpful"
            onClick={() => onRate(1)}
            className={clsx(message.feedback === 1 && 'text-match')}
          >
            <ThumbsUp className="size-4" />
          </IconButton>
          <IconButton
            label="Not helpful"
            onClick={() => onRate(-1)}
            className={clsx(message.feedback === -1 && 'text-miss')}
          >
            <ThumbsDown className="size-4" />
          </IconButton>
        </footer>
      )}
    </article>
  );
}
