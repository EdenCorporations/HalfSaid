/**
 * Hybrid retrieval tests (SPEC §5.1). The headline test is the demo: given "I want
 * to…" over the seeded Maya PCG, the three grounded candidates emerge from retrieval
 * — they are NOT hardcoded (PRD §31.1).
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';
import { MockEmbedder, backfillEmbeddings, retrieve, type SqlExecutor } from '../index';

const MAYA = '00000000-0000-4000-8000-000000000001';

describe('hybrid retrieval over the Maya seed', () => {
  let t: TestDb;
  let exec: SqlExecutor;
  const embedder = new MockEmbedder();

  beforeAll(async () => {
    t = await createTestDb({ withSeed: true });
    await t.become({ kind: 'postgres' });
    exec = <T>(sql: string, params?: unknown[]) => t.query<T>(sql, params);
    await backfillEmbeddings(exec, embedder);
  });
  afterAll(async () => {
    await t.close();
  });

  it('surfaces the three demo candidates for "I want to…"', async () => {
    const candidates = await retrieve(
      exec,
      { userId: MAYA, partialText: 'I want to', intent: 'request' },
      embedder,
      { topK: 5 },
    );
    const texts = candidates.map((c) => c.content);
    expect(texts).toEqual(
      expect.arrayContaining(['call Sarah', 'go to the garden', 'read my book']),
    );
  });

  it('every candidate is a real PCG node with provenance and a source tag', async () => {
    const candidates = await retrieve(
      exec,
      { userId: MAYA, partialText: 'I want to', intent: 'request' },
      embedder,
      { topK: 5 },
    );
    for (const c of candidates) {
      expect(c.nodeId).toMatch(/^[0-9a-f-]{36}$/);
      expect(c.mergedFrom.length).toBeGreaterThan(0);
      expect(['yours', 'family-validated', 'therapist-approved']).toContain(c.sourceTag);
    }
  });

  it('de-duplicates "I want to call Sarah" into "call Sarah"', async () => {
    const candidates = await retrieve(
      exec,
      { userId: MAYA, partialText: 'I want to', intent: 'request' },
      embedder,
      { topK: 10 },
    );
    const callVariants = candidates.filter((c) => c.content.toLowerCase().includes('call sarah'));
    expect(callVariants).toHaveLength(1);
    expect(callVariants[0]!.content).toBe('call Sarah');
    expect(callVariants[0]!.mergedFrom.length).toBeGreaterThan(1); // bare + "I want to" merged
  });

  it('keyword search pulls garden phrases for a garden query', async () => {
    const candidates = await retrieve(
      exec,
      { userId: MAYA, partialText: 'garden roses', intent: 'request' },
      embedder,
      { topK: 10 },
    );
    const texts = candidates.map((c) => c.content.toLowerCase());
    expect(texts.some((x) => x.includes('garden') || x.includes('roses'))).toBe(true);
  });

  it('high-stakes forced flag restricts to Tier 3 (therapist-approved) only', async () => {
    const candidates = await retrieve(
      exec,
      { userId: MAYA, partialText: 'I want to', intent: 'request', highStakes: true },
      embedder,
      { topK: 20 },
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.sourceTag).toBe('therapist-approved');
      expect(c.privacyTier).toBe(3);
    }
    // "go to the garden" is Tier 1 — it must be filtered out under high-stakes.
    expect(candidates.map((c) => c.content)).not.toContain('go to the garden');
  });
});
