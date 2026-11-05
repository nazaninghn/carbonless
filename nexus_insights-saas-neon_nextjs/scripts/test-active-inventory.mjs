// Unit tests for the dashboard's active-inventory choice (src/lib/activeInventory.js).
// Run: node scripts/test-active-inventory.mjs
// Several inventories can share a reporting year; the dashboard must always name ONE of them,
// never fall back to "the year", and never trust a remembered id that no longer exists.
import assert from 'node:assert/strict';
import {
  inventoriesForYear, inventoryQuery, pickInventory, rememberInventory, rememberedInventory,
} from '../src/lib/activeInventory.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n  ', e.message); } };

// newest-updated first, as GET /api/questionnaire/ returns them
const reports = [
  { report_id: 9, reporting_year: 2023, title: 'C' },
  { report_id: 7, reporting_year: 2024, title: 'D' },
  { report_id: 5, reporting_year: 2023, title: 'B' },
  { report_id: 3, reporting_year: 2023, title: 'A' },
];
const memory = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };

test('lists only the inventories of the year, every one of them', () => {
  assert.deepEqual(inventoriesForYear(reports, 2023).map(r => r.report_id), [9, 5, 3]);
  assert.deepEqual(inventoriesForYear(reports, '2024').map(r => r.report_id), [7]);
  assert.deepEqual(inventoriesForYear(reports, 2030), []);
  assert.deepEqual(inventoriesForYear(null, 2023), []);
});

test('defaults to the most recently updated inventory of the year', () => {
  assert.equal(pickInventory(reports, 2023), 9);
  assert.equal(pickInventory(reports, 2024), 7);
});

test('a preferred or remembered inventory wins, in that order, only if it belongs to the year', () => {
  assert.equal(pickInventory(reports, 2023, 3), 3);
  assert.equal(pickInventory(reports, 2023, null, 5), 5);
  assert.equal(pickInventory(reports, 2023, 3, 5), 3);
  assert.equal(pickInventory(reports, 2023, 7), 9);            // 7 is a 2024 inventory
  assert.equal(pickInventory(reports, 2023, null, 999), 9);    // a deleted inventory is ignored
});

test('a year with no inventory has none (the server then uses the year-level records)', () => {
  assert.equal(pickInventory(reports, 2030), null);
  assert.equal(pickInventory([], 2023), null);
});

test('the choice is remembered per user and per year', () => {
  const s = memory();
  rememberInventory('u1', 2023, 5, s);
  assert.equal(rememberedInventory('u1', 2023, s), 5);
  assert.equal(rememberedInventory('u2', 2023, s), null);      // another user on a shared computer
  assert.equal(rememberedInventory('u1', 2024, s), null);      // another year
  rememberInventory('u1', 2023, null, s);
  assert.equal(rememberedInventory('u1', 2023, s), null);
  assert.equal(rememberedInventory('u1', 2023, null), null);   // no storage
});

test('the query fragment names the inventory, or is empty', () => {
  assert.equal(inventoryQuery(5), 'inventory_id=5');
  assert.equal(inventoryQuery('5'), 'inventory_id=5');
  assert.equal(inventoryQuery(null), '');
  assert.equal(inventoryQuery(0), '');
});

console.log(`active-inventory: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
