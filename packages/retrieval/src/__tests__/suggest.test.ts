/**
 * End-to-end suggest() tests (SPEC §5–§8, PRD §31.1). Proves the demo produces
 * grounded, explained candidates; the Hard Rule holds (every card cites a PCG id);
 * the refusal path is first-class; and high-stakes restricts to therapist-approved.
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';
import { MockEmbedder, backfillEmbeddings, suggest, type SqlExecutor } from '../index';

const MAYA = '00000000-0000-4000-8000-000000000001';
const NOW = 1_781_000_000;

describe('suggest() end-to-end', () => {
  let t: TestDb;
  let exec: SqlExecutor;
  const embedder = new MockEmbedder();
  const opts = { embedder, nowEpoch: NOW, maxCards: 5 };

  beforeAll(async () => {
    t = await createTestDb({ withSeed: true });
    await t.become({ kind: 'postgres' });
    exec = <T>(sql: string, params?: unknown[]) => t.query<T>(sql, params);
    await backfillEmbeddings(exec, embedder);
  });
  afterAll(async () => {
    await t.close();
  });

  it('produces the three demo candidates, grounded and explained', async () => {
    const res = await suggest(
      exec,
      { userId: MAYA, partialText: 'I want to', intent: 'request' },
      opts,
    );
    expect(res.kind).toBe('candidates');
    if (res.kind !== 'candidates') return;
    const texts = res.candidates.map((c) => c.text);
    expect(texts).toEqual(
      expect.arrayContaining(['call Sarah', 'go to the garden', 'read my book']),
    );
    for (const c of res.candidates) {
      expect(c.provenance.nodeIds.length).toBeGreaterThan(0); // Hard Rule: grounded
      expect(c.explanation.length).toBeGreaterThan(0); // provenance-derived reason
      expect(['ship', 'sandbox']).toContain(c.gate);
      expect(c.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('respects the max-cards cognitive-load budget', async () => {
    const res = await suggest(
      exec,
      { userId: MAYA, partialText: 'I want to', intent: 'request' },
      { ...opts, maxCards: 3 },
    );
    if (res.kind !== 'candidates') throw new Error('expected candidates');
    expect(res.candidates.length).toBeLessThanOrEqual(3);
  });

  it('refuses (first-class) when there is nothing to ground a suggestion in', async () => {
    const res = await suggest(
      exec,
      { userId: '99999999-9999-4999-8999-999999999999', partialText: 'I want to' },
      opts,
    );
    expect(res.kind).toBe('refusal');
    if (res.kind !== 'refusal') return;
    expect(res.reason).toMatch(/confident suggestion/i);
    expect(res.alternatives.length).toBeGreaterThan(0);
  });

  it('high-stakes surfaces only therapist-approved items (or refuses)', async () => {
    const res = await suggest(
      exec,
      { userId: MAYA, partialText: 'I want to', intent: 'request', highStakes: true },
      opts,
    );
    if (res.kind === 'candidates') {
      for (const c of res.candidates) {
        expect(c.sourceTag).toBe('therapist-approved');
      }
      expect(res.candidates.map((c) => c.text)).not.toContain('go to the garden'); // Tier 1
    } else {
      expect(res.kind).toBe('refusal');
    }
  });
});
