/**
 * Row Level Security (SPEC §6, PRD §13.4). Proves the privacy guarantee:
 *
 *   - the owner sees their own rows, every tier;
 *   - a different authenticated user sees NONE of the owner's rows (incl. Tier 1);
 *   - `anon` cannot read the PCG at all;
 *   - an admin-like role (NOBYPASSRLS) sees nothing it doesn't own — there is no
 *     admin role that can read Tier 1;
 *   - only `service_role` (BYPASSRLS, server-only infra credential) bypasses RLS.
 */

import { createTestDb, type TestDb } from '../testing/harness';

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('RLS tier visibility', () => {
  let t: TestDb;

  beforeAll(async () => {
    t = await createTestDb();
    await t.become({ kind: 'postgres' });
    await t.exec(`
      insert into public.users (id, name) values ('${A}', 'Maya'), ('${B}', 'Other');
      insert into public.pcg_nodes (user_id, node_type, event_time, privacy_tier, attributes) values
        ('${A}', 'Utterance', now(), 1, '{"content":"private thought"}'),
        ('${A}', 'Utterance', now(), 3, '{"content":"therapy note"}'),
        ('${B}', 'Utterance', now(), 1, '{"content":"other private"}');
    `);
  });
  afterAll(async () => {
    await t.close();
  });

  it('owner A sees only their own rows — all tiers', async () => {
    await t.become({ kind: 'user', uid: A });
    const rows = await t.query<{ privacy_tier: number }>(
      `select privacy_tier from public.pcg_nodes order by privacy_tier;`,
    );
    expect(rows.map((r) => r.privacy_tier)).toEqual([1, 3]);
  });

  it('user B cannot see ANY of A rows, including Tier 1', async () => {
    await t.become({ kind: 'user', uid: B });
    const aRows = await t.query<{ n: number }>(
      `select count(*)::int as n from public.pcg_nodes where user_id = '${A}';`,
    );
    expect(aRows[0]!.n).toBe(0);
    // B only ever sees its own single row
    const own = await t.query<{ n: number }>(`select count(*)::int as n from public.pcg_nodes;`);
    expect(own[0]!.n).toBe(1);
  });

  it('anon cannot read the PCG at all', async () => {
    await t.become({ kind: 'anon' });
    await expect(t.query(`select * from public.pcg_nodes;`)).rejects.toThrow();
  });

  it('an admin-like role (no bypassrls) sees nothing — no admin reads Tier 1', async () => {
    await t.become({ kind: 'admin' });
    const rows = await t.query<{ n: number }>(`select count(*)::int as n from public.pcg_nodes;`);
    expect(rows[0]!.n).toBe(0);
  });

  it('service_role (server-only infra credential) bypasses RLS by design', async () => {
    await t.become({ kind: 'service_role' });
    const rows = await t.query<{ n: number }>(`select count(*)::int as n from public.pcg_nodes;`);
    expect(rows[0]!.n).toBe(3);
  });

  it('a user cannot insert rows owned by someone else (WITH CHECK)', async () => {
    await t.become({ kind: 'user', uid: B });
    await expect(
      t.exec(
        `insert into public.pcg_nodes (user_id, node_type, event_time)
           values ('${A}', 'Utterance', now());`,
      ),
    ).rejects.toThrow();
  });
});
