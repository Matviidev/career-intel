import type { JobProfile, ResumeProfile } from '../domain/profiles.js';
import { cosine, type Embedder } from '../embeddings/embedder.js';
import { dedupeSkills, normalizeSkill } from './skills.js';

export const RELATED_THRESHOLD = 0.82;

const WEIGHTS = { mustHave: 0.6, niceToHave: 0.2, experience: 0.2 };

export type MatchKind = 'exact' | 'related' | 'missing';

export interface SkillMatch {
  skill: string;
  kind: MatchKind;
  matchedWith: string | null;
  similarity: number | null;
}

export interface FitReport {
  score: number;
  verdict: 'strong' | 'moderate' | 'stretch';
  mustHave: SkillMatch[];
  niceToHave: SkillMatch[];
  experience: { candidateYears: number; requiredYears: number | null; meets: boolean };
  breakdown: { mustHave: number; niceToHave: number; experience: number };
}

function coverage(matches: SkillMatch[]): number {
  if (!matches.length) return 1;
  const points = matches.reduce(
    (sum, m) => sum + (m.kind === 'exact' ? 1 : m.kind === 'related' ? 0.5 : 0),
    0,
  );
  return points / matches.length;
}

export async function matchSkills(
  required: string[],
  candidate: string[],
  embedder: Embedder,
): Promise<SkillMatch[]> {
  const wanted = dedupeSkills(required);
  const have = dedupeSkills(candidate);
  const haveByKey = new Map(have.map((s) => [normalizeSkill(s), s]));

  const matches: SkillMatch[] = wanted.map((skill) => {
    const exact = haveByKey.get(normalizeSkill(skill));
    return exact
      ? { skill, kind: 'exact', matchedWith: exact, similarity: 1 }
      : { skill, kind: 'missing', matchedWith: null, similarity: null };
  });

  const unresolved = matches.filter((m) => m.kind === 'missing');
  if (!unresolved.length || !have.length) return matches;

  const [wantVecs, haveVecs] = await Promise.all([
    embedder.embed(
      unresolved.map((m) => m.skill),
      'passage',
    ),
    embedder.embed(have, 'passage'),
  ]);

  unresolved.forEach((m, i) => {
    let best = -1;
    let bestIdx = -1;
    haveVecs.forEach((v, j) => {
      const sim = cosine(wantVecs[i]!, v);
      if (sim > best) {
        best = sim;
        bestIdx = j;
      }
    });
    if (best >= RELATED_THRESHOLD) {
      m.kind = 'related';
      m.matchedWith = have[bestIdx]!;
      m.similarity = Math.round(best * 100) / 100;
    }
  });
  return matches;
}

export async function computeFit(
  resume: ResumeProfile,
  job: JobProfile,
  embedder: Embedder,
): Promise<FitReport> {
  const candidateSkills = resume.skills.map((s) => s.name);
  const [mustHave, niceToHave] = await Promise.all([
    matchSkills(job.mustHaveSkills, candidateSkills, embedder),
    matchSkills(job.niceToHaveSkills, candidateSkills, embedder),
  ]);

  const requiredYears = job.minYearsExperience;
  const candidateYears = resume.totalYearsExperience;
  const experience = requiredYears ? Math.min(1, candidateYears / requiredYears) : 1;

  const breakdown = {
    mustHave: coverage(mustHave),
    niceToHave: coverage(niceToHave),
    experience,
  };
  const score = Math.round(
    100 *
      (WEIGHTS.mustHave * breakdown.mustHave +
        WEIGHTS.niceToHave * breakdown.niceToHave +
        WEIGHTS.experience * breakdown.experience),
  );

  return {
    score,
    verdict: score >= 75 ? 'strong' : score >= 50 ? 'moderate' : 'stretch',
    mustHave,
    niceToHave,
    experience: { candidateYears, requiredYears, meets: experience >= 1 },
    breakdown,
  };
}
