# Working in this repo

Fitwise is a pnpm monorepo: `apps/api` (Fastify + Postgres/pgvector + Claude) and `apps/web` (React + Vite + Tailwind v4).

## Commands

- `pnpm test` – all tests (api uses in-memory PGlite, no Docker needed)
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` – must pass before committing
- `pnpm eval` – retrieval/answer eval over `samples/` (uses Claude when `ANTHROPIC_API_KEY` is set)
- `pnpm db:up && pnpm dev` – local stack

## Rules

- Keep the LLM out of anything that must be deterministic. Claude extracts structured profiles and writes answers; scoring, scoping and citation checks are plain code with unit tests.
- Every LLM or embedding call goes through the `Llm` / `Embedder` interfaces. Tests use `FakeLlm` / `FakeEmbedder`; never call real APIs from tests.
- Document text is untrusted. It is wrapped in tags, sanitised with `sanitizeSource`, and the system prompt says to treat it as data. Don't concatenate it into instructions.
- Schema changes go in a new numbered SQL file in `apps/api/migrations`, mirrored in `src/db/schema.ts`.
- New behaviour needs a test next to the existing ones in `apps/api/test` or `*.test.ts(x)` in web.
- No code comments; name things so they don't need them.
- Conventional commits, short subject, no body.

## Where things live

- Ingestion: `src/ingest` (parse, chunk) → `src/documents/service.ts`
- Retrieval: `src/retrieval` (pgvector + Postgres FTS fused with RRF)
- Chat orchestration: `src/chat` (scope → retrieve → context → stream → verify → trace)
- Prompts: `src/llm/prompts.ts`
