import { test as base, expect } from '@playwright/test';

export const test = base.extend<{
  appReady: void;
}>({
  appReady: async ({ page }, use) => {
    // Setup before test
    await page.goto('/');
    await expect(page).toHaveTitle(/Angular.*Electron/i);

    // Run test
    await use();

    // Cleanup if needed
  },
});

export { expect };
