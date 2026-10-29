// Unit tests for the "I don't know — answer later" helpers (src/lib/carboniq/pending.js).
// Run: node scripts/test-pending-questions.mjs
// The copy follows the UI language (English / Turkish, never mixed); a pending question is unanswered,
// so it is dropped from the list as soon as an answer exists; the action is not offered where it
// would be wrong (info screens, per-item loops, answered or locked inventories).
import assert from 'node:assert/strict';
import { pendingCopy, visiblePending, canAnswerLater } from '../src/lib/carboniq/pending.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n  ', e.message); } };

test('English copy has the required labels', () => {
  const c = pendingCopy(false);
  assert.equal(c.button, "I don't know — answer later");
  assert.equal(c.title, 'Pending questions');
  assert.equal(c.answerLater, 'Answer later');
  assert.equal(c.returnTo, 'Return to question');
  assert.equal(c.badge, 'Unanswered');
  assert.equal(c.banner, 'You have unanswered questions in this Inventory.');
});

test('Turkish copy is Turkish and has the same keys as English', () => {
  const en = pendingCopy(false), tr = pendingCopy(true);
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
  assert.equal(tr.button, 'Bilmiyorum — sonra yanıtla');
  assert.equal(tr.title, 'Bekleyen sorular');
  assert.equal(tr.returnTo, 'Soruya dön');
  assert.equal(tr.badge, 'Yanıtsız');
  assert.equal(tr.banner, 'Bu envanterde yanıtlanmamış sorularınız var.');
});

test('no language mixes the other: no shared strings except none', () => {
  const en = pendingCopy(false), tr = pendingCopy(true);
  for (const k of Object.keys(en)) {
    if (typeof en[k] === 'string') assert.notEqual(en[k], tr[k], k);
  }
  assert.equal(pendingCopy(false).count(1), '1 question waiting');
  assert.equal(pendingCopy(false).count(3), '3 questions waiting');
  assert.equal(pendingCopy(true).count(2), '2 soru bekliyor');
});

test('visiblePending keeps order, drops duplicates and answered questions', () => {
  assert.deepEqual(visiblePending(['4A-EF', '4B-EF', '4A-EF', '3A-5'], { '3A-5': 'x' }), ['4A-EF', '4B-EF']);
});

test('visiblePending never treats an empty/zero answer as pending-free by accident', () => {
  assert.deepEqual(visiblePending(['A'], { A: 0 }), []);       // 0 IS an answer: the id is present
  assert.deepEqual(visiblePending(['A'], {}), ['A']);           // absent = still pending
});

test('visiblePending tolerates bad input', () => {
  assert.deepEqual(visiblePending(null, {}), []);
  assert.deepEqual(visiblePending([1, null, 'Q1'], null), ['Q1']);
});

const ok = { answered: false, locked: false, hasReport: true, editing: false };
test('canAnswerLater: offered for a normal unanswered question', () => {
  assert.equal(canAnswerLater({ type: 'single_select' }, ok), true);
});
test('canAnswerLater: not for info screens, loops, answered, locked, editing or no report', () => {
  assert.equal(canAnswerLater({ type: 'info' }, ok), false);
  assert.equal(canAnswerLater({ type: 'number', loopSource: '3A-1' }, ok), false);
  assert.equal(canAnswerLater({ type: 'number' }, { ...ok, answered: true }), false);
  assert.equal(canAnswerLater({ type: 'number' }, { ...ok, locked: true }), false);
  assert.equal(canAnswerLater({ type: 'number' }, { ...ok, editing: true }), false);
  assert.equal(canAnswerLater({ type: 'number' }, { ...ok, hasReport: false }), false);
  assert.equal(canAnswerLater(null, ok), false);
});

console.log(`pending-questions: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
