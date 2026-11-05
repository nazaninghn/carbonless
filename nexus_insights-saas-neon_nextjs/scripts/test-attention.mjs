// Unit tests for the unanswered-questions overview (src/lib/carboniq/attention.js) and the content kinds
// (src/lib/carboniq/contentKinds.js).
// Run: node scripts/test-attention.mjs
//   - the overview lists required-unanswered and "answer later" questions on the ACTIVE route only, behind the user's
//     position; questions ahead, on inactive branches or in empty loops are not listed; nothing is converted;
//   - at the end of the questionnaire it is exactly what the server blocks the sign-off for (checked against the
//     shared parity fixture, whose expected values both route engines reproduce);
//   - text is classified as question / information / notification / instruction, and a question bubble is split
//     into the question and its explanation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { attentionOverview, attentionByStage, attentionCopy } from '../src/lib/carboniq/attention.js';
import { CONTENT_KINDS, INFO_SCREEN_KIND, infoScreenKind, splitHelper, messageKind, kindLabel } from '../src/lib/carboniq/contentKinds.js';
import { policy as POLICY } from '../src/lib/carboniq/deferral.js';

const policy = POLICY.questions;

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, '..', '..', 'carbonless_backend', 'questionnaire', 'deferral_parity.json'), 'utf-8')).scenarios;
const complete = fixture.filter(s => s.kind === 'complete');

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n  ', e.message); } };
const ids = (list) => list.map(i => i.id);

// ── the overview ────────────────────────────────────────────────────────────────────────────────────────────────
test('an inventory with nothing answered has nothing behind it to attend to', () => {
  const o = attentionOverview({ answers: {}, pendingIds: [], currentId: 'A1' });
  assert.deepEqual([o.required, o.deferred, o.needsAttention], [[], [], 0]);
});

test('a complete route needs no attention, and everything on it is answered', () => {
  for (const s of complete.slice(0, 20)) {
    const o = attentionOverview({ answers: s.answers, pendingIds: [], completed: true });
    assert.equal(o.needsAttention, 0, s.label);
    assert.ok(o.answered > 30, s.label);
  }
});

test('a required question skipped behind the user is listed as required; the question being asked, and those ahead, are not', () => {
  const s = complete[0];
  const route = s.route;
  const target = route.find(id => policy[id].kind !== 'info' && !policy[id].loop && policy[id].req && id !== 'A1');
  const answers = { ...s.answers }; delete answers[target];
  const at = route.indexOf(target);
  const later = route.slice(at + 1).find(id => policy[id].kind !== 'info' && !policy[id].loop);
  const before = attentionOverview({ answers, pendingIds: [], currentId: route[at + 1] });
  assert.deepEqual(ids(before.required), [target]);                      // the user has moved past it
  assert.equal(before.required[0].status, 'required');
  assert.equal(before.required[0].wasDeferred, false);
  const asking = attentionOverview({ answers, pendingIds: [], currentId: target });
  assert.deepEqual(asking.required, []);                                 // it is the question on screen now
  const ahead = attentionOverview({ answers, pendingIds: [], currentId: route[Math.max(0, at - 1)] });
  assert.deepEqual(asking.deferred.concat(ahead.required), []);          // and not listed while still ahead
  assert.ok(later);
});

test('a question left with "answer later" is listed as deferred, and stays unanswered', () => {
  const s = complete.find(x => x.route.includes('A2') && 'A2' in x.answers);
  const answers = { ...s.answers }; delete answers.A2;
  const o = attentionOverview({ answers, pendingIds: ['A2'], currentId: '7B-INFO' });
  assert.deepEqual(ids(o.deferred), ['A2']);
  assert.equal(o.deferred[0].status, 'deferred');
  assert.ok(!('A2' in answers));                                         // nothing was filled in
  assert.ok(!o.required.some(i => i.id === 'A2'));
});

test('a question deferred before it became required is listed as REQUIRED and flagged (inventory #34: 2A-1)', () => {
  const s = complete.find(x => '2A-1' in x.answers);
  const answers = { ...s.answers }; delete answers['2A-1'];
  const o = attentionOverview({ answers, pendingIds: ['2A-1'], currentId: '2A-2' });
  const item = o.required.find(i => i.id === '2A-1');
  assert.ok(item, 'listed');
  assert.equal(item.wasDeferred, true);
  assert.ok(!o.deferred.some(i => i.id === '2A-1'));
});

test('a question on an inactive branch is not pending, not required and is listed as not needed', () => {
  const s = complete.find(x => x.answers.A7 === 'yes' && 'A7a' in x.answers);
  const answers = { ...s.answers, A7: 'no' }; delete answers.A7a;       // the user turns away from A7a
  const o = attentionOverview({ answers, pendingIds: ['A7a'], currentId: '7B-INFO' });
  assert.ok(!ids(o.required).includes('A7a') && !ids(o.deferred).includes('A7a'));
  assert.ok(o.inactive.includes('A7a'));
  const back = attentionOverview({ answers: { ...answers, A7: 'yes' }, pendingIds: ['A7a'], currentId: '7B-INFO' });
  assert.ok(ids(back.deferred).includes('A7a'));                         // back on the route: pending again
  assert.ok(!back.inactive.includes('A7a'));
});

test('an answer saved on a branch the user has since left does not make that question needed or unanswered', () => {
  const s = complete.find(x => x.answers.A7 === 'yes' && 'A7a' in x.answers);
  const answers = { ...s.answers, A7: 'no' };                            // A7a keeps its saved answer
  const o = attentionOverview({ answers, pendingIds: [], currentId: '7B-INFO' });
  assert.ok('A7a' in answers);
  assert.ok(o.inactive.includes('A7a'));
  assert.equal(o.needsAttention, 0);
});

test('a mark on a question of a loop with no items is not listed; with items it is', () => {
  const s = complete.find(x => x.answers['3A-0'] === 'yes' && Array.isArray(x.answers['3A-1']) && x.answers['3A-1'].length > 0);
  assert.ok(s);
  const answers = { ...s.answers }; delete answers['3A-2'];
  const withItems = attentionOverview({ answers, pendingIds: ['3A-2'], currentId: '7B-INFO', loopHasItems: () => true });
  assert.ok(ids(withItems.required.concat(withItems.deferred)).includes('3A-2'));
  const empty = attentionOverview({ answers, pendingIds: ['3A-2'], currentId: '7B-INFO', loopHasItems: () => false });
  assert.ok(!ids(empty.required.concat(empty.deferred)).includes('3A-2'));
  assert.equal(empty.needsAttention, withItems.needsAttention - 1);
});

test('at the end of the questionnaire the overview is exactly what the server refuses the sign-off for (all fixtures)', () => {
  let checked = 0;
  for (const s of fixture) {
    const o = attentionOverview({ answers: s.answers, pendingIds: s.pending, completed: true });
    const server = new Set([...s.required_unanswered, ...s.active_pending]);
    const mine = new Set([...ids(o.required), ...ids(o.deferred)]);
    assert.deepEqual([...mine].sort(), [...server].sort(), `${s.kind || 'random'} ${s.label || ''}`);
    checked++;
  }
  assert.ok(checked > 300, `${checked} scenarios`);
});

test('required and deferred never overlap, and each question is listed once', () => {
  for (const s of fixture) {
    const o = attentionOverview({ answers: s.answers, pendingIds: s.pending, currentId: s.route[Math.floor(s.route.length / 2)] });
    const all = [...ids(o.required), ...ids(o.deferred)];
    assert.equal(new Set(all).size, all.length, s.label);
  }
});

test('the overview does not change the answers it is given', () => {
  const s = complete[3];
  const answers = JSON.parse(JSON.stringify(s.answers)); delete answers.A2;
  const snapshot = JSON.stringify(answers);
  attentionOverview({ answers, pendingIds: ['A2'], currentId: '7B-INFO' });
  assert.equal(JSON.stringify(answers), snapshot);
});

test('the sidebar counts per stage add up to the list', () => {
  const s = complete[2];
  const answers = { ...s.answers }; delete answers.A2; delete answers.A5;
  const o = attentionOverview({ answers, pendingIds: ['A2'], currentId: '7B-INFO' });
  const by = attentionByStage(o, id => policy[id]?.stage);
  const sum = Object.values(by).reduce((n, v) => n + v.required + v.deferred, 0);
  assert.equal(sum, o.needsAttention);
});

test('the copy exists in both languages with the same keys and no shared wording', () => {
  const en = attentionCopy(false), tr = attentionCopy(true);
  assert.deepEqual(Object.keys(tr).sort(), Object.keys(en).sort());
  for (const k of Object.keys(en)) if (typeof en[k] === 'string') assert.notEqual(en[k], tr[k], k);
  assert.equal(en.count(1), '1 question waiting');
  assert.equal(tr.count(3), '3 soru bekliyor');
  assert.equal(en.goTo, 'Return to question');             // the label the answer-later flow already used
});

// ── content kinds ───────────────────────────────────────────────────────────────────────────────────────────────
test('there are exactly four kinds of content', () => {
  assert.deepEqual([...CONTENT_KINDS], ['question', 'information', 'notification', 'instruction']);
});

test('every information screen of the questionnaire is classified, and section introductions are instructions', () => {
  const infoScreens = Object.entries(policy).filter(([, q]) => q.kind === 'info' && q.code === 'info').map(([id]) => id);
  assert.ok(infoScreens.length >= 8);
  for (const id of infoScreens) assert.ok(id in INFO_SCREEN_KIND, `${id} is not classified`);
  for (const id of ['2A-0', '3-GİRİŞ', '4-GİRİŞ', '6-GİRİŞ', '7-GİRİŞ']) assert.equal(infoScreenKind(id), 'instruction');
  for (const id of ['D2', '7A-INFO', '6B-0']) assert.equal(infoScreenKind(id), 'information');
  assert.equal(infoScreenKind('something-new'), 'information');           // never a warning by default
  for (const v of Object.values(INFO_SCREEN_KIND)) assert.ok(CONTENT_KINDS.includes(v));
});

test('a question bubble is split into the question and its explanation', () => {
  const r = splitHelper('**Question 13:** What types of locations?\n\n_You may select multiple options._');
  assert.equal(r.head, '**Question 13:** What types of locations?');
  assert.equal(r.helper, 'You may select multiple options.');
  assert.deepEqual(splitHelper('**Question 5:** Plain'), { head: '**Question 5:** Plain', helper: '' });
  const loop = splitHelper('**Question 43** _(Facility 1)_\n\nElectricity?\n\n_Enter kWh._');
  assert.equal(loop.head, '**Question 43** _(Facility 1)_\n\nElectricity?');
  assert.equal(loop.helper, 'Enter kWh.');
  const multi = splitHelper('Title\n\n_First paragraph.\n\nSecond paragraph._');
  assert.equal(multi.helper, 'First paragraph.\n\nSecond paragraph.');
  assert.deepEqual(splitHelper(null), { head: '', helper: '' });
});

test('messages are classified by their kind, else by their type', () => {
  assert.equal(messageKind({ type: 'warning' }), 'notification');
  assert.equal(messageKind({ type: 'info' }), 'information');
  assert.equal(messageKind({ type: 'info', kind: 'instruction' }), 'instruction');
  assert.equal(messageKind({ type: 'info', kind: 'notification' }), 'notification');
  assert.equal(messageKind({ type: 'assistant' }), 'question');
  assert.equal(messageKind({ type: 'error' }), 'error');
  assert.equal(messageKind({ type: 'assistant', kind: 'bogus' }), 'question');
  assert.equal(messageKind(null), 'question');
});

test('every kind has a label in both languages', () => {
  for (const k of [...CONTENT_KINDS, 'error']) {
    assert.ok(kindLabel(k, false)); assert.ok(kindLabel(k, true));
    assert.notEqual(kindLabel(k, false), kindLabel(k, true));
  }
});

console.log(`attention: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
