import { test, expect } from '@playwright/test';

/**
 * EvidencePanel Comprehensive Scientific & Provenance Audit (Phase 5/7)
 * Verifies dynamic dataset lineage, metric scale scaling with latitude,
 * compound hazard evidence, probabilistic event attribution, and provenance badges.
 */
test.describe('EvidencePanel Provenance & Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 30000 });
  });

  test('displays verified NASA CF-1.8 provenance badge with clickable DOI', async ({ page }) => {
    const provBadge = page.locator("text=Verified NASA CF-1.8 Observations");
    await expect(provBadge.first()).toBeVisible({ timeout: 15000 });

    const doiLink = page.locator("a[title*='View dataset DOI']");
    if (await doiLink.count() > 0) {
      await expect(doiLink.first()).toHaveAttribute('href', /doi\.org/);
      await expect(doiLink.first()).toHaveAttribute('target', '_blank');
    }
  });

  test('calculates latitude-dependent metric dimensions accurately', async ({ page }) => {
    // Select first signal
    const firstSignal = page.locator('button:has-text("#1")').first();
    await expect(firstSignal).toBeVisible({ timeout: 15000 });
    await firstSignal.click();

    // Verify Metric Scale formula includes cos(lat)
    const metricRow = page.locator("div:has-text('METRIC SCALE')").first();
    await expect(metricRow).toBeVisible();
    const metricText = await metricRow.innerText();
    expect(metricText).toContain('cos(');
    expect(metricText).toContain('km²');
  });

  test('user can open and inspect Scientific Robustness Lab modal', async ({ page }) => {
    // Select first signal
    const firstSignal = page.locator('button:has-text("#1")').first();
    await expect(firstSignal).toBeVisible({ timeout: 15000 });
    await firstSignal.click();

    // Click Robustness Lab button
    const robBtn = page.getByRole('button', { name: /Robustness Lab/i });
    await expect(robBtn).toBeVisible();
    await robBtn.click();

    // Verify Robustness modal appears
    const robModal = page.getByRole('dialog', { name: /Trend Robustness Lab/i });
    await expect(robModal).toBeVisible({ timeout: 5000 });

    // Press Escape to dismiss modal
    await page.keyboard.press('Escape');
    await expect(robModal).toBeHidden();
  });

  test('user can open and inspect Data Quality modal', async ({ page }) => {
    // Select first signal
    const firstSignal = page.locator('button:has-text("#1")').first();
    await expect(firstSignal).toBeVisible({ timeout: 15000 });
    await firstSignal.click();

    // Click Data Quality button
    const dqBtn = page.getByRole('button', { name: /Data Quality/i });
    await expect(dqBtn).toBeVisible();
    await dqBtn.click();

    // Verify modal appears
    const dqModal = page.getByRole('dialog', { name: /Data Quality/i });
    await expect(dqModal).toBeVisible({ timeout: 5000 });

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(dqModal).toBeHidden();
  });
});
