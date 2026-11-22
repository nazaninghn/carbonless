// The factor standard of an inventory (question D1) and, for a "mix"
// inventory, of each calculating question. The server is the authority
// (carbonless_backend/questionnaire/step_entries.py: STANDARD_BY_CHOICE,
// ENTRY_STEPS, checked_factor_standard); a backend test keeps the step list
// below identical to ENTRY_STEPS.

// Questions whose answer becomes emission entries: in a "mix" inventory each
// one is calculated on the standard chosen for it.
export const FACTOR_STANDARD_STEPS = new Set([
  '3A-5', '3B-7', '3C-2', '4A-1', '4A-EV', '4B-2',
  'K3C1-2', 'K3C1-3a', 'K3C1-4a', 'K3C3-INFO', 'K3C4-2', 'K3C4-2c',
  'K3C5-2', 'K3C5-2b', 'K3C5-2c', 'K3C5-1', 'K3C6-2', 'K3C6-2c', 'K3C8-1', 'K3C9-1',
  'K3C10-1', 'K3C11-1', 'K3C12-1', 'K3C13-1', 'K3C14-1', 'K3C15-1',
]);

export const STEP_STANDARD_OPTIONS = [
  { value: 'ghg', label: { tr: 'GHG Protokolü', en: 'GHG Protocol' } },
  { value: 'ipcc', label: { tr: 'IPCC', en: 'IPCC' } },
  { value: 'defra', label: { tr: 'DEFRA', en: 'DEFRA' } },
];
const STEP_STANDARDS = new Set(STEP_STANDARD_OPTIONS.map((o) => o.value));

// The D1 answer of an answers map: the local value ('std_mix') or the stored
// backend answer ({ ef_database: 'std_mix' }).
export function inventoryStandardChoice(answersMap) {
  let v = answersMap?.D1;
  if (v && typeof v === 'object' && 'answer' in v) v = v.answer;
  if (v && typeof v === 'object') v = v.ef_database;
  return typeof v === 'string' ? v : '';
}

export function isMixInventory(answersMap) {
  return inventoryStandardChoice(answersMap) === 'std_mix';
}

// True when this question must carry its own standard.
export function needsStepStandard(questionId, answersMap) {
  return FACTOR_STANDARD_STEPS.has(questionId) && isMixInventory(answersMap);
}

// { stepId: 'defra' } from stored backend answers ({ answer, factor_standard }).
export function storedStepStandards(answersMap) {
  const out = {};
  Object.entries(answersMap || {}).forEach(([stepId, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && STEP_STANDARDS.has(v.factor_standard)) {
      out[stepId] = v.factor_standard;
    }
  });
  return out;
}

// The payload of a step save, with the question's standard next to its answer.
export function withFactorStandard(questionId, backendData, stepStandards) {
  const chosen = stepStandards?.[questionId];
  if (!FACTOR_STANDARD_STEPS.has(questionId) || !STEP_STANDARDS.has(chosen)) return backendData;
  if (!backendData || typeof backendData !== 'object' || !('answer' in backendData)) return backendData;
  return { ...backendData, factor_standard: chosen };
}
