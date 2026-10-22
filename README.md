# Fitwise — career intelligence assistant

Upload a resume and the job postings you're considering. Fitwise scores each role, shows which skills match, which are close and which are missing, and answers questions like _"What skills am I missing for Job #2?"_ with citations back to the exact resume or posting lines it used.

## Quick start

You need Docker and an Anthropic API key.

```bash
cp .env.example .env            # put your ANTHROPIC_API_KEY in it
docker compose --env-file .env up --build
open http://localhost:8080
```

Then upload `samples/resume-alex-morgan.md` and the postings in `samples/jobs/`.

No API key? Set `LLM_PROVIDER=fake` to run the app end to end with a deterministic stand-in model.

## Local development

```bash
pnpm install
pnpm db:up                      # Postgres 17 + pgvector on :5432
pnpm dev                        # api on :3000, web on :5173
```

- `pnpm test` — API and web tests (PGlite + fake LLM, no Docker needed)
- `pnpm eval` — retrieval and answer eval over `samples/`
- `pnpm typecheck && pnpm lint && pnpm format:check` — what CI runs

## Repo layout

```
apps/api      Fastify service
apps/api/eval Eval dataset + runner
apps/web      React SPA
samples/      Demo resume and job postings
```

## How it works

**Upload:** parse PDF/DOCX/text → Claude extracts a typed profile (Zod schema) → split into section-aware chunks → embed locally and store in Postgres with a `tsvector` for keyword search.

**Question:** resolve which jobs it's about → hybrid search (pgvector + full-text, merged with RRF) → build prompt with profiles, fit reports and tagged chunks (`R3`, `J2.1`) → stream Claude's answer over SSE → verify every citation against what was retrieved.

## Key decisions

- **LLM extracts, code decides.** Claude turns documents into typed data and data into advice. Fit scores, scope and citation checks are deterministic code.
- **Fit score:** 60% must-have coverage + 20% nice-to-have + 20% experience. Skills match via an alias table, with embedding similarity ≥ 0.82 as a half-credit fallback.
- **Claude Opus 5.5** for chat and extraction; model set by `LLM_MODEL`.
- **Local embeddings** (`bge-small-en-v1.5` via transformers.js): no second API key, nothing leaves the box except the Claude call.
- **Postgres + pgvector** for vectors, full-text search and relational data in one database. Tests run on PGlite, the same SQL.
- **No orchestration framework.** The pipeline is a few explicit, unit-tested steps in plain TypeScript.
- **Guardrails:** documents are treated as data (prompt-injection defence), unknown citations and job references are flagged, inputs are size-limited and Zod-validated.
- **Observability:** structured logs, Prometheus `/metrics`, and a stored trace per answer (retrieved chunks, ranks, flags, latency, tokens, feedback).
