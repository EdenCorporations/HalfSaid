/**
 * POST /v1/suggestions handler tests (SPEC §12). Every candidate response carries
 * confidence + provenance; auth and validation are enforced; RLS scopes the user.
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';
import { MockEmbedder, backfillEmbeddings } from '@halfsaid/retrieval';
import type { SuggestionsResponse } from '@halfsaid/shared-types';

import { handleSuggestions } from '../index';
import { makeTestDeps, type TestDepsHandle } from '../testing/deps';

const MAYA = '00000000-0000-4000-8000-000000000001';

function post(body: unknown): Request {
  return new Request('http://localhost/v1/suggestions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /v1/suggestions', () => {
  let t: TestDb;
  let h: TestDepsHandle;

  beforeAll(async () => {
    t = await createTestDb({ withSeed: true });
    await t.become({ kind: 'postgres' });
    await backfillEmbeddings((sql, p) => t.query(sql, p), new MockEmbedder());
    h = makeTestDeps(t);
  });
  afterAll(async () => {
    await t.close();
  });

  it('returns grounded candidates with confidence + provenance for the demo', async () => {
    h.setUser(MAYA);
    const res = await handleSuggestions(
      post({ partialText: 'I want to', intent: 'request' }),
      h.deps,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as SuggestionsResponse;
    expect(data.kind).toBe('candidates');
    if (data.kind !== 'candidates') return;
    expect(data.candidates.map((c) => c.text)).toEqual(
      expect.arrayContaining(['call Sarah', 'go to the garden', 'read my book']),
    );
    for (const c of data.candidates) {
      expect(typeof c.confidence).toBe('number');
      expect(c.provenance.nodeIds.length).toBeGreaterThan(0);
    }
  });

  it('rejects a non-POST method with 405', async () => {
    h.setUser(MAYA);
    const res = await handleSuggestions(
      new Request('http://localhost/v1/suggestions', { method: 'GET' }),
      h.deps,
    );
    expect(res.status).toBe(405);
  });

  it('returns 401 when unauthenticated', async () => {
    h.setUser(null);
    const res = await handleSuggestions(post({ partialText: 'I want to' }), h.deps);
    expect(res.status).toBe(401);
  });

  it('returns 400 on a missing partialText', async () => {
    h.setUser(MAYA);
    const res = await handleSuggestions(post({ intent: 'request' }), h.deps);
    expect(res.status).toBe(400);
  });

  it('refuses (200) for an authenticated user with no PCG data', async () => {
    h.setUser('99999999-9999-4999-8999-999999999999');
    const res = await handleSuggestions(post({ partialText: 'I want to' }), h.deps);
    expect(res.status).toBe(200);
    const data = (await res.json()) as SuggestionsResponse;
    expect(data.kind).toBe('refusal');
  });
});
