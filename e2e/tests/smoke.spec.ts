import { test, expect } from '@playwright/test';

test('has correct page title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Financely');
});

test('renders the root component', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('app-root')).toBeVisible();
});

test('shows main navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Movements' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Categories' })).toBeVisible();
});
