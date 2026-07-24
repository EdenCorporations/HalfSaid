/**
 * A minimal async SQL executor. Retrieval builds portable SQL and runs it through
 * this, so the same code works against PGlite (tests) and Postgres/Supabase (prod).
 */
export type SqlExecutor = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<T[]>;
