import { expect, test, type Page } from '@playwright/test';

/**
 * The Ch 31.1 acceptance path plus the demo-day upgrades: walkthrough, undo
 * window, high-stakes shield, and persona switching. Typed input (mic needs a
 * real device); everything else is the live demo.
 */

/** Pre-seed localStorage so a test starts past the first-visit tour. */
async function skipTour(page: Page, persona?: 'maya' | 'david') {
  await page.addInitScript(
    ([p]) => {
      window.localStorage.setItem('halfsaid.walkthrough.v1', 'done');
      if (p) window.localStorage.setItem('halfsaid.persona', p);
    },
    [persona],
  );
}

test('demo path: tour → type → suggestions → accept (undo window) → clinician log', async ({
  page,
}) => {
  await page.goto('/canvas');

  // First visit: the guided tour frames the PCG story, then gets out of the way.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(/personal communication graph/i);
  await page.getByRole('button', { name: /skip tour/i }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel(/type what you want to say/i).fill('I want to');
  await page.getByRole('button', { name: /get suggestions/i }).click();

  // The three demo candidates emerge from retrieval (not hardcoded).
  await expect(page.getByText('call Sarah')).toBeVisible();
  await expect(page.getByText('go to the garden')).toBeVisible();
  await expect(page.getByText('read my book')).toBeVisible();

  // Accept one — spoken immediately, persisted only after the 5s undo window.
  // (Match the SPOKEN ingest specifically — the typed input is ingested too.)
  const ingested = page.waitForResponse(
    (r) => r.url().includes('/pcg/ingest') && (r.request().postData() ?? '').includes('call Sarah'),
  );
  await page.getByRole('button', { name: /accept and speak: call Sarah/i }).click();
  await expect(page.getByLabel('Spoken')).toContainText('call Sarah');
  await expect(page.getByRole('button', { name: /undo speaking/i })).toBeVisible();
  await ingested; // the undo window elapsed and the utterance landed in the PCG

  // The clinician dashboard shows live stats, the MOCK-labelled FCM trend, and
  // the new log entry.
  await page.goto('/clinician');
  await expect(page.getByText('MOCK DATA')).toBeVisible();
  await expect(page.getByText('LIVE DATA')).toBeVisible();
  await expect(page.getByText('call Sarah').first()).toBeVisible();
});

test('a request returns grounded suggestions (never a raw error)', async ({ page }) => {
  await skipTour(page);
  await page.goto('/canvas');
  await page.getByLabel(/type what you want to say/i).fill('read');
  await page.getByRole('button', { name: /get suggestions/i }).click();
  // A real card appears (the "unsure" note or a source tag), i.e. a grounded
  // response — not a crash. At least one Accept button proves a card rendered.
  await expect(page.getByRole('button', { name: /accept and speak/i }).first()).toBeVisible();
});

test('a detected high-stakes topic restricts to clinician-approved phrases', async ({ page }) => {
  await skipTour(page);
  await page.goto('/canvas');
  await page.getByLabel(/type what you want to say/i).fill('I need my medication');
  await page.getByRole('button', { name: /get suggestions/i }).click();
  // Whether cards or a refusal come back, the block explains itself.
  await expect(page.getByText(/clinician-approved/i).first()).toBeVisible();
});

test('teach chat: a typed fact is ingested and acknowledged', async ({ page }) => {
  await skipTour(page);
  await page.goto('/ingest');
  const fact = 'Nora visits every Sunday and they bake scones';
  await page.getByLabel(/tell halfsaid something/i).fill(fact);
  const ingested = page.waitForResponse((r) => r.url().includes('/pcg/chat'));
  await page.getByRole('button', { name: /send/i }).click();
  await ingested;
  // The message bubble + the (no-key deterministic) acknowledgement render.
  await expect(page.getByText(fact)).toBeVisible();
  await expect(page.getByText(/saved/i).first()).toBeVisible();
  // …and the fact is now IN the graph: the clinician log shows it.
  await page.goto('/clinician');
  await expect(page.getByText(fact).first()).toBeVisible();
});

test('persona switch: David gets suggestions from HIS graph', async ({ page }) => {
  await skipTour(page, 'david');
  await page.goto('/canvas');
  await expect(page.getByRole('heading', { name: /david's conversation/i })).toBeVisible();

  await page.getByLabel(/type what you want to say/i).fill('call');
  await page.getByRole('button', { name: /get suggestions/i }).click();
  // David's wife, not Maya's daughter.
  await expect(page.getByText('call Anna')).toBeVisible();
  await expect(page.getByText('call Sarah')).toHaveCount(0);
});
