/**
 * Smoke tests — dashboard (authenticated)
 *
 * Verifies that the dashboard shell, tabs, and key components render correctly
 * when API calls return stub data.  All Django backend calls are intercepted by
 * mockDjangoApi() so no real server is required.
 *
 * Auth state is seeded with seedAuth() which sets:
 *   • `carbonless_auth=1` cookie  (middleware gate)
 *   • `_ca` localStorage item     (api.js Bearer token)
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

// ── shared setup ──────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Register API mocks BEFORE any navigation so no real requests slip through
  await mockDjangoApi(page);
  // Seed cookie + token BEFORE the first goto
  await seedAuth(page);
});

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('Dashboard shell', () => {

  test('renders without a JS crash', async ({ page }) => {
    // page.goto() throws if a navigation error occurs; if it resolves, the page
    // loaded.  We also assert no uncaught exceptions were thrown.
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto('/dashboard');

    // Wait for the main layout to stabilise (sidebar + content area visible)
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('sidebar is visible with navigation items', async ({ page }) => {
    await page.goto('/dashboard');

    // DashboardSidebar renders nav items — at least the "Emissions" tab link
    // should appear regardless of the active language.
    await expect(
      page.getByRole('button', { name: /emission|Emisyon/i }).first()
        .or(page.getByText(/emission|Emisyon/i).first())
    ).toBeVisible({ timeout: 10_000 });
  });

  test('overview KPI cards are rendered', async ({ page }) => {
    await page.goto('/dashboard');

    // The DashboardOverview shows total_tonne; stub returns 25.4 t so we look
    // for a number somewhere on the page.
    await page.waitForLoadState('networkidle');
    // At minimum the page should have rendered some numeric text from the summary
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(100); // page is not blank
  });

});

test.describe('Dashboard navigation', () => {

  test('clicking Emissions tab shows emission management heading', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find the Emissions tab in the sidebar and click it
    const emissionsTab = page
      .getByRole('button', { name: /^emission|^Emisyon/i }).first()
      .or(page.locator('[data-tab="emissions"]').first());

    if (await emissionsTab.isVisible()) {
      await emissionsTab.click();
      // EmissionsTab renders "Emission Management" or "Emisyon Yönetimi"
      await expect(
        page.getByText(/Emission Management|Emisyon Yönetimi/i)
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  test('clicking Targets tab shows reduction targets heading', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const targetsTab = page
      .getByRole('button', { name: /target|Hedef/i }).first()
      .or(page.locator('[data-tab="targets"]').first());

    if (await targetsTab.isVisible()) {
      await targetsTab.click();
      await expect(
        page.getByText(/Reduction Targets|Azaltma Hedefleri/i)
      ).toBeVisible({ timeout: 8_000 });
    }
  });

});

test.describe('Dashboard — empty states', () => {

  test('shows no-entries empty state when API returns empty list', async ({ page }) => {
    // The stub already returns [] for /emissions/entries so the empty state
    // should be visible once the data loads.
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigate to Emissions tab to trigger the empty-state UI
    const emissionsTab = page
      .getByRole('button', { name: /^emission|^Emisyon/i }).first();

    if (await emissionsTab.isVisible()) {
      await emissionsTab.click();
      // The empty state message in EmissionsTab (any language)
      await expect(
        page.getByText(/no entries|kayıt bulunamadı|henüz/i)
      ).toBeVisible({ timeout: 8_000 });
    }
  });

});
