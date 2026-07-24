/**
 * Embeddings tests (SPEC §4.3). The mock embedder is deterministic, 1024-d, and
 * token-overlap similar; backfill fills NULL seed embeddings (append-only path).
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';
import {
  MockEmbedder,
  GeminiEmbedder,
  getEmbedder,
  cosine,
  backfillEmbeddings,
  EMBEDDING_DIM,
} from '../index';

describe('MockEmbedder', () => {
  const e = new MockEmbedder();

  it('produces deterministic, unit-length 1024-d vectors', async () => {
    const a = await e.embed('call Sarah');
    const b = await e.embed('call Sarah');
    expect(a).toHaveLength(EMBEDDING_DIM);
    expect(a).toEqual(b);
    const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('ranks token-overlapping text as more similar than disjoint text', async () => {
    const q = await e.embed('call Sarah on the phone');
    const near = await e.embed('call Sarah');
    const far = await e.embed('water the roses');
    expect(cosine(q, near)).toBeGreaterThan(cosine(q, far));
  });

  it('returns a zero vector for empty text', async () => {
    const z = await e.embed('   ');
    expect(z.every((x) => x === 0)).toBe(true);
  });
});

describe('GeminiEmbedder', () => {
  function fakeFetch(values: number[]): typeof fetch {
    return jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ embedding: { values } }),
    }) as unknown as typeof fetch;
  }

  it('L2-normalizes the truncated 1024-d vector', async () => {
    // Raw (un-normalized) values, as Gemini returns for truncated dims.
    const raw = Array.from({ length: EMBEDDING_DIM }, (_, i) => (i % 7) - 3);
    const e = new GeminiEmbedder('test-key', fakeFetch(raw));
    const v = await e.embed('call Sarah');
    expect(v).toHaveLength(EMBEDDING_DIM);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('caches repeated queries (one HTTP call for the same text)', async () => {
    const raw = Array.from({ length: EMBEDDING_DIM }, () => 1);
    const f = fakeFetch(raw);
    const e = new GeminiEmbedder('test-key', f);
    await e.embed('I want tea');
    await e.embed('I want tea');
    expect((f as jest.Mock).mock.calls).toHaveLength(1);
  });

  it('throws on a non-1024-d response', async () => {
    const e = new GeminiEmbedder('test-key', fakeFetch([1, 2, 3]));
    await expect(e.embed('x')).rejects.toThrow(/unexpected shape/);
  });

  it('is selected by getEmbedder when a Gemini key is present', () => {
    expect(getEmbedder({ GEMINI_API_KEY: 'k' } as NodeJS.ProcessEnv).id).toMatch(/^gemini/);
    expect(getEmbedder({} as NodeJS.ProcessEnv).id).toBe('mock-bow-1024');
  });
});

describe('backfillEmbeddings over the Maya seed', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb({ withSeed: true });
    await t.become({ kind: 'postgres' });
  });
  afterAll(async () => {
    await t.close();
  });

  it('fills NULL embeddings for text-bearing nodes and is idempotent', async () => {
    const before = await t.query<{ n: number }>(
      `select count(*)::int as n from public.pcg_nodes where embedding is null;`,
    );
    expect(before[0]!.n).toBeGreaterThan(0);

    const exec = <T>(sql: string, params?: unknown[]) => t.query<T>(sql, params);
    const first = await backfillEmbeddings(exec, new MockEmbedder());
    expect(first.updated).toBeGreaterThan(100); // utterances + named nodes

    const second = await backfillEmbeddings(exec, new MockEmbedder());
    expect(second.updated).toBe(0); // idempotent

    const dims = await t.query<{ dim: number }>(
      `select vector_dims(embedding) as dim from public.pcg_nodes
        where embedding is not null limit 1;`,
    );
    expect(dims[0]!.dim).toBe(EMBEDDING_DIM);
  });
});
