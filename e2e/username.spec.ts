  import { test, expect } from '@playwright/test';

  test('shows username screen on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('Enter your username')).toBeVisible();
  });