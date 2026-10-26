import clsx from 'clsx';
import { Check, ChevronDown, MessageSquareText, Minus, X } from 'lucide-react';
import { useState } from 'react';
import { useJob } from '../hooks/queries';
import type { FitReport, SkillMatch } from '../lib/types';
import { ScoreRing } from './ScoreRing';
import { Button, ErrorNote, JobBadge, SectionLabel, Spinner } from './ui';

const VERDICT_COPY = {
  strong: 'Strong fit — you cover most of what they ask for.',
  moderate: 'Moderate fit — a few gaps worth addressing.',
  stretch: 'Stretch role — significant gaps against the must-haves.',
};

const KIND_STYLE: Record<SkillMatch['kind'], string> = {
  exact: 'bg-match-soft text-match',
  related: 'bg-partial-soft text-partial',
  missing: 'bg-miss-soft text-miss',
};

const KIND_ICON = { exact: Check, related: Minus, missing: X };

function SkillChips({ matches }: { matches: SkillMatch[] }) {
  if (!matches.length) return <p className="text-xs text-muted">None listed in the posting.</p>;
  const order = { missing: 0, related: 1, exact: 2 };
  return (
    <ul className="flex flex-wrap gap-1.5">
      {[...matches]
        .sort((a, b) => order[a.kind] - order[b.kind])
        .map((m) => {
          const Icon = KIND_ICON[m.kind];
          const title =
            m.kind === 'related'
              ? `Closest on your resume: ${m.matchedWith} (similarity ${m.similarity})`
              : m.kind === 'exact'
                ? `On your resume as ${m.matchedWith}`
                : 'Not found on your resume';
          return (
            <li
              key={m.skill}
              title={title}
              className={clsx(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
                KIND_STYLE[m.kind],
              )}
            >
              <Icon className="size-3" aria-hidden />
              {m.skill}
              {m.kind === 'related' && (
                <span className="font-normal opacity-75">≈ {m.matchedWith}</span>
              )}
            </li>
          );
        })}
    </ul>
  );
}

function Bar({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>
          {label} <span className="text-muted">· {weight}</span>
        </span>
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-700"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

function Report({ fit }: { fit: FitReport }) {
  const { experience: exp } = fit;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <ScoreRing score={fit.score} verdict={fit.verdict} size={72} stroke={6} />
        <p className="text-sm leading-snug">{VERDICT_COPY[fit.verdict]}</p>
      </div>
      <div className="space-y-3">
        <Bar label="Must-have skills" value={fit.breakdown.mustHave} weight="60%" />
        <Bar label="Nice-to-have skills" value={fit.breakdown.niceToHave} weight="20%" />
        <Bar label="Experience" value={fit.breakdown.experience} weight="20%" />
      </div>
      <div>
        <SectionLabel>Must-have</SectionLabel>
        <SkillChips matches={fit.mustHave} />
      </div>
      <div>
        <SectionLabel>Nice-to-have</SectionLabel>
        <SkillChips matches={fit.niceToHave} />
      </div>
      <div>
        <SectionLabel>Experience</SectionLabel>
        <p className="text-sm">
          You have <strong>{exp.candidateYears} years</strong>
          {exp.requiredYears ? (
            <>
              {' '}
              vs <strong>{exp.requiredYears}+</strong> required{' '}
              <span className={exp.meets ? 'text-match' : 'text-miss'}>
                {exp.meets ? '— meets it' : '— below it'}
              </span>
            </>
          ) : (
            ' — the posting does not state a minimum.'
          )}
        </p>
      </div>
      <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
        Scores are computed by the app, not the LLM: exact skill matches count fully, semantically
        related skills (≈) count half. Claude only extracts the skills.
      </p>
    </div>
  );
}

export function FitReportPanel({
  jobId,
  pinned,
  onAsk,
}: {
  jobId: string | null;
  pinned: boolean;
  onAsk: (jobNumber: number) => void;
}) {
  const { data, isLoading, error } = useJob(jobId);
  const [showPosting, setShowPosting] = useState(false);

  if (!jobId) {
    return (
      <div className="px-1 py-10 text-center text-sm text-muted">
        Select a saved role to see how your resume stacks up against it.
      </div>
    );
  }
  if (isLoading) return <Spinner className="mx-auto mt-10 text-accent" />;
  if (error || !data) return <ErrorNote>{error?.message ?? 'Could not load this job.'}</ErrorNote>;

  const { job, fit } = data;
  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <JobBadge number={job.number} />
          {job.profile.seniority !== 'unknown' && (
            <span className="text-xs text-muted capitalize">{job.profile.seniority}</span>
          )}
        </div>
        <h2 className="mt-2 text-2xl leading-tight font-semibold tracking-tight">{job.title}</h2>
        <p className="text-sm text-muted">{job.company ?? 'Company not stated'}</p>
        {job.profile.summary && (
          <p className="mt-2 text-sm leading-relaxed">{job.profile.summary}</p>
        )}
        <Button
          variant={pinned ? 'outline' : 'primary'}
          className="mt-3"
          onClick={() => onAsk(job.number)}
        >
          <MessageSquareText className="size-4" />
          {pinned ? 'Chat is scoped to this role' : 'Focus chat on this role'}
        </Button>
      </header>
      {fit ? (
        <Report fit={fit} />
      ) : (
        <p className="text-sm text-muted">Upload your resume to score this role.</p>
      )}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          onClick={() => setShowPosting((v) => !v)}
          aria-expanded={showPosting}
        >
          <ChevronDown
            className={clsx('size-3.5 transition-transform', showPosting && 'rotate-180')}
          />
          Original posting
        </button>
        {showPosting && (
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-sunken p-3 text-xs leading-relaxed whitespace-pre-wrap">
            {job.content}
          </pre>
        )}
      </div>
    </div>
  );
}
