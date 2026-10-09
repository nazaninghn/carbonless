'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/utils/api';

// The company's change history: who created, changed, deleted, approved or
// rejected which emission entry or inventory answer, finished an inventory or
// changed a target, and when. The backend keeps this audit trail
// (ActivityLog); owner, admin, manager and auditor can read it here.
const ACTIONS = {
  entry_created:  { tr: 'Kayıt eklendi',     en: 'Entry added',    cls: 'bg-[#2ABD41]/10 text-[#175022]' },
  entry_updated:  { tr: 'Kayıt değiştirildi', en: 'Entry changed',  cls: 'bg-amber-50 text-amber-700' },
  entry_deleted:  { tr: 'Kayıt silindi',      en: 'Entry deleted',  cls: 'bg-red-50 text-red-600' },
  entry_approved: { tr: 'Kayıt onaylandı',    en: 'Entry approved', cls: 'bg-[#2ABD41]/10 text-[#175022]' },
  entry_rejected: { tr: 'Kayıt reddedildi',   en: 'Entry rejected', cls: 'bg-red-50 text-red-600' },
  questionnaire_changed: { tr: 'Anket cevabı değişti', en: 'Inventory answer changed', cls: 'bg-amber-50 text-amber-700' },
  inventory_completed:   { tr: 'Envanter tamamlandı',  en: 'Inventory completed',      cls: 'bg-[#2ABD41]/10 text-[#175022]' },
  target_created: { tr: 'Hedef eklendi',      en: 'Target added',   cls: 'bg-[#2ABD41]/10 text-[#175022]' },
  target_updated: { tr: 'Hedef değiştirildi', en: 'Target changed', cls: 'bg-amber-50 text-amber-700' },
  target_deleted: { tr: 'Hedef silindi',      en: 'Target deleted', cls: 'bg-red-50 text-red-600' },
};
const STATUS = {
  approved:  { tr: 'Onaylı', en: 'Approved' },
  submitted: { tr: 'Beklemede', en: 'Pending' },
  draft:     { tr: 'Reddedildi', en: 'Rejected' },
};

export default function CompanyHistory({ language }) {
  const tr = language === 'tr';
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Details come back in the UI language (factor names, months, units).
        const res = await api.getCompanyHistory(tr ? 'tr' : 'en');
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError(tr ? 'Geçmiş yüklenemedi.' : 'Could not load the history.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tr]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (rows === null) return <p className="text-sm text-[#072C0E]/50">{tr ? 'Yükleniyor…' : 'Loading…'}</p>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[#072C0E]/55">
        {tr ? 'Henüz kayıtlı bir değişiklik yok. Emisyon kayıtları ve anket cevapları eklendikçe, değiştirildikçe ve onaylandıkça; envanterler tamamlandıkça ve hedefler değiştikçe burada listelenir.'
            : 'No changes recorded yet. Emission entries and inventory answers appear here as they are added, changed and approved, as do finished inventories and target changes.'}
      </p>
    );
  }
  const fmt = (d) => new Date(d).toLocaleString(tr ? 'tr-TR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const statusLabel = (s) => (STATUS[s] ? (tr ? STATUS[s].tr : STATUS[s].en) : s);

  return (
    <div className="space-y-2">
      <p className="mb-2 text-xs text-[#072C0E]/50">
        {tr ? 'Son 300 değişiklik, en yenisi üstte.' : 'Last 300 changes, newest first.'}
      </p>
      {rows.map((r) => {
        const a = ACTIONS[r.action] || { tr: r.action, en: r.action, cls: 'bg-[#F8F8F8] text-[#072C0E]/70' };
        return (
          <div key={r.id} className="rounded-xl border border-[#072C0E]/8 bg-white px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`rounded-full px-2 py-0.5 font-bold ${a.cls}`}>{tr ? a.tr : a.en}</span>
              <span className="font-semibold text-[#072C0E]/70">{r.user || (tr ? '(silinmiş kullanıcı)' : '(deleted user)')}</span>
              <span className="text-[#072C0E]/40">{fmt(r.created_at)}</span>
              {r.status_before && r.status_after && r.status_before !== r.status_after && (
                <span className="text-[#072C0E]/55">{statusLabel(r.status_before)} → {statusLabel(r.status_after)}</span>
              )}
              {r.action === 'questionnaire_changed' && r.status_after === 'submitted' && (
                <span className="text-[#072C0E]/55">{tr ? 'Onay bekliyor' : 'Awaiting approval'}</span>
              )}
            </div>
            <p className="mt-1 break-words text-xs text-[#072C0E]/80">{r.detail}</p>
            {r.reason && <p className="mt-0.5 text-[11px] text-red-500">{tr ? 'Red nedeni' : 'Reason'}: {r.reason}</p>}
          </div>
        );
      })}
    </div>
  );
}
