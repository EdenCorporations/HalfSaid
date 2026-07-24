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
const DIM = 1024;

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
function embed(text) {
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

async function main() {
  const client = new pg.Client(pgConfig());
  await client.connect();
  console.log('connected:', pgConfig().host);

  const exists = await client.query("select to_regclass('public.pcg_nodes') as t");
  if (!exists.rows[0].t) {
    for (const file of readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      console.log('applying migration', file);
      await client.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
    }
  } else {
    console.log('schema already present — skipping migrations');
  }

  const count = await client.query('select count(*)::int as n from public.pcg_nodes');
  if (count.rows[0].n === 0) {
    console.log('applying seed…');
    await client.query(readFileSync(SEED, 'utf8'));
  } else {
    console.log(`seed already present (${count.rows[0].n} nodes) — skipping`);
  }

  const toFill = await client.query(
    `select id, coalesce(attributes->>'content', attributes->>'name') as text
       from public.pcg_nodes
      where embedding is null
        and coalesce(attributes->>'content', attributes->>'name') is not null`,
  );
  console.log(`backfilling ${toFill.rows.length} embeddings…`);
  for (const row of toFill.rows) {
    await client.query('update public.pcg_nodes set embedding = $1::vector where id = $2', [
      toVector(embed(row.text)),
      row.id,
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
