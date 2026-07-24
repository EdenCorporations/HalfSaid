/**
 * Maya seed load test (SPEC §2, §14). Applies migrations + supabase/seed.sql and
 * asserts the synthetic 200-node PCG loads, the three demo utterances exist at the
 * source tiers that make the demo show all three tags, and the owner can read it
 * through RLS.
 */

import { createTestDb, type TestDb } from '../testing/harness';

const MAYA = '00000000-0000-4000-8000-000000000001';

describe('Maya PCG seed', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb({ withSeed: true });
  });
  afterAll(async () => {
    await t.close();
  });

  it('loads exactly 200 nodes for Maya', async () => {
    await t.become({ kind: 'postgres' });
    const rows = await t.query<{ n: number }>(
      `select count(*)::int as n from public.pcg_nodes where user_id = '${MAYA}';`,
    );
    expect(rows[0]!.n).toBe(200);
  });

  it('includes all 11 node types', async () => {
    const types = await t.query<{ node_type: string }>(
      `select distinct node_type from public.pcg_nodes order by node_type;`,
    );
    expect(types).toHaveLength(11);
  });

  it('has the three demo utterances at the tiers that show all three source tags', async () => {
    const rows = await t.query<{ content: string; privacy_tier: number }>(
      `select attributes->>'content' as content, privacy_tier
         from public.pcg_nodes
        where node_type = 'Utterance'
          and attributes->>'content' in ('call Sarah','go to the garden','read my book')
        order by content;`,
    );
    const byContent = Object.fromEntries(rows.map((r) => [r.content, r.privacy_tier]));
    expect(byContent['go to the garden']).toBe(1); // yours
    expect(byContent['call Sarah']).toBe(2); // family-validated
    expect(byContent['read my book']).toBe(3); // therapist-approved
  });

  it('links utterances to people/places/topics via edges (retrieval signal)', async () => {
    const edgeCount = await t.query<{ n: number }>(
      `select count(*)::int as n from public.pcg_edges where user_id = '${MAYA}';`,
    );
    expect(edgeCount[0]!.n).toBeGreaterThan(200);
    // "call Sarah" mentions the Person Sarah
    const mention = await t.query<{ ok: number }>(
      `select count(*)::int as ok
         from public.pcg_edges e
         join public.pcg_nodes u on u.id = e.from_id and u.attributes->>'content' = 'call Sarah'
         join public.pcg_nodes p on p.id = e.to_id and p.attributes->>'name' = 'Sarah'
        where e.edge_type = 'mentioned';`,
    );
    expect(mention[0]!.ok).toBe(1);
  });

  it('the owner can read the whole seeded PCG through RLS', async () => {
    await t.become({ kind: 'user', uid: MAYA });
    const rows = await t.query<{ n: number }>(`select count(*)::int as n from public.pcg_nodes;`);
    expect(rows[0]!.n).toBe(200);
  });
});
