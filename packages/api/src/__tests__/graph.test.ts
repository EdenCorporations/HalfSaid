/**
 * GET /v1/pcg/graph tests — the mini-map slice (hubs first) + growth totals.
 * RLS-scoped: Maya sees her graph, David sees his, never each other's.
 */

import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';
import { join, resolve } from 'node:path';

import { handleGraph } from '../index';
import { makeTestDeps, type TestDepsHandle } from '../testing/deps';

const MAYA = '00000000-0000-4000-8000-000000000001';
const DAVID = '00000000-0000-4000-8000-000000000101';
const REPO_ROOT = resolve(__dirname, '../../../..');

const get = (query = ''): Request =>
  new Request(`http://localhost/v1/pcg/graph${query}`, { method: 'GET' });

interface GraphBody {
  nodes: Array<{ id: string; type: string; label: string; degree: number }>;
  edges: Array<{ from: string; to: string; type: string }>;
  totals: { nodes: number; edges: number };
}

describe('GET /v1/pcg/graph', () => {
  let t: TestDb;
  let h: TestDepsHandle;

  beforeAll(async () => {
    t = await createTestDb({
      withSeed: true,
      extraSeedFiles: [join(REPO_ROOT, 'supabase', 'seed-david.sql')],
    });
    await t.become({ kind: 'postgres' });
    h = makeTestDeps(t);
  });
  afterAll(async () => {
    await t.close();
  });

  it('returns hub-ranked nodes, closed edges, and whole-graph totals', async () => {
    h.setUser(MAYA);
    const res = await handleGraph(get('?limit=40'), h.deps);
    expect(res.status).toBe(200);
    const body = (await res.json()) as GraphBody;

    expect(body.nodes.length).toBeGreaterThan(30);
    expect(body.nodes.length).toBeLessThanOrEqual(40);
    expect(body.totals.nodes).toBeGreaterThan(150); // full Maya seed
    expect(body.totals.edges).toBeGreaterThan(100);

    // Hub ranking: the first node has at least as many connections as the last.
    expect(body.nodes[0]!.degree).toBeGreaterThanOrEqual(body.nodes.at(-1)!.degree);

    // Edge closure: every edge endpoint is a returned node.
    const ids = new Set(body.nodes.map((n) => n.id));
    for (const e of body.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it('is RLS-scoped per persona (David sees his graph, never Maya data)', async () => {
    h.setUser(DAVID);
    const res = await handleGraph(get(), h.deps);
    const body = (await res.json()) as GraphBody;
    expect(body.totals.nodes).toBeGreaterThan(30); // David's seed
    expect(body.totals.nodes).toBeLessThan(100); // ...but nowhere near Maya's 200
    const labels = body.nodes.map((n) => n.label);
    expect(labels).toContain('Anna');
    expect(labels).not.toContain('Sarah');
  });

  it('freshly ingested nodes appear on the map even at low degree', async () => {
    h.setUser(MAYA);
    await t.become({ kind: 'postgres' });
    await t.query(
      `insert into public.pcg_nodes (user_id, node_type, attributes, event_time, privacy_tier)
         values ($1, 'Utterance', '{"content":"a brand new phrase"}'::jsonb, now(), 1);`,
      [MAYA],
    );
    const res = await handleGraph(get('?limit=40'), h.deps);
    const body = (await res.json()) as GraphBody;
    expect(body.nodes.map((n) => n.label)).toContain('a brand new phrase');
  });

  it('401 unauthenticated, 405 on POST', async () => {
    h.setUser(null);
    expect((await handleGraph(get(), h.deps)).status).toBe(401);
    h.setUser(MAYA);
    const res = await handleGraph(
      new Request('http://localhost/v1/pcg/graph', { method: 'POST' }),
      h.deps,
    );
    expect(res.status).toBe(405);
  });
});
