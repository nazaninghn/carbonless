#!/usr/bin/env node
// Regression tests for the questionnaire's own validation (questions.js) and
// number parsing (numbers.js) — the rules the server mirrors in
// carbonless_backend/questionnaire/carboniq_validation.py. Plain Node, no
// test framework:   npm run test:unit
//
// questions.js imports "@/" modules, which plain Node ESM can't resolve, so
// they are copied into a temp dir with the imports rewritten (same approach
// as extract-carboniq-schema.mjs).
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'carboniq-test-'));
const deps = {
  '@/lib/data/countries': 'src/lib/data/countries.js',
  '@/lib/utils/numbers': 'src/lib/utils/numbers.js',
  '@/lib/companyFields': 'src/lib/companyFields.js',
};

let failed = 0;
let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (e) {
    failed += 1;
    console.error(`✗ ${name}\n  ${e.message.split('\n').join('\n  ')}`);
  }
}

try {
  let src = readFileSync(join(repoRoot, 'src/lib/carboniq/questions.js'), 'utf-8');
  for (const [alias, file] of Object.entries(deps)) {
    const local = `./${alias.split('/').pop()}.mjs`;
    src = src.replace(`'${alias}'`, `'${local}'`);
    writeFileSync(join(scratch, local), readFileSync(join(repoRoot, file), 'utf-8'));
  }
  writeFileSync(join(scratch, 'questions.mjs'), src);
  const Q = await import(pathToFileURL(join(scratch, 'questions.mjs')));
  const { parseLocalizedNumber } = await import(pathToFileURL(join(scratch, 'numbers.mjs')));
  const q = (id) => Q.getQuestionById(id);
  const check = (id, value, answers = {}) => Q.validateCarbonIQAnswer(q(id), value, answers, 'en');

  test('0.825 is a decimal, 15.000 is fifteen thousand', () => {
    assert.equal(parseLocalizedNumber('0.825'), 0.825);
    assert.equal(parseLocalizedNumber('0,469'), 0.469);
    assert.equal(parseLocalizedNumber('15.000'), 15000);
    assert.equal(parseLocalizedNumber('1.234.567,89'), 1234567.89);
  });

  test('office days per week 0–7', () => {
    assert.equal(check('K3C7-2', '40').ok, false);
    assert.match(check('K3C7-2', '40').message, /between 0 and 7/);
    assert.equal(check('K3C7-2', '3').ok, true);
  });

  test('one-way commute at most 300 km', () => {
    assert.equal(check('K3C7-4', '15000').ok, false);
    assert.equal(check('K3C7-4', '18').ok, true);
  });

  test('EV commuters at most office + hybrid staff', () => {
    const answers = { 'K3C7-1': { fulltime_count: '40', hybrid_count: '40', remote_count: '40' } };
    const r = check('K3C7-5', '120000', answers);
    assert.equal(r.ok, false);
    assert.match(r.message, /\(80, Question 95a\)/);
    assert.equal(check('K3C7-5', '80', answers).ok, true);
    assert.equal(check('K3C7-5', '120000').ok, true, 'skipped while 95a is unanswered');
  });

  test('group count at most 20', () => {
    const r = check('3A-2', { unit_count: '8000', site: 'Fabrika', group_count: '8000' });
    assert.equal(r.ok, false);
    assert.match(r.message, /At most 20/);
    assert.equal(check('3A-2', { unit_count: '8000', site: 'Fabrika', group_count: '20' }).ok, true);
  });

  test('refill not above capacity', () => {
    assert.equal(check('3D-4', { refill_kg: '50000', capacity_kg: '8' }).ok, false);
    assert.equal(check('3D-4', { refill_kg: '2.5', capacity_kg: '8' }).ok, true);
    assert.equal(check('3D-4', { refill_kg: '2.5' }).ok, true);
  });

  test('the same exception twice is refused', () => {
    const row = { exception_description: 'Gas factor', materiality_pct: '2', justification: 'Invoice' };
    assert.equal(check('6C-2', { items: [row, { ...row, justification: ' invoice ' }] }).ok, false);
    assert.equal(check('6C-2', { items: [row, { ...row, exception_description: 'Canteen' }] }).ok, true);
  });

  test('supplier / facility factor in a unit no amount uses is refused', () => {
    const doc = { ef_value: '0.825', ef_unit: 'kgCO2e_m3', ef_source: 'Plant lab', ef_year: '2025' };
    const answers = { '3C-2': { 'EQ-3C-01': { quantity: '50000', method: 'cems_tier3' } } };
    const r = check('3C-EF-a', doc, answers);
    assert.equal(r.ok, false);
    assert.match(r.message, /could not be used/);
    assert.equal(check('3C-EF-a', { ...doc, ef_unit: 'kgCO2e_tonne_product', ef_value: '510' }, answers).ok, true);
    const gas = { '3A-5': { natural_gas: '50000 m³' } };
    assert.equal(check('3A-EF-a', { ...doc, ef_unit: 'kgCO2e_litre' }, gas).ok, false);
    assert.equal(check('3A-EF-a', { ...doc, ef_unit: 'kgCO2e_m3', ef_value: '2.05' }, gas).ok, true);
  });

  test('a diesel generator suggests diesel first', () => {
    assert.deepEqual(Q.suggestedOptionValues(q('3A-4'), 'EQ-3A-07'), ['diesel']);
    assert.deepEqual(Q.suggestedOptionValues(q('3A-4'), 'EQ-3A-08#2'), ['natural_gas']);
    assert.deepEqual(Q.suggestedOptionValues(q('3A-5'), 'EQ-3A-07'), []);
  });

  test('no Euro standard or road band for a locomotive', () => {
    const euro = q('3B-4').options;
    const forItem = (item) => euro.filter(o => !o.onlyForItems || o.onlyForItems.includes(item)).map(o => o.value);
    assert.deepEqual(forItem('EQ-3B-22'), ['not_applicable']);
    assert.ok(forItem('EQ-3B-01').includes('euro_6d') && !forItem('EQ-3B-01').includes('not_applicable'));
    const band = q('3B-3').fields.find(f => f.id === 'size_band');
    assert.deepEqual(band.optionsByItem['EQ-3B-22'], ['not_road']);
  });

  test('a gas pipeline offers methane, not refrigerants', () => {
    const gas = q('3D-2').fields.find(f => f.id === 'gas_type');
    assert.deepEqual(gas.optionsByItem['EQ-3D-08'], ['CH4', 'unknown']);
    assert.ok(gas.options.some(o => o.value === 'CH4'));
    assert.deepEqual(gas.optionsByItem['EQ-3D-11'], ['SF6', 'unknown']);
  });

  test('a field error names its field, so the form can scroll to it', () => {
    const r = check('A7b', { telephone: 'QA test answer' });
    assert.equal(r.ok, false);
    assert.equal(r.field, 'telephone');
  });

  writeFileSync(join(scratch, 'activeYear.mjs'), readFileSync(join(repoRoot, 'src/lib/activeYear.js'), 'utf-8'));
  const Y = await import(pathToFileURL(join(scratch, 'activeYear.mjs')));
  test('the dashboard year: remembered per user, else the latest inventory', () => {
    const now = new Date('2026-10-19T12:00:00Z');
    assert.equal(Y.defaultReportingYear([{ reporting_year: 2025 }, { reporting_year: 2023 }], now), 2025);
    assert.equal(Y.defaultReportingYear([], now), 2026);
    assert.equal(Y.defaultReportingYear([{ reporting_year: 2031 }, { reporting_year: 2024 }], now), 2024);
    const store = new Map();
    const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    Y.rememberYear('3', 2024, storage);
    assert.equal(Y.rememberedYear('3', storage), 2024);
    assert.equal(Y.rememberedYear('4', storage), null, 'another user does not get this year');
    const payload = Buffer.from(JSON.stringify({ user_id: 3 })).toString('base64url');
    store.set('_ca', `h.${payload}.s`);
    assert.equal(Y.tokenUserId(storage), '3');
  });

  test('options without a factor say so', () => {
    const loco = q('3B-1').options.find(o => o.value === 'EQ-3B-22');
    assert.equal(loco.notCalculated, true);
    assert.match(loco.label.en, /recorded, not calculated yet/);
    assert.ok(q('K3C7-0').notCalculated?.en);
  });
  // The server validates with a JSON extract of questions.js; a rule added
  // here but not extracted is enforced in the browser only (ef_market was
  // required in the form for days while the server accepted it missing).
  test('the server schema and labels are regenerated from questions.js', () => {
    const backendData = join(repoRoot, '..', 'carbonless_backend', 'questionnaire', 'data');
    for (const [flag, file] of [[[], 'carboniq_schema.json'], [['--labels'], 'carboniq_labels.json']]) {
      const fresh = execFileSync(process.execPath, [join(repoRoot, 'scripts', 'extract-carboniq-schema.mjs'), ...flag],
        { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
      const committed = readFileSync(join(backendData, file), 'utf-8');
      assert.deepEqual(JSON.parse(committed), JSON.parse(fresh),
        `${file} is stale — run: node scripts/extract-carboniq-schema.mjs ${flag.join(' ')} > ../carbonless_backend/questionnaire/data/${file}`);
    }
  });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
