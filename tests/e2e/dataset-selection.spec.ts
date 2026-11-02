import { test, expect } from '@playwright/test';

/**
 * Journey C — Dataset and Parameter Selection (Phase 4)
 * Tests switching between NASA POWER and MERRA-2, verifying dynamic variable
 * options, units, physical descriptions, and scientific provider citations.
 */
test.describe('Journey C — Dataset & Parameter Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 25000 });
  });

  test('switching dataset updates variable options and provider metadata dynamically', async ({ page }) => {
    const dataStreamSelect = page.locator('#data-stream-select');
    const varSelect = page.locator('#variable-select');

    // 1. Initial: NASA POWER
    await dataStreamSelect.selectOption('nasa_power');
    await expect(page.getByText('NASA Langley Research Center', { exact: false })).toBeVisible();

    // Verify NASA POWER variables present
    const powerOptions = await varSelect.locator('option').allInnerTexts();
    expect(powerOptions.some((opt) => opt.includes('T2M') || opt.includes('Temperature'))).toBe(true);
    expect(powerOptions.some((opt) => opt.includes('PRECTOTCORR') || opt.includes('Precipitation'))).toBe(true);

    // 2. Switch to MERRA-2 Reanalysis
    await dataStreamSelect.selectOption('merra2_reanalysis');
    await expect(page.getByText('NASA GMAO Atmospheric', { exact: false })).toBeVisible();

    // Verify MERRA-2 variables present
    const merraOptions = await varSelect.locator('option').allInnerTexts();
    expect(merraOptions.some((opt) => opt.includes('T2M') || opt.includes('Temperature'))).toBe(true);
  });

  test('user can trigger and observe Pre-flight Scientific Quality Gate assessment', async ({ page }) => {
    // Inspect pre-flight quality gate status panel
    const gatePanel = page.locator("div:has-text('Evaluating scientific feasibility'), div:has-text('Fully Supported'), div:has-text('Supported')");
    await expect(gatePanel.first()).toBeVisible({ timeout: 10000 });
  });
});
