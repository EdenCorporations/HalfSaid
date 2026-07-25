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

  it('BLENDS retrieved PCG phrases with LLM cards when a Groq key is provided (D20)', async () => {
    const fetchImpl = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                // One duplicates a PCG phrase (must de-dupe), one is novel.
                suggestions: ['I want to call Sarah', 'I want to visit the garden'],
              }),
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const res = await suggest(
      exec,
      { userId: MAYA, partialText: 'I want to', intent: 'request' },
      { ...opts, groqApiKey: 'k', fetchImpl },
    );
    expect(res.kind).toBe('candidates');
    if (res.kind !== 'candidates') return;
    const texts = res.candidates.map((c) => c.text);
    // The user's own phrases lead (strong match) AND the LLM's novel sentence appears.
    expect(res.candidates[0]!.generated).toBeUndefined();
    expect(texts).toContain('call Sarah');
    expect(texts).toContain('I want to visit the garden');
    // De-dupe: "I want to call Sarah" (LLM) collapses into "call Sarah" (PCG).
    expect(texts).not.toContain('I want to call Sarah');
  });

  it('a close graph match beats generic generation ("Call my daughter" → "call Sarah")', async () => {
    const junkLlm = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: { content: JSON.stringify({ suggestions: ['I need help', 'Call her now'] }) },
          },
        ],
      }),
    })) as unknown as typeof fetch;

    const res = await suggest(
      exec,
      { userId: MAYA, partialText: 'Call my daughter', intent: 'request' },
      { ...opts, groqApiKey: 'k', fetchImpl: junkLlm },
    );
    if (res.kind !== 'candidates') throw new Error('expected candidates');
    const texts = res.candidates.map((c) => c.text);
    expect(texts).toContain('call Sarah');
    const pcgIdx = texts.indexOf('call Sarah');
    const llmIdx = texts.indexOf('I need help');
    // The PCG's real answer ranks above the LLM's generic one.
    expect(res.candidates[pcgIdx]!.generated).toBeUndefined();
    if (llmIdx !== -1) expect(pcgIdx).toBeLessThan(llmIdx);
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

  it('DETECTS a high-stakes topic and never free-generates for it (SPEC §7.3)', async () => {
    const llmSpy = jest.fn();
    const res = await suggest(
      exec,
      { userId: MAYA, partialText: 'I need my medication', intent: 'request' },
      { ...opts, groqApiKey: 'k', fetchImpl: llmSpy as unknown as typeof fetch },
    );
    // The LLM must NOT be called — medication is a detected medical context.
    expect(llmSpy).not.toHaveBeenCalled();
    expect(res.highStakes).toBe(true);
    expect(res.highStakesCategory).toBe('medical');
    if (res.kind === 'candidates') {
      for (const c of res.candidates) {
        expect(c.sourceTag).toBe('therapist-approved');
        expect(c.generated).toBeUndefined();
      }
    }
  });
});
