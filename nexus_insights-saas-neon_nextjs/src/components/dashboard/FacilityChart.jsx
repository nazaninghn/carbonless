'use client';
import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/utils/api';

export default function FacilityChart({ language, selectedYear, compact }) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const tr = language === 'tr';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.getByFacility(selectedYear);
        if (res.ok && !cancelled) setData(await res.json());
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selectedYear]);

  // useMemo MUST be called unconditionally (Rules of Hooks) — before any early return.
  // When data is empty or still loading, Math.max returns 1 (the fallback), which is harmless.
  const maxKg = useMemo(() => Math.max(...data.map(d => d.total_kg), 1), [data]);
  const SCOPE_COLORS = ['#75863B', '#95A847', '#B4BE6A', '#302817'];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="mb-1.5 flex justify-between">
              <div className="h-3 w-24 rounded-full bg-[#302817]/8" />
              <div className="h-3 w-12 rounded-full bg-[#302817]/6" />
            </div>
            <div className="h-2 rounded-full bg-[#302817]/5" />
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl bg-[#302817]/3">
        <p className="text-xs font-semibold text-[#302817]/35">
          {tr ? 'Tesis verisi yok' : 'No facility data'}
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {data.slice(0, 5).map((d, i) => {
          const pct = (d.total_kg / maxKg) * 100;
          return (
            <div key={d.facility_id ?? i}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-bold text-[#302817]/80">{d.facility_name}</span>
                <span className="shrink-0 text-[10px] font-bold text-[#302817]/40">
                  {d.total_tonne.toFixed(2)}t
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#302817]/5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: SCOPE_COLORS[i % SCOPE_COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Full view (used standalone)
  return (
    <div className="rounded-[1.5rem] border border-[#302817]/8 bg-white p-4 shadow-[0_4px_20px_rgba(48,40,23,0.05)] sm:p-5">
      <h3 className="mb-4 text-sm font-bold text-[#302817]">
        {tr ? 'Tesis Karşılaştırması' : 'Facility Comparison'}
      </h3>
      <div className="space-y-3">
        {data.map((d, i) => {
          const pct = (d.total_kg / maxKg) * 100;
          return (
            <div key={d.facility_id ?? i}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold text-[#302817]">{d.facility_name}</span>
                <span className="shrink-0 text-xs font-semibold text-[#302817]/50">{d.total_tonne.toFixed(2)} tCO₂e</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#302817]/5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: SCOPE_COLORS[i % SCOPE_COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
