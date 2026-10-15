export interface JobRef {
  id: string;
  number: number;
  title: string;
  company: string | null;
}

export interface ResolvedScope {
  jobs: JobRef[];
  reason: 'pinned' | 'mentioned' | 'all';
  unknownNumbers: number[];
}

const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

const STOP_TITLES = new Set(['engineer', 'developer', 'manager', 'senior', 'job', 'role']);

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function mentionedNumbers(question: string, maxNumber: number): number[] {
  const found = new Set<number>();
  for (const m of question.matchAll(
    /\b(?:job|role|posting|position)s?\s*(?:#|no\.?|number)?\s*(\d{1,3})\b/gi,
  )) {
    found.add(Number(m[1]));
  }
  for (const m of question.matchAll(/(?:^|\s|\(|,)#(\d{1,3})\b/g)) found.add(Number(m[1]));
  for (const m of question.matchAll(/\b(?:and|&|or|vs\.?|versus)\s*#?(\d{1,3})\b/gi)) {
    if (found.size) found.add(Number(m[1]));
  }
  for (const m of question.matchAll(
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|latest)\s+(?:job|role|posting|position|one)\b/gi,
  )) {
    const word = m[1]!.toLowerCase();
    found.add(word === 'last' || word === 'latest' ? maxNumber : ORDINALS[word]!);
  }
  return [...found].sort((a, b) => a - b);
}

function mentionsJob(question: string, job: JobRef): boolean {
  const q = question.toLowerCase();
  const company = job.company?.trim().toLowerCase();
  if (company && company.length >= 3 && new RegExp(`\\b${escape(company)}\\b`).test(q)) return true;
  const title = job.title.trim().toLowerCase();
  return title.length >= 6 && !STOP_TITLES.has(title) && q.includes(title);
}

export function resolveScope(
  question: string,
  jobs: JobRef[],
  pinned: number[] = [],
): ResolvedScope {
  const byNumber = new Map(jobs.map((j) => [j.number, j]));
  const maxNumber = Math.max(0, ...jobs.map((j) => j.number));

  const select = (numbers: number[], reason: ResolvedScope['reason']): ResolvedScope => ({
    jobs: numbers.flatMap((n) => byNumber.get(n) ?? []),
    reason,
    unknownNumbers: numbers.filter((n) => !byNumber.has(n)),
  });

  if (pinned.length) return select(pinned, 'pinned');

  const numbers = mentionedNumbers(question, maxNumber);
  const named = jobs.filter((j) => mentionsJob(question, j)).map((j) => j.number);
  const mentioned = [...new Set([...numbers, ...named])].sort((a, b) => a - b);
  if (mentioned.length) return select(mentioned, 'mentioned');

  return { jobs, reason: 'all', unknownNumbers: [] };
}
