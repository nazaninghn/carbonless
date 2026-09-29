// Activity data describes what already happened: an entry can't be for a
// month that hasn't started yet (same rule as emissions/periods.py).

export function isFutureMonth(year, month, today = new Date()) {
  const y = Number(year), m = Number(month);
  if (!y || !m) return false;
  return y > today.getFullYear() || (y === today.getFullYear() && m > today.getMonth() + 1);
}

export const futurePeriodMessage = (tr) => (tr
  ? 'Bu dönem henüz başlamadı. Bu ayı veya daha önceki bir ayı seçin.'
  : 'This period has not started yet. Choose the current month or an earlier one.');
