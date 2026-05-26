// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Carbonless — Playwright E2E smoke test config
 *
 * Run locally:  npx playwright test
 * Run headed:   npx playwright test --headed
 * Show report:  npx playwright show-report
 *
 * The webServer block starts `next dev` if localhost:3000 is not already
 * reachable; set reuseExistingServer to false to always start a fresh one.
 *
 * All tests mock the Django backend (localhost:8000) via page.route() so no
 * real backend is required to run the suite.
 */
module.exports = defineConfig({
  testDir:       './tests',
  fullyParallel: true,
  forbidOnly:    !!process.env.CI,   // fail CI if test.only is committed
  retries:       process.env.CI ? 2 : 0,
  workers:       process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL:           'http://localhost:3000',
    trace:             'on-first-retry',  // .zip trace on retry — useful for CI debugging
    screenshot:        'only-on-failure',
    video:             'off',
    actionTimeout:     10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Smoke suite runs on Chromium only — fast and sufficient for a CI gate
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // CI: use `next start` against the pre-built .next/ artifact (fast, ~2 s).
    // Local: use `next dev` for hot-reload during test authoring.
    command: process.env.CI ? 'npm start' : 'npm run dev',
    url:     'http://localhost:3000',
    // Always start a fresh server in CI; reuse an existing one locally.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_API_URL:     'http://localhost:8000/api',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
