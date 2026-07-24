/**
 * PGlite test harness (SPEC §16). Runs the REAL migration SQL against Postgres
 * compiled to WASM — no Docker required — so schema, bi-temporal, and RLS tests
 * run in CI without secrets.
 *
 * It first bootstraps a Supabase-compatible surface (the `auth.uid()` function and
 * the anon / authenticated / service_role roles the migrations grant to), then
 * applies every file in supabase/migrations in order. This keeps the migrations
 * Supabase-native (the single source of truth, SPEC §4.3) while remaining runnable
 * here.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';

const REPO_ROOT = resolve(__dirname, '../../../..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');
const SEED_FILE = join(REPO_ROOT, 'supabase', 'seed.sql');

/** A logged-in principal or an infrastructure role, for RLS tests. */
export type Principal =
  | { kind: 'user'; uid: string }
  | { kind: 'anon' }
  | { kind: 'service_role' }
  | { kind: 'admin' } // NOBYPASSRLS admin-like role — must see nothing it doesn't own
  | { kind: 'postgres' }; // superuser bootstrap connection (setup only)

export interface TestDb {
  readonly db: PGlite;
  /** Switch the session principal for subsequent queries (RLS applies). */
  become(principal: Principal): Promise<void>;
  /** Run a query as the current principal and return rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run one or more statements (DDL/seed) as the current principal. */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/** Supabase-compatible bootstrap applied before the migrations. */
const BOOTSTRAP_SQL = `
  create schema if not exists auth;

  -- Mirror of Supabase's auth.uid(): reads the JWT subject from a GUC.
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  create or replace function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '');
  $$;

  -- Roles the migrations grant to (Supabase provides these; we create them here).
  do $$ begin
    if not exists (select from pg_roles where rolname = 'anon') then
      create role anon nologin noinherit; end if;
    if not exists (select from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin noinherit; end if;
    if not exists (select from pg_roles where rolname = 'service_role') then
      create role service_role nologin noinherit bypassrls; end if;
    -- An admin-like application role WITHOUT bypassrls, used to prove that no such
    -- role can read another user's data (SPEC §6).
    if not exists (select from pg_roles where rolname = 'app_admin') then
      create role app_admin nologin noinherit; end if;
  end $$;
`;

function migrationFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export interface CreateTestDbOptions {
  /** Also apply supabase/seed.sql (the Maya PCG). */
  withSeed?: boolean;
  /** Override the migrations directory (default resolves from this file). */
  migrationsDir?: string;
  /** Override the seed file path (default resolves from this file). */
  seedFile?: string;
}

/** Spin up a fresh in-memory database with migrations (and optional seed) applied. */
export async function createTestDb(options: CreateTestDbOptions = {}): Promise<TestDb> {
  const migrationsDir = options.migrationsDir ?? MIGRATIONS_DIR;
  const seedFile = options.seedFile ?? SEED_FILE;

  const db = new PGlite({ extensions: { vector } });
  await db.exec(BOOTSTRAP_SQL);

  for (const file of migrationFiles(migrationsDir)) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await db.exec(sql);
  }

  // Mirror Supabase's default grants for the roles the harness adds:
  //  - app_admin gets the same table grants as `authenticated` so the "admin
  //    can't read Tier 1" test exercises RLS, not a missing GRANT;
  //  - service_role gets table grants too (Supabase grants it broadly), so its
  //    BYPASSRLS behaviour is actually demonstrable.
  await db.exec(`
    grant usage on schema public to app_admin, service_role;
    grant select on public.users, public.pcg_nodes, public.pcg_edges to app_admin, service_role;
  `);

  if (options.withSeed) {
    const seed = readFileSync(seedFile, 'utf8');
    await db.exec(seed);
  }

  async function become(principal: Principal): Promise<void> {
    switch (principal.kind) {
      case 'postgres':
        await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
        return;
      case 'anon':
        await db.exec(
          `reset role; set role anon; select set_config('request.jwt.claim.sub', '', false);`,
        );
        return;
      case 'service_role':
        await db.exec(`reset role; set role service_role;`);
        return;
      case 'admin':
        await db.exec(
          `reset role; set role app_admin; select set_config('request.jwt.claim.sub', '', false);`,
        );
        return;
      case 'user':
        await db.exec(
          `reset role; set role authenticated; select set_config('request.jwt.claim.sub', '${principal.uid}', false);`,
        );
        return;
    }
  }

  return {
    db,
    become,
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
      const res = await db.query<T>(sql, params);
      return res.rows;
    },
    async exec(sql: string): Promise<void> {
      await db.exec(sql);
    },
    async close(): Promise<void> {
      await db.close();
    },
  };
}
