'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Zap } from 'lucide-react';
import { saveReportFields } from '@/lib/workspace/api';
import { parseLocalizedNumber } from '@/lib/utils/numbers';

// Location-based grid emission factors (kgCO2e/kWh) — matches the backend's
// EmissionFactor rows (carbonless_backend/emissions/seed_data.py) so a
// preview here lands on the same number the backend will compute.
const GRID_FACTORS = [
  { value: '',        label: { tr: '— Seçin —',        en: '— Select —'        }, factor: null },
  { value: 'turkey',  label: { tr: 'Türkiye (TEİAŞ)',   en: 'Turkey (TEİAŞ)'   }, factor: 0.4199 },
  { value: 'eu_avg',  label: { tr: 'AB Ortalaması',     en: 'EU Average'        }, factor: 0.295 },
  { value: 'germany', label: { tr: 'Almanya',           en: 'Germany'           }, factor: 0.364 },
  { value: 'uk',      label: { tr: 'İngiltere',         en: 'UK'                }, factor: 0.207 },
  { value: 'usa',     label: { tr: 'ABD Ort.',          en: 'USA Avg.'          }, factor: 0.417 },
  { value: 'custom',  label: { tr: 'Özel (manuel gir)', en: 'Custom (enter manually)' }, factor: null },
];

const DATA_SOURCE_OPTIONS = [
  { value: 'invoice',        label: { tr: 'Fatura',             en: 'Invoice'           } },
  { value: 'meter_reading',  label: { tr: 'Sayaç okuma',        en: 'Meter reading'     } },
  { value: 'estimate',       label: { tr: 'Tahmin',             en: 'Estimate'          } },
  { value: 'utility_report', label: { tr: 'Tedarikçi raporu',   en: 'Utility report'    } },
];

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
        {required && <span className="ml-0.5 text-yellow-500">*</span>}
        {hint && <span className="ml-1 font-normal text-[#072C0E]/30">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export function ElectricityPanel({ reportId, fieldValues = {}, lang = 'en', onSaved, isPreview = false }) {
  const tr = lang === 'tr';

  // ── Field state ──────────────────────────────────────────────────
  const [facility,              setFacility]            = useState(fieldValues['rf.4a.facility']               || '');
  const [consumptionKwh,        setConsumptionKwh]      = useState(fieldValues['rf.4a.consumption_kwh']        || '');
  const [period,                setPeriod]              = useState(fieldValues['rf.4a.period']                 || '');
  const [dataSource,            setDataSource]          = useState(fieldValues['rf.4a.data_source']            || '');
  const [supplier,              setSupplier]            = useState(fieldValues['rf.4a.supplier']               || '');
  const [renewableOnSite,       setRenewableOnSite]     = useState(fieldValues['rf.4a.renewable_on_site']      || '');
  const [emissionFactor,        setEmissionFactor]      = useState(fieldValues['rf.4a.emission_factor']        || '');
  const [emissionFactorSource,  setEmissionFactorSource]= useState(fieldValues['rf.4a.emission_factor_source'] || '');
  const [gridPreset,            setGridPreset]          = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState('');

  // Sync when fieldValues update (after AI confirm)
  useEffect(() => {
    setFacility(            fieldValues['rf.4a.facility']               || '');
    setConsumptionKwh(      fieldValues['rf.4a.consumption_kwh']        || '');
    setPeriod(              fieldValues['rf.4a.period']                 || '');
    setDataSource(          fieldValues['rf.4a.data_source']            || '');
    setSupplier(            fieldValues['rf.4a.supplier']               || '');
    setRenewableOnSite(     fieldValues['rf.4a.renewable_on_site']      || '');
    setEmissionFactor(      fieldValues['rf.4a.emission_factor']        || '');
    setEmissionFactorSource(fieldValues['rf.4a.emission_factor_source'] || '');
  }, [fieldValues]);

  // Auto-fill emission factor from grid preset
  useEffect(() => {
    const preset = GRID_FACTORS.find(g => g.value === gridPreset);
    if (preset && preset.factor !== null) {
      setEmissionFactor(String(preset.factor));
      setEmissionFactorSource(preset.label[lang] || preset.label.en);
    }
  }, [gridPreset, lang]);

  // ── Calculated emission estimate ─────────────────────────────────
  const emissionKg = (() => {
    const kwh = parseLocalizedNumber(consumptionKwh);
    const ren = parseLocalizedNumber(renewableOnSite) || 0;
    const ef  = parseLocalizedNumber(emissionFactor);
    if (isNaN(kwh) || isNaN(ef) || ef <= 0) return null;
    const netKwh = Math.max(kwh - ren, 0);
    return netKwh * ef;
  })();

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!reportId || !consumptionKwh) return;
    if (isPreview) {
      setSaveError(tr ? 'Önizleme modunda kaydedilemez. Gerçek rapor başlatın.' : 'Cannot save in preview mode. Start a real report.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      const toNum = (v) => {
        const n = parseLocalizedNumber(v);
        return isNaN(n) ? v : n;
      };
      await saveReportFields(reportId, [
        { field_id: 'rf.4a.facility',               value: facility },
        { field_id: 'rf.4a.consumption_kwh',        value: toNum(consumptionKwh) },
        { field_id: 'rf.4a.period',                 value: period },
        { field_id: 'rf.4a.data_source',            value: dataSource },
        { field_id: 'rf.4a.supplier',               value: supplier },
        { field_id: 'rf.4a.renewable_on_site',      value: renewableOnSite !== '' ? toNum(renewableOnSite) : null },
        { field_id: 'rf.4a.emission_factor',        value: emissionFactor  !== '' ? toNum(emissionFactor)  : null },
        { field_id: 'rf.4a.emission_factor_source', value: emissionFactorSource },
      ].filter(f => f.value !== null && f.value !== ''), 'dashboard');

      setSaved(true);
      if (onSaved) onSaved([
        'rf.4a.facility', 'rf.4a.consumption_kwh', 'rf.4a.period', 'rf.4a.data_source',
        'rf.4a.supplier', 'rf.4a.renewable_on_site', 'rf.4a.emission_factor', 'rf.4a.emission_factor_source',
      ]);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError(tr ? 'Kaydetme başarısız. Lütfen tekrar deneyin.' : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!consumptionKwh;

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-50">
          <Zap className="h-4.5 w-4.5 text-yellow-500" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#072C0E]">
            {tr ? 'Satın Alınan Elektrik' : 'Purchased Electricity'}
          </p>
          <p className="text-[10px] text-[#072C0E]/40">
            {tr ? 'Kapsam 2 · 4A · ISO 14064-1 §5.3' : 'Scope 2 · 4A · ISO 14064-1 §5.3'}
          </p>
        </div>
      </div>

      {/* Tesis ve Tüketim */}
      <div className="flex flex-col gap-3">
        <SectionDivider>{tr ? 'Tesis ve Tüketim' : 'Facility & Consumption'}</SectionDivider>

        <FieldRow label={tr ? 'Tesis / Yer' : 'Facility / Location'} hint={tr ? 'isteğe bağlı' : 'optional'}>
          <input
            type="text"
            className={INPUT_CLS}
            placeholder={tr ? 'Örn: Merkez Ofis, Fabrika A' : 'e.g. Head Office, Plant A'}
            value={facility}
            onChange={e => setFacility(e.target.value)}
          />
        </FieldRow>

        <FieldRow label={tr ? 'Tüketim (kWh)' : 'Consumption (kWh)'} required>
          <input
            type="number"
            min="0"
            className={INPUT_CLS}
            placeholder={tr ? 'Örn: 18000' : 'e.g. 18000'}
            value={consumptionKwh}
            onChange={e => setConsumptionKwh(e.target.value)}
          />
        </FieldRow>

        <div className="flex gap-2">
          <div className="flex-1">
            <FieldRow label={tr ? 'Dönem' : 'Period'} hint={tr ? 'isteğe bağlı' : 'optional'}>
              <input
                type="text"
                className={INPUT_CLS}
                placeholder={tr ? 'Örn: 2023' : 'e.g. 2023'}
                value={period}
                onChange={e => setPeriod(e.target.value)}
              />
            </FieldRow>
          </div>
          <div className="flex-1">
            <FieldRow label={tr ? 'Veri kaynağı' : 'Data source'} hint={tr ? 'isteğe bağlı' : 'optional'}>
              <select
                className={SELECT_CLS}
                value={dataSource}
                onChange={e => setDataSource(e.target.value)}
              >
                <option value="">{tr ? '— Seçin —' : '— Select —'}</option>
                {DATA_SOURCE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label[lang] || o.label.en}</option>
                ))}
              </select>
            </FieldRow>
          </div>
        </div>

        <FieldRow label={tr ? 'Tedarikçi' : 'Supplier'} hint={tr ? 'isteğe bağlı' : 'optional'}>
          <input
            type="text"
            className={INPUT_CLS}
            placeholder={tr ? 'Örn: TEDAŞ, Enerjisa' : 'e.g. TEDAS, Enerjisa'}
            value={supplier}
            onChange={e => setSupplier(e.target.value)}
          />
        </FieldRow>

        <FieldRow
          label={tr ? 'Sahada yenilenebilir üretim (kWh)' : 'On-site renewable generation (kWh)'}
          hint={tr ? 'isteğe bağlı' : 'optional'}
        >
          <input
            type="number"
            min="0"
            className={INPUT_CLS}
            placeholder={tr ? 'Örn: 2000' : 'e.g. 2000'}
            value={renewableOnSite}
            onChange={e => setRenewableOnSite(e.target.value)}
          />
        </FieldRow>
      </div>

      {/* Emisyon Faktörü */}
      <div className="flex flex-col gap-3">
        <SectionDivider>{tr ? 'Emisyon Faktörü' : 'Emission Factor'}</SectionDivider>

        <FieldRow label={tr ? 'Izgara ön ayarı' : 'Grid preset'} hint={tr ? 'isteğe bağlı' : 'optional'}>
          <select
            className={SELECT_CLS}
            value={gridPreset}
            onChange={e => setGridPreset(e.target.value)}
          >
            {GRID_FACTORS.map(g => (
              <option key={g.value} value={g.value}>{g.label[lang] || g.label.en}</option>
            ))}
          </select>
        </FieldRow>

        <div className="flex gap-2">
          <div className="flex-1">
            <FieldRow label={tr ? 'Faktör (kgCO₂e/kWh)' : 'Factor (kgCO₂e/kWh)'}>
              <input
                type="number"
                min="0"
                step="0.001"
                className={INPUT_CLS}
                placeholder="0.4199"
                value={emissionFactor}
                onChange={e => { setEmissionFactor(e.target.value); setGridPreset('custom'); }}
              />
            </FieldRow>
          </div>
          <div className="flex-1">
            <FieldRow label={tr ? 'Faktör kaynağı' : 'Factor source'}>
              <input
                type="text"
                className={INPUT_CLS}
                placeholder={tr ? 'Örn: ATOM KABLO ISO 14064-1' : 'e.g. ATOM KABLO ISO 14064-1'}
                value={emissionFactorSource}
                onChange={e => setEmissionFactorSource(e.target.value)}
              />
            </FieldRow>
          </div>
        </div>

        {/* EF box — shown when factor is set */}
        {emissionFactor && parseFloat(emissionFactor) > 0 && (
          <div className="flex overflow-hidden rounded-xl border border-[#072C0E]/8">
            <div className="w-[3px] shrink-0 bg-[#175022]" />
            <div className="flex-1 bg-[#F1FCF2] px-3 py-2.5">
              <p className="text-[9.5px] text-[#072C0E]/40 mb-0.5">
                {emissionFactorSource || (tr ? 'Özel faktör' : 'Custom factor')}
              </p>
              <p className="text-[13px] font-bold text-[#072C0E]">
                {parseFloat(emissionFactor).toFixed(3)} kgCO₂e/kWh
              </p>
              <p className="text-[10px] text-[#175022] mt-0.5">
                {tr ? 'Lokasyon bazlı' : 'Location-based'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Emission estimate */}
      {emissionKg !== null && (
        <div className="rounded-xl bg-gradient-to-br from-[#2ABD41]/8 to-[#8BEA99]/4 border border-[#8BEA99]/20 px-4 py-3">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#175022] mb-1">
            {tr ? 'Tahmini Kapsam 2 Emisyonu' : 'Estimated Scope 2 Emission'}
          </p>
          {renewableOnSite && parseFloat(renewableOnSite) > 0 && (
            <p className="text-[10px] text-[#072C0E]/40 mb-0.5">
              {tr
                ? `Net: ${Math.max(parseFloat(consumptionKwh) - parseFloat(renewableOnSite), 0).toLocaleString()} kWh (sahada üretim düşüldü)`
                : `Net: ${Math.max(parseFloat(consumptionKwh) - parseFloat(renewableOnSite), 0).toLocaleString()} kWh (after on-site generation)`}
            </p>
          )}
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
          {emissionFactorSource && (
            <p className="text-[10px] text-[#072C0E]/35 mt-0.5">{emissionFactorSource}</p>
          )}
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
