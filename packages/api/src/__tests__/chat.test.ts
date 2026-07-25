/**
 * POST /v1/pcg/chat tests — the graph-building companion. Every message ingests
 * into the PCG; the reply acknowledges what was linked. No-key path returns a
 * deterministic acknowledgement (CI/offline safe).
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';

import { handleChat } from '../index';
import { makeTestDeps, type TestDepsHandle } from '../testing/deps';

const MAYA = '00000000-0000-4000-8000-000000000001';
const base = 'http://localhost/v1/pcg/chat';

const post = (body?: unknown): Request =>
  new Request(base, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

interface ChatReply {
  reply: string;
  utteranceId: string;
  linked: number;
  entities: { people: string[]; places: string[]; topics: string[] };
}

describe('POST /v1/pcg/chat', () => {
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

  it('ingests the message and replies deterministically without a key', async () => {
    h.setUser(MAYA);
    const message = 'Nora visits every Sunday and they bake scones';
    const res = await handleChat(post({ message }), h.deps);
    expect(res.status).toBe(201);
    const data = (await res.json()) as ChatReply;
    expect(data.reply).toMatch(/saved/i);
    expect(data.utteranceId).toMatch(/^[0-9a-f-]{36}$/);

    await t.become({ kind: 'postgres' });
    const rows = await t.query<{ source: string }>(
      `select attributes->>'source' as source from public.pcg_nodes
        where attributes->>'content' = $1;`,
      [message],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe('chat');
  });

  it('with an LLM: extracts entities into the graph and returns the companion reply', async () => {
    h.setUser(MAYA);
    h.deps.llmApiKey = 'test-key';
    // First LLM call = extraction, second = companion reply.
    h.deps.llmFetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  people: ['Nora'],
                  places: [],
                  objects: ['scones'],
                  topics: ['baking'],
                  intent: 'inform',
                }),
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Lovely — saved Nora. Does she live nearby?' } }],
        }),
      }) as unknown as typeof fetch;
    try {
      const res = await handleChat(
        post({ message: 'Nora bakes scones with her', history: [] }),
        h.deps,
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as ChatReply;
      expect(data.reply).toContain('Nora');
      expect(data.linked).toBe(4); // Nora + scones + baking + intent
      expect(data.entities.people).toEqual(['Nora']);

      await t.become({ kind: 'postgres' });
      const person = await t.query(
        `select id from public.pcg_nodes
          where node_type = 'Person' and attributes->>'name' = 'Nora' and user_id = $1;`,
        [MAYA],
      );
      expect(person).toHaveLength(1);
    } finally {
      h.deps.llmApiKey = undefined;
      h.deps.llmFetch = undefined;
    }
  });

  it('400 on empty message, 401 unauthenticated, 405 on GET', async () => {
    h.setUser(MAYA);
    expect((await handleChat(post({ message: '  ' }), h.deps)).status).toBe(400);
    h.setUser(null);
    expect((await handleChat(post({ message: 'x' }), h.deps)).status).toBe(401);
    h.setUser(MAYA);
    expect((await handleChat(new Request(base, { method: 'GET' }), h.deps)).status).toBe(405);
  });
});
