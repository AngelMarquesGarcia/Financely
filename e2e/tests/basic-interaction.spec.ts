import { test, expect } from '../fixtures/app.fixture';

test('should interact with operations component', async ({ page }) => {
  await page.goto('/');

  // Navigate to operations if it exists
  const operationsLink = page.locator('a:has-text("Operations")').first();

  if (await operationsLink.isVisible()) {
    await operationsLink.click();
    await expect(page).toHaveURL(/.*operations/);
  }
});

test('should interact with sentences component', async ({ page }) => {
  await page.goto('/');

  // Navigate to sentences if it exists
  const sentencesLink = page.locator('a:has-text("Sentences")').first();

  if (await sentencesLink.isVisible()) {
    await sentencesLink.click();
    await expect(page).toHaveURL(/.*sentences/);
  }
});
