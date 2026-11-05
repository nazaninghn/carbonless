import { useEffect, useState } from 'react';
import { api } from '@/lib/utils/api';

// Records of the year that belong to NO inventory (chat / form entries when the year has several
// inventories, or rows that could not be tied to one safely). They are kept as they are, are never part of
// an inventory's totals and are never assigned automatically; this panel only makes them visible.
export default function UnassignedRecords({ year, language, info }) {
  const tr = language === 'tr';
  const count = Number(info?.entries) || 0;
  const tonne = (Number(info?.total_kg) || 0) / 1000;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!open || !count) return undefined;
    let cancelled = false;
    api.getEntries(`year=${year}&unassigned=1`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setRows(Array.isArray(d) ? d : (d?.results || [])); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [open, count, year]);
  if (!count) return null;
  return (
    <section data-testid="unassigned-records" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-[12px] text-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {tr
            ? `${count} onaylı kayıt (${tonne.toFixed(2)} tCO₂e) hiçbir envantere atanmamış`
            : `${count} approved record${count === 1 ? '' : 's'} (${tonne.toFixed(2)} tCO₂e) not assigned to any inventory`}
        </p>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100">
          {open ? (tr ? 'Gizle' : 'Hide') : (tr ? 'Kayıtları göster' : 'Show records')}
        </button>
      </div>
      <p className="mt-1 leading-5 text-amber-800/90">
        {tr
          ? 'Bu yılda birden fazla envanter olduğu için bu kayıtların hangisine ait olduğu güvenle belirlenemez. Hiçbir envanterin toplamına dahil edilmezler, otomatik olarak atanmazlar ve silinmeden olduğu gibi saklanırlar. Atanan kayıtlar bir envantere bağlıdır ve yalnızca o envanterin toplamında görünür.'
          : 'This year has several inventories, so these records cannot be safely tied to one of them. They are not included in any inventory\'s totals, are never assigned automatically, and are kept untouched. Assigned records belong to one inventory and appear only in that inventory\'s totals.'}
      </p>
      {open && (
        <div className="mt-2 overflow-x-auto rounded-xl bg-white">
          {rows === null ? (
            <p className="p-3 text-[11px]">{tr ? 'Yükleniyor…' : 'Loading…'}</p>
          ) : (
            <table className="w-full text-left text-[11px]">
              <thead><tr className="border-b border-amber-100 text-amber-700">
                <th className="px-3 py-1.5">{tr ? 'Kayıt' : 'Record'}</th>
                <th className="px-3 py-1.5">{tr ? 'Ay' : 'Month'}</th>
                <th className="px-3 py-1.5">{tr ? 'Durum' : 'Status'}</th>
                <th className="px-3 py-1.5 text-right">kg CO₂e</th>
                <th className="px-3 py-1.5">{tr ? 'Atama' : 'Assignment'}</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-amber-50">
                    <td className="px-3 py-1.5">{r.description || r.emission_factor_name || `#${r.id}`}</td>
                    <td className="px-3 py-1.5">{r.month}</td>
                    <td className="px-3 py-1.5">{r.status}</td>
                    <td className="px-3 py-1.5 text-right">{Number(r.calculated_co2e_kg).toLocaleString(tr ? 'tr-TR' : 'en-US', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-1.5"><span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">{tr ? 'Atanmamış' : 'Unassigned'}</span></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={5} className="px-3 py-2">{tr ? 'Kayıt yok.' : 'No records.'}</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
