// Checks for the organisation's contact details, which the ISO 14064-1 report
// prints as stated. Same rules as companies/contact.py on the server.
const PHONE_RE = /^\+?[0-9 ()./-]+$/;
const WEBSITE_RE = /^(https?:\/\/)?([^\s/.:]+\.)+[^\s/.:\d]{2,}(:\d+)?(\/\S*)?$/i;

export function phoneOk(value) {
  const v = (value || '').trim();
  if (!v) return true;
  const digits = (v.match(/\d/g) || []).length;
  return PHONE_RE.test(v) && digits >= 7 && digits <= 20;
}

export function websiteOk(value) {
  const v = (value || '').trim();
  return !v || WEBSITE_RE.test(v);
}

// An example number in the company's own country: a German company was shown
// "+90 212 555 01 23" everywhere. Unknown / unset country = Turkey.
const PHONE_EXAMPLES = {
  TR: '+90 212 555 01 23', DE: '+49 30 1234 5678', AT: '+43 1 234 5678',
  CH: '+41 44 123 45 67', GB: '+44 20 7946 0000', IE: '+353 1 234 5678',
  FR: '+33 1 23 45 67 89', NL: '+31 20 123 4567', BE: '+32 2 123 45 67',
  LU: '+352 26 12 34 56', IT: '+39 02 1234 5678', ES: '+34 912 345 678',
  PT: '+351 21 123 4567', PL: '+48 22 123 45 67', CZ: '+420 212 345 678',
  SE: '+46 8 123 456 78', DK: '+45 32 12 34 56', NO: '+47 21 23 45 67',
  FI: '+358 9 123 4567', GR: '+30 21 0123 4567', RO: '+40 21 123 4567',
  BG: '+359 2 123 4567', HU: '+36 1 234 5678', US: '+1 212 555 0123',
  CA: '+1 416 555 0123', AE: '+971 4 123 4567', SA: '+966 11 123 4567',
  AZ: '+994 12 123 45 67', GE: '+995 32 212 34 56', CN: '+86 10 1234 5678',
  JP: '+81 3 1234 5678', IN: '+91 22 1234 5678',
};
const TURKEY = ['TR', 'TUR', 'TURKEY', 'TÜRKIYE', 'TÜRKİYE', 'TURKIYE'];

export function isTurkeyCountry(country) {
  const c = String(country || '').trim().toUpperCase();
  return !c || c === 'NOT SET' || TURKEY.includes(c);
}

export function phoneExample(country, tr) {
  const c = String(country || '').trim().toUpperCase();
  if (isTurkeyCountry(c)) return PHONE_EXAMPLES.TR;
  return PHONE_EXAMPLES[c] || (tr ? '+[ülke kodu] 123 456 789' : '+[country code] 123 456 789');
}

export const phoneMessage = (tr, country) => (tr
  ? `Geçerli bir telefon numarası girin (örn. ${phoneExample(country, tr)}).`
  : `Enter a valid phone number (e.g. ${phoneExample(country, tr)}).`);

// Tax number at sign-up / in Settings. A Turkish company has a VKN (10 digits)
// or TCKN (11); anywhere else it is the local tax / VAT registration number,
// which has no single format. Same rules as StepA2Serializer on the server.
export function normalizeTaxNumber(value, country) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (isTurkeyCountry(country)) return v.replace(/[\s-]/g, '');
  return v.split(/\s+/).join(' ').toUpperCase();
}

export function taxNumberOk(value, country) {
  const v = normalizeTaxNumber(value, country);
  if (!v) return true;
  if (isTurkeyCountry(country)) return /^\d{10,11}$/.test(v);
  return /^[A-Z0-9][A-Z0-9 ./-]{3,29}$/.test(v) && /\d/.test(v);
}

export const taxNumberMessage = (tr, country) => {
  if (isTurkeyCountry(country)) {
    return tr ? 'Vergi numarası 10 haneli (VKN) veya 11 haneli (TCKN) olmalıdır'
      : 'Tax number must be 10 digits (VKN) or 11 digits (TCKN)';
  }
  return tr ? 'Vergi / KDV (VAT) numaranızı girin: harf ve rakam, 4-30 karakter'
    : 'Enter your tax / VAT number: letters and digits, 4-30 characters';
};

export const taxNumberPlaceholder = (tr, country) => {
  const c = String(country || '').trim();
  if (!c) return tr ? 'Opsiyonel — Türkiye\'de VKN/TCKN, diğer ülkelerde KDV (VAT) no' : 'Optional — VKN/TCKN in Turkey, VAT number elsewhere';
  if (isTurkeyCountry(c)) return tr ? 'Opsiyonel — VKN (10) veya TCKN (11)' : 'Optional — VKN (10) or TCKN (11 digits)';
  return tr ? 'Opsiyonel — vergi veya KDV (VAT) kayıt numaranız' : 'Optional — your tax or VAT registration number';
};

export const websiteMessage = (tr) => (tr
  ? 'Geçerli bir internet sitesi adresi girin (örn. www.sirketiniz.com.tr).'
  : 'Enter a valid website address (e.g. www.yourcompany.com).');
