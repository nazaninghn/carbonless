/**
 * Smoke tests — public pages (no auth required)
 *
 * These tests verify that every public route renders without a JS crash and
 * contains the expected key elements.  They run entirely in-browser against
 * the local dev/build server; no backend is involved.
 */
import { test, expect } from '@playwright/test';

test.describe('Public pages', () => {

  test('homepage loads and contains brand name', async ({ page }) => {
    await page.goto('/');
    // Brand name appears in the page (header or hero)
    await expect(page.getByText('Carbonless').first()).toBeVisible();
  });

  test('login page — form renders with email and password inputs', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    // Submit button present
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register page — first step renders', async ({ page }) => {
    await page.goto('/register');
    // The multi-step registration form starts on step 1 (corporate info)
    // At least one text input must be visible
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('terms page — heading is visible', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByText('Terms of Use')).toBeVisible();
  });

  test('forgot-password page — email input is visible', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('login page — no-session redirect from /dashboard goes to /login', async ({ page }) => {
    // Without the carbonless_auth cookie the middleware must redirect to /login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

});
