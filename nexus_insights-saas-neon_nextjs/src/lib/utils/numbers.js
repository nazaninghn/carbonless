// Parses a user-typed quantity that may use either '.' or ',' as the
// thousands/decimal separator, without guessing wrong on the common
// "15.000" (Turkish: fifteen thousand) / "15,000" (English: fifteen
// thousand) case.
//
// Every Workspace panel previously did `parseFloat(String(v).replace(',', '.'))`,
// which silently turned "15.000 kWh" into 15 — a 1000x understatement, since
// the string is still valid float syntax and nothing throws. Mirrors the
// Python parse_localized_number() in carbonless_backend/chat/local_parser.py
// — keep both in sync if the heuristic changes.
export function parseLocalizedNumber(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return NaN;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // Whichever separator comes last is the real decimal point; earlier
    // occurrences are thousands grouping. Handles "1.234.567,89" (Turkish)
    // and "1,234,567.89" (English) alike.
    const cleaned = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
    return parseFloat(cleaned);
  }

  if (/^\d{1,3}[.,]\d{3}$/.test(s)) {
    // A single separator followed by exactly 3 digits and nothing else —
    // "15.000" or "15,000" — is thousands grouping in both conventions; a
    // genuine decimal quantity essentially never has exactly 3 trailing
    // digits in casual form input.
    return parseFloat(s.replace(/[.,]/g, ''));
  }

  return parseFloat(s.replace(',', '.'));
}
