/**
 * Embeddings (SPEC §4.3, O2/D10/D12).
 *
 * Production uses a hosted free-tier embedder (1024-d). For dev/CI there is no key,
 * so a DETERMINISTIC mock embedder produces 1024-d bag-of-words vectors — no
 * network, reproducible, and enough token-overlap signal for the curated Maya seed.
 * Seed embeddings are NULL on disk and backfilled here (append-only NULL -> value).
 */

import type { SqlExecutor } from './sql';

export const EMBEDDING_DIM = 1024;

export interface Embedder {
  readonly dim: number;
  readonly id: string;
  embed(text: string): Promise<number[]>;
}

/** FNV-1a — small, fast, deterministic string hash. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Deterministic bag-of-words embedder. Each token is hashed into a dimension (with
 * a sign from a second hash) and L2-normalized. Cosine similarity then tracks token
 * overlap — a reasonable stand-in for a real embedder over a small curated graph.
 */
export class MockEmbedder implements Embedder {
  readonly dim = EMBEDDING_DIM;
  readonly id = 'mock-bow-1024';

  async embed(text: string): Promise<number[]> {
    const v = new Array<number>(this.dim).fill(0);
    const tokens = tokenize(text);
    for (const tok of tokens) {
      const idx = fnv1a(tok) % this.dim;
      const sign = (fnv1a(tok + '#s') & 1) === 0 ? 1 : -1;
      v[idx] = v[idx]! + sign;
    }
    let norm = 0;
    for (const x of v) norm += x * x;
    norm = Math.sqrt(norm);
    if (norm === 0) return v; // empty text -> zero vector
    for (let i = 0; i < v.length; i++) v[i] = v[i]! / norm;
    return v;
  }
}

/**
 * Placeholder for the hosted embedder (O2/D10). Not exercised in CI (no key); wiring
 * a real HTTP call is left for when a key is provisioned.
 */
export class HostedEmbedder implements Embedder {
  readonly dim = EMBEDDING_DIM;
  readonly id = 'hosted';
  constructor(private readonly apiKey: string) {}
  async embed(_text: string): Promise<number[]> {
    throw new Error(
      'HostedEmbedder is not wired in the MVP build; set HALFSAID_MOCK_MODE=true to use MockEmbedder.',
    );
  }
}

/** Pick the embedder from the environment: mock unless a key is present and mock off. */
export function getEmbedder(env: NodeJS.ProcessEnv = process.env): Embedder {
  const mock = env.HALFSAID_MOCK_MODE !== 'false';
  const key = env.EMBEDDINGS_API_KEY;
  if (!mock && key) return new HostedEmbedder(key);
  return new MockEmbedder();
}

/** pgvector text literal for a vector. */
export function toVectorLiteral(v: readonly number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(',')}]`;
}

/** Cosine similarity (both vectors assumed same length). */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface BackfillResult {
  updated: number;
  embedderId: string;
}

/**
 * Backfill NULL embeddings for text-bearing nodes (Utterance/Topic/Person/Place/
 * Object). Uses the append-only-permitted NULL -> value path. Idempotent: only
 * touches rows still NULL.
 */
export async function backfillEmbeddings(
  exec: SqlExecutor,
  embedder: Embedder = getEmbedder(),
): Promise<BackfillResult> {
  const rows = await exec<{ id: string; text: string | null }>(
    `select id, coalesce(attributes->>'content', attributes->>'name') as text
       from public.pcg_nodes
      where embedding is null
        and coalesce(attributes->>'content', attributes->>'name') is not null;`,
  );
  let updated = 0;
  for (const row of rows) {
    if (!row.text) continue;
    const vec = await embedder.embed(row.text);
    await exec(`update public.pcg_nodes set embedding = $1::vector where id = $2;`, [
      toVectorLiteral(vec),
      row.id,
    ]);
    updated += 1;
  }
  return { updated, embedderId: embedder.id };
}
