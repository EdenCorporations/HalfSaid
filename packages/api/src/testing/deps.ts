/**
 * Test deps: build ApiDeps from the PGlite harness. executorFor() switches the
 * session to the given user so Row Level Security enforces owner-only access —
 * exactly as a per-request RLS-scoped Postgres connection would in production.
 */

import type { TestDb } from '@halfsaid/pcg/testing';
import { MockEmbedder } from '@halfsaid/retrieval';
import type { ApiDeps } from '../deps';

export interface TestDepsHandle {
  deps: ApiDeps;
  /** Set the user the next request authenticates as (null = unauthenticated). */
  setUser(userId: string | null): void;
}

export function makeTestDeps(t: TestDb, now = 1_781_000_000): TestDepsHandle {
  let current: string | null = null;
  const deps: ApiDeps = {
    resolveUserId: async () => current,
    executorFor: (userId) => async (sql, params) => {
      await t.become({ kind: 'user', uid: userId });
      return t.query(sql, params);
    },
    embedder: new MockEmbedder(),
    now: () => now,
  };
  return { deps, setUser: (u) => (current = u) };
}
