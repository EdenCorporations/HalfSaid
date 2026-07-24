import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config (SPEC §16). Drives the 3-minute demo path in a real browser against
 * `next dev` in mock mode — the in-memory PGlite DB + demo user, so the run is
 * deterministic and needs no secrets (good for CI). SUPABASE_DB_HOST='' forces the
 * mock DB even though the root .env has real Supabase configured.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  // The first suggestion request warms the in-memory DB (migrations + seed +
  // embeddings), which takes a few seconds — give assertions room for it.
  expect: { timeout: 25_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:3210',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Production server (`next start`) so all API routes share one process — the mock
  // DB is a single instance, so an accepted phrase persists across routes into the
  // clinician log. `npm run test:e2e` builds first. Mock DB + demo user, no secrets.
  webServer: {
    command: 'node ../../node_modules/next/dist/bin/next start -p 3210',
    url: 'http://localhost:3210/canvas',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // GROQ_API_KEY='' forces the deterministic constrained path (the LLM path
    // generates non-deterministic sentences, which can't be asserted).
    env: { HALFSAID_MOCK_MODE: 'true', SUPABASE_DB_HOST: '', GROQ_API_KEY: '' },
  },
});
