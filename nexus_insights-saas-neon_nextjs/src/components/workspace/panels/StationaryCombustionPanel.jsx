'use client';
import { useState, useEffect } from 'react';
import { Save, CheckCircle2, Loader2, Flame } from 'lucide-react';
import { saveReportFields } from '@/lib/workspace/api';

const FUEL_OPTIONS = [
  { value: 'natural_gas', label: { tr: 'Doğalgaz', en: 'Natural Gas' } },
  { value: 'fuel_oil',    label: { tr: 'Fuel Oil', en: 'Fuel Oil' } },
  { value: 'diesel',      label: { tr: 'Motorin', en: 'Diesel' } },
  { value: 'lpg',         label: { tr: 'LPG', en: 'LPG' } },
  { value: 'coal',        label: { tr: 'Kömür', en: 'Coal' } },
  { value: 'biomass',     label: { tr: 'Biyokütle', en: 'Biomass' } },
  { value: 'other',       label: { tr: 'Diğer', en: 'Other' } },
];

const UNIT_OPTIONS = {
  natural_gas: ['m³', 'kWh', 'GJ'],
  fuel_oil:    ['litre', 'kg', 'GJ'],
  diesel:      ['litre', 'GJ'],
  lpg:         ['litre', 'kg', 'GJ'],
  coal:        ['tonne', 'kg', 'GJ'],
  biomass:     ['tonne', 'GJ'],
  other:       ['GJ', 'kWh', 'tonne'],
};

// Approximate DEFRA 2023 emission factors (kg CO₂e per unit)
const EMISSION_FACTORS = {
  natural_gas: { 'm³': 2.02,  kWh: 0.183, GJ: 50.77 },
  fuel_oil:    { litre: 2.52, kg: 2.96,   GJ: 74.07 },
  diesel:      { litre: 2.54, GJ: 68.08 },
  lpg:         { litre: 1.51, kg: 2.94,   GJ: 59.65 },
  coal:        { tonne: 2360, kg: 2.36,   GJ: 88.34 },
  biomass:     { tonne: 390,  GJ: 10.23 },
  other:       { GJ: 56, kWh: 0.2, tonne: 500 },
};

function FieldRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[#302817]/60">{label}</label>
      {children}
    </div>
  );
}

export function StationaryCombustionPanel({ reportId, fieldValues = {}, lang = 'en', onSaved }) {
  const tr = lang === 'tr';

  const [fuelType, setFuelType] = useState(fieldValues['rf.3a.fuel_type'] || '');
  const [consumption, setConsumption] = useState(fieldValues['rf.3a.consumption'] || '');
  const [unit, setUnit] = useState(fieldValues['rf.3a.unit'] || '');
  const [facility, setFacility] = useState(fieldValues['rf.3a.facility'] || '');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState('');

  // Sync when fieldValues change (e.g. after AI suggestion confirmed)
  useEffect(() => {
    setFuelType(fieldValues['rf.3a.fuel_type'] || '');
    setConsumption(fieldValues['rf.3a.consumption'] || '');
    setUnit(fieldValues['rf.3a.unit'] || '');
    setFacility(fieldValues['rf.3a.facility'] || '');
  }, [fieldValues]);

  // Auto-set default unit when fuel type changes
  useEffect(() => {
    if (fuelType && !unit) {
      const defaults = UNIT_OPTIONS[fuelType];
      if (defaults) setUnit(defaults[0]);
    }
  }, [fuelType]);

  // Calculate emission estimate
  const emissionKg = (() => {
    const ef = EMISSION_FACTORS[fuelType]?.[unit];
    const qty = parseFloat(String(consumption).replace(',', '.'));
    if (!ef || isNaN(qty)) return null;
    return qty * ef;
  })();

  const handleSave = async () => {
    if (!reportId || !fuelType || !consumption) return;
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await saveReportFields(reportId, [
        { field_id: 'rf.3a.fuel_type',   value: fuelType },
        { field_id: 'rf.3a.consumption', value: parseFloat(String(consumption).replace(',', '.')) || consumption },
        { field_id: 'rf.3a.unit',        value: unit },
        { field_id: 'rf.3a.facility',    value: facility },
      ], 'dashboard');
      setSaved(true);
      if (onSaved) onSaved(['rf.3a.fuel_type', 'rf.3a.consumption', 'rf.3a.unit', 'rf.3a.facility']);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError(tr ? 'Kaydetme başarısız. Lütfen tekrar deneyin.' : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const unitOptions = fuelType ? (UNIT_OPTIONS[fuelType] || ['GJ']) : [];
  const canSave = !!(fuelType && consumption);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-500">
          <Flame className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#302817]">
            {tr ? 'Sabit Yanma — 3A' : 'Stationary Combustion — 3A'}
          </p>
          <p className="text-[11px] text-[#302817]/45">
            {tr ? 'Kapsam 1 · ISO 14064-1 §5.2' : 'Scope 1 · ISO 14064-1 §5.2'}
          </p>
        </div>
      </div>

      {/* Fields */}
      <FieldRow label={tr ? 'Yakıt türü *' : 'Fuel type *'}>
        <select
          className="rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
          value={fuelType}
          onChange={e => { setFuelType(e.target.value); setUnit(''); }}
        >
          <option value="">{tr ? '— Seçin —' : '— Select —'}</option>
          {FUEL_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label[lang] || o.label.en}</option>
          ))}
        </select>
      </FieldRow>

      <div className="flex gap-2">
        <div className="flex-1">
          <FieldRow label={tr ? 'Tüketim miktarı *' : 'Consumption amount *'}>
            <input
              type="number"
              min="0"
              className="w-full rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
              placeholder={tr ? 'Örn: 15000' : 'e.g. 15000'}
              value={consumption}
              onChange={e => setConsumption(e.target.value)}
            />
          </FieldRow>
        </div>
        <div className="w-28">
          <FieldRow label={tr ? 'Birim' : 'Unit'}>
            <select
              className="w-full rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              disabled={!fuelType}
            >
              {unitOptions.length === 0 && <option value="">{tr ? 'Birim' : 'Unit'}</option>}
              {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </FieldRow>
        </div>
      </div>

      <FieldRow label={tr ? 'Tesis / Yer (isteğe bağlı)' : 'Facility / Location (optional)'}>
        <input
          type="text"
          className="rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20"
          placeholder={tr ? 'Örn: Merkez Ofis, Fabrika A' : 'e.g. Head Office, Plant A'}
          value={facility}
          onChange={e => setFacility(e.target.value)}
        />
      </FieldRow>

      {/* Emission estimate */}
      {emissionKg !== null && (
        <div className="rounded-xl border border-[#B4BE6A]/30 bg-[#B4BE6A]/8 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-[#75863B] uppercase tracking-wider mb-0.5">
            {tr ? 'Tahmini Emisyon (DEFRA 2023)' : 'Estimated Emission (DEFRA 2023)'}
          </p>
          <p className="text-xl font-bold text-[#302817]">
            {emissionKg >= 1000
              ? `${(emissionKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`
              : `${emissionKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kgCO₂e`}
          </p>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 font-medium">
          {saveError}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={!canSave || saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#302817] py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <><CheckCircle2 className="h-4 w-4 text-[#B4BE6A]" /> {tr ? 'Kaydedildi' : 'Saved'}</>
        ) : (
          <>{tr ? 'Kaydet' : 'Save'}</>
        )}
      </button>
    </div>
  );
}
