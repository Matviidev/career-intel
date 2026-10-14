create extension if not exists vector;

create table documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('resume', 'job')),
  number integer,
  title text not null,
  company text,
  source_name text not null,
  content text not null,
  profile jsonb not null,
  created_at timestamptz not null default now()
);

create unique index documents_job_number_idx on documents (number) where kind = 'job';

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  ordinal integer not null,
  section text not null,
  content text not null,
  embedding vector(384) not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored
);

create index chunks_document_idx on chunks (document_id);
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_tsv_idx on chunks using gin (tsv);

create table traces (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  scope jsonb not null,
  retrieved jsonb not null,
  answer text not null default '',
  flags jsonb not null,
  model text not null,
  latency_ms integer,
  first_token_ms integer,
  input_tokens integer,
  output_tokens integer,
  feedback real,
  created_at timestamptz not null default now()
);

create index traces_created_idx on traces (created_at desc);
