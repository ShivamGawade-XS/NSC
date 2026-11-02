import { test, expect } from '@playwright/test';

/**
 * First-Time User Experience Audit (Phase 3)
 * Tests onboarding, landing page comprehension, cookie consent,
 * primary action discovery, and transition into analysis workspace.
 */
test.describe('First-Time User Experience', () => {
  test('landing page loads with clear scientific headline, attribution, and no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      // Filter out benign font network change events
      if (msg.type() === 'error' && !msg.text().includes('ERR_NETWORK_CHANGED')) {
        consoleErrors.push(msg.text());
      }
    });

    const response = await page.goto('/', { waitUntil: 'load' });
    expect(response?.status()).toBe(200);

    // Title & Primary Heading
    await expect(page).toHaveTitle(/EarthSift/i);
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Statistical Detection of Multi-Decadal Trends');

    // NASA Space Apps Challenge attribution
    await expect(page.getByText('NASA Space Apps Challenge 2026', { exact: false }).first()).toBeVisible();

    // Primary CTA button is obvious and accessible
    const launchBtn = page.getByRole('button', { name: /Launch Analysis Workspace/i });
    await expect(launchBtn.first()).toBeVisible();

    // Cookie consent banner appears after initial delay
    const cookieBanner = page.locator("aside[aria-label='Cookie and Storage Preferences']");
    await expect(cookieBanner).toBeVisible({ timeout: 3000 });

    // User can accept consent and banner is dismissed
    const acceptBtn = cookieBanner.getByRole('button', { name: /Accept Preferences/i });
    await acceptBtn.click();
    await expect(cookieBanner).toBeHidden();

    // No uncaught JavaScript errors
    expect(consoleErrors).toEqual([]);
  });

  test('user can launch workspace from hero CTA and arrives at operational dashboard', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    // Dismiss cookies if visible
    const acceptBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click();
    }

    // Click primary action
    const launchBtn = page.getByRole('button', { name: /Launch Analysis Workspace/i }).first();
    await launchBtn.click();

    // Verify URL navigation
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).toHaveTitle(/Analysis Workspace/i);

    // Verify key interface panels render
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /Top Discovery Signals/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Evidence Record', { exact: false })).toBeVisible();
  });
});
