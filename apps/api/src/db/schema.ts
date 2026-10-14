import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import type { JobProfile, ResumeProfile } from '../domain/profiles.js';

export const EMBEDDING_DIMENSIONS = 384;

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind', { enum: ['resume', 'job'] }).notNull(),
  number: integer('number'),
  title: text('title').notNull(),
  company: text('company'),
  sourceName: text('source_name').notNull(),
  content: text('content').notNull(),
  profile: jsonb('profile').$type<ResumeProfile | JobProfile>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    section: text('section').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    tsv: tsvector('tsv').generatedAlwaysAs(sql`to_tsvector('english', content)`),
  },
  (t) => [
    index('chunks_document_idx').on(t.documentId),
    index('chunks_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
    index('chunks_tsv_idx').using('gin', t.tsv),
  ],
);

export const traces = pgTable('traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  scope: jsonb('scope').$type<number[]>().notNull(),
  retrieved: jsonb('retrieved').$type<RetrievedTrace[]>().notNull(),
  answer: text('answer').notNull().default(''),
  flags: jsonb('flags').$type<string[]>().notNull(),
  model: text('model').notNull(),
  latencyMs: integer('latency_ms'),
  firstTokenMs: integer('first_token_ms'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  feedback: real('feedback'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const schemaMigrations = pgTable('schema_migrations', {
  name: text('name').primaryKey(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface RetrievedTrace {
  label: string;
  chunkId: string;
  section: string;
  score: number;
  vectorRank: number | null;
  keywordRank: number | null;
}

export type DocumentRow = typeof documents.$inferSelect;
export type ChunkRow = typeof chunks.$inferSelect;
export type TraceRow = typeof traces.$inferSelect;
