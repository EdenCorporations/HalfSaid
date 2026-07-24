# Deploying HalfSaid

The MVP runs end-to-end **locally against real Supabase** (verified: the 3-minute
demo path, and the Playwright E2E). This note covers hosting it.

## The runtime reality (read first)

HalfSaid's API is built as **Next.js Node-runtime route handlers** (`export const
runtime = 'nodejs'`). They use:

- **`pg`** — a raw TCP Postgres connection to Supabase (RLS-scoped via `SET ROLE`),
- **`node:fs`** — the mock DB reads the migration/seed files,
- **`@electric-sql/pglite`** (WASM) — the secret-free mock DB,
- **`node:crypto`** — Supabase JWT verification.

Cloudflare **Pages/Workers run on the V8 isolate runtime, not Node**.
`@cloudflare/next-on-pages` only accepts **Edge-runtime** routes, so it will refuse
to build our `nodejs` routes. A Pages deploy of the app as-is therefore **cannot
serve the API** (and would fail the build). This is a deliberate MVP tradeoff — the
app targets a Node host — not a bug.

## Recommended: a Node host (works today, no changes)

Any Node platform (Render, Railway, Fly.io, a VPS) runs the app unchanged:

```bash
npm ci
npm run build
HALFSAID_MOCK_MODE=true npm run start --workspace=apps/web   # or with real Supabase env
```

Set the env from `.env.example` (Supabase pooler fields + `GROQ_API_KEY`). The app
serves the Canvas, the `/v1` API, and the clinician dashboard.

## Cloudflare (needs an adaptation)

To actually run on Cloudflare, port the server to the Workers runtime with
**`@opennextjs/cloudflare`** (Node-compat) and make the data layer Workers-safe:

1. Replace the `pg` TCP executor with a Workers-compatible Postgres path — either
   `pg` over `cloudflare:sockets` (`nodejs_compat`), Cloudflare **Hyperdrive**, or the
   Supabase HTTP client via SQL RPC functions.
2. Exclude the mock DB (PGlite + `fs`) from the Workers bundle (dynamic-import it only
   when not on Workers), so the build has no `fs` dependency.
3. Keep `node:crypto` — it's available under `nodejs_compat`.

This is a real piece of work (a few hours, some uncertainty) and is tracked as a
post-MVP task.

### Credentials

- **Account ID:** `CLOUDFLARE_ACCOUNT_ID` (dashboard sidebar).
- **API token:** a scoped token with **Account → Cloudflare Pages → Edit** for *that
  account*. Verify access with:
  ```bash
  curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  ```
  A `success: true` means the token can deploy to that account; an `Authentication
  error` means the token is scoped to a different account or lacks Pages:Edit.

## Database

Apply the schema + seed to Supabase once (idempotent):

```bash
node scripts/apply-supabase.mjs   # migrations + Maya seed + embeddings, via the IPv4 pooler
```
