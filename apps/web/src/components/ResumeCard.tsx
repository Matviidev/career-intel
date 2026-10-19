import { RefreshCw, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useDeleteResume, useUploadResume } from '../hooks/queries';
import type { Resume } from '../lib/types';
import { IconButton, Spinner } from './ui';
import { UploadZone } from './UploadZone';

const VISIBLE_SKILLS = 12;

export function ResumeCard({ resume }: { resume: Resume | null | undefined }) {
  const upload = useUploadResume();
  const remove = useDeleteResume();
  const replaceRef = useRef<HTMLInputElement>(null);

  if (!resume || upload.isPending) {
    return (
      <UploadZone
        title="Upload your resume"
        hint="PDF, DOCX, TXT or Markdown · up to 5 MB"
        pastePlaceholder="Paste your resume text…"
        onSubmit={(input) => upload.mutate(input)}
        pending={upload.isPending}
        error={upload.error?.message}
      />
    );
  }

  const { profile } = resume;
  const extra = profile.skills.length - VISIBLE_SKILLS;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent font-serif text-lg text-accent-ink">
          {(profile.name || 'You').slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{profile.name || 'Your resume'}</p>
          <p className="truncate text-xs text-muted">{profile.headline}</p>
          <p className="mt-0.5 text-xs text-muted">
            {profile.totalYearsExperience} yrs experience
            {profile.roles.length > 0 && ` · ${profile.roles.length} roles`}
          </p>
        </div>
        <div className="-mr-1 flex">
          <IconButton label="Replace resume" onClick={() => replaceRef.current?.click()}>
            <RefreshCw className="size-3.5" />
          </IconButton>
          <IconButton
            label="Remove resume"
            disabled={remove.isPending}
            onClick={() => confirm('Remove your resume?') && remove.mutate()}
          >
            {remove.isPending ? <Spinner /> : <Trash2 className="size-3.5" />}
          </IconButton>
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-1" aria-label="Skills">
        {profile.skills.slice(0, VISIBLE_SKILLS).map((s) => (
          <li key={s.name} className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px]">
            {s.name}
          </li>
        ))}
        {extra > 0 && <li className="px-1 py-0.5 text-[11px] text-muted">+{extra} more</li>}
      </ul>
      <p className="mt-3 truncate font-mono text-[10px] text-muted">{resume.sourceName}</p>
      <input
        ref={replaceRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
