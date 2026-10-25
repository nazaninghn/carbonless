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

// Tax number at sign-up / in Settings. Universal rule for every country:
// required and exactly 10 numeric digits (0-9). Spaces/dashes/letters are not
// allowed — they are stripped first, then the value must be exactly 10 digits.
// The `country` parameter is kept in every signature for call-site
// compatibility, but it no longer affects the result or the message.
// Same rule as CompanySerializer.validate_tax_number on the server.
export function normalizeTaxNumber(value, country) {  // eslint-disable-line no-unused-vars
  return String(value || '').replace(/\D/g, '');
}

export function taxNumberOk(value, country) {
  const v = normalizeTaxNumber(value, country);
  return /^\d{10}$/.test(v);
}

export const taxNumberMessage = (tr, country) => (tr  // eslint-disable-line no-unused-vars
  ? 'Vergi numarası tam olarak 10 haneli olmalıdır'
  : 'Tax number must be exactly 10 digits');

export const taxNumberPlaceholder = (tr, country) => (tr  // eslint-disable-line no-unused-vars
  ? '10 haneli vergi numarası'
  : '10-digit tax number');

export const websiteMessage = (tr) => (tr
  ? 'Geçerli bir internet sitesi adresi girin (örn. www.sirketiniz.com.tr).'
  : 'Enter a valid website address (e.g. www.yourcompany.com).');
