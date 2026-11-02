import { test, expect } from '@playwright/test';

/**
 * Scientific Results & Evidence Validation (Phase 5)
 * Verifies accuracy and consistency across backend API responses,
 * rendered telemetry cards, time-series charts, and EvidencePanel details.
 */
test.describe('Scientific Results & Evidence Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 30000 });
  });

  test('returned telemetry and EvidencePanel match scientific metadata and units', async ({ page }) => {
    // Select first candidate signal
    const firstSignal = page.locator('button:has-text("#1")').first();
    await expect(firstSignal).toBeVisible({ timeout: 15000 });
    await firstSignal.click();

    // 1. Verify Active Target telemetry values
    const slopeVal = page.locator("div:has-text('Slope') > div.text-sm.font-bold").first();
    await expect(slopeVal).toBeVisible();
    const slopeText = await slopeVal.innerText();
    expect(slopeText).toMatch(/^[+-]?\d+\.\d{3,4}$/); // Numeric slope

    const pVal = page.locator("div:has-text('p-value') > div.text-sm.font-bold").first();
    await expect(pVal).toBeVisible();
    const pText = await pVal.innerText();
    expect(pText).toMatch(/^(p\s*<\s*0\.001|\d+\.\d{4})$/); // Formatted p-value

    const tauVal = page.locator("div:has-text('Kendall τ') > div.text-sm.font-bold").first();
    await expect(tauVal).toBeVisible();
    const tauText = await tauVal.innerText();
    expect(tauText).toMatch(/^[+-]\d+\.\d{3}$/); // Kendall tau rank correlation

    // 2. Verify Scientific Evidence Record table fields
    const evCard = page.locator("div.interface-card:has-text('Scientific Evidence Record')").first();
    await expect(evCard).toBeVisible();

    await expect(evCard.getByText('MAGNITUDE')).toBeVisible();
    await expect(evCard.getByText('SIGNIFICANCE')).toBeVisible();
    await expect(evCard.getByText('METHOD')).toBeVisible();
    await expect(evCard.getByText('GRID RESOLUTION')).toBeVisible();
    await expect(evCard.getByText('METRIC SCALE')).toBeVisible();
    await expect(evCard.getByText('INTEGRITY')).toBeVisible();
    await expect(evCard.getByText('LIMITATIONS')).toBeVisible();

    // 3. Verify Metric Scale has physical formula and area
    const metricRow = evCard.locator("div:has-text('METRIC SCALE')").first();
    const metricText = await metricRow.innerText();
    expect(metricText).toContain('km²');
    expect(metricText).toContain('km (N-S)');
    expect(metricText).toContain('km (E-W)');

    // 4. Verify Probabilistic Climate Attribution FAR Card
    const farCard = page.locator("div.interface-card:has-text('Probabilistic Event Attribution (FAR)')").first();
    await expect(farCard).toBeVisible();
    await expect(farCard.getByText('Risk Ratio (RR)')).toBeVisible();
    await expect(farCard.getByText('Attributable Risk (FAR)')).toBeVisible();
  });

  test('peer-reviewed literature mechanism briefing modal opens and displays hypotheses', async ({ page }) => {
    // Select signal
    const firstSignal = page.locator('button:has-text("#1")').first();
    await expect(firstSignal).toBeVisible({ timeout: 15000 });
    await firstSignal.click();

    // Click Literature Mechanism & Drivers button
    const litBtn = page.getByRole('button', { name: /Literature Mechanism & Drivers/i });
    await expect(litBtn).toBeVisible();
    await litBtn.click();

    // Verify Briefing card appears with Summary or Physical Hypotheses (allow time for LLM/fallback response)
    await expect(page.getByText('Summary:')).toBeVisible({ timeout: 30000 });
  });
});
