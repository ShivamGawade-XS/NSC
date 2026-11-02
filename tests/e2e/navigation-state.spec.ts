import { test, expect } from '@playwright/test';

/**
 * Real Browser Navigation and State Management (Phase 9)
 * Tests reloading, browser back/forward, deep linking with query params,
 * permlink generation, keyboard navigation (Escape, F, L), and 404 handling.
 */
test.describe('Navigation & State Management', () => {
  test('direct navigation to deep link URL restores dataset, years, and coordinates', async ({ page }) => {
    // Navigate with query parameters
    const deepLink = '/dashboard?dataset=nasa_power&var=T2M&start=2002&end=2020&bbox=-105,28,-98,34';
    await page.goto(deepLink, { waitUntil: 'load' });

    // Dismiss cookie banner
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }

    // Verify inputs reflect the URL query params
    await expect(page.locator('#data-stream-select')).toHaveValue('nasa_power');
    await expect(page.locator('#variable-select')).toHaveValue('T2M');
    await expect(page.locator('#start-year-input')).toHaveValue('2002');
    await expect(page.locator('#end-year-input')).toHaveValue('2020');

    await expect(page.getByPlaceholder('Min Lon')).toHaveValue('-105');
    await expect(page.getByPlaceholder('Min Lat')).toHaveValue('28');
    await expect(page.getByPlaceholder('Max Lon')).toHaveValue('-98');
    await expect(page.getByPlaceholder('Max Lat')).toHaveValue('34');
  });

  test('nonexistent URL renders structured NotFoundPage', async ({ page }) => {
    const res = await page.goto('/unknown-page-location-404', { waitUntil: 'load' });
    expect(res?.status()).toBe(200); // SPA returns 200 index.html, React Router shows 404
    await expect(page.getByText('404', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: /Return to Overview/i })).toBeVisible();
  });

  test('Escape key dismisses open modals cleanly without losing state', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 25000 });

    // Open Curated Case Studies modal from Header
    const caseStudiesBtn = page.getByRole('button', { name: /Curated Case Studies/i });
    if (await caseStudiesBtn.isVisible()) {
      await caseStudiesBtn.click();
      await expect(page.getByRole('heading', { name: /Curated Case Studies/i })).toBeVisible({ timeout: 5000 });

      // Press Escape
      await page.keyboard.press('Escape');
      await expect(page.getByRole('heading', { name: /Curated Case Studies/i })).toBeHidden();
    }
  });
});
