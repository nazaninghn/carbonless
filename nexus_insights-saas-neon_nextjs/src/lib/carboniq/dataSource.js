// Where the amount of a calculating question comes from. The server is the
// authority (carbonless_backend/questionnaire/uncertainty.py: ACTIVITY_PERCENT,
// checked_data_source, source_warning); the percentages and the wording below
// mirror it. The source never changes a calculated emission — it says how
// sure the number is.
import { FACTOR_STANDARD_STEPS } from './factorStandard';

// The same questions that carry a factor standard: the ones whose answer becomes emission entries.
export const DATA_SOURCE_STEPS = FACTOR_STANDARD_STEPS;

export const DATA_SOURCE_OPTIONS = [
  { value: 'measurement', percent: 1, label: { tr: 'Ölçüm (±%1)', en: 'Measurement (±1 %)' } },
  { value: 'invoice', percent: 7, label: { tr: 'Fatura / sistem verisi (±%7)', en: 'Invoice / system data (±7 %)' } },
  { value: 'estimate', percent: 20, label: { tr: 'Tahmin (±%20)', en: 'Estimate (±20 %)' } },
];
const DATA_SOURCES = new Set(DATA_SOURCE_OPTIONS.map((o) => o.value));

export function hasDataSource(questionId) {
  return DATA_SOURCE_STEPS.has(questionId);
}

// { stepId: 'invoice' } from stored backend answers ({ answer, data_source }).
export function storedDataSources(answersMap) {
  const out = {};
  Object.entries(answersMap || {}).forEach(([stepId, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && DATA_SOURCES.has(v.data_source)) out[stepId] = v.data_source;
  });
  return out;
}

// The payload of a step save, with the source next to the answer.
export function withDataSource(questionId, backendData, dataSources) {
  const chosen = dataSources?.[questionId];
  if (!DATA_SOURCE_STEPS.has(questionId) || !DATA_SOURCES.has(chosen)) return backendData;
  if (!backendData || typeof backendData !== 'object' || !('answer' in backendData)) return backendData;
  return { ...backendData, data_source: chosen };
}

// What the user is told about the chosen (or missing) source — same wording as the server's source_warning.
export function dataSourceWarning(source, tr) {
  if (source === 'measurement') {
    return tr ? 'Ölçüm: faaliyet verisi belirsizliği ±%1. Ölçüm kaydını saklayın; doğrulamada istenir.'
      : 'Measurement: activity-data uncertainty ±1 %. Keep the measurement record; a verifier will ask for it.';
  }
  if (source === 'invoice') {
    return tr ? 'Fatura / sistem verisi: faaliyet verisi belirsizliği ±%7.' : 'Invoice / system data: activity-data uncertainty ±7 %.';
  }
  if (source === 'estimate') {
    return tr
      ? 'Tahmin: faaliyet verisi belirsizliği ±%20. Kesin olmayan bir değer envanterin doğruluğunu düşürür; girilen değerin sorumluluğu kuruluşunuza aittir.'
      : 'Estimate: activity-data uncertainty ±20 %. An imprecise figure lowers the accuracy of the inventory; the figure you enter is your organisation’s responsibility.';
  }
  return tr
    ? 'Veri kaynağı seçilmedi: bu değer tahmin (±%20) olarak sayılır. Değerin doğruluğu kuruluşunuzun sorumluluğundadır; fatura veya ölçüm varsa kaynağı seçin.'
    : 'No data source is chosen: this figure is counted as an estimate (±20 %). Its accuracy is your organisation’s responsibility; choose the source if you have an invoice or a measurement.';
}
