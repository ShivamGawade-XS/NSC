import { test, expect } from '@playwright/test';

/**
 * Journey B — Map and Geographic Interaction (Phase 4)
 * Tests spatial selection, bounding box inputs, coordinate order,
 * layer toggles (Sig mask, LISA clusters, Raster vs Point), and map resetting.
 */
test.describe('Journey B — Geographic Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    // Wait for initial analysis to settle
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 25000 });
  });

  test('user can input custom valid bounding box coordinates and clear them', async ({ page }) => {
    // Fill bounding box coordinates
    const minLonInput = page.getByPlaceholder('Min Lon');
    const minLatInput = page.getByPlaceholder('Min Lat');
    const maxLonInput = page.getByPlaceholder('Max Lon');
    const maxLatInput = page.getByPlaceholder('Max Lat');

    await minLonInput.fill('-102.0');
    await minLatInput.fill('30.0');
    await maxLonInput.fill('-98.0');
    await maxLatInput.fill('34.0');

    await expect(minLonInput).toHaveValue('-102.0');
    await expect(minLatInput).toHaveValue('30.0');
    await expect(maxLonInput).toHaveValue('-98.0');
    await expect(maxLatInput).toHaveValue('34.0');

    // Click Clear button
    const clearBtn = page.getByRole('button', { name: 'Clear' });
    await clearBtn.click();

    await expect(minLonInput).toHaveValue('');
    await expect(minLatInput).toHaveValue('');
    await expect(maxLonInput).toHaveValue('');
    await expect(maxLatInput).toHaveValue('');
  });

  test('user can toggle map visualization layers: Sig Mask, LISA, and Raster/Point modes', async ({ page }) => {
    // 1. Toggle Sig Only mask
    const sigMaskBtn = page.getByRole('button', { name: /Sig Only/i });
    if (await sigMaskBtn.isVisible()) {
      await sigMaskBtn.click();
      await page.waitForTimeout(300);
      // Toggle back
      await sigMaskBtn.click();
      await page.waitForTimeout(300);
    }

    // 2. Toggle LISA Spatial Clusters
    const lisaBtn = page.getByRole('button', { name: /LISA/i });
    if (await lisaBtn.isVisible()) {
      await lisaBtn.click();
      await page.waitForTimeout(300);
      // Toggle back
      await lisaBtn.click();
      await page.waitForTimeout(300);
    }

    // 3. Toggle Raster vs Point mode
    const modeBtn = page.getByRole('button', { name: /Point Mode|Raster Mode/i });
    if (await modeBtn.isVisible()) {
      const initialText = await modeBtn.innerText();
      await modeBtn.click();
      await page.waitForTimeout(300);
      const updatedText = await modeBtn.innerText();
      expect(updatedText).not.toEqual(initialText);
    }
  });
});
