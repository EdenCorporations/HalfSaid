import { expect, test } from '@playwright/test';

/**
 * The Ch 31.1 acceptance test: Maya opens the Canvas, says "I want to…", three
 * grounded candidates appear, she taps one, it's spoken, and the clinician log shows
 * the exchange. Typed here (mic needs a real device); everything else is the demo.
 */
test('demo path: type → grounded suggestions → accept → clinician log', async ({ page }) => {
  await page.goto('/canvas');

  await page.getByLabel(/type what you want to say/i).fill('I want to');
  await page.getByRole('button', { name: /get suggestions/i }).click();

  // The three demo candidates emerge from retrieval (not hardcoded).
  await expect(page.getByText('call Sarah')).toBeVisible();
  await expect(page.getByText('go to the garden')).toBeVisible();
  await expect(page.getByText('read my book')).toBeVisible();

  // Accept one — it is spoken and recorded.
  await page.getByRole('button', { name: /accept and speak: call Sarah/i }).click();
  await expect(page.getByLabel('Spoken')).toContainText('call Sarah');

  // The clinician dashboard shows the FCM trend (mock) and the new log entry.
  await page.goto('/clinician');
  await expect(page.getByText('MOCK DATA')).toBeVisible();
  await expect(page.getByText('call Sarah').first()).toBeVisible();
});

test('a request returns grounded suggestions (never a raw error)', async ({ page }) => {
  await page.goto('/canvas');
  await page.getByLabel(/type what you want to say/i).fill('read');
  await page.getByRole('button', { name: /get suggestions/i }).click();
  // A real card appears (the "unsure" note or a source tag), i.e. a grounded
  // response — not a crash. At least one Accept button proves a card rendered.
  await expect(page.getByRole('button', { name: /accept and speak/i }).first()).toBeVisible();
});
