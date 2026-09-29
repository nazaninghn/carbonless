// "5 dk önce" / "5 min ago", "dün" / "yesterday"; a date after a week.
export function timeAgo(iso, tr, now = new Date()) {
  const t = new Date(iso);
  if (!iso || Number.isNaN(t.getTime())) return '';
  const rtf = new Intl.RelativeTimeFormat(tr ? 'tr-TR' : 'en-US', { numeric: 'auto', style: 'short' });
  const sec = Math.round((t - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return tr ? 'az önce' : 'just now';
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(sec / 86400), 'day');
  return t.toLocaleDateString(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
