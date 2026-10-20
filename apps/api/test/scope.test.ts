import { describe, expect, it } from 'vitest';
import { companyAliases, mentionedNumbers, resolveScope, type JobRef } from '../src/chat/scope.js';

const jobs: JobRef[] = [
  { id: 'a', number: 1, title: 'Staff Platform Engineer', company: 'Northwind' },
  { id: 'b', number: 2, title: 'Senior Full-Stack Engineer', company: 'Acme' },
  { id: 'c', number: 3, title: 'Data Engineer', company: null },
];

describe('mentionedNumbers', () => {
  it.each([
    ['How does my experience align with Job #2?', [2]],
    ['compare job 1 and 3', [1, 3]],
    ['What about #3', [3]],
    ['jobs #1 vs #2', [1, 2]],
    ['Prep me for the second role', [2]],
    ['what about the last job?', [3]],
    ['I have 5 years in React', []],
  ])('%s', (q, expected) => {
    expect(mentionedNumbers(q, 3)).toEqual(expected);
  });
});

describe('resolveScope', () => {
  it('uses pinned jobs first', () => {
    const scope = resolveScope('What about job 3?', jobs, [1]);
    expect(scope.reason).toBe('pinned');
    expect(scope.jobs.map((j) => j.number)).toEqual([1]);
  });

  it('matches company names', () => {
    expect(resolveScope('Am I a good fit for Acme?', jobs).jobs.map((j) => j.number)).toEqual([2]);
  });

  it('matches a company by its first word', () => {
    const named = [{ id: 'x', number: 4, title: 'Platform Lead', company: 'Northwind Logistics' }];
    expect(
      resolveScope('Does Northwind care about Kafka?', named).jobs.map((j) => j.number),
    ).toEqual([4]);
  });

  it('ignores generic leading company words', () => {
    expect(companyAliases('Global Payments Inc')).toEqual(['global payments inc']);
  });

  it('matches titles', () => {
    expect(
      resolveScope('skills for the data engineer role', jobs).jobs.map((j) => j.number),
    ).toEqual([3]);
  });

  it('falls back to all jobs', () => {
    const scope = resolveScope('Which role suits me best?', jobs);
    expect(scope.reason).toBe('all');
    expect(scope.jobs).toHaveLength(3);
  });

  it('reports unknown job numbers', () => {
    const scope = resolveScope('What about job #7?', jobs);
    expect(scope.unknownNumbers).toEqual([7]);
    expect(scope.jobs).toEqual([]);
  });
});
