/**
 * Real per-request, RLS-scoped Postgres executor (SPEC §6, §12; replaces the D16
 * stub). Each query runs in its own transaction as the `authenticated` role with the
 * caller's JWT subject set, so Supabase Row Level Security enforces owner-only access
 * — exactly the guarantee the RLS tests prove. Connects via the IPv4 session pooler.
 */

import { Pool } from 'pg';
import type { SqlExecutor } from '@halfsaid/retrieval';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.SUPABASE_DB_HOST,
      port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
      user: process.env.SUPABASE_DB_USER,
      password: process.env.SUPABASE_DB_PASSWORD,
      database: process.env.SUPABASE_DB_NAME ?? 'postgres',
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

/** True when Supabase connection details are configured. */
export function hasRealDb(): boolean {
  return Boolean(process.env.SUPABASE_DB_HOST);
}

export function pgExecutorFor(userId: string): SqlExecutor {
  return async <T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> => {
    const client = await getPool().connect();
    try {
      await client.query('begin');
      // Become the authenticated user for this transaction so RLS applies.
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      const res = await client.query(sql, params);
      await client.query('commit');
      return res.rows as T[];
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };
}
