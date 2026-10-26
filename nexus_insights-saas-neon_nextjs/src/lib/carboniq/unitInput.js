// Helpers for the amount + unit input of the questionnaire (3A-5 fuel consumption, 4A-1 electricity, 3A-3 capacity ...).
// An answer is stored as one string, "15000 m³" / "500 kg buhar/h": the amount, a space, the unit token.
// Pure functions, no React: scripts/test-unit-input.mjs runs them under plain Node.

// Splits a stored "amount unit" string into { amount, unit }. The unit is the longest of `unitList` that ends the
// string after a space, so a unit that holds a space ('kg buhar/h') is not cut at its last word. A value with no
// listed unit comes back whole with unit '' (the caller keeps the chip it already has).
export function splitStoredAmount(value, unitList) {
  if (!value || typeof value !== 'string') return { amount: value || '', unit: '' };
  for (const u of [...(unitList || [])].sort((a, b) => b.length - a.length)) {
    if (value.endsWith(` ${u}`)) return { amount: value.slice(0, -(u.length + 1)).trim(), unit: u };
  }
  return { amount: value, unit: '' };
}

// The amount typed and the unit chip as the one string the server stores. An empty amount stays empty, never a bare unit.
export function joinAmountUnit(amount, unit) {
  const a = String(amount ?? '').trim();
  return a && unit ? `${a} ${unit}` : a;
}

// LPG and fuel oil have emission factors per litre only and the engine applies no density conversion, so an amount in
// kg is stored as entered but is not calculated (the server says so after saving: step_entries.uncalculated_notes).
// This is the same message, shown while the unit is chosen, before anything is saved.
const KG_NOT_CALCULATED = new Set(['3A-5:lpg:kg', '3A-5:fuel_oil:kg']);

export function unitWarning(questionId, item, unit, lang) {
  if (!KG_NOT_CALCULATED.has(`${questionId}:${item}:${unit}`)) return null;
  return lang === 'tr'
    ? 'kg henüz hesaplanmıyor: bu yakıtın emisyon faktörü litre başınadır ve yoğunluk dönüşümü yapılmaz. '
      + 'Girdiğiniz kg değeri olduğu gibi kaydedilir ancak envantere dahil edilmez. Hesaplanması için litre cinsinden girin.'
    : 'kg is not calculated yet: the emission factor for this fuel is per litre and no density conversion is applied. '
      + 'Your kg value is saved as entered but is not counted in the inventory. Enter litres to have it calculated.';
}
