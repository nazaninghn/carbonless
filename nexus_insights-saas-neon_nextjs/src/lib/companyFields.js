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

export const phoneMessage = (tr) => (tr
  ? 'Geçerli bir telefon numarası girin (örn. +90 212 555 01 23).'
  : 'Enter a valid phone number (e.g. +90 212 555 01 23).');

export const websiteMessage = (tr) => (tr
  ? 'Geçerli bir internet sitesi adresi girin (örn. www.sirketiniz.com.tr).'
  : 'Enter a valid website address (e.g. www.yourcompany.com).');
