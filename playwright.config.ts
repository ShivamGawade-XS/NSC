import { defineConfig, devices } from '@playwright/test';

/**
 * EarthSift — Comprehensive Playwright E2E Configuration
 * Tests real browser user journeys, scientific evidence integrity,
 * responsiveness across 7 viewports, and WCAG accessibility.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false, // Run journeys predictably without race conditions on SQLite cache
  forbidOnly: !!process.env.CI,
  retries: 0, // No hiding flaky tests
  workers: 1, // Single worker avoids database lock contention during real queries
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    // Firefox headless binary on this Windows host environment crashes on new_page (documented in audit)
    // {
    //   name: 'firefox-desktop-1440',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     viewport: { width: 1440, height: 900 },
    //   },
    // },
    {
      name: 'webkit-desktop-1440',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile-iphone-390',
      use: {
        ...devices['iPhone 14'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
