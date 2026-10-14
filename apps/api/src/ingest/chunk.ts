export interface Chunk {
  ordinal: number;
  section: string;
  content: string;
}

export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

const DEFAULTS: ChunkOptions = { maxChars: 900, overlapChars: 150 };

const KNOWN_HEADINGS = [
  'summary',
  'profile',
  'about',
  'about you',
  'about us',
  'about the role',
  'experience',
  'work experience',
  'professional experience',
  'employment',
  'skills',
  'technical skills',
  'core skills',
  'education',
  'projects',
  'certifications',
  'languages',
  'awards',
  'publications',
  'responsibilities',
  'what you will do',
  "what you'll do",
  'requirements',
  'qualifications',
  'must have',
  'nice to have',
  'preferred qualifications',
  'bonus points',
  'benefits',
  'what we offer',
  'tech stack',
];

export function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (/^#{1,6}\s+\S/.test(t)) return true;
  const bare = t
    .replace(/[:\-–—]+$/, '')
    .trim()
    .toLowerCase();
  if (KNOWN_HEADINGS.includes(bare)) return true;
  const letters = t.replace(/[^a-zA-Z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase() && t.split(/\s+/).length <= 5;
}

function cleanHeading(line: string): string {
  const t = line
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/[:\-–—]+$/, '')
    .trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function splitSections(text: string): { section: string; body: string }[] {
  const sections: { section: string; lines: string[] }[] = [{ section: 'Overview', lines: [] }];
  for (const line of text.split('\n')) {
    if (isHeading(line)) sections.push({ section: cleanHeading(line), lines: [] });
    else sections.at(-1)!.lines.push(line);
  }
  return sections
    .map((s) => ({ section: s.section, body: s.lines.join('\n').trim() }))
    .filter((s) => s.body.length > 0);
}

function splitLong(body: string, { maxChars, overlapChars }: ChunkOptions): string[] {
  if (body.length <= maxChars) return [body];
  const units = body.split(/\n+|(?<=[.!?])\s+/).filter((u) => u.trim());
  const out: string[] = [];
  let current = '';
  for (const unit of units) {
    if (current && current.length + unit.length + 1 > maxChars) {
      out.push(current.trim());
      const tail = current.slice(-overlapChars);
      current = tail.slice(tail.indexOf(' ') + 1);
    }
    current += (current ? '\n' : '') + unit;
    while (current.length > maxChars) {
      out.push(current.slice(0, maxChars));
      current = current.slice(maxChars - overlapChars);
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function chunkDocument(text: string, options: Partial<ChunkOptions> = {}): Chunk[] {
  const opts = { ...DEFAULTS, ...options };
  const chunks: Chunk[] = [];
  for (const { section, body } of splitSections(text)) {
    for (const piece of splitLong(body, opts)) {
      chunks.push({ ordinal: chunks.length, section, content: piece });
    }
  }
  return chunks;
}
