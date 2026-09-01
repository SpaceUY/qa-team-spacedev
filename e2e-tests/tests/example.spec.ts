import { test, expect } from '@playwright/test';

/**
 * Template smoke test. Copy this file's pattern into a new spec when
 * onboarding a project — replace the assertions with something real for
 * that app (e.g. a visible heading, a nav link, a login form).
 *
 * Run against a specific target with:
 *   BASE_URL=https://your-app.example.com npx playwright test
 */
test.describe('example smoke test', () => {
  test('home page loads and has a title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });
});
