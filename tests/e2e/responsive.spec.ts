import { test, expect } from '@playwright/test';

/**
 * Responsiveness & Viewport Audit across 7 Device Profiles (Phase 11)
 * Tests 1920x1080, 1440x900, 1366x768, 1024x768, 768x1024, 390x844, 360x800.
 * Verifies zero unexpected horizontal scroll and adaptive interface rendering.
 */
const VIEWPORTS = [
  { name: '1920x1080 Desktop Large', width: 1920, height: 1080 },
  { name: '1440x900 Desktop Standard', width: 1440, height: 900 },
  { name: '1366x768 Laptop Standard', width: 1366, height: 768 },
  { name: '1024x768 Tablet Landscape', width: 1024, height: 768 },
  { name: '768x1024 Tablet Portrait', width: 768, height: 1024 },
  { name: '390x844 Mobile iPhone', width: 390, height: 844 },
  { name: '360x800 Mobile Compact', width: 360, height: 800 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Viewport: ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`landing page renders with zero horizontal overflow at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'load' });
      const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
      if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cookieBtn.click();
      }

      // Check document body horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth + 2;
      });
      expect(overflow).toBe(true);

      // Verify primary heading remains visible
      await expect(page.locator('h1')).toBeVisible();
    });

    test(`dashboard workspace renders panels adaptively at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.goto('/dashboard', { waitUntil: 'load' });
      const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
      if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cookieBtn.click();
      }

      // Verify Leaflet container is visible
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });

      // Verify form controls exist
      await expect(page.locator('#data-stream-select')).toBeVisible();
    });
  });
}
