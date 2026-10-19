import clsx from 'clsx';
import type { Verdict } from '../lib/types';

const TONE: Record<Verdict, string> = {
  strong: 'text-match',
  moderate: 'text-partial',
  stretch: 'text-miss',
};

export function ScoreRing({
  score,
  verdict,
  size = 40,
  stroke = 4,
}: {
  score: number;
  verdict: Verdict;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      className={clsx('relative shrink-0', TONE[verdict])}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Fit score ${score} out of 100, ${verdict}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <span
        className="absolute inset-0 grid place-items-center font-semibold tabular-nums text-ink"
        style={{ fontSize: size * 0.3 }}
      >
        {score}
      </span>
    </div>
  );
}
