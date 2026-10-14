import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

export class UnsupportedFileError extends Error {}

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown'];

export async function parseFile(filename: string, buffer: Buffer): Promise<string> {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (ext === '.pdf') return normalizeText(await parsePdf(buffer));
  if (ext === '.docx') return normalizeText((await mammoth.extractRawText({ buffer })).value);
  if (TEXT_EXTENSIONS.includes(ext)) return normalizeText(buffer.toString('utf8'));
  throw new UnsupportedFileError(`Unsupported file type "${ext}". Use PDF, DOCX, TXT or MD.`);
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\t]+/g, ' ')
    .replace(/[•●▪‣]/g, '-')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
