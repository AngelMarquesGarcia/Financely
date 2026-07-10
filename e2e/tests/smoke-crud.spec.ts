import { test, expect } from '@playwright/test';

test('/ redirects to /movements', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/movements/);
  await expect(page.locator('app-movements')).toBeVisible();
});

test('Settings page opens via navbar', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/settings/);
  await expect(page.locator('app-settings')).toBeVisible();
});

test.fixme('create a category then create a movement and see the envelope name in the list', async ({ page }) => {
  // Requires the Electron IPC layer (window.categories, window.movements).
  // Playwright runs against ng serve only, so all IPC calls throw — the form never becomes interactive.
  await page.goto('/categories');

  // Create a test category
  const categoryName = `E2E Cat ${Date.now()}`;
  await page.fill('[id="cat-name"]', categoryName);
  await page.getByRole('button', { name: 'Create' }).first().click();
  await expect(page.getByText(categoryName)).toBeVisible();

  // Navigate to Movements and create a movement
  await page.getByRole('link', { name: 'Movements' }).click();
  await page.fill('[id="mov-name"]', 'E2E Test Movement');
  await page.fill('[id="mov-amount"]', '10.00');
  await page.fill('[id="mov-category"]', categoryName);
  // Wait for the category datalist and confirm selection via change event
  await page.locator('[id="mov-category"]').dispatchEvent('change');

  // Submit the form
  await page.getByRole('button', { name: 'Create' }).first().click();

  // The row should appear in the movements list with an envelope name (not a raw number)
  const row = page.locator('table tbody tr').last();
  await expect(row).toBeVisible();
  // Envelope column should contain a non-numeric name (e.g. "Unassigned" or whatever the seed has)
  const envelopeCell = row.locator('td').nth(4);
  await expect(envelopeCell).not.toHaveText(/^\d+$/);
});
