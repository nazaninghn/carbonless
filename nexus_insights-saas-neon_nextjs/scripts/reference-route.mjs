// FROZEN REFERENCE — a verbatim copy of the questionnaire's route walk as it was in CarbonAIPage.jsx before it was
// moved into src/lib/carboniq/deferral.js. scripts/test-deferral.mjs runs it side by side with the shared engine on
// hundreds of answer sets to prove the move changed nothing (progress totals, summaries, pending lists).
// Do not "fix" this file: if the two disagree, the engine is wrong.
export function makeReference({ getQuestionById, getNextQuestionId, readAnswerValue, getInitialQuestionId, loopResumeState }) {
function conditionalShowMatches(conditionalShow, answersMap) {
  if (!conditionalShow) return true;
  const { questionId, field, includesValue, inValues, equals, greaterThan, unitIn, hasKey } = conditionalShow;
  const raw = readAnswerValue(answersMap, questionId);
  // hasKey: a per-item answer has a non-empty value for this item (3A-5bio
  // only when a biomass amount was given).
  if (hasKey) {
    return !!(raw && typeof raw === 'object' && !Array.isArray(raw) && String(raw[hasKey] ?? '').trim());
  }
  // unitIn: an "amount unit" answer (or any item of a per-site loop) was
  // given in one of these units — 4A-1a only for a TL invoice amount.
  if (unitIn) {
    const vals = raw && typeof raw === 'object' ? Object.values(raw) : [raw];
    return vals.some(v => typeof v === 'string' && unitIn.includes(v.trim().split(/\s+/).pop()));
  }

  let candidates;
  if (Array.isArray(raw)) {
    candidates = raw;
  } else if (raw && typeof raw === 'object') {
    const values = Object.values(raw);
    const isLoopOfCompounds = values.length > 0 && values.every(v => v && typeof v === 'object');
    if (field) {
      candidates = isLoopOfCompounds ? values.map(v => v[field]) : [raw[field]];
    } else {
      candidates = isLoopOfCompounds ? [] : values; // no scalar to compare without `field`
    }
  } else {
    candidates = [raw];
  }

  if (inValues) return candidates.some(v => inValues.includes(v));
  if (equals !== undefined) {
    return candidates.some(v => (typeof equals === 'number' ? Number(v) === equals : v === equals));
  }
  // e.g. K3C7-2 (hybrid office days) only makes sense if hybrid_count > 0.
  if (greaterThan !== undefined) return candidates.some(v => Number(v) > greaterThan);
  return candidates.includes(includesValue);
}

// The questions on this user's route through the survey, in order: walked
// from the first question along the answers given (nextByValue branches,
// loops, hidden conditional questions), and past the last answer along each
// question's default next. Answers left behind on a branch the user later
// turned away from (6A-2 after switching 6A-1 to "none flagged") are not on
// the route, so the summaries and the progress count no longer include them.
// Section pickers and go-back answers only lead back into earlier sections
// while editing, so the walk takes the forward branch instead.
function questionPath(answersMap) {
  const src = answersMap || {};
  const path = [];
  const seen = new Set();
  let id = getInitialQuestionId();
  while (id && !seen.has(id) && path.length < 2000) {
    const q = getQuestionById(id);
    if (!q) break;
    seen.add(id);
    if (q.conditionalShow && !(id in src) && !conditionalShowMatches(q.conditionalShow, src)) {
      id = q.next || q.loopNext || null;
      continue;
    }
    if (q.loopSource && !(id in src) && loopResumeState(q, src).items.length === 0) {
      id = q.loopNext || q.next || null;
      continue;
    }
    if (q.type === 'section_picker') { id = q.next || null; continue; }
    path.push(q);
    const answered = id in src;
    const value = answered ? readAnswerValue(src, id) : undefined;
    let next;
    if (q.loopSource) next = q.loopNext || q.next || null;
    else if (q.type === 'info' || !answered) {
      next = q.next || q.loopNext || (q.nextByValue ? Object.values(q.nextByValue).find(Boolean) : null) || null;
    } else next = getNextQuestionId(q, value);
    if (next === '4-GİRİŞ' && readAnswerValue(src, 'SCOPE-GROUPING') !== 'separate') {
      next = getQuestionById('4-GİRİŞ')?.next || next;
    }
    const backwards = (n) => !n || seen.has(n) || getQuestionById(n)?.type === 'section_picker';
    if (next && backwards(next)) {
      const alts = [q.next, ...Object.values(q.nextByValue || {}), q.loopNext];
      next = alts.find(n => n && !backwards(n)) || null;
    }
    id = next;
  }
  return path;
}
  return { conditionalShowMatches, questionPath };
}
