// The dashboard's insights: only what the data supports, never a made-up figure, and the four kinds kept apart.
// Run: node scripts/test-dashboard-insights.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { buildInsights, scopeShares, quarterly, yearComparison } =
  await import(pathToFileURL(join(root, 'src/lib/dashboard/insights.js')).href);

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error(`FAIL ${name}\n  ${e.message}`); } };
const categoryName = (c) => ({ natural_gas: 'Natural gas', electricity: 'Electricity' })[c] || c;
const ids = (list) => list.map(i => i.id);
const kinds = (list) => [...new Set(list.map(i => i.kind))];

const populated = {
  year: 2025, total_tonne: 100, scope1_tonne: 60, scope2_tonne: 30, scope3_tonne: 10, scope3_kg: 10000,
  monthly: [{ month: 1, total_kg: 5000 }, { month: 2, total_kg: 9000 }, { month: 4, total_kg: 1000 }],
  by_category: [{ category: 'electricity', total_kg: 30000 }, { category: 'natural_gas', total_kg: 60000 }],
  scope3_by_category: [{ category: 'waste', ghg_number: 5, name_en: 'Waste generated in operations', name_tr: 'Operasyonlarda oluşan atık', total_co2e_kg: 10000 }],
  by_facility: [{ facility_id: 1, facility_name: 'Gebze', total_kg: 70000 }, { facility_id: 2, facility_name: 'Izmir', total_kg: 20000 }],
  previous_year_change: { change_pct: -12.4, previous_year: 2024, months: 12 },
  unassigned_records: { entries: 0 }, custom_emissions: { pending_count: 0 },
};

test('no data: no facts and no warnings, only what is missing', () => {
  const out = buildInsights({ summary: { total_tonne: 0, scope1_tonne: 0, scope2_tonne: 0, scope3_tonne: 0 }, inventory: { report_id: 1 }, tr: false, categoryName });
  assert.deepEqual(kinds(out).sort(), ['ai', 'missing']);
  assert.ok(ids(out).includes('no-emissions'));
  assert.equal(out.filter(i => i.kind === 'fact').length, 0);
});

test('no data and no inventory: nothing at all (no AI action either)', () => {
  assert.deepEqual(buildInsights({ summary: null, inventory: null, tr: false, categoryName }), []);
});

test('populated: the facts come from the figures given', () => {
  const out = buildInsights({ summary: populated, inventory: { report_id: 1 }, tr: false, categoryName });
  const by = Object.fromEntries(out.map(i => [i.id, i]));
  assert.match(by['top-scope'].text, /Scope 1 is 60% of the inventory \(60\.00 tCO2e\)/);
  assert.match(by['top-source'].text, /Natural gas: 60\.00 tCO2e \(67% of source-attributed emissions\)/);
  assert.match(by['top-scope3'].text, /Category 5 — Waste generated in operations: 100% of Scope 3/);
  assert.match(by['facility-concentration'].text, /Gebze accounts for 78% of facility-attributed emissions/);
  assert.match(by['year-change'].text, /12\.4% lower than 2024/);
  assert.match(by['peak-month'].text, /Feb: 9\.00 tCO2e \(of 3 months with entries\)/);
});

test('a comparison the server did not make is never invented', () => {
  const out = buildInsights({ summary: { ...populated, previous_year_change: null }, inventory: {}, tr: false, categoryName });
  assert.ok(!ids(out).includes('year-change'));
  assert.equal(yearComparison(null, false), null);
  assert.equal(yearComparison({ previous_year: 2024 }, false), null);
});

test('a part-year comparison names the months it covers', () => {
  const c = yearComparison({ change_pct: 5, previous_year: 2024, months: 4 }, false);
  assert.equal(c.span, 'Jan–Apr 2024');
  assert.equal(c.down, false);
});

test('a scope with nothing calculated is said to be missing, not shown as a fact', () => {
  const out = buildInsights({ summary: { total_tonne: 10, scope1_tonne: 10, scope2_tonne: 0, scope3_tonne: 0 }, inventory: {}, tr: false, categoryName });
  const miss = out.filter(i => i.kind === 'missing').map(i => i.id);
  assert.ok(miss.includes('empty-scope2') && miss.includes('empty-scope3') && !miss.includes('empty-scope1'));
});

test('missing information counts what the server reports, and offers the way on', () => {
  const out = buildInsights({ summary: populated, inventory: { report_id: 7 }, status: { requiredUnanswered: 3, pending: 1 }, tr: false, categoryName });
  const req = out.find(i => i.id === 'required-open');
  assert.match(req.text, /3 required questions are unanswered/);
  assert.equal(req.action.kind, 'continue');
  assert.match(out.find(i => i.id === 'deferred').text, /1 question is marked "answer later"; they do not count as answered/);
  const none = buildInsights({ summary: populated, inventory: {}, status: { requiredUnanswered: 0, pending: 0 }, tr: false, categoryName });
  assert.ok(!ids(none).includes('required-open') && !ids(none).includes('deferred'));
  const unknown = buildInsights({ summary: populated, inventory: {}, status: { requiredUnanswered: null, pending: null }, tr: false, categoryName });
  assert.ok(!ids(unknown).includes('required-open'));                       // unknown is not zero and not a number
});

test('warnings: pending requests, unassigned records, advisor, grid connection, credit', () => {
  const out = buildInsights({
    summary: { ...populated, unassigned_records: { entries: 2 }, custom_emissions: { pending_count: 1 },
      avoided_credit: { note: { en: 'Credit unverified', tr: 'Kredi doğrulanmadı' } } },
    inventory: { advisor_pending: 2, advisor_rejected: 1 }, facilitiesWithoutGrid: 1, notCountedLine: '3 entries awaiting approval', tr: false, categoryName });
  const w = ids(out.filter(i => i.kind === 'warning'));
  for (const id of ['not-counted', 'unassigned', 'avoided-credit', 'custom-pending', 'grid-connection', 'advisor']) assert.ok(w.includes(id), id);
});

test('approvals waiting are a warning for someone who can approve, and nothing otherwise', () => {
  const yes = buildInsights({ summary: populated, inventory: {}, canApprove: true, pendingApprovals: 3, tr: false, categoryName });
  assert.match(yes.find(i => i.id === 'pending-approvals').text, /3 items await your review and approval/);
  assert.equal(yes.find(i => i.id === 'pending-approvals').kind, 'warning');
  assert.ok(!ids(buildInsights({ summary: populated, inventory: {}, canApprove: false, pendingApprovals: 3, tr: false, categoryName })).includes('pending-approvals'));
  assert.ok(!ids(buildInsights({ summary: populated, inventory: {}, canApprove: true, pendingApprovals: 0, tr: false, categoryName })).includes('pending-approvals'));
});

test('a target is suggested only to someone who can set one, and only when there is data', () => {
  assert.ok(ids(buildInsights({ summary: populated, targets: [], canApprove: true, inventory: {}, tr: false, categoryName })).includes('no-target'));
  assert.ok(!ids(buildInsights({ summary: populated, targets: [], canApprove: false, inventory: {}, tr: false, categoryName })).includes('no-target'));
  assert.ok(!ids(buildInsights({ summary: populated, targets: [{ id: 1 }], canApprove: true, inventory: {}, tr: false, categoryName })).includes('no-target'));
  assert.ok(!ids(buildInsights({ summary: { total_tonne: 0 }, targets: [], canApprove: true, inventory: {}, tr: false, categoryName })).includes('no-target'));
});

test('the AI entry is an action with a prefilled question, never a finding', () => {
  const out = buildInsights({ summary: populated, inventory: {}, tr: false, categoryName });
  const ai = out.filter(i => i.kind === 'ai');
  assert.equal(ai.length, 1);
  assert.equal(ai[0].action.kind, 'ask-ai');
  assert.match(ai[0].action.prefill, /2025/);
  assert.match(ai[0].text, /not shown here as findings/);
});

test('Turkish text is Turkish, with its own numbers', () => {
  const out = buildInsights({ summary: populated, inventory: {}, tr: true, categoryName });
  const by = Object.fromEntries(out.map(i => [i.id, i]));
  assert.match(by['top-scope'].text, /Kapsam 1, envanterin %60'ini oluşturuyor \(60,00 tCO2e\)/);
  assert.match(by['year-change'].text, /2024 dönemine göre %12,4 daha düşük/);
});

test('scope shares and quarters', () => {
  assert.equal(scopeShares({ scope1_tonne: 0, scope2_tonne: 0, scope3_tonne: 0 }), null);
  const s = scopeShares(populated);
  assert.equal(Math.round(s.scopes[0].share * 100), 60);
  assert.equal(quarterly([{ month: 1, total_kg: 0 }, { month: 2, total_kg: 0 }]), null);
  assert.deepEqual(quarterly(populated.monthly).map(q => q.total_kg), [14000, 1000, 0, 0]);
});

console.log(`dashboard insights: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
