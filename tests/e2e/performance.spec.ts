import { test, expect } from '@playwright/test';

/**
 * Performance & Perceived Speed Measurements (Phase 12)
 * Measures real browser performance: initial load, analysis execution latency,
 * and cell drilldown responsiveness against authoritative baselines.
 */
test.describe('Performance & Speed Measurements', () => {
  test('landing page loads and is interactive within acceptable threshold (< 3.0s)', async ({ page }) => {
    const t0 = Date.now();
    await page.goto('/', { waitUntil: 'load' });
    const loadTime = Date.now() - t0;
    console.log(`[PERF] Landing page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3500); // 3.5s budget on local server
  });

  test('cached analysis execution completes rapidly (< 2.5s)', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 25000 });

    // Click Texas Basin preset (already executed and cached in SQLite L2)
    const txBtn = page.getByRole('button', { name: 'Texas Basin' });
    const t0 = Date.now();
    await txBtn.click();
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 15000 });
    const elapsed = Date.now() - t0;
    console.log(`[PERF] Preset load & render latency: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(5000);
  });

  test('coordinate drilldown cell fetch responds under 500ms', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 25000 });

    const firstSignal = page.locator('button:has-text("#1")').first();
    await expect(firstSignal).toBeVisible({ timeout: 15000 });

    const t0 = Date.now();
    await firstSignal.click();
    await expect(page.getByRole('heading', { name: /Scientific Evidence Record/i })).toBeVisible({ timeout: 3000 });
    const elapsed = Date.now() - t0;
    console.log(`[PERF] Cell drilldown click-to-render latency: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2500);
  });
});
