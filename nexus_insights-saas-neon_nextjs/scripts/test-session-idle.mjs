// The timing rules of the inactivity timeout (src/lib/session/idle.js).
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const idle = await import(pathToFileURL(path.join(root, 'src/lib/session/idle.js')));
const unsaved = await import(pathToFileURL(path.join(root, 'src/lib/session/unsaved.js')));
const MIN = 60 * 1000;
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error('✗', name, '\n  ', e.message); } };

test('the limit is 30 minutes and the warning comes 2 minutes before it', () => {
  assert.equal(idle.IDLE_MS, 30 * MIN);
  assert.equal(idle.idleState({ now: 27 * MIN, lastActivity: 0 }), 'active');
  assert.equal(idle.idleState({ now: 28 * MIN, lastActivity: 0 }), 'warning');
  assert.equal(idle.idleState({ now: 30 * MIN - 1, lastActivity: 0 }), 'warning');
  assert.equal(idle.idleState({ now: 30 * MIN, lastActivity: 0 }), 'expired');
  assert.equal(idle.idleState({ now: 5 * 60 * MIN, lastActivity: 0 }), 'expired');
});
test('there is no absolute lifetime: the clock restarts at every activity', () => {
  let last = 0;
  for (let t = 20 * MIN; t <= 600 * MIN; t += 20 * MIN) {          // ten hours of work, activity every 20 minutes
    assert.equal(idle.idleState({ now: t, lastActivity: last }), 'active');
    last = t;
  }
});
test('time left and the countdown text', () => {
  assert.equal(idle.msLeft({ now: 29 * MIN, lastActivity: 0 }), MIN);
  assert.equal(idle.msLeft({ now: 40 * MIN, lastActivity: 0 }), 0);
  assert.equal(idle.clock(120 * 1000), '2:00');
  assert.equal(idle.clock(61 * 1000), '1:01');
  assert.equal(idle.clock(0), '0:00');
});
test('the server is told about activity: not without any, then while working and after a pause', () => {
  const base = { lastExtend: 100 * MIN, reported: 100 * MIN };
  assert.equal(idle.shouldExtend({ ...base, now: 110 * MIN, lastActivity: 90 * MIN }), false);                 // nothing new since
  assert.equal(idle.shouldExtend({ ...base, now: 100.5 * MIN, lastActivity: 100.4 * MIN }), false);            // working, told 30 s ago
  assert.equal(idle.shouldExtend({ ...base, now: 102 * MIN, lastActivity: 101.9 * MIN }), true);               // working, told 2 min ago
  assert.equal(idle.shouldExtend({ ...base, now: 102.9 * MIN, lastActivity: 101.2 * MIN }), true);             // paused for 1.7 min, 1.2 min of news
});
test('no refresh for news of less than a minute: the server is allowed to lag that far behind', () => {
  const base = { lastExtend: 100 * MIN, reported: 100 * MIN };
  assert.equal(idle.shouldExtend({ ...base, now: 105 * MIN, lastActivity: 100.9 * MIN }), false);              // paused, but only 54 s of news
  assert.equal(idle.shouldExtend({ ...base, now: 105 * MIN, lastActivity: 101.1 * MIN }), true);               // paused, 66 s of news
  assert.equal(idle.shouldExtend({ lastExtend: 0, now: 5 * MIN, lastActivity: 4 * MIN }), true);               // never reported
});
test('the reported age is whole seconds and never negative', () => {
  assert.equal(idle.activityAgeSeconds({ now: 10500, lastActivity: 0 }), 10);
  assert.equal(idle.activityAgeSeconds({ now: 0, lastActivity: 5000 }), 0);
});
test('unsaved sources are tracked and released', () => {
  assert.equal(unsaved.hasUnsaved(), false);
  unsaved.setUnsaved('questionnaire', true);
  assert.equal(unsaved.hasUnsaved(), true);
  unsaved.setUnsaved('questionnaire', false);
  assert.equal(unsaved.hasUnsaved(), false);
});

console.log(`session-idle: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
