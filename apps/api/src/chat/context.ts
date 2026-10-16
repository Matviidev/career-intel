import type { FitReport, SkillMatch } from '../analysis/fit.js';
import type { JobProfile, ResumeProfile } from '../domain/profiles.js';
import type { ChatTurn } from '../llm/llm.js';
import type { RetrievedChunk } from '../retrieval/search.js';
import { sanitizeSource } from './guardrails.js';

export const MAX_HISTORY_TURNS = 6;
export const MAX_HISTORY_CHARS = 2000;

export interface JobContext {
  number: number;
  profile: JobProfile;
  fit: FitReport | null;
}

function list(matches: SkillMatch[], kind: SkillMatch['kind']): string {
  const items = matches
    .filter((m) => m.kind === kind)
    .map((m) => (kind === 'related' ? `${m.skill} (closest: ${m.matchedWith})` : m.skill));
  return items.length ? items.join(', ') : 'none';
}

export function describeFit(fit: FitReport): string {
  const exp = fit.experience;
  return [
    `Fit score: ${fit.score}/100 (${fit.verdict}).`,
    `Must-have matched: ${list(fit.mustHave, 'exact')}. Partially matched: ${list(fit.mustHave, 'related')}. Missing: ${list(fit.mustHave, 'missing')}.`,
    `Nice-to-have matched: ${list(fit.niceToHave, 'exact')}. Missing: ${list(fit.niceToHave, 'missing')}.`,
    `Experience: candidate ${exp.candidateYears} years vs ${exp.requiredYears ?? 'unstated'} required.`,
  ].join('\n');
}

export function describeResume(profile: ResumeProfile): string {
  const roles = profile.roles
    .map((r) => `${r.title} at ${r.company} (${r.start} – ${r.end})`)
    .join('; ');
  return [
    `Name: ${profile.name || 'unknown'}. Headline: ${profile.headline}.`,
    `Total experience: ${profile.totalYearsExperience} years.`,
    `Skills: ${profile.skills.map((s) => (s.years ? `${s.name} (${s.years}y)` : s.name)).join(', ')}.`,
    roles && `Roles: ${roles}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function describeJob(job: JobContext): string {
  const p = job.profile;
  return [
    `Job #${job.number}: ${p.title}${p.company ? ` at ${p.company}` : ''} (${p.seniority}).`,
    p.summary && `Summary: ${p.summary}`,
    `Must-have: ${p.mustHaveSkills.join(', ') || 'none listed'}.`,
    `Nice-to-have: ${p.niceToHaveSkills.join(', ') || 'none listed'}.`,
    job.fit && describeFit(job.fit),
  ]
    .filter(Boolean)
    .join('\n');
}

export function selectWithinBudget(sources: RetrievedChunk[], budget: number): RetrievedChunk[] {
  const out: RetrievedChunk[] = [];
  let used = 0;
  for (const s of sources) {
    if (used + s.content.length > budget) continue;
    out.push(s);
    used += s.content.length;
  }
  return out;
}

export function renderContext(
  resume: ResumeProfile,
  jobs: JobContext[],
  sources: RetrievedChunk[],
): string {
  const sourceBlocks = sources.map(
    (s) =>
      `<source id="${s.label}" document="${s.documentKind === 'resume' ? 'Resume' : `Job #${s.jobNumber}`}" section="${s.section}">\n${sanitizeSource(s.content)}\n</source>`,
  );
  return [
    '<sources>',
    `<candidate_profile>\n${describeResume(resume)}\n</candidate_profile>`,
    ...jobs.map((j) => `<job_profile number="${j.number}">\n${describeJob(j)}\n</job_profile>`),
    ...sourceBlocks,
    '</sources>',
  ].join('\n');
}

export function buildMessages(history: ChatTurn[], context: string, question: string): ChatTurn[] {
  const trimmed = history
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_HISTORY_CHARS) }));
  while (trimmed[0]?.role === 'assistant') trimmed.shift();
  return [...trimmed, { role: 'user', content: `${context}\n\nQuestion: ${question}` }];
}
