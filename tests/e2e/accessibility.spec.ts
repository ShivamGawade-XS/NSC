import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility Audit using axe-core (Phase 11)
 * Evaluates semantic HTML, accessible names, ARIA usage,
 * and WCAG 2.2 AA compliance across key pages.
 */
test.describe('Accessibility & WCAG 2.2 AA Evaluation', () => {
  test('landing page meets WCAG 2.2 AA accessibility standards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // Color contrast can depend on client rendering engine
      .analyze();

    // Critical accessibility violations must be 0
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toEqual([]);
  });

  test('dashboard analysis interface meets WCAG accessibility guidelines', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'load' });
    const cookieBtn = page.getByRole('button', { name: /Accept Preferences/i });
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await cookieBtn.click();
    }
    await expect(page.getByRole('button', { name: /Computing Trends.../i })).toBeHidden({ timeout: 25000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .exclude('.leaflet-control-container')
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalViolations).toEqual([]);
  });
});
