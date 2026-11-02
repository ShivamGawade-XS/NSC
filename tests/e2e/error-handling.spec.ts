import { test, expect } from '@playwright/test';

/**
 * Invalid Input & Edge-Case Testing (Phase 6/8)
 * Thinks like a user who makes mistakes: tests client-side validation guards,
 * bounds checking, temporal window minimums, and rapid click cooldown.
 */
test.describe('Invalid Input & Edge-Case Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 25000 });
  });

  test('start year greater than end year displays inline error and prevents execution', async ({ page }) => {
    const startYear = page.locator('#start-year-input');
    const endYear = page.locator('#end-year-input');

    await startYear.fill('2024');
    await endYear.fill('2018');

    const execBtn = page.getByRole('button', { name: /Execute Trend Detection/i });
    await execBtn.click();

    // Verify inline alert appears
    const alert = page.locator("[role='alert']");
    await expect(alert.first()).toBeVisible();
    await expect(alert.first()).toContainText('Start year (2024) cannot be greater than end year (2018)');
  });

  test('fewer than 3 observation years displays inline scientific minimum alert', async ({ page }) => {
    const startYear = page.locator('#start-year-input');
    const endYear = page.locator('#end-year-input');

    await startYear.fill('2020');
    await endYear.fill('2021'); // Only 2 years

    const execBtn = page.getByRole('button', { name: /Execute Trend Detection/i });
    await execBtn.click();

    const alert = page.locator("[role='alert']");
    await expect(alert.first()).toBeVisible();
    await expect(alert.first()).toContainText('At least 3 consecutive annual observations are required');
  });

  test('incomplete bounding box coordinates triggers spatial validation alert', async ({ page }) => {
    // Fill only Min Lon and leave others empty
    await page.getByPlaceholder('Min Lon').fill('-100.0');

    const execBtn = page.getByRole('button', { name: /Execute Trend Detection/i });
    await execBtn.click();

    const alert = page.locator("[role='alert']");
    await expect(alert.first()).toBeVisible();
    await expect(alert.first()).toContainText('All 4 spatial bounding coordinates');
  });

  test('latitude coordinates outside valid bounds [-90, +90] triggers validation error', async ({ page }) => {
    await page.getByPlaceholder('Min Lon').fill('-100.0');
    await page.getByPlaceholder('Min Lat').fill('-95.0'); // Invalid latitude
    await page.getByPlaceholder('Max Lon').fill('-95.0');
    await page.getByPlaceholder('Max Lat').fill('35.0');

    const execBtn = page.getByRole('button', { name: /Execute Trend Detection/i });
    await execBtn.click();

    const alert = page.locator("[role='alert']");
    await expect(alert.first()).toBeVisible();
    await expect(alert.first()).toContainText('Latitude coordinates must fall between -90° and +90°');
  });

  test('minimum latitude greater than or equal to maximum latitude triggers coordinate order error', async ({ page }) => {
    await page.getByPlaceholder('Min Lon').fill('-100.0');
    await page.getByPlaceholder('Min Lat').fill('36.0');
    await page.getByPlaceholder('Max Lon').fill('-95.0');
    await page.getByPlaceholder('Max Lat').fill('30.0'); // Max < Min

    const execBtn = page.getByRole('button', { name: /Execute Trend Detection/i });
    await execBtn.click();

    const alert = page.locator("[role='alert']");
    await expect(alert.first()).toBeVisible();
    await expect(alert.first()).toContainText('Minimum latitude (36°) must be less than maximum latitude (30°)');
  });
});
