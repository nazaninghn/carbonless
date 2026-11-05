// Generates the "answer later" policy from the question catalogue (src/lib/carboniq/questions.js):
//   node scripts/generate-deferral-policy.mjs            writes both copies
//   node scripts/generate-deferral-policy.mjs --check    fails when a committed copy differs from what this generates
//
//   carbonless_backend/questionnaire/deferral_policy.json   (the server)
//   src/lib/carboniq/deferralPolicy.js                       (the frontend; a test keeps the two identical)
//
// What it does, in order:
//   1. what each question DOES decides required / deferrable / info (the REQUIRED table below is the business reason
//      of each required question; everything else follows from routes, loops and info types);
//   2. which questions are conditional (on the route for some answers only) or never on the route comes from the
//      EXHAUSTIVE route search of scripts/audit-route-graph.mjs, not from sampling;
//   3. loop data a server needs to tell that a loop has no items: `ls` / `lio` on each loop question and the
//      top-level `loopSources` ({source id: {num, ex}}) — the mirror of buildLoopItems in CarbonAIPage.jsx.
// Edit the tables here, never the generated files.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BE = path.join(repoRoot, '..', 'carbonless_backend', 'questionnaire', 'deferral_policy.json');
const FE_FILE = path.join(repoRoot, 'src', 'lib', 'carboniq', 'deferralPolicy.js');
const CHECK = process.argv.includes('--check');

// the catalogue, with its `@/` imports pointed at local copies (the same way the route audit loads it)
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-gen-'));
const deps = { '@/lib/data/countries': 'src/lib/data/countries.js', '@/lib/utils/numbers': 'src/lib/utils/numbers.js', '@/lib/companyFields': 'src/lib/companyFields.js' };
let src = fs.readFileSync(path.join(repoRoot, 'src/lib/carboniq/questions.js'), 'utf-8');
for (const [alias, file] of Object.entries(deps)) {
  const local = `./${alias.split('/').pop()}.mjs`;
  src = src.replace(`'${alias}'`, `'${local}'`);
  fs.writeFileSync(path.join(scratch, local), fs.readFileSync(path.join(repoRoot, file), 'utf-8'));
}
fs.writeFileSync(path.join(scratch, 'questions.mjs'), src);
const { CARBONIQ_QUESTIONS } = await import(pathToFileURL(path.join(scratch, 'questions.mjs')));

// ── What each REQUIRED question does (the business reason; the code picks the explanation shown) ──────────
const REQUIRED = {
  A1: ['identity', 'Legal name of the reporting organization: identifies the inventory in every report and in Company Profile reuse.'],
  A3: ['calc_prerequisite', 'Country and city select the default national grid and regional factors the rest of the questionnaire uses.'],
  A4: ['identity', 'Reporting year: sets the factor year and every year-scoped record of the inventory.'],
  B1: ['structure', 'Sector decides whether the process-emission (3C-0) and sold-product-processing (K3C10-0) questions apply.'],
  C1: ['structure', 'Subsidiaries decide whether the subsidiary boundary questions (2A-4) apply.'],
  C2: ['structure', 'International operations drive the overseas-site advisor check on later site answers.'],
  C3: ['structure', 'Franchise / joint venture decides whether Scope 3 category 14 (K3C14-0) applies.'],
  D1: ['methodology', 'Emission factor database: selects the factor source used by every calculation.'],
  D3: ['boundary', 'Consolidation approach: decides which boundary questions follow and how facilities are included.'],
  D4: ['methodology', 'Scope 3 reporting approach: decides the Scope 3 route.'],
  'SCOPE-GROUPING': ['structure', 'Decides whether Scope 1 and 2 are answered as one flow or Scope 2 starts its own section; unanswered it was silently treated as "together".'],
  '2A-1': ['loop_source', 'Number of facilities: the facility loop (2A-2, 2A-3, 4A-1) is asked once per facility.'],
  '2A-4': ['boundary', 'Subsidiary / affiliate entities: part of the organizational boundary.'],
  '2A-5': ['boundary', 'Equity share in the subsidiary: decides how much of it is included (equity-share approach).'],
  '2B-OC1a': ['boundary', 'Facilities outside operational control: excluded from the boundary.'],
  '2B-OC2': ['boundary', 'Who manages day-to-day operations: operational-control test.'],
  '2B-FC2': ['boundary', 'Authority over financial and operating policies: financial-control test.'],
  '2B-EQ1': ['boundary', 'Equity share per asset: decides the included share (equity-share approach).'],
  '3A-1': ['loop_source', 'Stationary combustion equipment: the equipment loop is asked per item.'],
  '3A-1a': ['loop_source', 'Name and fuel of equipment that is not in the list: needed before its loop items can be asked.'],
  '3A-5bio': ['methodology', 'Which biomass is burned: selects the factor and the biogenic treatment.'],
  '3A-6a': ['methodology', 'Estimation method and source for estimated consumption: the data-quality basis recorded for the ISO report.'],
  '3B-1': ['loop_source', 'Vehicle types: the vehicle loop is asked per type.'],
  '3C-1': ['loop_source', 'Process equipment: the process loop is asked per item.'],
  '3D-0': ['loop_source', 'Fugitive sources: the refrigerant loop is asked per source.'],
  '3D-4-zero-decision': ['methodology', 'How a zero refill is treated in the leakage calculation.'],
  '4A-2s': ['structure', 'Facilities in shared or leased buildings: defines the allocation sub-flow (4A-2a, 4A-2b, 4A-2c).'],
  '4B-1': ['loop_source', 'Purchased energy types: the energy loop is asked per type.'],
  'K3C1-1': ['loop_source', 'Purchased goods and service categories: asked per category.'],
  'K3C3-custom': ['methodology', 'The custom WTT / T&D factor chosen for category 3.'],
  'K3C7-0': ['methodology', 'Commute survey or estimate: decides the commuting method.'],
  'K3C7-1': ['structure', 'Full-time / hybrid / remote counts: decide which commuting follow-ups apply.'],
  'K3C7-3': ['structure', 'Commute mode shares: decide whether the shuttle ownership question applies.'],
  'K3C7-6': ['methodology', 'Who owns the staff shuttle buses: decides whether the emissions are Scope 1 or Scope 3.'],
  '6F-3': ['methodology', 'Base year recalculation decision.'],
  '7C-2': ['sign_off', 'Signature and declaration: the act that completes the inventory.'],
};
const DEFERRABLE_REASON = {
  A2: 'Tax identification number: identifies the company, changes neither the route nor any calculation.',
  A5: 'Name of the preparer: documentation only.',
  A6: 'Intended use of the report: documentation only.',
  A7b: 'Organization details printed in the report: documentation only.',
  B2: 'Description of the main activity: documentation only.',
  B3: 'Employee band: used for the sector-benchmark band and a plausibility warning against the commuting headcounts (K3C7-1); not an input of any emission calculation.',
  B4: 'Number of locations: a reference for the facility count, which 2A-1 asks itself.',
  B5: 'Location types: documentation only.',
  B6: 'Revenue band (optional).',
  '6E-1': 'Planned data-quality improvements (optional text).',
};

const questions = {};
for (const q of CARBONIQ_QUESTIONS) {
  const exclusive = (q.options || []).filter(o => o.exclusive || o.value === 'none' || o.value === 'skip').map(o => o.value);
  const e = {
    n: q.number, stage: q.stage, type: q.type, text: q.text?.en || '', iso: q.isoRef || undefined,
    req: q.required === true, creq: q.conditionalRequired || undefined,
    next: q.next || undefined, nbv: q.nextByValue || undefined, loopNext: q.loopNext || undefined,
    loop: q.loopSource ? true : undefined, show: q.conditionalShow || undefined,
    exclusive: exclusive.length ? exclusive : undefined,
  };
  let kind, code, reason;
  if (q.type === 'info') { kind = 'info'; code = 'info'; reason = 'Information screen: not a question.'; }
  else if (q.type === 'section_picker') { kind = 'info'; code = 'navigation'; reason = 'Section picker: navigation back into a section, not an answer.'; }
  else if (q.loopSource) { kind = 'required'; code = 'loop_item'; reason = 'Answered item by item for the items its loop source defined (' + q.loopSource + '); not deferrable one by one.'; }
  else if (REQUIRED[q.id]) { [code, reason] = REQUIRED[q.id]; kind = 'required'; }
  else if (q.nextByValue) { kind = 'required'; code = 'gate'; reason = 'Its answer chooses the next question (' + Object.keys(q.nextByValue).join(' / ') + '); without it the route is a guess.'; }
  else { kind = 'deferrable'; code = 'deferrable'; reason = DEFERRABLE_REASON[q.id] || 'Data input or documentation: its answer changes neither the route, the boundary nor the method; it can be supplied later.'; }
  questions[q.id] = Object.assign(e, { kind, code, reason });
}


// ── 2. conditional / never-on-the-route: from the exhaustive route search ───────────────────────────────────
const staticPolicy = { version: 1, generated_from: 'src/lib/carboniq/questions.js', questions };
const tmpPolicy = path.join(scratch, 'policy.mjs');
fs.writeFileSync(tmpPolicy, 'export default ' + JSON.stringify(staticPolicy) + ';\n');
process.env.AUDIT_POLICY_FILE = tmpPolicy;
process.env.AUDIT_CLASSES_ONLY = '1';
const { classes } = await import('./audit-route-graph.mjs');
for (const [id, q] of Object.entries(questions)) {
  if (q.kind === 'info') continue;
  const c = classes[id];
  if (c === 'always') continue;
  q.then = q.kind; q.kind = 'conditional';
  if (c === 'never') q.unreachable = true;
  else if (c !== 'sometimes') throw new Error(`unexpected class ${c} for ${id}`);
}

// ── 3. loops: what a server needs to tell that a loop has no items ───────────────────────────────────────────
const byId = Object.fromEntries(CARBONIQ_QUESTIONS.map(q => [q.id, q]));
const loopSources = {};
for (const [id, p] of Object.entries(questions)) {
  const q = byId[id];
  if (!q || !q.loopSource) continue;
  p.ls = q.loopSource;
  if (q.loopItemsOnly) p.lio = q.loopItemsOnly;
  const s = byId[q.loopSource];
  loopSources[q.loopSource] = {
    num: !!(s && (s.subtype === 'numeric' || s.type === 'numeric')),
    ex: ((s && s.options) || []).filter(o => o.exclusive || o.value === 'none').map(o => o.value),
  };
}

const out = { version: 1, generated_from: 'src/lib/carboniq/questions.js', questions, loopSources };
const json = JSON.stringify(out, null, 1) + '\n';
const js = '// GENERATED from questions.js by scripts/generate-deferral-policy.mjs — do not edit by hand.\n' +
  '// The same data lives in carbonless_backend/questionnaire/deferral_policy.json (a test keeps them identical).\n' +
  'export default ' + JSON.stringify(out, null, 1) + ';\n';
if (CHECK) {
  const bad = [];
  if (fs.readFileSync(BE, 'utf-8').replace(/\r\n/g, '\n') !== json) bad.push('carbonless_backend/questionnaire/deferral_policy.json');
  if (fs.readFileSync(FE_FILE, 'utf-8').replace(/\r\n/g, '\n') !== js) bad.push('src/lib/carboniq/deferralPolicy.js');
  if (bad.length) { console.error('deferral policy is out of date with the generator:', bad.join(', '), '\n  run: node scripts/generate-deferral-policy.mjs'); process.exit(1); }
  console.log('deferral policy: both copies are what the generator produces');
} else {
  fs.writeFileSync(BE, json);
  fs.writeFileSync(FE_FILE, js);
  const tally = {};
  for (const q of Object.values(questions)) { const k = q.kind + (q.then ? '>' + q.then : ''); tally[k] = (tally[k] || 0) + 1; }
  console.log('written', Object.keys(questions).length, 'questions', tally);
}
process.exit(0);
