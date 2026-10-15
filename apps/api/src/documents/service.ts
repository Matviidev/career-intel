import { and, asc, eq, max } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { chunks, documents, type DocumentRow } from '../db/schema.js';
import type { JobProfile, ResumeProfile } from '../domain/profiles.js';
import type { Embedder } from '../embeddings/embedder.js';
import { chunkDocument } from '../ingest/chunk.js';
import type { Llm } from '../llm/llm.js';

export const MIN_TEXT_CHARS = 200;
export const MAX_TEXT_CHARS = 60_000;

export class InvalidDocumentError extends Error {}

export interface IngestInput {
  sourceName: string;
  text: string;
}

export class DocumentService {
  constructor(
    private readonly db: Db,
    private readonly llm: Llm,
    private readonly embedder: Embedder,
  ) {}

  async ingestResume({ sourceName, text }: IngestInput): Promise<DocumentRow> {
    assertUsable(text);
    const profile = await this.llm.extractResume(text);
    const title = profile.name ? `${profile.name} — Resume` : 'Resume';
    const prepared = await this.prepareChunks(text, title);

    return this.db.transaction(async (tx) => {
      await tx.delete(documents).where(eq(documents.kind, 'resume'));
      const [doc] = await tx
        .insert(documents)
        .values({ kind: 'resume', title, company: null, sourceName, content: text, profile })
        .returning();
      await tx.insert(chunks).values(prepared.map((c) => ({ ...c, documentId: doc!.id })));
      return doc!;
    });
  }

  async ingestJob({ sourceName, text }: IngestInput): Promise<DocumentRow> {
    assertUsable(text);
    const profile = await this.llm.extractJob(text);
    const title = profile.title || sourceName;
    const prepared = await this.prepareChunks(text, title);

    return this.db.transaction(async (tx) => {
      const [{ value } = { value: 0 }] = await tx
        .select({ value: max(documents.number) })
        .from(documents)
        .where(eq(documents.kind, 'job'));
      const [doc] = await tx
        .insert(documents)
        .values({
          kind: 'job',
          number: (value ?? 0) + 1,
          title,
          company: profile.company || null,
          sourceName,
          content: text,
          profile,
        })
        .returning();
      await tx.insert(chunks).values(prepared.map((c) => ({ ...c, documentId: doc!.id })));
      return doc!;
    });
  }

  async getResume(): Promise<(DocumentRow & { profile: ResumeProfile }) | null> {
    const [doc] = await this.db.select().from(documents).where(eq(documents.kind, 'resume'));
    return (doc as DocumentRow & { profile: ResumeProfile }) ?? null;
  }

  async listJobs(): Promise<(DocumentRow & { profile: JobProfile })[]> {
    const rows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.kind, 'job'))
      .orderBy(asc(documents.number));
    return rows as (DocumentRow & { profile: JobProfile })[];
  }

  async getJob(id: string): Promise<(DocumentRow & { profile: JobProfile }) | null> {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.kind, 'job')));
    return (doc as DocumentRow & { profile: JobProfile }) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning({ id: documents.id });
    return deleted.length > 0;
  }

  private async prepareChunks(text: string, title: string) {
    const pieces = chunkDocument(text);
    const vectors = await this.embedder.embed(
      pieces.map((c) => `${title} — ${c.section}\n${c.content}`),
      'passage',
    );
    return pieces.map((c, i) => ({ ...c, embedding: vectors[i]! }));
  }
}

function assertUsable(text: string): void {
  if (text.length < MIN_TEXT_CHARS) {
    throw new InvalidDocumentError(
      'Document has too little text. If it is a scanned PDF, export it with selectable text.',
    );
  }
  if (text.length > MAX_TEXT_CHARS) {
    throw new InvalidDocumentError(`Document is too long (max ${MAX_TEXT_CHARS} characters).`);
  }
}
