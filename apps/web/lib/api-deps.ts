/**
 * Wires the framework-agnostic @halfsaid/api handlers to real deps (SPEC §12, O4).
 * Server-only — imported only by the /api/v1 route handlers.
 *
 * Auth: Supabase JWT (HS256) in production; in mock mode, the `x-halfsaid-user`
 * header or the demo user (Maya) so the app works offline without secrets.
 *
 * DB: in mock mode, a single in-memory PGlite (migrations + seed + embeddings) so
 * the whole API runs with no Supabase — great for the demo. Real Postgres wiring
 * (a per-request RLS-scoped connection) is a deploy-time concern (Phase 7).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createTestDb, type TestDb } from '@halfsaid/pcg/testing';
import { backfillEmbeddings, getEmbedder, type SqlExecutor } from '@halfsaid/retrieval';
import type { ApiDeps } from '@halfsaid/api';
import { hasRealDb, pgExecutorFor } from './db-pg';

/** The seeded demo user (Maya). */
const DEMO_USER = '00000000-0000-4000-8000-000000000001';

const mockMode = process.env.HALFSAID_MOCK_MODE !== 'false';

// --- Mock in-memory database (singleton) ------------------------------------
let dbPromise: Promise<TestDb> | null = null;
function getMockDb(): Promise<TestDb> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // Next bundles the harness, so resolve migration/seed paths from the repo
      // root (cwd is apps/web under `next dev`), not from the harness's __dirname.
      const repoRoot = process.env.HALFSAID_REPO_ROOT ?? resolve(process.cwd(), '..', '..');
      const t = await createTestDb({
        withSeed: true,
        migrationsDir: join(repoRoot, 'supabase', 'migrations'),
        seedFile: join(repoRoot, 'supabase', 'seed.sql'),
        // Second demo persona (David) — persona switching needs both graphs.
        extraSeedFiles: [join(repoRoot, 'supabase', 'seed-david.sql')],
      });
      await t.become({ kind: 'postgres' });
      await backfillEmbeddings((sql, p) => t.query(sql, p), getEmbedder());
      return t;
    })();
  }
  return dbPromise;
}

function mockExecutorFor(userId: string): SqlExecutor {
  // NOTE: the mock DB shares one PGlite session, so this sets the RLS user per
  // query. Fine for the single-user demo; production uses an isolated per-request
  // Postgres connection instead.
  return async (sql, params) => {
    const t = await getMockDb();
    await t.become({ kind: 'user', uid: userId });
    return t.query(sql, params);
  };
}

// --- Auth -------------------------------------------------------------------
function b64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifySupabaseJwt(token: string, secret: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  const got = b64url(signature);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const claims = JSON.parse(b64url(payload).toString('utf8')) as { sub?: string; exp?: number };
    if (claims.exp && Date.now() / 1000 > claims.exp) return null;
    return claims.sub ?? null;
  } catch {
    return null;
  }
}

async function resolveUserId(req: Request): Promise<string | null> {
  if (mockMode) {
    return req.headers.get('x-halfsaid-user') ?? DEMO_USER;
  }
  const auth = req.headers.get('authorization');
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!auth?.startsWith('Bearer ') || !secret) return null;
  return verifySupabaseJwt(auth.slice(7), secret);
}

function executorFor(userId: string): SqlExecutor {
  // Prefer real Supabase when configured; otherwise the in-memory mock DB.
  if (hasRealDb()) return pgExecutorFor(userId);
  return mockExecutorFor(userId);
}

export function getApiDeps(): ApiDeps {
  return {
    resolveUserId,
    executorFor,
    embedder: getEmbedder(),
    // When a Groq key is present the LLM writes the suggestions (D20).
    llmApiKey: process.env.GROQ_API_KEY,
    now: () => Math.floor(Date.now() / 1000),
  };
}
