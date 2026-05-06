'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';

export default function FacilityChart({ language, selectedYear, compact }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getByFacility(selectedYear);
        if (res.ok) setData(await res.json());
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, [selectedYear]);

  if (loading) return null;
  if (data.length === 0) {
    return (
      <p className="py-6 text-center text-xs font-semibold text-[#302817]/40">
        {language === 'tr' ? 'Tesis verisi yok' : 'No facility data'}
      </p>
    );
  }

  const maxKg = Math.max(...data.map(d => d.total_kg), 1);

  if (compact) {
    return (
      <div className="space-y-3">
        {data.map(d => {
          const pct = (d.total_kg / maxKg) * 100;
          return (
            <div key={d.facility_id}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-bold text-[#302817]">{d.facility_name}</span>
                <span className="text-xs font-semibold text-[#302817]/50">{d.total_tonne.toFixed(2)} t</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#95A847]/12">
                <div className="h-full rounded-full bg-[#95A847] transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-[#302817]/10 bg-white/75 p-4 shadow-[0_6px_20px_rgba(48,40,23,0.045)] backdrop-blur-xl">
      <h3 className="mb-4 text-sm font-bold text-[#302817]">
        {language === 'tr' ? 'Tesis Karşılaştırması' : 'Facility Comparison'}
      </h3>
      <div className="space-y-3">
        {data.map(d => {
          const pct = (d.total_kg / maxKg) * 100;
          return (
            <div key={d.facility_id}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold text-[#302817]">{d.facility_name}</span>
                <span className="text-xs font-semibold text-[#302817]/50">{d.total_tonne.toFixed(2)} tCO₂e</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#95A847]/12">
                <div className="h-full rounded-full bg-[#95A847] transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
