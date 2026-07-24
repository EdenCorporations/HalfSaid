/**
 * Injected dependencies for the /v1 handlers. Keeping auth and DB access as deps
 * makes every handler a pure function of (request, deps) — fully testable against
 * PGlite, and wired to Supabase JWT + Postgres in the Next.js route files.
 */

import type { Embedder, SqlExecutor } from '@halfsaid/retrieval';

export interface ApiDeps {
  /** Resolve the authenticated user id from the request (Supabase JWT). Null = 401. */
  resolveUserId(req: Request): Promise<string | null>;
  /**
   * An RLS-scoped SQL executor for the given user — every query runs as that
   * authenticated user, so Row Level Security enforces owner-only visibility.
   */
  executorFor(userId: string): SqlExecutor;
  /** Embedder for the suggestion path (defaults to the env-selected one). */
  embedder?: Embedder;
  /** Groq key — when set, the LLM writes the suggestions (D20); else constrained. */
  llmApiKey?: string;
  /** Clock for recency (epoch seconds); defaults to real time. */
  now?: () => number;
}
