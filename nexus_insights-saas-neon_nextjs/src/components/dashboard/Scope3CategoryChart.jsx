'use client';
import { useMemo } from 'react';

/**
 * Scope3CategoryChart — visualizes Scope 3 emissions broken down by the
 * 15 GHG Protocol categories. Renders a horizontal bar chart matching the
 * existing FacilityChart / CategoryChart visual style.
 *
 * Props:
 *   data     — array of { category, ghg_number, name_en, name_tr, total_co2e_kg }
 *              from the emission_summary API `scope3_by_category` field
 *   language — 'tr' | 'en'
 */

const BAR_COLORS = [
  '#1D9C31', '#2ABD41', '#51D766', '#175022', '#2ABD41',
  '#8BEA99', '#072C0E', '#2ABD41', '#1A7B2A', '#8BEA99',
  '#1A7B2A', '#2ABD41', '#51D766', '#1D9C31', '#51D766',
];

export default function Scope3CategoryChart({ data, language }) {
  const tr = language === 'tr';

  // Filter to only categories with non-zero emissions, sorted descending
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data
      .filter(d => d.total_co2e_kg > 0)
      .sort((a, b) => b.total_co2e_kg - a.total_co2e_kg);
  }, [data]);

  // Maximum value for bar width calculation
  const maxKg = useMemo(
    () => Math.max(...chartData.map(d => d.total_co2e_kg), 1),
    [chartData],
  );

  // Empty state — all categories are zero or no data
  if (chartData.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl bg-[#072C0E]/3">
        <p className="text-xs font-semibold text-[#072C0E]/35">
          {tr ? 'Scope 3 kategori verisi yok' : 'No Scope 3 category data'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {chartData.map((d, i) => {
        const pct = (d.total_co2e_kg / maxKg) * 100;
        const tonne = d.total_co2e_kg / 1000;
        const label = tr ? d.name_tr : d.name_en;
        return (
          <div key={d.category}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-bold text-[#072C0E]/80">
                <span className="text-[10px] font-semibold text-[#072C0E]/40 mr-1">
                  {d.ghg_number}.
                </span>
                {label}
              </span>
              <span className="shrink-0 text-[10px] font-bold text-[#072C0E]/40">
                {tonne < 0.01 ? `${d.total_co2e_kg.toFixed(1)} kg` : `${tonne.toFixed(2)} t`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#072C0E]/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
