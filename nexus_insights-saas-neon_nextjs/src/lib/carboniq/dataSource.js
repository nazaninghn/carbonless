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
  { value: 'other', percent: null, label: { tr: 'Diğer (yüzdeyi siz girersiniz — danışman onayı)', en: 'Other (you enter the percentage — advisor approval)' } },
];
export const OTHER_REASON_MIN = 20;
export const OTHER_REASON_MAX = 500;
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

// { stepId: { percent, reason } } of the questions whose stored source is "other".
export function storedOtherSources(answersMap) {
  const out = {};
  Object.entries(answersMap || {}).forEach(([stepId, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.data_source === 'other') {
      out[stepId] = { percent: String(v.data_source_percent ?? ''), reason: String(v.data_source_reason ?? '') };
    }
  });
  return out;
}

// The extra fields "other" sends, or null when they are not complete yet.
export function otherExtra(other) {
  const percent = Number(String(other?.percent ?? '').replace(',', '.'));
  const reason = String(other?.reason ?? '').trim();
  if (!Number.isFinite(percent) || percent < 0.1 || percent > 100) return null;
  if (reason.length < OTHER_REASON_MIN || reason.length > OTHER_REASON_MAX) return null;
  return { data_source_percent: percent, data_source_reason: reason };
}

// { stepId: 'total' } of the questions whose figure was declared as one total for several devices / sites / items.
export function storedDataDetails(answersMap) {
  const out = {};
  Object.entries(answersMap || {}).forEach(([stepId, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && (v.data_detail === 'total' || v.data_detail === 'itemised')) out[stepId] = v.data_detail;
  });
  return out;
}

// What the user is told when the figure is one total — same wording as the server's detail_warning.
export function dataDetailWarning(detail, tr) {
  if (detail !== 'total') return '';
  return tr
    ? 'Toplam değer girdiniz: cihaz, tesis veya kalem bazında ayrı değerler olmadan her birinin kendi faktörü uygulanamaz ve sonucun doğruluğu düşer. Ayrı değerleriniz varsa tek tek girin. Bu, raporda belirtilir.'
    : 'You entered a total: without a separate figure for each device, site or item, the factor of each one cannot be applied and the result is less accurate. Enter them one by one if you have them. The report states this.';
}

// The payload of a step save, with the source next to the answer.
export function withDataSource(questionId, backendData, dataSources, others, details) {
  if (!DATA_SOURCE_STEPS.has(questionId)) return backendData;
  if (!backendData || typeof backendData !== 'object' || !('answer' in backendData)) return backendData;
  const detail = details?.[questionId];
  if (detail === 'total' || detail === 'itemised') backendData = { ...backendData, data_detail: detail };
  const chosen = dataSources?.[questionId];
  if (!DATA_SOURCES.has(chosen)) return backendData;
  if (chosen === 'other') {
    const extra = otherExtra(others?.[questionId]);
    return extra ? { ...backendData, data_source: chosen, ...extra } : backendData;   // incomplete: nothing is claimed
  }
  return { ...backendData, data_source: chosen };
}

// What the user is told about the chosen (or missing) source — same wording as the server's source_warning.
export function dataSourceWarning(source, tr) {
  if (source === 'measurement') {
    return tr ? 'Ölçüm (±%1): ölçüm kaydını yükleyin; danışman inceler. Kayıt yüklenene kadar bu değer tahmin (±%20) olarak sayılır.'
      : 'Measurement (±1 %): upload the measurement record; an advisor reviews it. Until the record is uploaded this figure is counted as an estimate (±20 %).';
  }
  if (source === 'invoice') {
    return tr ? 'Fatura / sistem verisi: faaliyet verisi belirsizliği ±%7.' : 'Invoice / system data: activity-data uncertainty ±7 %.';
  }
  if (source === 'other') {
    return tr
      ? 'Diğer: girdiğiniz belirsizlik uygulanır; gerekçeniz danışman onayına gider. Onaylanana kadar envanter imzalanamaz.'
      : 'Other: the uncertainty you entered is applied; your reason goes to the advisor for approval. The inventory cannot be signed until it is approved.';
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
