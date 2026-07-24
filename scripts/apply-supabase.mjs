#!/usr/bin/env node
/**
 * Apply the HalfSaid schema + Maya seed to a real Supabase Postgres (SPEC §4, §15).
 *
 * Idempotent: applies migrations only if pcg_nodes is absent, applies the seed only
 * if the graph is empty, and backfills embeddings only for NULL rows. Connects via
 * the IPv4 session pooler (see .env). The migrations are Supabase-native (auth.uid(),
 * authenticated/anon/service_role roles all exist there).
 *
 * Usage: node scripts/apply-supabase.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { pgConfig } from './supabase-conn.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const SEED = join(ROOT, 'supabase', 'seed.sql');
const SEED_DAVID = join(ROOT, 'supabase', 'seed-david.sql');
const DAVID = '00000000-0000-4000-8000-000000000101';
const DIM = 1024;
const REEMBED = process.argv.includes('--re-embed');

// --- MockEmbedder — MIRRORS packages/retrieval/src/embeddings.ts EXACTLY. Query-time
// and seed-time embeddings must use the identical algorithm. Keep in sync. ----------
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mockEmbed(text) {
  const v = new Array(DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
  for (const tok of tokens) {
    const idx = fnv1a(tok) % DIM;
    const sign = (fnv1a(tok + '#s') & 1) === 0 ? 1 : -1;
    v[idx] += sign;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}
const toVector = (v) => `[${v.map((x) => x.toFixed(6)).join(',')}]`;
const l2 = (v) => {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n);
  return n === 0 ? v : v.map((x) => x / n);
};

// --- Gemini batch embedding (real semantic vectors when a key is present). Batches
// of 50 through :batchEmbedContents; 1024-d truncation requires re-normalizing.
// MIRRORS GeminiEmbedder in packages/retrieval/src/embeddings.ts. ------------------
const GEMINI_MODEL = 'gemini-embedding-001';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geminiEmbedBatch(texts, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:batchEmbedContents`;
  // The free tier rate-limits aggressively; retry 429s with growing backoff.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${GEMINI_MODEL}`,
          content: { parts: [{ text }] },
          taskType: 'SEMANTIC_SIMILARITY',
          outputDimensionality: DIM,
        })),
      }),
    });
    if (res.status === 429 && attempt <= 6) {
      const wait = attempt * 15_000;
      console.log(`  rate-limited — waiting ${wait / 1000}s (attempt ${attempt}/6)…`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`gemini batch embed failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.embeddings.map((e) => l2(e.values));
  }
}

async function embedAll(texts, apiKey) {
  if (!apiKey) return texts.map(mockEmbed);
  const out = [];
  for (let i = 0; i < texts.length; i += 25) {
    const batch = texts.slice(i, i + 25);
    out.push(...(await geminiEmbedBatch(batch, apiKey)));
    console.log(`  embedded ${Math.min(i + 25, texts.length)}/${texts.length} (gemini)`);
    if (i + 25 < texts.length) await sleep(1500);
  }
  return out;
}

async function main() {
  const client = new pg.Client(pgConfig());
  await client.connect();
  console.log('connected:', pgConfig().host);

  // Incremental migrations tracked in schema_migrations.
  await client.query(
    'create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())',
  );
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const pcgExists = (await client.query("select to_regclass('public.pcg_nodes') as t")).rows[0].t;
  const applied = new Set(
    (await client.query('select version from public.schema_migrations')).rows.map((r) => r.version),
  );
  // Backfill: an older DB may already have 0001/0002 applied but untracked.
  if (pcgExists && applied.size === 0) {
    for (const f of files.filter((f) => f.startsWith('0001') || f.startsWith('0002'))) {
      await client.query('insert into public.schema_migrations (version) values ($1)', [f]);
      applied.add(f);
    }
    console.log('backfilled schema_migrations for existing 0001/0002');
  }
  for (const file of files) {
    if (applied.has(file)) {
      console.log('already applied —', file);
      continue;
    }
    console.log('applying migration', file);
    await client.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
    await client.query('insert into public.schema_migrations (version) values ($1)', [file]);
  }

  const count = await client.query('select count(*)::int as n from public.pcg_nodes');
  if (count.rows[0].n === 0) {
    console.log('applying seed…');
    await client.query(readFileSync(SEED, 'utf8'));
  } else {
    console.log(`seed already present (${count.rows[0].n} nodes) — skipping`);
  }

  // Second persona (David) — applied independently so an existing Maya DB gains him.
  const davidCount = await client.query(
    'select count(*)::int as n from public.pcg_nodes where user_id = $1',
    [DAVID],
  );
  if (davidCount.rows[0].n === 0) {
    console.log('applying David seed…');
    await client.query(readFileSync(SEED_DAVID, 'utf8'));
  } else {
    console.log(`David seed already present (${davidCount.rows[0].n} nodes) — skipping`);
  }

  const apiKey = process.env.GEMINI_API_KEY || '';
  console.log(`embedder: ${apiKey ? 'gemini-embedding-001@1024 (real)' : 'mock bag-of-words'}`);

  // --re-embed: embedder upgrade path (e.g. mock → Gemini). The append-only trigger
  // makes embeddings write-once, so we disable it for this one deliberate,
  // owner-run maintenance operation and restore it immediately after.
  if (REEMBED) {
    console.log('re-embed requested — clearing existing embeddings…');
    await client.query('alter table public.pcg_nodes disable trigger pcg_nodes_no_overwrite');
    await client.query('update public.pcg_nodes set embedding = null where embedding is not null');
    await client.query('alter table public.pcg_nodes enable trigger pcg_nodes_no_overwrite');
  }

  const toFill = await client.query(
    `select id, coalesce(attributes->>'content', attributes->>'name') as text
       from public.pcg_nodes
      where embedding is null
        and coalesce(attributes->>'content', attributes->>'name') is not null`,
  );
  console.log(`backfilling ${toFill.rows.length} embeddings…`);
  const vectors = await embedAll(
    toFill.rows.map((r) => r.text),
    apiKey,
  );
  for (let i = 0; i < toFill.rows.length; i++) {
    await client.query('update public.pcg_nodes set embedding = $1::vector where id = $2', [
      toVector(vectors[i]),
      toFill.rows[i].id,
    ]);
  }

  const summary = await client.query(
    `select (select count(*)::int from public.pcg_nodes) as nodes,
            (select count(*)::int from public.pcg_edges) as edges,
            (select count(*)::int from public.pcg_nodes where embedding is not null) as embedded`,
  );
  console.log('done:', summary.rows[0]);
  await client.end();
}

main().catch((e) => {
  console.error('apply failed:', e.message);
  process.exit(1);
});
