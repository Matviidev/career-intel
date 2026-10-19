import clsx from 'clsx';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useAddJob, useDeleteJob } from '../hooks/queries';
import type { Job } from '../lib/types';
import { ScoreRing } from './ScoreRing';
import { Button, IconButton, JobBadge, SectionLabel } from './ui';
import { UploadZone } from './UploadZone';

export function JobList({
  jobs,
  selectedId,
  onSelect,
}: {
  jobs: Job[];
  selectedId: string | null;
  onSelect: (job: Job | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const add = useAddJob();
  const remove = useDeleteJob();

  return (
    <section>
      <SectionLabel
        action={
          !adding && (
            <Button
              variant="ghost"
              className="-mr-2 h-7 px-2 text-xs"
              onClick={() => setAdding(true)}
            >
              <Plus className="size-3.5" /> Add role
            </Button>
          )
        }
      >
        Saved roles · {jobs.length}
      </SectionLabel>

      {(adding || add.isPending) && (
        <div className="relative mb-3">
          {!add.isPending && (
            <IconButton
              label="Cancel"
              className="absolute top-1 right-1 z-10"
              onClick={() => setAdding(false)}
            >
              <X className="size-3.5" />
            </IconButton>
          )}
          <UploadZone
            title="Add a job posting"
            hint="Upload or paste the full description"
            pastePlaceholder="Paste the job description…"
            pending={add.isPending}
            error={add.error?.message}
            onSubmit={(input) =>
              add.mutate(input, {
                onSuccess: ({ job }) => {
                  setAdding(false);
                  onSelect(job);
                },
              })
            }
          />
        </div>
      )}

      {!jobs.length && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-line px-4 py-5 text-left text-sm text-muted hover:border-accent hover:text-ink"
        >
          Add the job postings you're considering. Each one gets a number so you can ask about "Job
          #2".
        </button>
      )}

      <ul className="space-y-1">
        {jobs.map((job) => (
          <li key={job.id}>
            <div
              className={clsx(
                'group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                selectedId === job.id
                  ? 'border-accent/40 bg-accent-soft'
                  : 'border-transparent hover:border-line hover:bg-surface',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => onSelect(selectedId === job.id ? null : job)}
                aria-pressed={selectedId === job.id}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <JobBadge number={job.number} />
                    <span className="truncate text-sm font-medium">{job.title}</span>
                  </div>
                  <p className="mt-0.5 truncate pl-9 text-xs text-muted">
                    {[
                      job.company ?? 'Company not stated',
                      job.profile.seniority !== 'unknown' && job.profile.seniority,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {job.fit && (
                  <ScoreRing
                    score={job.fit.score}
                    verdict={job.fit.verdict}
                    size={34}
                    stroke={3.5}
                  />
                )}
              </button>
              <IconButton
                label={`Delete job #${job.number}`}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={() => {
                  if (!confirm(`Delete Job #${job.number}?`)) return;
                  remove.mutate(job.id);
                  if (selectedId === job.id) onSelect(null);
                }}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
