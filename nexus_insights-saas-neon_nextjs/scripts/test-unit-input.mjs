// Unit tests for the amount + unit helpers (src/lib/carboniq/unitInput.js).
// Run: node scripts/test-unit-input.mjs
// A stored answer is one string ("15000 m³", "500 kg buhar/h"): re-editing it must give the same amount and chip back,
// whatever the unit holds, and the LPG / fuel-oil kg warning must exist exactly where kg is offered.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitStoredAmount, joinAmountUnit, unitWarning } from '../src/lib/carboniq/unitInput.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n  ', e.message); } };

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(here, '..', '..', 'carbonless_backend', 'questionnaire', 'data', 'carboniq_schema.json'), 'utf-8'));
const CAPACITY = schema['3A-3'].units;
const FUELS = schema['3A-5'].units;

// The previous implementation (split on the last space), kept here as the oracle for every single-word unit.
const previous = (v, unitList) => {
  if (!v || typeof v !== 'string') return { amount: v || '', unit: '' };
  const parts = v.split(' ');
  if (parts.length >= 2) {
    const potentialUnit = parts[parts.length - 1];
    if (unitList.includes(potentialUnit)) return { amount: parts.slice(0, -1).join(' '), unit: potentialUnit };
  }
  return { amount: v, unit: '' };
};

test('kg buhar/h is split as amount + unit, not cut at its last word', () => {
  assert.deepEqual(splitStoredAmount('500 kg buhar/h', CAPACITY), { amount: '500', unit: 'kg buhar/h' });
  assert.deepEqual(splitStoredAmount('12.5 kg buhar/h', CAPACITY), { amount: '12.5', unit: 'kg buhar/h' });
});

test('the capacity units are all offered, including the multi-word one', () => {
  assert.ok(CAPACITY.includes('kg buhar/h'));
  assert.deepEqual(CAPACITY, ['kW', 'kcal/h', 'kg buhar/h', 'MJ/h', 'hp']);
});

test('re-editing a stored value gives the same amount and chip back, for every capacity unit', () => {
  for (const unit of CAPACITY) {
    const stored = joinAmountUnit('500', unit);
    const { amount, unit: chip } = splitStoredAmount(stored, CAPACITY);
    assert.equal(chip, unit);
    assert.equal(amount, '500');
    assert.equal(joinAmountUnit(amount, chip), stored);                    // saving it again changes nothing
  }
});

test('changing the amount or the chip of a stored kg buhar/h value never doubles the unit', () => {
  const { amount, unit } = splitStoredAmount('500 kg buhar/h', CAPACITY);
  assert.equal(joinAmountUnit('750', unit), '750 kg buhar/h');
  assert.equal(joinAmountUnit(amount, 'kW'), '500 kW');
  assert.equal(splitStoredAmount('500 kg buhar/h kW', CAPACITY).unit, 'kW');  // what the old split produced, now just a visible oddity
});

test('a value with no listed unit comes back whole, with no chip', () => {
  assert.deepEqual(splitStoredAmount('500', CAPACITY), { amount: '500', unit: '' });
  assert.deepEqual(splitStoredAmount('500 kg', CAPACITY), { amount: '500 kg', unit: '' });
  assert.deepEqual(splitStoredAmount('500 buhar/h', CAPACITY), { amount: '500 buhar/h', unit: '' });
  assert.deepEqual(splitStoredAmount('', CAPACITY), { amount: '', unit: '' });
  assert.deepEqual(splitStoredAmount(undefined, CAPACITY), { amount: '', unit: '' });
  assert.deepEqual(splitStoredAmount(null, undefined), { amount: '', unit: '' });
  assert.deepEqual(splitStoredAmount(12, CAPACITY), { amount: 12, unit: '' });
});

test('every single-word unit of every question splits exactly as before', () => {
  const corpus = ['15000 m³', '1 000 m³', '15.000 kWh', '15000', 'abc', '100 litre', '2 ton', '100 GJ', '3 MWh', '100 tonnes', '5 kg', ''];
  const lists = [];
  for (const q of Object.values(schema)) {
    if (Array.isArray(q.units)) lists.push(q.units.filter(u => !u.includes(' ')));
    else if (q.units && typeof q.units === 'object') for (const l of Object.values(q.units)) lists.push(l);
  }
  assert.ok(lists.length >= 10);
  for (const list of lists) for (const v of corpus) assert.deepEqual(splitStoredAmount(v, list), previous(v, list), `${v} / ${list}`);
});

test('an empty amount stays empty, never a bare unit', () => {
  assert.equal(joinAmountUnit('', 'kW'), '');
  assert.equal(joinAmountUnit('  ', 'kW'), '');
  assert.equal(joinAmountUnit('500', ''), '500');
});

test('the kg warning exists for LPG and fuel oil only, in both languages, and names litres', () => {
  for (const fuel of ['lpg', 'fuel_oil']) {
    const en = unitWarning('3A-5', fuel, 'kg', 'en');
    const tr = unitWarning('3A-5', fuel, 'kg', 'tr');
    assert.match(en, /not calculated/); assert.match(en, /litres/); assert.match(en, /no density conversion/);
    assert.match(tr, /hesaplanmıyor/); assert.match(tr, /litre/); assert.match(tr, /yoğunluk/);
    assert.equal(unitWarning('3A-5', fuel, 'litre', 'en'), null);
  }
});

test('no warning for the units that are calculated, other fuels, or other questions', () => {
  assert.equal(unitWarning('3A-5', 'diesel', 'litre', 'en'), null);
  assert.equal(unitWarning('3A-5', 'coal', 'kg', 'en'), null);
  assert.equal(unitWarning('3A-5', 'natural_gas', 'kWh', 'en'), null);
  assert.equal(unitWarning('K3C1-3a', 'lpg', 'kg', 'en'), null);
  assert.equal(unitWarning('3A-5', undefined, 'kg', 'en'), null);
});

test('the warning is reachable: kg is offered for exactly the fuels that have one', () => {
  for (const fuel of ['lpg', 'fuel_oil']) assert.ok(FUELS[fuel].includes('kg'), `${fuel} no longer offers kg`);
  const warned = Object.keys(FUELS).filter(f => FUELS[f].some(u => unitWarning('3A-5', f, u, 'en')));
  assert.deepEqual(warned.sort(), ['fuel_oil', 'lpg']);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
