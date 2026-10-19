import clsx from 'clsx';
import { FileUp } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Button, ErrorNote, Spinner } from './ui';

const ACCEPT = '.pdf,.docx,.txt,.md';
const STEPS = ['Reading document…', 'Extracting skills and experience…', 'Indexing for search…'];

export function UploadZone({
  title,
  hint,
  pastePlaceholder,
  onSubmit,
  pending,
  error,
}: {
  title: string;
  hint: string;
  pastePlaceholder: string;
  onSubmit: (input: File | string) => void;
  pending: boolean;
  error?: string | null;
}) {
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pending) return setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    return () => clearInterval(timer);
  }, [pending]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onSubmit(file);
  };

  if (pending) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-5 text-sm"
        aria-live="polite"
      >
        <Spinner className="text-accent" />
        <span>{STEPS[step]}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mode === 'file' ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            'rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
            dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
          )}
        >
          <FileUp className="mx-auto mb-2 size-5 text-accent" aria-hidden />
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-xs text-muted">{hint}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button variant="primary" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
            <Button variant="ghost" onClick={() => setMode('paste')}>
              Paste text
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSubmit(file);
              e.target.value = '';
            }}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={pastePlaceholder}
            rows={8}
            autoFocus
            className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMode('file')}>
              Upload instead
            </Button>
            <Button
              variant="primary"
              disabled={text.trim().length < 50}
              onClick={() => onSubmit(text)}
            >
              Analyse
            </Button>
          </div>
        </div>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
