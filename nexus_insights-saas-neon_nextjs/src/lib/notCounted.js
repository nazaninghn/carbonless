import { fixed } from '@/lib/formatNumber';

// The informational line under the totals: new pending and rejected entries
// are outside them; a change or deletion waiting on an approved entry is
// counted apart without an amount, since the approved figure stands until
// it is approved. `info` is the summary's `not_counted` shape.
export function notCountedText(info, tr) {
  const pend = info?.pending || {};
  const rej = info?.rejected || {};
  const changes = info?.changes?.count || 0;
  const deletes = info?.delete_requests?.count || 0;
  const out = [];
  const parts = [
    pend.count > 0 && (tr
      ? `${pend.count} onay bekleyen kayıt (${fixed(pend.total_kg / 1000, 3)} t)`
      : `${pend.count} awaiting approval (${fixed(pend.total_kg / 1000, 3)} t)`),
    rej.count > 0 && (tr
      ? `${rej.count} reddedilen kayıt (${fixed(rej.total_kg / 1000, 3)} t)`
      : `${rej.count} rejected (${fixed(rej.total_kg / 1000, 3)} t)`),
  ].filter(Boolean);
  if (parts.length) {
    out.push(parts.join(tr ? ' ve ' : ' and ') + (tr
      ? ' toplamlara ve raporlara dahil değildir. Yalnızca onaylanmış kayıtlar sayılır.'
      : ' are not included in the totals or reports. Only approved entries are counted.'));
  }
  const waiting = [
    changes > 0 && (tr ? `${changes} değişiklik talebi` : `${changes} change request${changes === 1 ? '' : 's'}`),
    deletes > 0 && (tr ? `${deletes} silme talebi` : `${deletes} deletion request${deletes === 1 ? '' : 's'}`),
  ].filter(Boolean);
  if (waiting.length) {
    out.push(waiting.join(tr ? ' ve ' : ' and ') + (tr
      ? ' onay bekliyor; onaylanana kadar onaylı değerler geçerlidir.'
      : (changes + deletes === 1 ? ' awaits' : ' await') + ' approval; until then the approved figures stand.'));
  }
  return out.join(' ');
}

export function hasNotCounted(info) {
  return (info?.pending?.count || 0) + (info?.rejected?.count || 0)
    + (info?.changes?.count || 0) + (info?.delete_requests?.count || 0) > 0;
}
