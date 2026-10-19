export interface ResumeProfile {
  name: string;
  headline: string;
  totalYearsExperience: number;
  skills: { name: string; years: number | null }[];
  roles: { title: string; company: string; start: string; end: string; highlights: string[] }[];
  education: string[];
}

export interface JobProfile {
  title: string;
  company: string;
  seniority: string;
  minYearsExperience: number | null;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  responsibilities: string[];
  summary: string;
}

export interface DocumentSummary<P> {
  id: string;
  kind: 'resume' | 'job';
  number: number | null;
  title: string;
  company: string | null;
  sourceName: string;
  profile: P;
  createdAt: string;
}

export type Resume = DocumentSummary<ResumeProfile>;

export interface Job extends DocumentSummary<JobProfile> {
  number: number;
  fit: { score: number; verdict: Verdict } | null;
}

export type Verdict = 'strong' | 'moderate' | 'stretch';

export interface SkillMatch {
  skill: string;
  kind: 'exact' | 'related' | 'missing';
  matchedWith: string | null;
  similarity: number | null;
}

export interface FitReport {
  score: number;
  verdict: Verdict;
  mustHave: SkillMatch[];
  niceToHave: SkillMatch[];
  experience: { candidateYears: number; requiredYears: number | null; meets: boolean };
  breakdown: { mustHave: number; niceToHave: number; experience: number };
}

export interface JobDetail {
  job: Job & { content: string };
  fit: FitReport | null;
}

export interface Source {
  label: string;
  documentKind: 'resume' | 'job';
  jobNumber: number | null;
  documentTitle: string;
  section: string;
  content: string;
}

export interface ChatMeta {
  traceId: string;
  scope: { reason: 'pinned' | 'mentioned' | 'all'; jobs: number[]; unknown: number[] };
  sources: Source[];
  flags: string[];
}

export interface ChatDone {
  cited: string[];
  unknownCitations: string[];
  flags: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'streaming' | 'done' | 'error';
  meta?: ChatMeta;
  done?: ChatDone;
  error?: string;
  feedback?: 1 | -1;
}

export interface Trace {
  id: string;
  question: string;
  scope: number[];
  retrieved: {
    label: string;
    section: string;
    score: number;
    vectorRank: number | null;
    keywordRank: number | null;
  }[];
  flags: string[];
  model: string;
  latencyMs: number | null;
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  feedback: number | null;
  createdAt: string;
}
