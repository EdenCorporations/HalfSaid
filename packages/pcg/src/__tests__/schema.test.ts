/**
 * Schema shape tests (SPEC §4). Applies the real migrations via PGlite and checks
 * the bi-temporal columns, type CHECK constraints, embedding dimension, and tier
 * bounds are exactly as specified.
 */

import { createTestDb, type TestDb } from '../testing/harness';
import { NODE_TYPES, EDGE_TYPES } from '../index';

const USER = '11111111-1111-1111-1111-111111111111';

async function seedUser(t: TestDb): Promise<void> {
  await t.become({ kind: 'postgres' });
  await t.exec(`insert into public.users (id, name) values ('${USER}', 'Maya');`);
}

describe('PCG schema', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
    await seedUser(t);
  });
  afterAll(async () => {
    await t.close();
  });

  it('creates pcg_nodes and pcg_edges with bi-temporal + superseded_by columns', async () => {
    const cols = await t.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema='public' and table_name in ('pcg_nodes','pcg_edges')
          and column_name in ('event_time','ingestion_time','superseded_by')
        order by table_name, column_name;`,
    );
    // both tables carry all three
    expect(cols).toHaveLength(6);
  });

  it('pcg_nodes.embedding is vector(1024)', async () => {
    const rows = await t.query<{ atttypmod: number; format: string }>(
      `select a.atttypmod, format_type(a.atttypid, a.atttypmod) as format
         from pg_attribute a
         where a.attrelid = 'public.pcg_nodes'::regclass and a.attname = 'embedding';`,
    );
    expect(rows[0]?.format).toBe('vector(1024)');
  });

  it('accepts every valid node type and rejects an invalid one', async () => {
    for (const nt of NODE_TYPES) {
      await expect(
        t.query(
          `insert into public.pcg_nodes (user_id, node_type, event_time)
             values ('${USER}', '${nt}', now()) returning id;`,
        ),
      ).resolves.toBeDefined();
    }
    await expect(
      t.exec(
        `insert into public.pcg_nodes (user_id, node_type, event_time)
           values ('${USER}', 'NotAType', now());`,
      ),
    ).rejects.toThrow();
  });

  it('accepts every valid edge type and rejects an invalid one', async () => {
    const [n1] = await t.query<{ id: string }>(
      `insert into public.pcg_nodes (user_id, node_type, event_time)
         values ('${USER}', 'Person', now()) returning id;`,
    );
    const [n2] = await t.query<{ id: string }>(
      `insert into public.pcg_nodes (user_id, node_type, event_time)
         values ('${USER}', 'Person', now()) returning id;`,
    );
    for (const et of EDGE_TYPES) {
      await expect(
        t.query(
          `insert into public.pcg_edges (user_id, edge_type, from_id, to_id, event_time)
             values ('${USER}', '${et}', '${n1!.id}', '${n2!.id}', now()) returning id;`,
        ),
      ).resolves.toBeDefined();
    }
    await expect(
      t.exec(
        `insert into public.pcg_edges (user_id, edge_type, from_id, to_id, event_time)
           values ('${USER}', 'not_an_edge', '${n1!.id}', '${n2!.id}', now());`,
      ),
    ).rejects.toThrow();
  });

  it('rejects a privacy_tier outside 0..3', async () => {
    await expect(
      t.exec(
        `insert into public.pcg_nodes (user_id, node_type, event_time, privacy_tier)
           values ('${USER}', 'Utterance', now(), 4);`,
      ),
    ).rejects.toThrow();
  });
});
