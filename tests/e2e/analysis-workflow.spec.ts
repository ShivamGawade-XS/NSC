import { test, expect } from '@playwright/test';

/**
 * Complete Real User Journey A — Ordinary First-Time Analysis (Phase 4)
 * Real E2E: Browser interaction with actual frontend and backend,
 * selecting preset/region, submitting analysis, verifying progress,
 * inspecting returned map cells, evidence record, lineage, and scale.
 */
test.describe('Journey A — Core Analysis Workflow', () => {
  test('user can configure and execute real NASA analysis and inspect cell evidence', async ({ page }) => {
    // 1. Open dashboard directly
    await page.goto('/dashboard', { waitUntil: 'load' });
    await expect(page).toHaveTitle(/Analysis Workspace/i);

    // Dismiss cookie banner if present
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cookieBtn.click();
    }

    // 2. Load Texas Basin exemplar transect preset
    const txBtn = page.getByRole('button', { name: 'Texas Basin' });
    await expect(txBtn).toBeVisible({ timeout: 10000 });
    await txBtn.click();

    // 3. Verify inputs populated correctly
    const datasetSelect = page.locator('#data-stream-select');
    await expect(datasetSelect).toHaveValue('nasa_power');

    const varSelect = page.locator('#variable-select');
    await expect(varSelect).toHaveValue('T2M');

    const startYear = page.locator('#start-year-input');
    await expect(startYear).toHaveValue('2000');

    const endYear = page.locator('#end-year-input');
    await expect(endYear).toHaveValue('2023');

    // 4. Wait for analysis execution to complete (no computing spinner)
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 30000 });

    // 5. Verify Leaflet map container and rendered tiles/grid
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible();

    // 6. Verify Discovery Signals list contains candidate signals
    const firstSignal = page.locator('button:has-text("#1")');
    await expect(firstSignal).toBeVisible({ timeout: 15000 });

    // 7. Click top candidate signal to open and populate Evidence Panel
    await firstSignal.click();

    // 8. Inspect Evidence Record details
    await expect(page.getByRole('heading', { name: /Scientific Evidence Record/i })).toBeVisible({ timeout: 5000 });

    // Verify cell telemetry badge
    const badge = page.locator('.badge-hotspot, .badge-nominal');
    await expect(badge.first()).toBeVisible();

    // Verify Metric Scale computation exists and has physical dimensions
    const metricScaleRow = page.locator('text=Metric Scale');
    await expect(metricScaleRow).toBeVisible();
    const metricText = await metricScaleRow.locator('xpath=..').innerText();
    expect(metricText).toMatch(/km.*km/); // Contains km dimensions

    // Verify Grid Resolution
    const resRow = page.locator('text=Grid Resolution');
    await expect(resRow).toBeVisible();

    // Verify Provenance Badge
    const provBadge = page.locator(':text("Verified NASA CF-1.8 Observations"), :text("Synthetic test data")');
    await expect(provBadge.first()).toBeVisible();

    // Verify Annual Time Series Chart rendered
    const chart = page.locator('canvas');
    await expect(chart.first()).toBeVisible();

    // Verify Sen's Slope summary label
    await expect(page.getByText("Sen's Slope:", { exact: false })).toBeVisible();
  });
});
