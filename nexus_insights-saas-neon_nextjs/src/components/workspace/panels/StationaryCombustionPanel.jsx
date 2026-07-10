'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Flame } from 'lucide-react';
import { saveReportFields } from '@/lib/workspace/api';
import { getEmissionFactor, EF_SOURCE } from '@/lib/carboniq/emission-factors';

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

// 'other' has no real backend factor row (it's a free-text/custom fuel bucket),
// so it keeps a rough local placeholder. Every other fuel reads the shared,
// backend-aligned table via getEmissionFactor() below.
const OTHER_EF = { GJ: 56, kWh: 0.2, tonne: 500 };

function lookupEf(fuelType, unit) {
  if (!fuelType || !unit) return 0;
  if (fuelType === 'other') return OTHER_EF[unit] || 0;
  return getEmissionFactor(fuelType, unit);
}

const INPUT_CLS =
  'w-full rounded-xl border border-[#072C0E]/10 bg-white px-3 py-2 text-sm text-[#072C0E] outline-none ' +
  'placeholder:text-[#072C0E]/25 focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/12 transition-colors';
const SELECT_CLS =
  'w-full rounded-xl border border-[#072C0E]/10 bg-white px-3 py-2 text-sm text-[#072C0E] outline-none ' +
  'focus:border-[#8BEA99]/50 focus:ring-2 focus:ring-[#8BEA99]/12 transition-colors';

function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#072C0E]/35 shrink-0">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#072C0E]/8" />
    </div>
  );
}

function FieldRow({ label, hint, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-[#072C0E]/55">
        {label}
        {required && <span className="ml-0.5 text-orange-400">*</span>}
        {hint && <span className="ml-1 font-normal text-[#072C0E]/30">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export function StationaryCombustionPanel({ reportId, fieldValues = {}, lang = 'en', onSaved, isPreview = false }) {
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
    const ef = lookupEf(fuelType, unit);
    const qty = parseFloat(String(consumption).replace(',', '.'));
    if (!ef || isNaN(qty)) return null;
    return qty * ef;
  })();

  const handleSave = async () => {
    if (!reportId || !fuelType || !consumption) return;
    if (isPreview) {
      // Preview mode — cannot save to backend; panel drawer shows CTA to start real report
      setSaveError(tr ? 'Önizleme modunda kaydedilemez. Gerçek rapor başlatın.' : 'Cannot save in preview mode. Start a real report.');
      return;
    }
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
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50">
          <Flame className="h-4.5 w-4.5 text-orange-500" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#072C0E]">
            {tr ? 'Sabit Yanma' : 'Stationary Combustion'}
          </p>
          <p className="text-[10px] text-[#072C0E]/40">
            {tr ? 'Kapsam 1 · 3A · ISO 14064-1 §5.2' : 'Scope 1 · 3A · ISO 14064-1 §5.2'}
          </p>
        </div>
      </div>

      {/* Fuel section */}
      <div className="flex flex-col gap-3">
        <SectionDivider>{tr ? 'Yakıt Bilgisi' : 'Fuel Data'}</SectionDivider>

        <FieldRow label={tr ? 'Yakıt türü' : 'Fuel type'} required>
          <select
            className={SELECT_CLS}
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
            <FieldRow label={tr ? 'Tüketim miktarı' : 'Consumption'} required>
              <input
                type="number"
                min="0"
                className={INPUT_CLS}
                placeholder={tr ? 'Örn: 15000' : 'e.g. 15000'}
                value={consumption}
                onChange={e => setConsumption(e.target.value)}
              />
            </FieldRow>
          </div>
          <div className="w-[90px]">
            <FieldRow label={tr ? 'Birim' : 'Unit'}>
              <select
                className={SELECT_CLS}
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
      </div>

      {/* Facility */}
      <div className="flex flex-col gap-3">
        <SectionDivider>{tr ? 'Tesis' : 'Facility'}</SectionDivider>
        <FieldRow
          label={tr ? 'Tesis / Yer' : 'Facility / Location'}
          hint={tr ? 'isteğe bağlı' : 'optional'}
        >
          <input
            type="text"
            className={INPUT_CLS}
            placeholder={tr ? 'Örn: Merkez Ofis, Fabrika A' : 'e.g. Head Office, Plant A'}
            value={facility}
            onChange={e => setFacility(e.target.value)}
          />
        </FieldRow>
      </div>

      {/* Emission factor + result */}
      {fuelType && unit && !!lookupEf(fuelType, unit) && (
        <div className="flex flex-col gap-2">
          <SectionDivider>{tr ? 'Emisyon Faktörü' : 'Emission Factor'}</SectionDivider>
          {/* EF box with left-border accent */}
          <div className="flex overflow-hidden rounded-xl border border-[#072C0E]/8">
            <div className="w-[3px] shrink-0 bg-[#175022]" />
            <div className="flex-1 bg-[#F1FCF2] px-3 py-2.5">
              <p className="text-[9.5px] text-[#072C0E]/40 mb-0.5">
                {tr ? `Kaynak: ${EF_SOURCE[fuelType] || 'DEFRA 2024'}` : `Source: ${EF_SOURCE[fuelType] || 'DEFRA 2024'}`}
              </p>
              <p className="text-[13px] font-bold text-[#072C0E]">
                {lookupEf(fuelType, unit)} kgCO₂e/{unit}
              </p>
              <p className="text-[10px] text-[#175022] mt-0.5">
                {tr ? 'Onaylı · Seviye 1' : 'Verified · Level 1'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Emission estimate */}
      {emissionKg !== null && (
        <div className="rounded-xl bg-gradient-to-br from-[#2ABD41]/8 to-[#8BEA99]/4 border border-[#8BEA99]/20 px-4 py-3">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#175022] mb-1">
            {tr ? `Tahmini Emisyon (${EF_SOURCE[fuelType] || 'DEFRA 2024'})` : `Estimated Emission (${EF_SOURCE[fuelType] || 'DEFRA 2024'})`}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-[#072C0E]">
              {emissionKg >= 1000
                ? (emissionKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })
                : emissionKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-semibold text-[#175022]">
              {emissionKg >= 1000 ? 'tCO₂e' : 'kgCO₂e'}
            </span>
          </div>
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
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold shadow-sm transition ${
          saved
            ? 'bg-[#2ABD41]/15 border border-[#2ABD41]/30 text-[#1A7B2A]'
            : 'bg-[#175022] text-white hover:bg-[#175022] disabled:opacity-35'
        }`}
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <><CheckCircle2 className="h-4 w-4" /> {tr ? '✓ Kaydedildi' : '✓ Saved'}</>
        ) : (
          <>{tr ? 'Kaydet' : 'Save'}</>
        )}
      </button>
    </div>
  );
}
