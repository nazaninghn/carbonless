// Unit tests for the Wizard's save feedback (src/lib/carboniq/calcFeedback.js).
// Run: node scripts/test-calc-feedback.mjs
// The questionnaire-only total is a PARTIAL total; the message must say so, must add the
// Dashboard-equivalent year total when other approved emissions exist, and must never call
// the partial figure "the approved total" / "the inventory total".
import assert from 'node:assert/strict';
import { calcFeedbackLine } from '../src/lib/carboniq/calcFeedback.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n  ', e.message); } };

const ONLY = { delta_kg: 1500, total_kg: 1500, year_total_kg: 1500, pending: false };        // nothing but the questionnaire
const OTHER = { delta_kg: 4810, total_kg: 95096, year_total_kg: 97908, pending: false };     // + 2,812 kg monthly entries
const PEND = { delta_kg: 860, total_kg: 95096, year_total_kg: 97908, pending: true };

// ---- normal message
test('EN normal, questionnaire only: names the questionnaire total, no year part', () => {
  const m = calcFeedbackLine(ONLY, { tr: false, year: 2025 });
  assert.match(m, /^✓ Added to the inventory: \*\*\+1\.5 t CO₂e\*\* \(questionnaire total 1\.5 t CO₂e\)\.$/);
  assert.doesNotMatch(m, /all approved emissions/);
});
test('EN normal, other approved emissions exist: adds the Dashboard-equivalent year total', () => {
  const m = calcFeedbackLine(OTHER, { tr: false, year: 2025 });
  assert.match(m, /questionnaire total 95\.1 t CO₂e/);
  assert.match(m, /all approved emissions for 2025 \(monthly entries included\): 97\.91 t CO₂e/);
});
test('EN normal never calls the partial figure "inventory total" or "approved total"', () => {
  for (const fb of [ONLY, OTHER]) {
    const m = calcFeedbackLine(fb, { tr: false, year: 2025 });
    assert.doesNotMatch(m, /inventory total/i);
    assert.doesNotMatch(m, /approved total/i);
  }
});
test('TR normal: anket toplamı + the year total when it differs', () => {
  const only = calcFeedbackLine(ONLY, { tr: true, year: 2025 });
  assert.match(only, /anket toplamı 1,5 t CO₂e/);
  assert.doesNotMatch(only, /tüm onaylı emisyonları/);
  const other = calcFeedbackLine(OTHER, { tr: true, year: 2025 });
  assert.match(other, /anket toplamı 95,1 t CO₂e/);
  assert.match(other, /2025 yılının tüm onaylı emisyonları \(aylık kayıtlar dahil\): 97,91 t CO₂e/);
  assert.doesNotMatch(other, /bu envanterin toplamı/);
});

// ---- pending-change message
test('EN pending: "approved questionnaire total", never "approved total"', () => {
  const m = calcFeedbackLine(PEND, { tr: false, year: 2025 });
  assert.match(m, /^⏳ Sent for approval: \*\*\+0\.86 t CO₂e\*\*/);
  assert.match(m, /approved questionnaire total 95\.1 t CO₂e/);
  assert.match(m, /all approved emissions for 2025 \(monthly entries included\): 97\.91 t CO₂e/);
  assert.doesNotMatch(m, /approved total/i);
});
test('TR pending: onaylı anket toplamı, never a bare "onaylı toplam"', () => {
  const m = calcFeedbackLine(PEND, { tr: true, year: 2025 });
  assert.match(m, /onaylı anket toplamı 95,1 t CO₂e/);
  assert.match(m, /2025 yılının tüm onaylı emisyonları/);
  assert.doesNotMatch(m, /onaylı toplam /);
});
test('pending with nothing else approved: no year part', () => {
  const m = calcFeedbackLine({ ...PEND, year_total_kg: PEND.total_kg }, { tr: false, year: 2025 });
  assert.doesNotMatch(m, /all approved emissions/);
});

// ---- edges
test('a decrease uses a minus sign', () => {
  assert.match(calcFeedbackLine({ ...ONLY, delta_kg: -300 }, { tr: false }), /\*\*−0\.3 t CO₂e\*\*/);
});
test('a very small change is shown in kg', () => {
  assert.match(calcFeedbackLine({ ...ONLY, delta_kg: 5, total_kg: 5, year_total_kg: 5 }, { tr: false }), /\*\*\+5 kg CO₂e\*\*/);
});
test('no change (or no feedback) says nothing', () => {
  assert.equal(calcFeedbackLine({ ...ONLY, delta_kg: 0 }), null);
  assert.equal(calcFeedbackLine(undefined), null);
});
test('an older backend without year_total_kg still gets a correctly labelled message', () => {
  const m = calcFeedbackLine({ delta_kg: 100, total_kg: 5000, pending: false }, { tr: false, year: 2025 });
  assert.match(m, /questionnaire total 5 t CO₂e/);
  assert.doesNotMatch(m, /all approved emissions/);
});
test('year part is dropped, not broken, when the year is unknown', () => {
  assert.match(calcFeedbackLine(OTHER, { tr: false }), /all approved emissions \(monthly entries included\): 97\.91 t CO₂e/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
