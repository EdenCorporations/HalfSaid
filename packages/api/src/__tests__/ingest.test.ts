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

  it('de-duplicates the same phrase within the 2-minute window', async () => {
    h.setUser(MAYA);
    const phrase = 'dedupe me please 77';
    const first = (await (await handleIngest(post({ content: phrase }), h.deps)).json()) as {
      utteranceId: string;
    };
    const res = await handleIngest(post({ content: phrase }), h.deps);
    expect(res.status).toBe(200);
    const second = (await res.json()) as { utteranceId: string; deduped?: boolean };
    expect(second.deduped).toBe(true);
    expect(second.utteranceId).toBe(first.utteranceId);

    await t.become({ kind: 'postgres' });
    const rows = await t.query(
      `select id from public.pcg_nodes where attributes->>'content' = $1;`,
      [phrase],
    );
    expect(rows).toHaveLength(1);
  });

  it("records the transcript source and tags the row as the user's own (tier 1)", async () => {
    h.setUser(MAYA);
    const phrase = 'typed input phrase 99';
    const res = await handleIngest(post({ content: phrase, source: 'transcript' }), h.deps);
    expect(res.status).toBe(201);

    await t.become({ kind: 'postgres' });
    const rows = await t.query<{ source: string; tier: number }>(
      `select attributes->>'source' as source, privacy_tier as tier
         from public.pcg_nodes where attributes->>'content' = $1;`,
      [phrase],
    );
    expect(rows[0]!.source).toBe('transcript');
    expect(rows[0]!.tier).toBe(1);
  });

  it('extracts entities AND the intent into nodes + edges (mocked LLM)', async () => {
    h.setUser(MAYA);
    h.deps.llmApiKey = 'test-key';
    h.deps.llmFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                people: ['Robert'],
                places: ['the beach'],
                objects: [],
                topics: ['chess'],
                intent: 'inform',
              }),
            },
          },
        ],
      }),
    }) as unknown as typeof fetch;
    try {
      const phrase = 'I played chess with Robert at the beach';
      const res = await handleIngest(post({ content: phrase }), h.deps);
      expect(res.status).toBe(201);
      const data = (await res.json()) as { utteranceId: string; linked: number };
      expect(data.linked).toBe(4); // Robert + the beach + chess + intent

      await t.become({ kind: 'postgres' });
      const edges = await t.query<{ edge_type: string; node_type: string; label: string }>(
        `select e.edge_type, n.node_type,
                coalesce(n.attributes->>'name', n.attributes->>'type') as label
           from public.pcg_edges e
           join public.pcg_nodes n on n.id = e.to_id
          where e.from_id = $1
          order by e.edge_type;`,
        [data.utteranceId],
      );
      expect(edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ edge_type: 'mentioned', node_type: 'Person', label: 'Robert' }),
          expect.objectContaining({
            edge_type: 'mentioned',
            node_type: 'Place',
            label: 'the beach',
          }),
          expect.objectContaining({ edge_type: 'about', node_type: 'Topic', label: 'chess' }),
          expect.objectContaining({ edge_type: 'expresses', node_type: 'Intent', label: 'inform' }),
        ]),
      );
    } finally {
      h.deps.llmApiKey = undefined;
      h.deps.llmFetch = undefined;
    }
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
