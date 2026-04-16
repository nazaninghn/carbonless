'use client';

import { useMemo } from 'react';

/**
 * Password strength rules:
 * - min 8 chars
 * - has uppercase
 * - has lowercase
 * - has number
 * - has special char
 */
function getPasswordStrength(password) {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };

  const passed = Object.values(checks).filter(Boolean).length;

  let level = 'none';
  let color = 'bg-gray-200';
  let textColor = 'text-gray-400';

  if (password.length === 0) {
    level = 'none';
  } else if (passed <= 2) {
    level = 'weak';
    color = 'bg-red-500';
    textColor = 'text-red-600';
  } else if (passed <= 3) {
    level = 'medium';
    color = 'bg-yellow-500';
    textColor = 'text-yellow-600';
  } else if (passed === 4) {
    level = 'good';
    color = 'bg-blue-500';
    textColor = 'text-blue-600';
  } else {
    level = 'strong';
    color = 'bg-green-500';
    textColor = 'text-green-600';
  }

  return { checks, passed, level, color, textColor };
}

const labels = {
  tr: {
    weak: 'Zayıf',
    medium: 'Orta',
    good: 'İyi',
    strong: 'Güçlü',
    minLength: 'En az 8 karakter',
    hasUpper: 'Büyük harf (A-Z)',
    hasLower: 'Küçük harf (a-z)',
    hasNumber: 'Rakam (0-9)',
    hasSpecial: 'Özel karakter (!@#$...)',
  },
  en: {
    weak: 'Weak',
    medium: 'Medium',
    good: 'Good',
    strong: 'Strong',
    minLength: 'At least 8 characters',
    hasUpper: 'Uppercase letter (A-Z)',
    hasLower: 'Lowercase letter (a-z)',
    hasNumber: 'Number (0-9)',
    hasSpecial: 'Special character (!@#$...)',
  },
};

export default function PasswordStrengthIndicator({ password, language = 'tr' }) {
  const { checks, passed, level, color, textColor } = useMemo(
    () => getPasswordStrength(password),
    [password]
  );

  const t = labels[language] || labels.en;

  if (!password) return null;

  const checkItems = [
    { key: 'minLength', label: t.minLength, ok: checks.minLength },
    { key: 'hasUpper', label: t.hasUpper, ok: checks.hasUpper },
    { key: 'hasLower', label: t.hasLower, ok: checks.hasLower },
    { key: 'hasNumber', label: t.hasNumber, ok: checks.hasNumber },
    { key: 'hasSpecial', label: t.hasSpecial, ok: checks.hasSpecial },
  ];

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= passed ? color : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        {level !== 'none' && (
          <span className={`text-xs font-medium ${textColor}`}>
            {t[level]}
          </span>
        )}
      </div>

      {/* Checklist */}
      <ul className="space-y-1">
        {checkItems.map(({ key, label, ok }) => (
          <li key={key} className="flex items-center gap-1.5 text-xs">
            {ok ? (
              <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v3a1 1 0 11-2 0V7zm0 6a1 1 0 112 0 1 1 0 01-2 0z" clipRule="evenodd" />
              </svg>
            )}
            <span className={ok ? 'text-green-700' : 'text-gray-500'}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Utility: returns true if password meets minimum strength (at least 3/5 checks) */
export function isPasswordStrong(password) {
  const { passed } = getPasswordStrength(password);
  return passed >= 3;
}
