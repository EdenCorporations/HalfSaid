/**
 * GET /v1/pcg/timeline tests (SPEC §12, §13). Reverse-chronological, RLS-scoped,
 * filterable by person/topic/emotion/language.
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';
import type { TimelineResponse } from '@halfsaid/shared-types';

import { handleTimeline } from '../index';
import { makeTestDeps, type TestDepsHandle } from '../testing/deps';

const MAYA = '00000000-0000-4000-8000-000000000001';
const base = 'http://localhost/v1/pcg/timeline';
const get = (query = ''): Request => new Request(base + query, { method: 'GET' });

describe('GET /v1/pcg/timeline', () => {
  let t: TestDb;
  let h: TestDepsHandle;

  beforeAll(async () => {
    t = await createTestDb({ withSeed: true });
    await t.become({ kind: 'postgres' });
    h = makeTestDeps(t);
  });
  afterAll(async () => {
    await t.close();
  });

  it('returns utterances newest-first', async () => {
    h.setUser(MAYA);
    const data = (await (
      await handleTimeline(get('?limit=50'), h.deps)
    ).json()) as TimelineResponse;
    expect(data.items.length).toBeGreaterThan(0);
    const dates = data.items.map((i) => Date.parse(i.date));
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it('filters by person (mentioned edge)', async () => {
    h.setUser(MAYA);
    const data = (await (
      await handleTimeline(get('?person=Sarah&limit=100'), h.deps)
    ).json()) as TimelineResponse;
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.some((i) => i.summary.includes('Sarah'))).toBe(true);
  });

  it('filters by topic (about edge)', async () => {
    h.setUser(MAYA);
    const data = (await (
      await handleTimeline(get('?topic=gardening&limit=100'), h.deps)
    ).json()) as TimelineResponse;
    expect(data.items.length).toBeGreaterThan(0);
  });

  it('searches utterance content with q (case-insensitive)', async () => {
    h.setUser(MAYA);
    const data = (await (
      await handleTimeline(get('?q=SARAH&limit=100'), h.deps)
    ).json()) as TimelineResponse;
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.every((i) => /sarah/i.test(i.summary))).toBe(true);
    expect(data.total).toBe(data.items.length);
  });

  it('paginates with offset and reports the pre-page total', async () => {
    h.setUser(MAYA);
    const page1 = (await (
      await handleTimeline(get('?limit=5&offset=0'), h.deps)
    ).json()) as TimelineResponse;
    const page2 = (await (
      await handleTimeline(get('?limit=5&offset=5'), h.deps)
    ).json()) as TimelineResponse;
    expect(page1.items).toHaveLength(5);
    expect(page2.items).toHaveLength(5);
    expect(page1.total!).toBeGreaterThan(10);
    expect(page2.total).toBe(page1.total);
    const ids1 = new Set(page1.items.map((i) => i.id));
    expect(page2.items.every((i) => !ids1.has(i.id))).toBe(true);
  });

  it('is RLS-scoped: another user sees an empty timeline', async () => {
    h.setUser('88888888-8888-4888-8888-888888888888');
    const data = (await (await handleTimeline(get(), h.deps)).json()) as TimelineResponse;
    expect(data.items).toHaveLength(0);
  });

  it('401 unauthenticated, 405 on non-GET', async () => {
    h.setUser(null);
    expect((await handleTimeline(get(), h.deps)).status).toBe(401);
    h.setUser(MAYA);
    expect((await handleTimeline(new Request(base, { method: 'POST' }), h.deps)).status).toBe(405);
  });
});
