// Numbers on screen follow the UI language: "71,42" in Turkish, "71.42" in
// English. LanguageProvider sets the language here as it renders, so any
// component (and helper) can format without passing the language down.
let current = 'en';

export function setNumberLanguage(lang) {
  current = lang === 'tr' ? 'tr' : 'en';
}

const locale = () => (current === 'tr' ? 'tr-TR' : 'en-US');

// Like n.toFixed(d), in the UI language (with thousands separators).
export function fixed(n, d = 2) {
  const v = Number(n);
  return (Number.isFinite(v) ? v : 0).toLocaleString(locale(), {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

// Up to d decimals, trailing zeros dropped.
export function num(n, d = 2) {
  const v = parseFloat(n);
  return (Number.isFinite(v) ? v : 0).toLocaleString(locale(), { maximumFractionDigits: d });
}
