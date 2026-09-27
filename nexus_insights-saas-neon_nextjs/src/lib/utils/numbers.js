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
  // Spaces are grouping too ("12 500"). Anything but digits, separators and
  // a leading sign is not a number: quantity fields are plain text inputs (so
  // Turkish "1.250,5" can be typed), and parseFloat("12abc") would give 12.
  const s = String(raw ?? '').trim().replace(/[\s\u00a0]/g, '');
  if (!s || !/^[-+]?[\d.,]+$/.test(s)) return NaN;

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

  if ((s.match(/\./g) || []).length > 1 || (s.match(/,/g) || []).length > 1) {
    // "1.250.000" / "1,250,000": a repeated separator can only be grouping.
    return parseFloat(s.replace(/[.,]/g, ''));
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
