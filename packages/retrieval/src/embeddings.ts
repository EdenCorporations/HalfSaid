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

const GEMINI_MODEL = 'gemini-embedding-001';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;

interface GeminiEmbedResponse {
  embedding?: { values?: number[] };
}

/**
 * Real hosted embedder (O2/D10 — resolved): Google `gemini-embedding-001` truncated
 * to 1024-d via `outputDimensionality` (free tier). Truncated vectors are NOT unit
 * length, so we L2-normalize before storing/querying — cosine distance then behaves
 * identically to the mock path. A small in-memory cache absorbs repeated queries
 * (the same partial text is often re-requested within a session).
 */
export class GeminiEmbedder implements Embedder {
  readonly dim = EMBEDDING_DIM;
  readonly id = `${GEMINI_MODEL}@${EMBEDDING_DIM}`;
  private readonly cache = new Map<string, number[]>();

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async embed(text: string): Promise<number[]> {
    const key = text.trim().toLowerCase();
    const hit = this.cache.get(key);
    if (hit) return hit;

    const res = await this.fetchImpl(GEMINI_URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'SEMANTIC_SIMILARITY',
        outputDimensionality: EMBEDDING_DIM,
      }),
    });
    if (!res.ok) throw new Error(`gemini embed failed (${res.status})`);
    const data = (await res.json()) as GeminiEmbedResponse;
    const values = data.embedding?.values;
    if (!Array.isArray(values) || values.length !== EMBEDDING_DIM) {
      throw new Error('gemini embed returned an unexpected shape');
    }

    // L2-normalize (truncated Gemini vectors are not unit length).
    let norm = 0;
    for (const x of values) norm += x * x;
    norm = Math.sqrt(norm);
    const vec = norm === 0 ? values : values.map((x) => x / norm);

    // Bounded cache: evict the oldest entry once full.
    if (this.cache.size >= 500) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, vec);
    return vec;
  }
}

/**
 * Pick the embedder from the environment. A Gemini key means REAL embeddings —
 * regardless of mock mode, because the demo runs mock auth against real Supabase
 * and the seed/query embedders must match. No key (CI, offline) → deterministic mock.
 */
export function getEmbedder(env: NodeJS.ProcessEnv = process.env): Embedder {
  const key = env.GEMINI_API_KEY || env.EMBEDDINGS_API_KEY;
  if (key) return new GeminiEmbedder(key);
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
