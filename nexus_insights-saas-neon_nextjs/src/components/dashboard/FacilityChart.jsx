'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';

export default function FacilityChart({ language, selectedYear }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await api.getByFacility(selectedYear);
        if (res.ok) setData(await res.json());
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, [selectedYear]);

  if (loading) return null;
  if (data.length === 0) return null;

  const maxKg = Math.max(...data.map(d => d.total_kg), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-4">
        {language === 'tr' ? 'TESİS KARŞILAŞTIRMASI' : 'FACILITY COMPARISON'}
      </h3>
      <div className="space-y-3">
        {data.map(d => {
          const pct = (d.total_kg / maxKg) * 100;
          return (
            <div key={d.facility_id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{d.facility_name}</span>
                <span className="text-sm text-gray-600">{d.total_tonne.toFixed(2)} tCO2e</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="h-2.5 rounded-full bg-primary/70 transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
