/**
 * POST /v1/pcg/ingest tests (D20). Persists the utterance; entity extraction is
 * best-effort and only runs with a Groq key (covered by the mocked retrieval tests),
 * so here we exercise the no-key persistence path + validation.
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';

import { handleIngest } from '../index';
import { makeTestDeps, type TestDepsHandle } from '../testing/deps';

const MAYA = '00000000-0000-4000-8000-000000000001';
const base = 'http://localhost/v1/pcg/ingest';

const post = (body?: unknown): Request =>
  new Request(base, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

describe('POST /v1/pcg/ingest', () => {
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

  it('persists the utterance (no key → no extraction, linked 0)', async () => {
    h.setUser(MAYA);
    const phrase = 'a unique ingest phrase 42';
    const res = await handleIngest(post({ content: phrase }), h.deps);
    expect(res.status).toBe(201);
    const data = (await res.json()) as { utteranceId: string; linked: number };
    expect(data.utteranceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.linked).toBe(0);

    await t.become({ kind: 'postgres' });
    const rows = await t.query<{ c: string; embedded: boolean }>(
      `select attributes->>'content' as c, (embedding is not null) as embedded
         from public.pcg_nodes
        where node_type = 'Utterance' and attributes->>'content' = $1;`,
      [phrase],
    );
    expect(rows).toHaveLength(1);
    // Ingest-time embedding: the new utterance is immediately semantically reachable.
    expect(rows[0]!.embedded).toBe(true);
  });

  it('400 on empty content, 401 unauthenticated, 405 on non-POST', async () => {
    h.setUser(MAYA);
    expect((await handleIngest(post({ content: '   ' }), h.deps)).status).toBe(400);
    h.setUser(null);
    expect((await handleIngest(post({ content: 'x' }), h.deps)).status).toBe(401);
    h.setUser(MAYA);
    expect((await handleIngest(new Request(base, { method: 'GET' }), h.deps)).status).toBe(405);
  });
});
