import type { JobProfile, ResumeProfile } from '../domain/profiles.js';
import type { AnswerRequest, AnswerResult, Llm } from './llm.js';

const KNOWN_SKILLS = [
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'Java',
  'React',
  'Node.js',
  'PostgreSQL',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Terraform',
  'GraphQL',
  'Kafka',
  'NestJS',
  'Next.js',
  'CI/CD',
  'Machine Learning',
];

function findSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return KNOWN_SKILLS.filter((s) => {
    const escaped = s.toLowerCase().replace(/[.+/]/g, '\\$&');
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(lower);
  });
}

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .find((l) => l.trim())
      ?.trim() ?? ''
  );
}

export class FakeLlm implements Llm {
  readonly model = 'fake';

  async extractResume(text: string): Promise<ResumeProfile> {
    const years = Number(/(\d+)\+?\s+years/i.exec(text)?.[1] ?? 0);
    return {
      name: firstLine(text),
      headline: 'Software engineer',
      totalYearsExperience: years,
      skills: findSkills(text).map((name) => ({ name, years: null })),
      roles: [],
      education: [],
    };
  }

  async extractJob(text: string): Promise<JobProfile> {
    const [required = text, preferred = ''] = text.split(/nice to have|preferred|bonus/i);
    const must = findSkills(required);
    return {
      title: firstLine(text),
      company: /at ([A-Z][\w]+)/.exec(text)?.[1] ?? '',
      seniority: /senior/i.test(text) ? 'senior' : 'unknown',
      minYearsExperience: Number(/(\d+)\+?\s+years/i.exec(text)?.[1] ?? 0) || null,
      mustHaveSkills: must,
      niceToHaveSkills: findSkills(preferred).filter((s) => !must.includes(s)),
      responsibilities: [],
      summary: '',
    };
  }

  async streamAnswer(
    request: AnswerRequest,
    onDelta: (text: string) => void,
  ): Promise<AnswerResult> {
    const last = request.messages.at(-1)?.content ?? '';
    const ids = [...last.matchAll(/<source id="([^"]+)"/g)].map((m) => m[1]);
    const text = ids.length
      ? `Based on your documents, here is what I found [${ids[0]}].`
      : 'I could not find anything relevant in your documents.';
    for (const word of text.split(/(?<= )/)) onDelta(word);
    return {
      text,
      model: this.model,
      inputTokens: last.length,
      outputTokens: text.length,
      refused: false,
    };
  }
}
