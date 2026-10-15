import { describe, expect, it } from 'vitest';
import { computeFit, matchSkills } from '../src/analysis/fit.js';
import { dedupeSkills, normalizeSkill } from '../src/analysis/skills.js';
import type { JobProfile, ResumeProfile } from '../src/domain/profiles.js';
import type { Embedder } from '../src/embeddings/embedder.js';
import { FakeEmbedder } from '../src/embeddings/fake.js';

const resume: ResumeProfile = {
  name: 'Alex',
  headline: 'Engineer',
  totalYearsExperience: 6,
  skills: ['TypeScript', 'Node.js', 'Postgres', 'React.js', 'AWS'].map((name) => ({
    name,
    years: null,
  })),
  roles: [],
  education: [],
};

const job: JobProfile = {
  title: 'Platform Engineer',
  company: 'Northwind',
  seniority: 'senior',
  minYearsExperience: 8,
  mustHaveSkills: ['TypeScript', 'NodeJS', 'PostgreSQL', 'Kubernetes'],
  niceToHaveSkills: ['ReactJS', 'Kafka'],
  responsibilities: [],
  summary: '',
};

describe('normalizeSkill', () => {
  it.each([
    ['Node.js', 'nodejs'],
    ['NodeJS', 'nodejs'],
    ['Postgres', 'postgresql'],
    ['k8s', 'kubernetes'],
    ['React.js', 'react'],
    ['CI/CD', 'cicd'],
    ['C#', 'c#'],
    ['Amazon Web Services (AWS)', 'aws'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSkill(input)).toBe(expected);
  });

  it('dedupes aliases keeping first spelling', () => {
    expect(dedupeSkills(['Postgres', 'PostgreSQL', 'JS', 'JavaScript'])).toEqual([
      'Postgres',
      'JS',
    ]);
  });
});

describe('computeFit', () => {
  it('scores exact matches, missing skills and experience', async () => {
    const fit = await computeFit(resume, job, new FakeEmbedder());
    expect(fit.mustHave.map((m) => [m.skill, m.kind])).toEqual([
      ['TypeScript', 'exact'],
      ['NodeJS', 'exact'],
      ['PostgreSQL', 'exact'],
      ['Kubernetes', 'missing'],
    ]);
    expect(fit.niceToHave.find((m) => m.skill === 'ReactJS')?.kind).toBe('exact');
    expect(fit.experience).toEqual({ candidateYears: 6, requiredYears: 8, meets: false });
    expect(fit.breakdown.mustHave).toBe(0.75);
    expect(fit.score).toBe(Math.round(100 * (0.6 * 0.75 + 0.2 * 0.5 + 0.2 * 0.75)));
    expect(fit.verdict).toBe('moderate');
  });

  it('treats a job without requirements as full coverage', async () => {
    const empty = { ...job, mustHaveSkills: [], niceToHaveSkills: [], minYearsExperience: null };
    expect((await computeFit(resume, empty, new FakeEmbedder())).score).toBe(100);
  });

  it('marks semantically close skills as related at half credit', async () => {
    const embedder: Embedder = {
      dimensions: 2,
      embed: async (texts) => texts.map((t) => (/amazon|aws/i.test(t) ? [1, 0] : [0, 1])),
    };
    const matches = await matchSkills(['Amazon EC2'], ['AWS'], embedder);
    expect(matches[0]).toMatchObject({ kind: 'related', matchedWith: 'AWS' });
  });
});
