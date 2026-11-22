/**
 * Smoke test — a source that is not in the list, entered with the organisation's own emission factor.
 *
 * Opened from a calculating question, as a dialog over it. The user says where the factor comes from: a
 * published source is accepted at once; any other needs its document and goes to the advisor. The
 * questionnaire stays on the same question throughout, and no answer is saved by it.
 * The rules are proved on the real backend in carbonless_backend/emissions/test_own_factor.py.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const REPORT = { report_id: 95, title: 'Inventory 2025', status: 'in_progress', reporting_year: 2025,
  progress: { percent: 5 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };
const ANSWERS = { D1: { ef_database: 'std_defra' }, A4: { reporting_year: 2025 }, 'K3C5-0': { answer: 'yes' }, 'K3C5-1': { answer: 'S2_total' } };

async function mockInventoryApi(page) {
  const seen = { saved: [], requests: [] };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') return json({ reports: [REPORT] });
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/` && req.method() === 'GET') {
      return json({ report_id: REPORT.report_id, title: REPORT.title, status: REPORT.status, current_step: 'K3C5-2b',
        answers: ANSWERS, completed_steps: Object.keys(ANSWERS), reporting_year: 2025, progress: { percent: 5 },
        advisor_rejected: [], advisor_pending: 0, pending_questions: [] });
    }
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/previous-profile/`) return json({ available: false });
    if (url.pathname === '/api/emissions/custom-requests/' && req.method() === 'POST') {
      const body = req.postData() || '';
      const field = (name) => (new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`).exec(body) || [])[1];
      const sent = { type: field('factor_source_type'), factor: field('proposed_factor_kg_co2e'), quantity: field('quantity'),
        inventory: field('inventory'), scope: field('scope'), name: field('source_name'), month: field('month'),
        hasFile: body.includes('name="factor_document"') };
      seen.requests.push(sent);
      const accepted = sent.type === 'published';
      return json({ id: 1, status: accepted ? 'approved' : 'pending', auto_accepted: accepted, year: 2025,
        calculated_co2e_kg: accepted ? String(Number(sent.quantity) * Number(sent.factor)) : null, has_document: sent.hasFile }, 201);
    }
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/step/` && req.method() === 'PATCH') {
      seen.saved.push(JSON.parse(req.postData() || '{}'));
      return json({ success: true });
    }
    return route.fallback();
  });
  return seen;
}

async function open(page, lang) {
  await mockDjangoApi(page);
  await seedAuth(page);
  await page.context().addCookies([{ name: 'carbonless_mode_chosen', value: '1', domain: 'localhost', path: '/', sameSite: 'Lax' }]);
  await page.addInitScript(([l, id]) => {
    localStorage.setItem('language', l);
    localStorage.setItem('language_explicit', '1');
    sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: id, step_id: 'K3C5-2b' }));
  }, [lang, REPORT.report_id]);
}

async function fill(page, { type, factor = '0.12' }) {
  await page.getByTestId('own-factor-name').fill('Compressed air');
  await page.getByTestId('own-factor-quantity').fill('1000');
  await page.getByTestId('own-factor-unit').selectOption('m3');
  await page.getByTestId('own-factor-value').fill(factor);
  await page.getByTestId('own-factor-source-type').selectOption(type);
  await page.getByTestId('own-factor-source').fill('Ecoinvent 3.9, compressed air 7 bar, Table 4');
}

for (const lang of ['en', 'tr']) {
  test.describe(`own emission factor (${lang})`, () => {
    test('a published source is accepted at once; the questionnaire stays where it was', async ({ page }) => {
      await open(page, lang);
      const seen = await mockInventoryApi(page);
      await page.goto('/dashboard?tab=questionnaire');
      await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', 'K3C5-2b');
      await page.getByTestId('own-factor-open').click();
      await expect(page.getByTestId('own-factor-dialog')).toBeVisible();
      await page.getByTestId('own-factor-submit').click();
      await expect(page.getByTestId('own-factor-error')).toContainText(lang === 'tr' ? 'Kaynağın adını yazın' : 'Write the name of the source');
      await fill(page, { type: 'published' });
      await expect(page.getByTestId('own-factor-route')).toContainText(lang === 'tr' ? 'hemen sayılır' : 'counted at once');
      await page.getByTestId('own-factor-submit').click();
      await expect(page.getByTestId('own-factor-result')).toContainText(lang === 'tr' ? 'Kabul edildi ve envantere eklendi: 120 kg' : 'Accepted and added to the inventory: 120 kg');
      expect(seen.requests[0]).toMatchObject({ type: 'published', factor: '0.12', quantity: '1000', inventory: '95', scope: 'scope3', name: 'Compressed air', month: '12', hasFile: false });
      await page.getByTestId('own-factor-close').click();
      await expect(page.getByTestId('own-factor-dialog')).toHaveCount(0);
      await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', 'K3C5-2b');
      expect(seen.saved).toEqual([]);                                        // no answer of the questionnaire was touched
    });

    test('any other source needs its document and is sent to the advisor without stopping the questionnaire', async ({ page }) => {
      await open(page, lang);
      const seen = await mockInventoryApi(page);
      await page.goto('/dashboard?tab=questionnaire');
      await page.getByTestId('own-factor-open').click();
      await fill(page, { type: 'supplier' });
      await expect(page.getByTestId('own-factor-route')).toContainText(lang === 'tr' ? 'belgeyle danışmana gider' : 'goes to the advisor with its document');
      await page.getByTestId('own-factor-submit').click();
      await expect(page.getByTestId('own-factor-error')).toContainText(lang === 'tr' ? 'belge yükleyin' : 'Upload the document');
      expect(seen.requests.length).toBe(0);
      await page.getByTestId('own-factor-document').setInputFiles({ name: 'declaration.pdf', mimeType: 'application/pdf', buffer: Buffer.from('doc') });
      await page.getByTestId('own-factor-submit').click();
      await expect(page.getByTestId('own-factor-result')).toContainText(lang === 'tr' ? 'Danışmana gönderildi' : 'Sent to the advisor');
      await expect(page.getByTestId('own-factor-result')).toContainText(lang === 'tr' ? 'Ankete devam edebilirsiniz' : 'You can go on with the questionnaire');
      expect(seen.requests[0]).toMatchObject({ type: 'supplier', hasFile: true });
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('own-factor-dialog')).toHaveCount(0);
      await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', 'K3C5-2b');
    });
  });
}

for (const [name, use] of [
  ['phone', { viewport: { width: 390, height: 844 } }],
  ['reduced motion', { reducedMotion: 'reduce' }],
]) {
  test.describe(`own emission factor dialog — ${name}`, () => {
    test.use(use);
    test('the dialog fits the screen', async ({ page }) => {
      await open(page, 'tr');
      await mockInventoryApi(page);
      await page.goto('/dashboard?tab=questionnaire');
      await page.getByTestId('own-factor-open').click();
      const box = await page.getByTestId('own-factor-dialog').boundingBox();
      const vp = page.viewportSize();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      await expect(page.getByTestId('own-factor-submit')).toBeVisible();
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/own-factor-${name.replace(' ', '-')}.png` });
    });
  });
}
