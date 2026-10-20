import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../lib/types';

export function SourcesPanel({
  message,
  highlight,
}: {
  message: ChatMessage | undefined;
  highlight: string | null;
}) {
  const refs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    if (highlight)
      refs.current.get(highlight)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlight, message?.id]);

  if (!message?.meta) {
    return (
      <div className="px-1 py-10 text-center text-sm text-muted">
        Ask a question to see which parts of your resume and job postings the answer was built from.
      </div>
    );
  }

  const cited = new Set(message.done?.cited ?? []);
  const sources = [...message.meta.sources].sort(
    (a, b) => Number(cited.has(b.label)) - Number(cited.has(a.label)),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        {message.meta.sources.length} passages retrieved · {cited.size} cited in the answer
      </p>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li
            key={s.label}
            ref={(el) => {
              if (el) refs.current.set(s.label, el);
            }}
            className={clsx(
              'rounded-xl border p-3 transition-colors',
              highlight === s.label ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
              !cited.has(s.label) && highlight !== s.label && 'opacity-70',
            )}
          >
            <div className="mb-1.5 flex items-center gap-2 text-xs">
              <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-ink">
                {s.label}
              </span>
              <span className="truncate font-medium">
                {s.documentKind === 'resume' ? 'Resume' : `Job #${s.jobNumber}`} · {s.section}
              </span>
              {cited.has(s.label) && <span className="ml-auto text-[10px] text-match">cited</span>}
            </div>
            <p className="line-clamp-6 text-xs leading-relaxed whitespace-pre-line text-ink/85">
              {s.content}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
