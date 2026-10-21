import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { drizzle } from 'drizzle-orm/pglite';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeps } from '../src/app.js';
import type { SourceView } from '../src/chat/service.js';
import { loadConfig } from '../src/config.js';
import type { Db } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import { FakeEmbedder } from '../src/embeddings/fake.js';
import { LocalEmbedder } from '../src/embeddings/local.js';
import { AnthropicLlm } from '../src/llm/anthropic.js';
import { FakeLlm } from '../src/llm/fake.js';
import { Metrics } from '../src/observability/metrics.js';

interface ExpectedSource {
  resume?: boolean;
  job?: number;
  section: string;
}

interface Case {
  question: string;
  expectScope: number[];
  expectSources: ExpectedSource[];
  mustMention?: string[];
  expectFlags?: string[];
  expectRefusalHint?: boolean;
}

interface ChatMeta {
  scope: number[];
  sources: SourceView[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const samples = path.resolve(here, '../../../samples');

const config = loadConfig({ ...process.env, NODE_ENV: 'test' });
const useRealLlm = !!config.ANTHROPIC_API_KEY && process.env.EVAL_LLM !== 'fake';
const llm = useRealLlm
  ? new AnthropicLlm({
      apiKey: config.ANTHROPIC_API_KEY,
      model: config.LLM_MODEL,
      extractionEffort: config.LLM_EXTRACTION_EFFORT,
      chatEffort: config.LLM_CHAT_EFFORT,
    })
  : new FakeLlm();
const embedder =
  process.env.EVAL_EMBEDDINGS === 'fake'
    ? new FakeEmbedder()
    : new LocalEmbedder(config.EMBEDDINGS_MODEL, config.MODELS_CACHE_DIR);

const client = new PGlite({ extensions: { vector } });
const db = drizzle(client, { schema }) as unknown as Db;
await migrate(db);
const deps = createDeps({ config, db, llm, embedder, metrics: new Metrics(false) });

await deps.documents.ingestResume({
  sourceName: 'resume-alex-morgan.md',
  text: await readFile(path.join(samples, 'resume-alex-morgan.md'), 'utf8'),
});
for (const file of (await readdir(path.join(samples, 'jobs'))).sort()) {
  await deps.documents.ingestJob({
    sourceName: file,
    text: await readFile(path.join(samples, 'jobs', file), 'utf8'),
  });
}

const cases: Case[] = JSON.parse(await readFile(path.join(here, 'dataset.json'), 'utf8'));
const rows: Record<string, string | number>[] = [];
let scopeHits = 0;
let recallSum = 0;
let rrSum = 0;
let flagHits = 0;
let flagCases = 0;
let citationValid = 0;
let mentionHits = 0;
let mentionTotal = 0;

for (const c of cases) {
  let meta: ChatMeta | undefined;
  let text = '';
  let flags: string[] = [];
  let unknown: string[] = [];
  await deps.chat.answer(
    { question: c.question, history: [], pinnedJobs: [] },
    {
      onStart: (m) => {
        meta = { scope: m.scope.jobs.map((j) => j.number), sources: m.sources };
      },
      onDelta: (d) => {
        text += d;
      },
      onDone: (d) => {
        flags = d.flags;
        unknown = d.unknownCitations;
      },
    },
  );

  const scopeOk =
    JSON.stringify([...meta!.scope].sort()) === JSON.stringify([...c.expectScope].sort());
  const matches = (e: ExpectedSource) => (s: SourceView) =>
    s.section.toLowerCase().includes(e.section.toLowerCase()) &&
    (e.resume ? s.documentKind === 'resume' : s.jobNumber === e.job);
  const found = c.expectSources.filter((e) => meta!.sources.some(matches(e))).length;
  const firstHit = meta!.sources.findIndex((s) => c.expectSources.some((e) => matches(e)(s)));
  const rr = c.expectSources.length ? (firstHit >= 0 ? 1 / (firstHit + 1) : 0) : 1;
  rrSum += rr;
  const recall = c.expectSources.length ? found / c.expectSources.length : 1;
  scopeHits += Number(scopeOk);
  recallSum += recall;
  if (c.expectFlags) {
    flagCases++;
    flagHits += Number(c.expectFlags.every((f) => flags.includes(f)));
  }
  citationValid += Number(unknown.length === 0);
  const mentions = (c.mustMention ?? []).filter((m) =>
    text.toLowerCase().includes(m.toLowerCase()),
  ).length;
  mentionHits += mentions;
  mentionTotal += c.mustMention?.length ?? 0;

  rows.push({
    question: c.question.slice(0, 56),
    scope: scopeOk ? 'ok' : `got ${meta!.scope.join(',')}`,
    recall: recall.toFixed(2),
    rr: rr.toFixed(2),
    citations: unknown.length ? `bad: ${unknown.join(',')}` : 'ok',
    mentions: c.mustMention ? `${mentions}/${c.mustMention.length}` : '-',
  });
}

console.table(rows);
const n = cases.length;
const summary = {
  llm: llm.model,
  embeddings: embedder instanceof LocalEmbedder ? config.EMBEDDINGS_MODEL : 'fake',
  scopeAccuracy: +(scopeHits / n).toFixed(2),
  sourceRecall: +(recallSum / n).toFixed(2),
  mrr: +(rrSum / n).toFixed(2),
  guardrailFlagAccuracy: flagCases ? +(flagHits / flagCases).toFixed(2) : null,
  citationValidity: +(citationValid / n).toFixed(2),
  mustMentionRate:
    useRealLlm && mentionTotal ? +(mentionHits / mentionTotal).toFixed(2) : 'n/a (fake LLM)',
};
console.log(summary);
await client.close();

const minRecall = Number(process.env.EVAL_MIN_RECALL ?? 0);
if (summary.scopeAccuracy < 1 || summary.sourceRecall < minRecall) process.exit(1);
