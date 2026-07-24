/**
 * Bi-temporal semantics (SPEC §4.4). A correction inserts a NEW row and points the
 * original's superseded_by at it; the original is RETAINED, never overwritten. The
 * append-only trigger makes overwriting content structurally impossible.
 *
 * Runs as the superuser bootstrap connection (bypasses RLS) to focus on the
 * bi-temporal invariant, not visibility.
 */

import { createTestDb, type TestDb } from '../testing/harness';

const USER = '22222222-2222-2222-2222-222222222222';
const vec = (fill: number): string => `[${Array(1024).fill(fill).join(',')}]`;

describe('bi-temporal corrections', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb();
    await t.become({ kind: 'postgres' });
    await t.exec(`insert into public.users (id, name) values ('${USER}', 'Maya');`);
  });
  afterAll(async () => {
    await t.close();
  });

  it('supersedes with a new row and retains the original', async () => {
    const [orig] = await t.query<{ id: string }>(
      `insert into public.pcg_nodes (user_id, node_type, event_time, attributes)
         values ('${USER}', 'Utterance', now(), '{"content":"it was Saturday"}')
         returning id;`,
    );
    const [correction] = await t.query<{ id: string }>(
      `insert into public.pcg_nodes (user_id, node_type, event_time, attributes)
         values ('${USER}', 'Utterance', now(), '{"content":"actually Sunday"}')
         returning id;`,
    );

    // Point the original at its correction (superseded_by is mutable).
    await t.exec(
      `update public.pcg_nodes set superseded_by = '${correction!.id}' where id = '${orig!.id}';`,
    );

    const both = await t.query<{ id: string; content: string; superseded_by: string | null }>(
      `select id, attributes->>'content' as content, superseded_by
         from public.pcg_nodes where id in ('${orig!.id}', '${correction!.id}') order by ingestion_time;`,
    );
    expect(both).toHaveLength(2); // BOTH rows retained
    const original = both.find((r) => r.id === orig!.id)!;
    expect(original.content).toBe('it was Saturday'); // original NOT overwritten
    expect(original.superseded_by).toBe(correction!.id);
  });

  it('refuses to overwrite content (append-only trigger)', async () => {
    const [n] = await t.query<{ id: string }>(
      `insert into public.pcg_nodes (user_id, node_type, event_time, attributes)
         values ('${USER}', 'Utterance', now(), '{"content":"original"}')
         returning id;`,
    );
    await expect(
      t.exec(
        `update public.pcg_nodes set attributes = '{"content":"tampered"}' where id = '${n!.id}';`,
      ),
    ).rejects.toThrow(/append-only/);
  });

  it('allows a one-time embedding backfill (NULL -> value) but not a rewrite', async () => {
    const [n] = await t.query<{ id: string }>(
      `insert into public.pcg_nodes (user_id, node_type, event_time)
         values ('${USER}', 'Utterance', now()) returning id;`,
    );
    // NULL -> value: allowed (Phase 3 embedder backfill).
    await expect(
      t.exec(`update public.pcg_nodes set embedding = '${vec(0.1)}' where id = '${n!.id}';`),
    ).resolves.toBeUndefined();
    // value -> other value: blocked.
    await expect(
      t.exec(`update public.pcg_nodes set embedding = '${vec(0.2)}' where id = '${n!.id}';`),
    ).rejects.toThrow(/append-only/);
  });
});
