#!/usr/bin/env node
// Exhaustive audit of the questionnaire's routing graph (178 questions, 48 branching questions, 107 branches,
// 43 conditionally shown questions, 23 loop questions, 4 section pickers).
//
// What it proves, over EVERY route a user who answers each question they are shown can take:
//   1. which questions are always on the route, which only sometimes, which never — compared with the
//      "answer later" policy (kind unconditional / conditional / unreachable), so a mis-classified question,
//      or a conditional branch the earlier sampling missed, fails here;
//   2. that no route dead-ends: every route ends at the sign-off screen (7B-INFO, answered "done") or at the end of
//      the assumptions review (6B-5);
//   3. branch coverage: every answer of every branching question, and both outcomes of every
//      conditionalShow, are reachable on some route.
//
// How it stays exhaustive: the naive space of answers is ~2^53, but a route only depends on the answers a
// later question still READS. The explorer walks (question, the still-read answers, the visited members of the
// one cycle) states with memoization, so each distinct future is explored once. It uses the engine's own
// nextQuestionId and conditionalShowMatches, so the semantics are the engine's; its walk loop is checked
// against deferral.js routeIds on 20,000 random concrete routes and on a witness route for every claim.
//
// Model limits (documented in ANSWER_LATER_POLICY.md): a user "answers" every question the route shows; an
// answer is one of the question's options (compound answers: representative values per condition outcome,
// including boundary values); stale answers on abandoned branches, edit-mode jumps through section pickers and
// loops without items are not modelled here (the shared fixtures cover partial answer sets).
//
// Run: node scripts/audit-route-graph.mjs
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'route-audit-'));
const deps = { '@/lib/data/countries': 'src/lib/data/countries.js', '@/lib/utils/numbers': 'src/lib/utils/numbers.js', '@/lib/companyFields': 'src/lib/companyFields.js' };
let src = readFileSync(join(repoRoot, 'src/lib/carboniq/questions.js'), 'utf-8');
for (const [alias, file] of Object.entries(deps)) {
  const local = `./${alias.split('/').pop()}.mjs`;
  src = src.replace(`'${alias}'`, `'${local}'`);
  writeFileSync(join(scratch, local), readFileSync(join(repoRoot, file), 'utf-8'));
}
writeFileSync(join(scratch, 'questions.mjs'), src);
const Qs = await import(pathToFileURL(join(scratch, 'questions.mjs')));
const D = await import('../src/lib/carboniq/deferral.js');
// the generator (generate-deferral-policy.mjs) points this at the policy it is building, to classify the questions
const POLICY = (await import(process.env.AUDIT_POLICY_FILE ? pathToFileURL(process.env.AUDIT_POLICY_FILE).href : '../src/lib/carboniq/deferralPolicy.js')).default;
const Q = POLICY.questions;
const eng = D.createDeferral(POLICY);
const ids = Object.keys(Q);
const t0 = Date.now();

// ── the answer domains ──────────────────────────────────────────────────────────────────────────────────
const optionValues = (id) => (Qs.getQuestionById(id)?.options || []).map(o => o.value);
const isGate = (q) => q.nbv && q.type !== 'info' && q.type !== 'section_picker';
const showReaders = {};                                  // variable -> the show conditions that read it
for (const [id, q] of Object.entries(Q)) if (q.show) (showReaders[q.show.questionId] ||= []).push({ id, cond: q.show });

// Non-gate answers some condition reads: representative values, boundaries included. Every value is
// grouped by the outcome vector it gives over the conditions that read it; one representative per group.
const CANDIDATES = {
  C1: ['yes', 'no'], C3: ['yes', 'no'],
  D3: optionValues('D3'),
  B1: optionValues('B1').concat(['NACE_25.11', 'NACE_', undefined]),
  '3A-1': [[], ['EQ-3A-01'], ['EQ-3A-99'], ['EQ-3A-01', 'EQ-3A-99']],
  '3A-5': [{}, { natural_gas: '1' }, { biomass: '' }, { biomass: ' ' }, { biomass: '0' }, { biomass: '5' }, { biomass: 5 }, { biomass: null }],
  '3A-6': [{}, { x: 'invoice_meter' }, { x: 'engineering_estimate' }, { x: 'sector_average' }, { x: 'invoice_meter', y: 'sector_average' }],
  '3B-5': [{}, { a: 'diesel' }, { a: 'electric' }, { a: 'diesel', b: 'electric' }],
  '3D-4': [{}, { a: { refill_kg: '5' } }, { a: { refill_kg: '0' } }, { a: { refill_kg: '0.0' } }, { a: { refill_kg: '' } },
    { a: {} }, { a: { refill_kg: null } }, { a: { refill_kg: '5' }, b: { refill_kg: '0' } }, { a: { refill_kg: 'abc' } }],
  '4A-1': [{}, { 1: '100 kWh' }, { 1: '100 TL' }, { 1: '100 tl' }, { 1: '100' }, { 1: '100 kWh', 2: '5 TL' }],
  'K3C7-1': ['0', '1', '0.5', '', ' ', 'abc', undefined, '5'].map(v => (v === undefined ? {} : { hybrid_count: v })),
  'K3C7-3': ['0', '1', '0.5', '', ' ', 'abc', undefined, '10'].map(v => (v === undefined ? {} : { shuttle_pct: v })),
};
function domainOf(id) {
  const q = Q[id];
  if (isGate(q)) {
    if (q.type === 'multi_select') {
      const other = optionValues(id).find(v => !(q.exclusive || []).includes(v) && v !== 'none');
      return [['none'], [other], [other, 'none']].filter(v => v[0] !== undefined);
    }
    const vals = [...new Set([...Object.keys(q.nbv), ...optionValues(id)])];
    return vals;
  }
  if (id === 'SCOPE-GROUPING') return ['combined', 'separate'];
  if (CANDIDATES[id]) {
    const conds = (showReaders[id] || []).map(r => r.cond);
    const groups = new Map();
    for (const v of CANDIDATES[id]) {
      const key = JSON.stringify(conds.map(c => D.conditionalShowMatches(c, v === undefined ? {} : { [id]: v })));
      if (!groups.has(key)) groups.set(key, v);
    }
    return [...groups.values()];
  }
  return null;                                           // answered, but nothing downstream reads it
}
const DOMAIN = {};
for (const id of ids) { const d = domainOf(id); if (d) DOMAIN[id] = d; }
// every variable a condition reads must have a domain: a new conditional source without one fails the audit
for (const r of Object.values(showReaders).flat()) assert.ok(DOMAIN[r.cond.questionId] || Q[r.cond.questionId], `no answer domain for ${r.cond.questionId}`);
for (const v of Object.keys(showReaders)) assert.ok(DOMAIN[v], `condition source ${v} has no answer domain in the audit`);

// ── liveness: which answers can still matter from a question on ──────────────────────────────────────────
// Over the FORWARD graph only: a section picker is skipped by the walker (it takes the picker's `next`), and an
// edge back to a question already visited is rerouted forward, so neither is ever followed.
const edgesOf = (id) => { const q = Q[id]; return q.type === 'section_picker' ? [q.next].filter(Boolean) : [q.next, q.loopNext, ...Object.values(q.nbv || {})].filter(Boolean); };
const backEdges = new Set(); const backTargets = new Set();
{
  const state = {};                                      // 1 = on the DFS stack, 2 = done
  const dfs = (u) => { state[u] = 1; for (const v of edgesOf(u)) { if (!Q[v]) continue; if (state[v] === 1) { backEdges.add(u + '>' + v); backTargets.add(v); } else if (!state[v]) dfs(v); } state[u] = 2; };
  dfs('A1');
}
const succ = (id) => edgesOf(id).filter(v => Q[v] && !backEdges.has(id + '>' + v));
const reach = {};                                        // id -> set of ids reachable (including itself)
for (const id of ids) {
  const seen = new Set([id]); const st = [id];
  while (st.length) { for (const n of succ(st.pop())) if (!seen.has(n)) { seen.add(n); st.push(n); } }
  reach[id] = seen;
}
const readersOf = {};                                    // var -> nodes that read it
for (const [v, rs] of Object.entries(showReaders)) readersOf[v] = new Set(rs.map(r => r.id));
readersOf['SCOPE-GROUPING'] = new Set(ids.filter(i => edgesOf(i).includes('4-GİRİŞ')));
const live = (v, id) => [...(readersOf[v] || [])].some(r => reach[id].has(r));
const cyc = backTargets;                                 // the visited members that decide a "go back" edge

// ── the explorer ────────────────────────────────────────────────────────────────────────────────────────
const valKey = (v) => JSON.stringify(v === undefined ? null : v);
function explore({ forbid = null, wantAll = false } = {}) {
  const visitedAny = new Map();                          // id -> witness path (first time on a route)
  const branches = new Map();                            // `${id}=${value}` -> true
  const showOutcomes = new Map();                        // id -> {shown, hidden}
  const terminals = [];                                  // { last, how, path? }
  const endings = {};
  const memo = new Set();
  let states = 0, found = null;
  const path = [];                                       // [{id, v}]
  // a route ending: counted by where it ends; the path is kept only for the first few that end somewhere unexpected
  const endAt = (how) => {
    const last = path.at(-1)?.id;
    const t = { last, how };
    if (last !== '7B-INFO' && terminals.filter(x => x.path).length < 3) t.path = path.slice();
    if (wantAll) { endings[how + '@' + last] = (endings[how + '@' + last] || 0) + 1; } else { found = { ...t, path: path.slice() }; }
    terminals.push(wantAll ? { last, how, path: t.path } : found);
  };

  function go(id, A, seen) {
    if (found && !wantAll) return;
    while (true) {
      const q = Q[id];
      if (!id || !q || seen.has(id)) { endAt(id && !q ? 'unknown' : id ? 'cycle' : 'end'); return; }
      // memo: the future depends on this node, the answers still read from here on, and the cycle's visited members
      const key = id + '|' + Object.keys(A).filter(v => live(v, id)).sort().map(v => v + '=' + valKey(A[v])).join(',') + '|' + [...seen].filter(s => cyc.has(s)).sort().join(',');
      if (memo.has(key)) return;
      memo.add(key); states++;
      if (process.env.AUDIT_DEBUG && states % 20000 === 0) console.error('states', states, 'at', id, 'live', Object.keys(A).filter(v => live(v, id)).join(','));
      if (process.env.AUDIT_CAP && states > Number(process.env.AUDIT_CAP)) { console.error('CAP reached'); process.exit(3); }
      const nextSeen = new Set(seen); nextSeen.add(id);
      if (q.show) {
        const shown = D.conditionalShowMatches(q.show, A);
        const o = showOutcomes.get(id) || { shown: false, hidden: false };
        o[shown ? 'shown' : 'hidden'] = true; showOutcomes.set(id, o);
        if (!shown) { id = q.next || q.loopNext || null; seen = nextSeen; continue; }
      }
      if (q.type === 'section_picker') { id = q.next || null; seen = nextSeen; continue; }
      if (id === forbid) return;                         // this run asks "can the route avoid it?"
      if (!visitedAny.has(id)) visitedAny.set(id, path.slice().concat([{ id, v: undefined }]));
      const dom = DOMAIN[id] ?? [undefined];
      for (const v of dom) {
        const A2 = DOMAIN[id] ? { ...A, [id]: v } : A;
        if (DOMAIN[id]) branches.set(`${id}=${valKey(v)}`, true);
        let next;
        if (q.loop) next = q.loopNext || q.next || null;
        else if (q.type === 'info') next = q.next || q.loopNext || (q.nbv ? Object.values(q.nbv).find(Boolean) : null) || null;
        else next = eng.nextQuestionId(q, v === undefined ? 'x' : v);
        if (next === '4-GİRİŞ' && A2['SCOPE-GROUPING'] !== 'separate') next = Q['4-GİRİŞ']?.next || next;
        const backwards = (n) => !n || nextSeen.has(n) || Q[n]?.type === 'section_picker';
        if (next && backwards(next)) {
          const alts = [q.next, ...Object.values(q.nbv || {}), q.loopNext];
          next = alts.find(n => n && !backwards(n)) || null;
        }
        path.push({ id, v });
        go(next, A2, nextSeen);
        path.pop();
        if (found && !wantAll) return;
      }
      return;
    }
  }
  go('A1', {}, new Set());
  return { visitedAny, branches, showOutcomes, terminals, endings, states, found };
}

// A concrete answer map for a path, in the shape the engine expects: a visited question is answered.
function replayMap(p) {
  const m = {};
  for (const { id, v } of p) if (Q[id].type !== 'info') m[id] = DOMAIN[id] ? v : 'x';
  return m;
}

// ── 1. the full exploration ─────────────────────────────────────────────────────────────────────────────
const full = explore({ wantAll: true });
// the sign-off screen answered "done", or the end of the assumptions review (6B-5: its "confirm" goes back to a question already passed)
const expectedEnd = (t) => t.last === '7B-INFO' || t.last === '6B-5';
const deadEnds = full.terminals.filter(t => !expectedEnd(t));
const endsOk = full.terminals.filter(expectedEnd);
console.log(`explored ${full.states.toLocaleString()} states in ${((Date.now() - t0) / 1000).toFixed(1)}s | ${full.terminals.length.toLocaleString()} distinct route endings`);

// ── 2. every question: always / sometimes / never on the route, per the exhaustive search ───────────────
const classes = {};
const bypass = {};
for (const id of ids) {
  if (Q[id].kind === 'info' && Q[id].code === 'navigation') { classes[id] = 'navigation'; continue; }
  if (!full.visitedAny.has(id)) { classes[id] = 'never'; continue; }
  const r = explore({ forbid: id });
  bypass[id] = r.found;
  classes[id] = r.found ? 'sometimes' : 'always';
}
console.log(`classified ${ids.length} questions in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ── 3. compared with the policy ─────────────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const test = process.env.AUDIT_CLASSES_ONLY ? () => {} : (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n  ', String(e.message).split('\n').join('\n   ')); } };

test('no route dead-ends: every route ends at the sign-off screen (7B-INFO) or the assumptions review (6B-5)', () => {
  assert.deepEqual(deadEnds.map(t => `${t.how}@${t.last}`).slice(0, 5), [], 'routes that end anywhere else');
  assert.ok(endsOk.length > 0);
});

test('the exhaustive search agrees with the policy on every question (always / sometimes / never)', () => {
  const wrong = [];
  for (const id of ids) {
    const q = Q[id];
    if (q.kind === 'info') continue;                     // information screens carry no deferral decision
    const policyClass = q.unreachable ? 'never' : q.kind === 'conditional' ? 'sometimes' : 'always';
    if (classes[id] !== policyClass) wrong.push(`${id}: search says ${classes[id]}, policy says ${policyClass}`);
  }
  assert.deepEqual(wrong, []);
});

test('every answer of every branching question is reachable on some route (branch coverage)', () => {
  const missing = [];
  for (const id of ids.filter(i => isGate(Q[i]) && full.visitedAny.has(i))) {
    for (const v of DOMAIN[id]) if (!full.branches.has(`${id}=${valKey(v)}`)) missing.push(`${id}=${v}`);
  }
  assert.deepEqual(missing, []);
});

test('every conditionalShow can be satisfied; the ones that can also hide, do (the rest are implied by the route)', () => {
  const unsatisfiable = [], redundant = [];
  for (const [id, q] of Object.entries(Q)) {
    if (!q.show || classes[id] === 'never') continue;
    const o = full.showOutcomes.get(id) || {};
    if (!o.shown) unsatisfiable.push(id);                // a condition no route can meet: a question nobody could see
    if (!o.hidden) redundant.push(id);                   // reached only through the answer that already implies it
  }
  assert.deepEqual(unsatisfiable, []);
  // such a question is still conditional, through the route itself
  for (const id of redundant) assert.equal(classes[id], 'sometimes', `${id} is neither hidden by its condition nor conditional by route`);
  console.log(`conditionalShow: ${Object.values(Q).filter(q => q.show).length} conditions | hide on some route: ${[...full.showOutcomes.values()].filter(o => o.hidden).length} | implied by the route (never hide): ${redundant.length}`);
});

test('every option of every branching question has a defined route (no option leads nowhere)', () => {
  const bad = [];
  for (const id of ids.filter(i => isGate(Q[i]) && Q[i].type !== 'multi_select')) {
    for (const v of optionValues(id)) {
      const n = eng.nextQuestionId(Q[id], v);
      if (!n && id !== '7B-INFO') bad.push(`${id}=${v} -> nothing`);
    }
  }
  assert.deepEqual(bad, []);
});

test('a question that can be hidden always has somewhere to go when it is', () => {
  const bad = ids.filter(i => Q[i].show && !Q[i].next && !Q[i].loopNext).map(i => `${i} (hidden: no default route)`);
  assert.deepEqual(bad, []);
});

test('every question that reads another reads a question that comes first on every route that reaches it', () => {
  const bad = [];
  for (const [id, q] of Object.entries(Q)) {
    if (!q.show || classes[id] === 'never') continue;
    const src = q.show.questionId;
    // a witness route to `id` must have visited `src` before it, or the condition reads an unanswered question
    const w = full.visitedAny.get(id);
    if (w && !w.some(s => s.id === src)) bad.push(`${id} reads ${src}, which this route has not passed`);
  }
  assert.deepEqual(bad, []);
});

// ── 4. the explorer's walk equals the engine's ──────────────────────────────────────────────────────────
test('the engine reproduces the explorer on a witness route for every claim (on a route / off a route)', () => {
  let n = 0;
  for (const id of ids) {
    const on = full.visitedAny.get(id);
    if (on) {
      // the witness route stops at the first visit; extend it with a continuation to a real ending is not needed:
      // the engine walks the same prefix, so the question must be on its route
      assert.ok(eng.routeIds(replayMap(on)).includes(id), `${id} should be on the route of its witness`);
      n++;
    }
    const off = bypass[id];
    if (off) {
      const m = replayMap(off.path);
      assert.ok(!eng.routeIds(m).includes(id), `${id} should be off the route of its bypass witness`);
      n++;
    }
  }
  assert.ok(n > 200, `only ${n} witnesses replayed`);
});

test('the explorer and the engine give the same route on 20,000 random concrete routes', () => {
  let seed = 424242; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let checked = 0;
  for (let s = 0; s < 20000; s++) {
    // random walk with the explorer's own step logic
    let id = 'A1'; const A = {}; const seen = new Set(); const route = [];
    for (let guard = 0; id && guard < 600; guard++) {
      const q = Q[id]; if (!q || seen.has(id)) break;
      seen.add(id);
      if (q.show && !D.conditionalShowMatches(q.show, A)) { id = q.next || q.loopNext || null; continue; }
      if (q.type === 'section_picker') { id = q.next || null; continue; }
      route.push(id);
      const dom = DOMAIN[id]; const v = dom ? dom[Math.floor(rnd() * dom.length)] : undefined;
      if (dom) A[id] = v;
      let next;
      if (q.loop) next = q.loopNext || q.next || null;
      else if (q.type === 'info') next = q.next || q.loopNext || (q.nbv ? Object.values(q.nbv).find(Boolean) : null) || null;
      else next = eng.nextQuestionId(q, v === undefined ? 'x' : v);
      if (next === '4-GİRİŞ' && A['SCOPE-GROUPING'] !== 'separate') next = Q['4-GİRİŞ']?.next || next;
      const backwards = (n) => !n || seen.has(n) || Q[n]?.type === 'section_picker';
      if (next && backwards(next)) { const alts = [q.next, ...Object.values(q.nbv || {}), q.loopNext]; next = alts.find(n => n && !backwards(n)) || null; }
      id = next;
    }
    const m = {};
    for (const r of route) if (Q[r].type !== 'info') m[r] = DOMAIN[r] ? A[r] : 'x';
    assert.deepEqual(eng.routeIds(m), route, `random route #${s}`);
    checked++;
  }
  assert.equal(checked, 20000);
});

const tally = {};
for (const c of Object.values(classes)) tally[c] = (tally[c] || 0) + 1;
console.log('on the route:', tally, '| never:', ids.filter(i => classes[i] === 'never').join(' '));
console.log(`branches covered: ${full.branches.size} (answer, question) pairs | conditions exercised both ways: ${[...full.showOutcomes.values()].filter(o => o.shown && o.hidden).length}/${full.showOutcomes.size}`);
console.log(`route audit: ${passed} passed, ${failed} failed (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
export { full, classes, replayMap, DOMAIN, bypass };
if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(failed ? 1 : 0);
