// Account/auth endpoints return English `error` text plus a stable `code`.
// Show the text in the UI language from the code; fall back to the server
// text, then to the caller's generic message.
const MESSAGES = {
  invalid_code: { tr: 'Kod geçersiz.', en: 'Invalid code.' },
  wrong_code: {
    tr: (d) => `Kod hatalı. ${d.attempts_remaining} deneme hakkınız kaldı.`,
    en: (d) => `Incorrect code. ${d.attempts_remaining} attempt(s) remaining.`,
  },
  code_expired: {
    tr: 'Kodun süresi doldu. Lütfen yeni bir kod isteyin.',
    en: 'This code has expired. Please request a new one.',
  },
  too_many_attempts: {
    tr: 'Çok fazla hatalı deneme. Lütfen yeni bir kod isteyin.',
    en: 'Too many incorrect attempts. Please request a new code.',
  },
  invalid_link: {
    tr: 'Bu bağlantı geçersiz. Lütfen yeni bir sıfırlama bağlantısı isteyin.',
    en: 'This link is invalid. Please request a new reset link.',
  },
  link_used: {
    tr: 'Bu bağlantı zaten kullanıldı. Lütfen yeni bir sıfırlama bağlantısı isteyin.',
    en: 'This link has already been used. Please request a new reset link.',
  },
  link_expired: {
    tr: 'Bu bağlantının süresi doldu. Lütfen yeni bir sıfırlama bağlantısı isteyin.',
    en: 'This link has expired. Please request a new reset link.',
  },
  weak_password: {
    tr: 'Şifre çok zayıf. En az 8 karakterli, tahmin edilmesi zor ve yalnızca rakamlardan oluşmayan bir şifre seçin.',
    en: 'That password is too weak. Use at least 8 characters that are hard to guess and not only numbers.',
  },
  rate_limited: {
    tr: 'Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.',
    en: 'Too many attempts. Please wait a little and try again.',
  },
  wrong_password: { tr: 'Mevcut şifre hatalı.', en: 'Current password is incorrect.' },
};

export function authErrorMessage(data, tr, fallback) {
  const entry = MESSAGES[data?.code];
  if (entry) {
    const m = tr ? entry.tr : entry.en;
    return typeof m === 'function' ? m(data) : m;
  }
  return data?.error || fallback;
}
