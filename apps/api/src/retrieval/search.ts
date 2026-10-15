import { and, cosineDistance, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { chunks, documents } from '../db/schema.js';
import type { Embedder } from '../embeddings/embedder.js';
import { reciprocalRankFusion } from './rrf.js';

export interface RetrievedChunk {
  label: string;
  chunkId: string;
  documentId: string;
  documentKind: 'resume' | 'job';
  jobNumber: number | null;
  documentTitle: string;
  section: string;
  content: string;
  score: number;
  vectorRank: number | null;
  keywordRank: number | null;
}

export interface SearchOptions {
  documentIds: string[];
  resumeLimit: number;
  perJobLimit: number;
}

const CANDIDATES = 40;

export function chunkLabel(
  kind: 'resume' | 'job',
  jobNumber: number | null,
  ordinal: number,
): string {
  return kind === 'resume' ? `R${ordinal + 1}` : `J${jobNumber}.${ordinal + 1}`;
}

export function toOrQuery(text: string): string {
  const words = text.toLowerCase().match(/[a-z0-9][a-z0-9+#]*/g);
  return [...new Set(words ?? [])]
    .map((w) => w.replace(/[+#]/g, ''))
    .filter((w) => w.length > 1)
    .join(' | ');
}

export class Retriever {
  constructor(
    private readonly db: Db,
    private readonly embedder: Embedder,
  ) {}

  async search(query: string, options: SearchOptions): Promise<RetrievedChunk[]> {
    if (!options.documentIds.length) return [];
    const [queryVector] = await this.embedder.embed([query], 'query');
    const scope = inArray(chunks.documentId, options.documentIds);

    const columns = {
      chunkId: chunks.id,
      documentId: chunks.documentId,
      ordinal: chunks.ordinal,
      section: chunks.section,
      content: chunks.content,
      kind: documents.kind,
      number: documents.number,
      title: documents.title,
    };

    const vectorHits = this.db
      .select(columns)
      .from(chunks)
      .innerJoin(documents, eq(documents.id, chunks.documentId))
      .where(scope)
      .orderBy(cosineDistance(chunks.embedding, queryVector!))
      .limit(CANDIDATES);

    const orQuery = toOrQuery(query);
    const tsQuery = sql`to_tsquery('english', ${orQuery})`;
    const keywordHits = orQuery
      ? this.db
          .select(columns)
          .from(chunks)
          .innerJoin(documents, eq(documents.id, chunks.documentId))
          .where(and(scope, sql`${chunks.tsv} @@ ${tsQuery}`))
          .orderBy(desc(sql`ts_rank_cd(${chunks.tsv}, ${tsQuery})`))
          .limit(CANDIDATES)
      : Promise.resolve([]);

    const [vector, keyword] = await Promise.all([vectorHits, keywordHits]);
    const fused = reciprocalRankFusion([vector, keyword], (r) => r.chunkId);

    const perDoc = new Map<string, number>();
    const out: RetrievedChunk[] = [];
    for (const { item, score, ranks } of fused) {
      const limit = item.kind === 'resume' ? options.resumeLimit : options.perJobLimit;
      const taken = perDoc.get(item.documentId) ?? 0;
      if (taken >= limit) continue;
      perDoc.set(item.documentId, taken + 1);
      out.push({
        label: chunkLabel(item.kind, item.number, item.ordinal),
        chunkId: item.chunkId,
        documentId: item.documentId,
        documentKind: item.kind,
        jobNumber: item.number,
        documentTitle: item.title,
        section: item.section,
        content: item.content,
        score: Math.round(score * 10000) / 10000,
        vectorRank: ranks[0]! > 0 ? ranks[0]! : null,
        keywordRank: ranks[1]! > 0 ? ranks[1]! : null,
      });
    }
    return out;
  }
}
