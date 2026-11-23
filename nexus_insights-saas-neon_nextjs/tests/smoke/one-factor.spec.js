/**
 * One source has one factor in an inventory, wherever it is entered.
 *
 * The dashboard form asks for the factors of the inventory that will hold the entry (`?entry_year=`), shows them with a note
 * naming the standard, and the dashboard names the entries that are not on that standard. The numbers come from the backend
 * (emissions/entry_standard.py); the values here are illustrative fixtures.
 */
import { test, expect } from '@playwright/test';
import { seedAuth } from '../helpers/mock-api.js';
import { mockPopulatedApi, SUMMARY } from '../helpers/populated-api.js';

const DEFRA_GAS = {
  id: 9001, name: 'Natural gas', name_tr: 'Doğal gaz', slug: 'natural-gas-m3', standard: 'defra', scope: 'scope1',
  category: 'stationary_combustion', country: 'global', unit: 'm3', factor_kg_co2e: '2.066720', year: 2025, is_default: false,
  source: 'defra', reference: 'fixture', is_active: true, method: '', is_yearly: false,
};
const NOTE = {
  entry_id: 77,
  en: '"Diesel" (2025/03) was entered outside the questionnaire and is calculated with the factor it was entered with: the standard of this inventory (DEFRA) publishes no factor for this source.',
  tr: '"Dizel" (2025/03) anket dışında girildi ve girildiği faktörle hesaplanıyor: bu envanterin standardı (DEFRA) bu kaynak için faktör yayımlamıyor.',
};

const lang = (page, l) => page.addInitScript(x => { localStorage.setItem('language', x); localStorage.setItem('language_explicit', '1'); }, l);

async function setup(page, { standard = 'defra', notes = [NOTE] } = {}) {
  const asked = [];
  await mockPopulatedApi(page);
  await page.route('http://localhost:8000/api/emissions/summary/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ...SUMMARY, factor_standard: standard, off_standard_notes: notes }) }));
  await page.route('http://localhost:8000/api/emissions/factors/**', (route) => {
    asked.push(new URL(route.request().url()).search);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([DEFRA_GAS]) });
  });
  await seedAuth(page);
  return asked;
}

async function openForm(page, tr) {
  await page.goto('/dashboard?tab=emissions');
  await page.getByRole('button', { name: tr ? /Yeni Kayıt/ : /New Entry/ }).click();
  await expect(page.locator('#add-entry-form')).toBeVisible();
}

for (const l of ['en', 'tr']) {
  const tr = l === 'tr';
  test(`${l}: the form asks for, shows and names the factors of the inventory's standard`, async ({ page }) => {
    await lang(page, l);
    const asked = await setup(page);
    await openForm(page, tr);
    expect(asked.some(q => /entry_year=\d{4}/.test(q))).toBe(true);
    await expect(page.getByTestId('form-factor-standard')).toContainText(tr ? 'DEFRA standardıyla' : 'on the DEFRA standard');
    await page.locator('[aria-labelledby="add-entry-scope"] button').first().click();
    await page.locator('#add-entry-category').selectOption('stationary_combustion');
    const options = await page.locator('#add-entry-source option').allTextContents();
    expect(options.filter(o => /2[.,]0667/.test(o))).toHaveLength(1);        // the DEFRA row, with its own number
  });

  test(`${l}: entries that are not on the standard are named on the page`, async ({ page }) => {
    await lang(page, l);
    await setup(page);
    await page.goto('/dashboard?tab=emissions');
    await expect(page.getByTestId('off-standard-notes')).toContainText(tr ? 'faktör yayımlamıyor' : 'publishes no factor');
  });
}

test('a mixed-standard inventory sends amounts to the questionnaire', async ({ page }) => {
  await lang(page, 'en');
  await setup(page, { standard: 'unset', notes: [] });
  await openForm(page, false);
  await expect(page.getByTestId('form-factor-standard')).toContainText('Enter amounts in the questionnaire');
  await expect(page.getByTestId('off-standard-notes')).toHaveCount(0);
});

test('an inventory on the platform catalogue shows neither note', async ({ page }) => {
  await lang(page, 'en');
  await setup(page, { standard: '', notes: [] });
  await openForm(page, false);
  await expect(page.getByTestId('form-factor-standard')).toHaveCount(0);
  await expect(page.getByTestId('off-standard-notes')).toHaveCount(0);
});

test('phone, reduced motion: the notes fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await lang(page, 'tr');
  await setup(page);
  await openForm(page, true);
  for (const id of ['form-factor-standard', 'off-standard-notes']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
  }
});
