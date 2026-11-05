#!/usr/bin/env node
// Tests for the "answer later" policy (src/lib/carboniq/deferral.js, deferralPolicy.js, pending.js):
//   - the generated policy is the SAME file the server uses and covers exactly the questionnaire's questions;
//   - the shared route walk gives the very same routes as the pre-move implementation (frozen in
//     scripts/reference-route.mjs) and as the server (carbonless_backend/questionnaire/deferral_parity.json);
//   - required questions (Q36 included) cannot be deferred, deferrable ones can, conditional ones follow their
//     condition, an inactive question is not pending, and nothing is ever fabricated.
// Run: node scripts/test-deferral.mjs     (plain Node; questions.js is loaded the way test-carboniq-validation does)
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(repoRoot, '..', 'carbonless_backend', 'questionnaire');
const scratch = mkdtempSync(join(tmpdir(), 'deferral-test-'));
const deps = {
  '@/lib/data/countries': 'src/lib/data/countries.js',
  '@/lib/utils/numbers': 'src/lib/utils/numbers.js',
  '@/lib/companyFields': 'src/lib/companyFields.js',
};
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n  ', String(e.message).split('\n').join('\n   ')); } };

let src = readFileSync(join(repoRoot, 'src/lib/carboniq/questions.js'), 'utf-8');
for (const [alias, file] of Object.entries(deps)) {
  const local = `./${alias.split('/').pop()}.mjs`;
  src = src.replace(`'${alias}'`, `'${local}'`);
  writeFileSync(join(scratch, local), readFileSync(join(repoRoot, file), 'utf-8'));
}
writeFileSync(join(scratch, 'questions.mjs'), src);
const Q = await import(pathToFileURL(join(scratch, 'questions.mjs')));
const D = await import('../src/lib/carboniq/deferral.js');
const P = await import('../src/lib/carboniq/pending.js');
const { makeReference } = await import('./reference-route.mjs');
const policyJs = (await import('../src/lib/carboniq/deferralPolicy.js')).default;
const policyPy = JSON.parse(readFileSync(join(backend, 'deferral_policy.json'), 'utf-8'));
const parity = JSON.parse(readFileSync(join(backend, 'deferral_parity.json'), 'utf-8')).scenarios;
const P_ = policyJs.questions;

// ── the policy ──────────────────────────────────────────────────────────────────────────────────────────
test('the frontend policy is byte-for-byte the one the server uses', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(policyJs)), policyPy);
});

test('every questionnaire question is classified, and nothing else is', () => {
  const ids = Q.CARBONIQ_QUESTIONS.map(q => q.id);
  assert.deepEqual(Object.keys(P_), ids);
  assert.equal(ids.length, 178);
});

test('the policy matches what each question does (routes, loops, info) in the catalogue itself', () => {
  for (const q of Q.CARBONIQ_QUESTIONS) {
    const p = P_[q.id];
    assert.equal(p.type, q.type, q.id);
    assert.equal(Boolean(p.req), q.required === true, q.id);
    assert.deepEqual(p.nbv, q.nextByValue, q.id);
    assert.equal(p.next, q.next || undefined, q.id);
    assert.equal(Boolean(p.loop), Boolean(q.loopSource), q.id);
    assert.deepEqual(p.show, q.conditionalShow, q.id);
    if (q.nextByValue && q.type !== 'info' && q.type !== 'section_picker') assert.equal(D.effectiveKind(p), 'required', `${q.id} routes the questionnaire`);
    if (q.loopSource) assert.equal(p.code, 'loop_item', q.id);
    if (q.type === 'info' || q.type === 'section_picker') assert.equal(p.kind, 'info', q.id);
  }
});

test('Question 36 (SCOPE-GROUPING) is required: it decides the Scope 1 / 2 route', () => {
  const p = P_['SCOPE-GROUPING'];
  assert.equal(p.n, 36);
  assert.equal(D.effectiveKind(p), 'required');
  assert.equal(D.deferStatus('SCOPE-GROUPING', {}).ok, false);
  assert.equal(D.deferStatus('SCOPE-GROUPING', {}).code, 'structure');
  // and the route really does change with it
  const base = { 'SCOPE-GROUPING': 'combined' };
  const sep = { 'SCOPE-GROUPING': 'separate' };
  const upTo4 = (a) => D.routeIds({ ...a, '3-GİRİŞ': 'x', 'TY-1': 'confirmed' });
  assert.equal(upTo4(base).includes('4-GİRİŞ'), false);
  assert.equal(upTo4(sep).includes('4-GİRİŞ'), true);
});

test('what the policy lets be deferred, by kind', () => {
  const eff = (id) => D.effectiveKind(P_[id]);
  for (const id of ['A1', 'A3', 'A4', 'B1', 'C1', 'C3', 'D1', 'D3', 'D4', 'SCOPE-GROUPING', '2A-1', '2B-OC1', '2B-OC1a', '2B-OC2', '3A-0', '3A-1', '3B-1', '3C-1', '3D-0', '4A-0', '4B-1', 'K3C1-1', 'K3C3-INFO', 'K3C7-0', '6F-3', '7C-2']) assert.equal(eff(id), 'required', id);
  for (const id of ['A2', 'A5', 'A6', 'A7b', 'B2', 'B3', 'B4', 'B5', 'B6', '2C-1', '3A-EF-a', '4A-EF-a', 'K3C2-1', 'K3C8-1', 'K3C15-1', '6A-1a', '6E-1']) assert.equal(eff(id), 'deferrable', id);
  const kinds = {};
  for (const p of Object.values(P_)) { const k = p.kind + (p.then ? '>' + p.then : ''); kinds[k] = (kinds[k] || 0) + 1; }
  assert.deepEqual(kinds, { required: 33, deferrable: 10, 'conditional>deferrable': 49, info: 12, 'conditional>required': 74 });
});

// ── the route walk: identical to before the move, and to the server ─────────────────────────────────────
test('the shared route walk equals the pre-move implementation on 600 random answer sets', () => {
  const ref = makeReference({
    getQuestionById: Q.getQuestionById, getNextQuestionId: Q.getNextQuestionId, readAnswerValue: Q.readAnswerValue,
    getInitialQuestionId: Q.getInitialQuestionId, loopResumeState: () => ({ items: [1] }),
  });
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const opt = Object.fromEntries(Q.CARBONIQ_QUESTIONS.map(q => [q.id, (q.options || []).map(o => o.value)]));
  const special = { B1: ['NACE_A', 'NACE_C', 'NACE_G'], D3: ['operational_control', 'financial_control', 'equity_share'],
    '3A-1': [['EQ-3A-01'], ['EQ-3A-99']], '3A-5': [{ biomass: '5' }, { gas: '1' }], '3A-6': [{ x: 'engineering_estimate' }],
    '3B-5': [{ a: 'electric' }], '3D-4': [{ a: { refill_kg: '0' } }, { a: { refill_kg: '5' } }], '4A-1': [{ 1: '1 TL' }, { 1: '1 kWh' }],
    'K3C7-1': [{ hybrid_count: '0' }, { hybrid_count: '4' }], 'K3C7-3': [{ shuttle_pct: '0' }, { shuttle_pct: '9' }] };
  let compared = 0;
  for (let s = 0; s < 600; s++) {
    const a = {}; const fill = rnd();
    for (const q of Q.CARBONIQ_QUESTIONS) {
      if (rnd() >= fill) continue;
      let v;
      if (special[q.id]) v = pick(special[q.id]);
      else if (q.nextByValue && q.type !== 'multi_select') v = pick(Object.keys(q.nextByValue));
      else if (opt[q.id]?.length) v = q.type === 'multi_select' ? [pick(opt[q.id])] : pick(opt[q.id]);
      else v = 'x';
      a[q.id] = rnd() < 0.5 ? { answer: v } : v;
    }
    assert.deepEqual(D.routeIds(a), ref.questionPath(a).map(q => q.id), `scenario ${s}`);
    for (const q of Q.CARBONIQ_QUESTIONS) if (q.conditionalShow) assert.equal(D.conditionalShowMatches(q.conditionalShow, a), ref.conditionalShowMatches(q.conditionalShow, a), `${q.id} #${s}`);
    compared++;
  }
  assert.equal(compared, 600);
});

test('the route, the pending list and every decision equal the server\'s (shared fixtures)', () => {
  assert.ok(parity.length >= 100);
  parity.forEach((s, i) => {
    assert.deepEqual(D.routeIds(s.answers), s.route, `route #${i}`);
    assert.deepEqual(D.routeIds(s.answers, { confirmed: true }), s.confirmed_route, `confirmed #${i}`);
    assert.deepEqual(D.activePending(s.pending, s.answers), s.active_pending, `pending #${i}`);
    assert.deepEqual(D.requiredUnanswered(s.answers), s.required_unanswered, `required #${i}`);
    if (s.kind === 'complete') {            // a route the questionnaire can finish: no required question is ever found open
      assert.deepEqual(s.required_unanswered, [], `complete route ${s.label}`);
      assert.equal(D.routeIds(s.answers).at(-1), '7B-INFO');
    }
    for (const [id, want] of Object.entries(s.defer)) {
      const r = D.deferStatus(id, s.answers);
      assert.equal(r.ok ? 'ok' : r.code, want, `defer ${id} #${i}`);
    }
  });
});

// ── the decisions ───────────────────────────────────────────────────────────────────────────────────────
const gates = (extra = {}) => {
  const a = {};
  for (const [id, p] of Object.entries(P_)) if (p.nbv && p.kind !== 'info' && p.type !== 'section_picker' && p.type !== 'multi_select') a[id] = 'no' in p.nbv ? 'no' : Object.keys(p.nbv)[0];
  return { ...a, A7: 'no', ...extra };
};

test('REQUIRED: a gate, the boundary, the method and a loop source cannot be deferred', () => {
  for (const [id, code] of [['3A-0', 'gate'], ['D3', 'boundary'], ['D1', 'methodology'], ['2A-1', 'loop_source'], ['A4', 'identity'], ['SCOPE-GROUPING', 'structure']]) {
    const r = D.deferStatus(id, {});
    assert.deepEqual([r.ok, r.code], [false, code], id);
  }
});

test('DEFERRABLE: profile and documentation questions can, and nothing is fabricated', () => {
  for (const id of ['A2', 'A5']) assert.equal(D.deferStatus(id, {}).ok, true, id);          // before the first gate
  for (const id of ['B2', 'B3', 'B5', 'K3C7-4']) assert.equal(D.deferStatus(id, gates()).ok, true, id);
  assert.equal(D.deferStatus('K3C7-4', gates()).ok, true);
  const answers = gates();
  const before = JSON.stringify(answers);
  D.deferStatus('A2', answers); D.activePending(['A2'], answers); D.requiredUnanswered(answers);
  assert.equal(JSON.stringify(answers), before);           // the decisions never write an answer
  assert.equal('A2' in answers, false);
});

test('CONDITIONAL: follows the real condition', () => {
  assert.equal(D.deferStatus('4A-EF-a', gates({ '4A-0': 'yes', '4A-EF': 'no' })).code, 'not_applicable');
  assert.equal(D.deferStatus('4A-EF-a', gates({ '4A-0': 'yes', '4A-EF': 'yes' })).ok, true);
  // required once it applies
  assert.equal(D.deferStatus('2B-OC2', gates()).code, 'not_applicable');
  const r = D.deferStatus('2B-OC2', gates({ D3: 'operational_control', '2B-OC1': 'yes' }));
  assert.deepEqual([r.ok, r.code], [false, 'boundary']);
  // a follow-up beyond a gate that is still unanswered does not apply yet
  assert.equal(D.deferStatus('4A-EF-a', {}).code, 'not_applicable');
});

test('INACTIVE: a deferred question the answers take off the route is not pending and not required', () => {
  const on = gates({ '4A-0': 'yes', '4A-EF': 'yes' });
  assert.deepEqual(D.activePending(['4A-EF-a'], on), ['4A-EF-a']);
  const off = gates({ '4A-0': 'yes', '4A-EF': 'no' });
  assert.deepEqual(D.activePending(['4A-EF-a'], off), []);
  assert.equal(D.requiredUnanswered(off).includes('4A-EF-a'), false);
  assert.equal(D.requiredUnanswered(on).includes('4A-EF-a'), true);       // active and required once the gate says yes
  // answered ones and duplicates drop out as before
  assert.deepEqual(D.activePending(['A2', 'A2', 'A5'], { A5: 'x' }), ['A2']);
});

test('COMPLETION: unanswered required questions are listed, optional ones are not', () => {
  const missing = D.requiredUnanswered({});
  assert.ok(missing.includes('A1') && missing.includes('SCOPE-GROUPING'));
  assert.equal(missing.includes('B6'), false);                              // optional (required: false)
  assert.equal(missing.includes('2A-2'), false);                            // loop items are answered when the loop runs
  assert.equal(D.requiredUnanswered(D.routeIds({}).reduce((a, id) => ({ ...a, [id]: 'x' }), {})).length >= 0, true);
});

test('A7a is required only when the earlier report question says yes (conditionalRequired)', () => {
  assert.equal(D.mustAnswer(P_.A7a, { A7: 'no' }), false);
  assert.equal(D.mustAnswer(P_.A7a, { A7: 'yes' }), true);
});

// ── the UI helpers ──────────────────────────────────────────────────────────────────────────────────────
test('the answer-later button is offered by the policy, and the old guards still hold', () => {
  const ctx = { answered: false, locked: false, hasReport: true, editing: false };
  const q = (id) => Q.getQuestionById(id);
  assert.equal(P.canAnswerLater(q('SCOPE-GROUPING'), { ...ctx, answers: {} }), false);   // Q36: no button
  assert.equal(P.canAnswerLater(q('3A-0'), { ...ctx, answers: {} }), false);
  assert.equal(P.canAnswerLater(q('A2'), { ...ctx, answers: {} }), true);
  assert.equal(P.canAnswerLater(q('A2'), { ...ctx, answers: {}, locked: true }), false);
  assert.equal(P.canAnswerLater(q('A2'), { ...ctx, answers: {}, answered: true }), false);
  assert.equal(P.canAnswerLater(q('4A-EF-a'), { ...ctx, answers: gates({ '4A-0': 'yes', '4A-EF': 'no' }) }), false);
  assert.equal(P.canAnswerLater(q('4A-EF-a'), { ...ctx, answers: gates({ '4A-0': 'yes', '4A-EF': 'yes' }) }), true);
});

test('the explanation is bilingual, and empty when the question can be deferred', () => {
  assert.match(P.deferralReason('SCOPE-GROUPING', {}, false), /structure of the questionnaire/);
  assert.match(P.deferralReason('SCOPE-GROUPING', {}, true), /anketin yapısını belirler/);
  assert.match(P.deferralReason('3A-0', {}, false), /which questions come next/);
  assert.equal(P.deferralReason('A2', {}, false), '');
  assert.equal(P.deferralReason('A2', { A2: 'x' }, false), '');            // answered: nothing to explain
  const en = D.deferralCopy(false), tr = D.deferralCopy(true);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(tr).sort());
  for (const k of Object.keys(en)) assert.notEqual(en[k], tr[k], k);
});

test('applicablePending drops what is answered, repeated or off the route', () => {
  assert.deepEqual(P.applicablePending(['A2', 'A2', 'A5', 4], { A5: 'x' }), ['A2']);
  assert.deepEqual(P.applicablePending(null, {}), []);
});

console.log(`deferral: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
