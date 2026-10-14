import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chunkDocument, isHeading, splitSections } from '../src/ingest/chunk.js';
import { normalizeText } from '../src/ingest/parse.js';

const resume = readFileSync(new URL('./fixtures/resume.md', import.meta.url), 'utf8');

describe('isHeading', () => {
  it.each(['EXPERIENCE', 'Skills:', '## Projects', 'Nice to have', 'WORK HISTORY'])(
    'detects %s',
    (line) => {
      expect(isHeading(line)).toBe(true);
    },
  );

  it.each([
    '- Built React dashboards',
    'Senior Software Engineer, Brightlane (2021 – present)',
    'AWS',
    '',
  ])('ignores %s', (line) => {
    expect(isHeading(line)).toBe(false);
  });
});

describe('chunkDocument', () => {
  it('splits by section and keeps section names', () => {
    const sections = splitSections(resume).map((s) => s.section);
    expect(sections).toEqual(['Overview', 'Summary', 'Experience', 'Skills', 'Education']);
  });

  it('never exceeds max size and numbers chunks sequentially', () => {
    const long = `EXPERIENCE\n${'Shipped a feature that improved retention. '.repeat(80)}`;
    const chunks = chunkDocument(long, { maxChars: 300, overlapChars: 50 });
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.content.length <= 300)).toBe(true);
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
    expect(chunks.every((c) => c.section === 'Experience')).toBe(true);
  });

  it('keeps short sections whole', () => {
    const chunks = chunkDocument(resume);
    const skills = chunks.filter((c) => c.section === 'Skills');
    expect(skills).toHaveLength(1);
    expect(skills[0]!.content).toContain('Kafka');
  });
});

describe('normalizeText', () => {
  it('normalises bullets, whitespace and line endings', () => {
    expect(normalizeText('A\r\n•  item\t one\n\n\n\nB')).toBe('A\n- item one\n\nB');
  });
});
