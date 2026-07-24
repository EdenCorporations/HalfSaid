/**
 * @halfsaid/api — framework-agnostic /v1 request handlers (SPEC §12). The Next.js
 * route files under apps/web/app/api/v1 are thin adapters that inject real deps
 * (Supabase JWT auth + an RLS-scoped Postgres executor).
 */

export type { ApiDeps } from './deps';
export { json, apiError, readJson, methodNotAllowed } from './http';
export { handleSuggestions } from './handlers/suggestions';
export { handleNodes } from './handlers/nodes';
