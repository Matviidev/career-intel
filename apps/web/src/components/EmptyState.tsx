import clsx from 'clsx';
import { ArrowUpRight } from 'lucide-react';
import type { Job, Resume } from '../lib/types';

function suggestions(jobs: Job[]): string[] {
  const [a, b] = jobs;
  if (!a) {
    return [
      'What are the strongest parts of my resume?',
      'Which of my achievements should I lead with?',
      'What roles does my experience suit best?',
    ];
  }
  const second = b ?? a;
  return [
    `What skills am I missing for Job #${a.number}?`,
    `How does my experience align with Job #${second.number}?`,
    jobs.length > 1
      ? 'Which role am I the strongest fit for, and why?'
      : `What should I emphasise when applying to Job #${a.number}?`,
    `Give me 5 likely interview questions for Job #${a.number} and how to answer them from my experience.`,
  ];
}

function Step({ n, done, children }: { n: number; done: boolean; children: string }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={clsx(
          'grid size-6 place-items-center rounded-full text-xs',
          done ? 'bg-accent text-accent-ink' : 'border border-line text-muted',
        )}
      >
        {done ? '✓' : n}
      </span>
      <span className={done ? 'text-muted line-through' : ''}>{children}</span>
    </li>
  );
}

export function EmptyState({
  resume,
  jobs,
  onPick,
}: {
  resume: Resume | null | undefined;
  jobs: Job[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col justify-center py-10">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
        Career intelligence
      </p>
      <h1 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">
        Know exactly where you stand <em className="text-accent">before</em> you apply.
      </h1>
      <p className="mt-4 max-w-lg text-muted">
        Fitwise reads your resume and the roles you're eyeing, scores the fit, and answers questions
        with citations back to the exact lines it used.
      </p>

      {!resume ? (
        <ol className="mt-8 space-y-3 text-sm">
          <Step n={1} done={false}>
            Upload your resume in the sidebar
          </Step>
          <Step n={2} done={false}>
            Add one or more job postings
          </Step>
          <Step n={3} done={false}>
            Ask about fit, gaps and interview prep
          </Step>
        </ol>
      ) : (
        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {suggestions(jobs).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              className="group flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 text-left text-sm transition-colors hover:border-accent/50 hover:bg-accent-soft"
            >
              {q}
              <ArrowUpRight className="size-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
