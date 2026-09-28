// Server-side signup errors (DRF / Django validators) -> readable text in the
// UI language, plus the form step that holds the offending field.
const REGISTER_FIELD_LABELS = {
  username: { tr: 'Kullanıcı Adı', en: 'Username' },
  email: { tr: 'E-posta', en: 'Email' },
  password: { tr: 'Şifre', en: 'Password' },
  password2: { tr: 'Şifre Tekrar', en: 'Confirm Password' },
  first_name: { tr: 'Yasal Kuruluş Adı', en: 'Legal Entity Name' },
};
const REGISTER_MESSAGE_TR = [
  [/valid email/i, 'Geçerli bir e-posta adresi girin.'],
  [/email already exists/i, 'Bu e-posta adresi zaten kayıtlı.'],
  [/username already exists/i, 'Bu kullanıcı adı zaten kullanılıyor.'],
  [/valid username/i, 'Kullanıcı adı yalnızca harf, rakam ve @ . + - _ içerebilir.'],
  [/too common/i, 'Bu şifre çok yaygın, daha güçlü bir şifre seçin.'],
  [/too similar/i, 'Şifre kullanıcı bilgilerinize çok benziyor.'],
  [/entirely numeric/i, 'Şifre yalnızca rakamlardan oluşamaz.'],
  [/too short/i, 'Şifre en az 8 karakter olmalıdır.'],
  [/didn't match|did not match/i, 'Şifreler eşleşmiyor.'],
  [/may not be blank|required/i, 'Bu alan zorunludur.'],
];
export function describeRegisterErrors(data, tr) {
  if (!data || typeof data !== 'object') return { message: '', section: null };
  const parts = [];
  let section = null;
  for (const [field, raw] of Object.entries(data)) {
    const msgs = (Array.isArray(raw) ? raw : [raw]).map(String);
    const label = REGISTER_FIELD_LABELS[field]?.[tr ? 'tr' : 'en'];
    if (label) section = 1;
    for (const m of msgs) {
      const text = tr ? (REGISTER_MESSAGE_TR.find(([re]) => re.test(m))?.[1] || m) : m;
      parts.push(label ? `${label}: ${text}` : text);
    }
  }
  return { message: parts.join(' '), section };
}
