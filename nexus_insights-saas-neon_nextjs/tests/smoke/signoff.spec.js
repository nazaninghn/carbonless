/**
 * Smoke test — the signature finishes the inventory (screens only; the backend is mocked here).
 *
 * The rules themselves are proved on the real backend in carbonless_backend/questionnaire/test_signoff_lifecycle.py. This covers what
 * the screen does with the answers: a refused signature names the problem and leads to the first unresolved question; an accepted
 * one goes straight to the completion card and saves nothing more (no 7A-INFO, no 7B-INFO); a signed inventory opens closed.
 */
import { test, expect } from '@playwright/test';
import { mockDjangoApi, seedAuth } from '../helpers/mock-api.js';

const REPORT = { report_id: 92, title: 'Inventory 2025', status: 'in_progress', reporting_year: 2025, progress: { percent: 90 }, updated_at: '2026-01-01T00:00:00Z', created_by: null };
const ANSWERS = { A1: { answer: 'x' }, '2A-1': { answer: '1' }, '7C-1': { answer: 'all_complete' } };

async function mockInventory(page, { answers = ANSWERS, step = '7C-2', onSign, signed = () => null, status = () => 'in_progress' }) {
  const seen = { saved: [] };
  await page.route('http://localhost:8000/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, code = 200) => route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.startsWith('/api/accounts/profile')) return json({ id: 1, username: 'owner', email: 'o@test.com', first_name: 'O', company_role: 'owner', role: 'owner', is_staff: false });
    if (url.pathname === '/api/questionnaire/' && req.method() === 'GET') return json({ reports: [{ ...REPORT, status: status(), signed_at: signed() }] });
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/` && req.method() === 'GET') {
      return json({ ...REPORT, status: status(), signed_at: signed(), current_step: step, answers, completed_steps: Object.keys(answers), advisor_rejected: [], advisor_pending: 0, pending_questions: [], required_unanswered: [] });
    }
    if (url.pathname === `/api/questionnaire/${REPORT.report_id}/step/` && req.method() === 'PATCH') {
      const body = JSON.parse(req.postData() || '{}');
      seen.saved.push(body.step);
      return body.step === '7C-2' ? onSign(json) : json({ success: true, step: body.step, reporting_year: 2025 });
    }
    return route.fallback();
  });
  return seen;
}

async function open(page, lang = 'en', step = '7C-2') {
  await page.addInitScript(([l, id, s]) => {
    localStorage.setItem('language', l);
    localStorage.setItem('language_explicit', '1');
    sessionStorage.setItem('carboniq_open_request', JSON.stringify({ report_id: id, step_id: s }));
  }, [lang, REPORT.report_id, step]);
  await page.goto('/dashboard?tab=questionnaire');
}

async function fillSignature(page) {
  const panel = page.getByTestId('input-panel');
  const inputs = panel.locator('input[type=text], input:not([type])');
  await inputs.nth(0).fill('Ayşe Demir');
  await inputs.nth(1).fill('Müdür');
  await panel.getByRole('radio').first().click();
  await panel.getByRole('button', { name: /Confirm|Onayla/ }).click();
}

test.beforeEach(async ({ page }) => {
  await mockDjangoApi(page);
  await seedAuth(page);
});

for (const lang of ['en', 'tr']) {
  test(`${lang}: a refused signature says why and leads to the first unresolved question`, async ({ page }) => {
    const msg = lang === 'tr' ? 'Bu envanter henüz tamamlanamaz — 1 zorunlu soru yanıtsız: 2A-1.' : 'This inventory cannot be marked complete yet — 1 required question is unanswered: 2A-1.';
    const seen = await mockInventory(page, { onSign: json => json({ success: false, step: '7C-2', next_step: '7C-2', code: 'required_unanswered', error: msg, first_question: '2A-1', required_unanswered: ['2A-1'] }, 400) });
    await open(page, lang);
    await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', '7C-2');
    await fillSignature(page);
    await expect(page.getByRole('alert').filter({ hasText: msg })).toBeVisible();
    await expect(page.getByTestId('completion-report-card').or(page.getByTestId('inventory-signed-note'))).toHaveCount(0);
    await page.getByTestId('go-to-unresolved').click();
    await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', '2A-1');
    expect(seen.saved).toEqual(['7C-2']);
  });

  test(`${lang}: an accepted signature goes straight to the completion card; Q127 and Q128 are never saved`, async ({ page }) => {
    let signedAt = null;
    const seen = await mockInventory(page, {
      signed: () => signedAt, status: () => (signedAt ? 'completed' : 'in_progress'),
      onSign: (json) => { signedAt = '2026-11-06T10:00:00Z'; return json({ success: true, step: '7C-2', next_step: null, completed: true, status: 'COMPLETED', report_id: REPORT.report_id, reporting_year: 2025, signed_at: signedAt }); },
    });
    await open(page, lang);
    await expect(page.getByTestId('pinned-question')).toHaveAttribute('data-question-id', '7C-2');
    await fillSignature(page);
    await expect(page.getByTestId('inventory-signed-note')).toBeVisible();
    await expect(page.getByTestId('input-panel')).toHaveCount(0);
    await page.waitForTimeout(800);
    expect(seen.saved).toEqual(['7C-2']);
  });
}

test('a signed inventory opens closed, wherever it was left: nothing can be answered', async ({ page }) => {
  const seen = await mockInventory(page, { step: '7A-INFO', signed: () => '2026-11-01T10:00:00Z', onSign: json => json({}, 409) });
  await open(page, 'en', '7A-INFO');
  await expect(page.getByTestId('inventory-signed-note')).toBeVisible();
  await expect(page.getByTestId('input-panel')).toHaveCount(0);
  expect(seen.saved).toEqual([]);
});
