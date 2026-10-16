export class QuestionRejectedError extends Error {}

const INJECTION_PATTERNS = [
  /ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)/i,
  /disregard (the |your )?(system|previous) (prompt|instructions)/i,
  /(reveal|print|show|repeat) (me )?(your|the) (system )?(prompt|instructions)/i,
  /you are now (a|an|in) /i,
  /\bjailbreak\b|\bDAN mode\b|developer mode/i,
  /<\/?(system|sources|source)\b/i,
];

export function validateQuestion(raw: string, maxChars: number): string {
  const question = raw.replace(/\s+/g, ' ').trim();
  if (!question) throw new QuestionRejectedError('Question is empty.');
  if (question.length > maxChars) {
    throw new QuestionRejectedError(`Question is too long (max ${maxChars} characters).`);
  }
  return question;
}

export function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

export function extractCitations(answer: string): string[] {
  const labels = new Set<string>();
  for (const group of answer.matchAll(/\[((?:R\d+|J\d+\.\d+)(?:\s*,\s*(?:R\d+|J\d+\.\d+))*)\]/g)) {
    for (const label of group[1]!.split(/\s*,\s*/)) labels.add(label);
  }
  return [...labels];
}

export function checkCitations(
  answer: string,
  allowed: string[],
): { cited: string[]; unknown: string[] } {
  const allowedSet = new Set(allowed);
  const cited = extractCitations(answer);
  return {
    cited: cited.filter((c) => allowedSet.has(c)),
    unknown: cited.filter((c) => !allowedSet.has(c)),
  };
}

export function sanitizeSource(text: string): string {
  return text.replace(/<\/?(source|sources|system)\b[^>]*>/gi, '');
}
