'use client';
import { useState, useEffect } from 'react';
import { Save, CheckCircle2, Loader2, Zap } from 'lucide-react';
import { saveReportFields } from '@/lib/workspace/api';

// Location-based grid emission factors (kgCO2e/kWh) — IEA 2023
const GRID_FACTORS = [
  { value: '',        label: { tr: '— Seçin —',        en: '— Select —'        }, factor: null },
  { value: 'turkey',  label: { tr: 'Türkiye (TEİAŞ)',   en: 'Turkey (TEİAŞ)'   }, factor: 0.437 },
  { value: 'eu_avg',  label: { tr: 'AB Ortalaması',     en: 'EU Average'        }, factor: 0.276 },
  { value: 'germany', label: { tr: 'Almanya',           en: 'Germany'           }, factor: 0.380 },
  { value: 'uk',      label: { tr: 'İngiltere',         en: 'UK'                }, factor: 0.207 },
  { value: 'usa',     label: { tr: 'ABD Ort.',          en: 'USA Avg.'          }, factor: 0.386 },
  { value: 'custom',  label: { tr: 'Özel (manuel gir)', en: 'Custom (enter manually)' }, factor: null },
];

const DATA_SOURCE_OPTIONS = [
  { value: 'invoice',       label: { tr: 'Fatura',             en: 'Invoice'           } },
  { value: 'meter_reading', label: { tr: 'Sayaç okuma',        en: 'Meter reading'     } },
  { value: 'estimate',      label: { tr: 'Tahmin',             en: 'Estimate'          } },
  { value: 'utility_report',label: { tr: 'Tedarikçi raporu',   en: 'Utility report'    } },
];

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-[#302817]/60">
        {label}
        {hint && <span className="ml-1 font-normal text-[#302817]/35">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none ' +
  'placeholder:text-[#302817]/30 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20';
const SELECT_CLS =
  'w-full rounded-xl border border-[#302817]/12 bg-white px-3 py-2 text-sm text-[#302817] outline-none ' +
  'focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/20';

export function ElectricityPanel({ reportId, fieldValues = {}, lang = 'en', onSaved }) {
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
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

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
    const kwh = parseFloat(String(consumptionKwh).replace(',', '.'));
    const ren = parseFloat(String(renewableOnSite).replace(',', '.')) || 0;
    const ef  = parseFloat(String(emissionFactor).replace(',', '.'));
    if (isNaN(kwh) || isNaN(ef) || ef <= 0) return null;
    const netKwh = Math.max(kwh - ren, 0);
    return netKwh * ef;
  })();

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!reportId || !consumptionKwh) return;
    setSaving(true);
    setSaved(false);
    try {
      const toNum = (v) => {
        const n = parseFloat(String(v).replace(',', '.'));
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
      // silent retry
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!consumptionKwh;

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-100 text-yellow-500">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#302817]">
            {tr ? 'Satın Alınan Elektrik — 4A' : 'Purchased Electricity — 4A'}
          </p>
          <p className="text-[11px] text-[#302817]/45">
            {tr ? 'Kapsam 2 · ISO 14064-1 §5.3' : 'Scope 2 · ISO 14064-1 §5.3'}
          </p>
        </div>
      </div>

      {/* Facility */}
      <FieldRow label={tr ? 'Tesis / Yer' : 'Facility / Location'} hint={tr ? 'isteğe bağlı' : 'optional'}>
        <input
          type="text"
          className={INPUT_CLS}
          placeholder={tr ? 'Örn: Merkez Ofis, Fabrika A' : 'e.g. Head Office, Plant A'}
          value={facility}
          onChange={e => setFacility(e.target.value)}
        />
      </FieldRow>

      {/* Consumption */}
      <FieldRow label={tr ? 'Tüketim (kWh) *' : 'Consumption (kWh) *'}>
        <input
          type="number"
          min="0"
          className={INPUT_CLS}
          placeholder={tr ? 'Örn: 18000' : 'e.g. 18000'}
          value={consumptionKwh}
          onChange={e => setConsumptionKwh(e.target.value)}
        />
      </FieldRow>

      {/* Period + Data source */}
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

      {/* Supplier */}
      <FieldRow label={tr ? 'Tedarikçi' : 'Supplier'} hint={tr ? 'isteğe bağlı' : 'optional'}>
        <input
          type="text"
          className={INPUT_CLS}
          placeholder={tr ? 'Örn: TEDAŞ, Enerjisa' : 'e.g. TEDAS, Enerjisa'}
          value={supplier}
          onChange={e => setSupplier(e.target.value)}
        />
      </FieldRow>

      {/* On-site renewable */}
      <FieldRow
        label={tr ? 'Sahada yenilenebilir üretim (kWh)' : 'On-site renewable generation (kWh)'}
        hint={tr ? 'isteğe bağlı — net tüketimden düşülür' : 'optional — deducted from net consumption'}
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

      {/* Emission factor section */}
      <div className="rounded-xl border border-[#302817]/8 bg-[#302817]/2 p-3 flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#302817]/50">
          {tr ? 'Emisyon Faktörü' : 'Emission Factor'}
        </p>

        {/* Grid preset picker */}
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
                placeholder="0.437"
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
                placeholder={tr ? 'Örn: IEA 2023' : 'e.g. IEA 2023'}
                value={emissionFactorSource}
                onChange={e => setEmissionFactorSource(e.target.value)}
              />
            </FieldRow>
          </div>
        </div>
      </div>

      {/* Emission estimate */}
      {emissionKg !== null && (
        <div className="rounded-xl border border-[#B4BE6A]/30 bg-[#B4BE6A]/8 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-[#75863B] uppercase tracking-wider mb-0.5">
            {tr ? 'Tahmini Kapsam 2 Emisyonu' : 'Estimated Scope 2 Emission'}
          </p>
          {renewableOnSite && parseFloat(renewableOnSite) > 0 && (
            <p className="text-[10px] text-[#302817]/40 mb-0.5">
              {tr
                ? `Net tüketim: ${Math.max(parseFloat(consumptionKwh) - parseFloat(renewableOnSite), 0).toLocaleString()} kWh (sahada üretim düşüldü)`
                : `Net consumption: ${Math.max(parseFloat(consumptionKwh) - parseFloat(renewableOnSite), 0).toLocaleString()} kWh (after on-site generation)`}
            </p>
          )}
          <p className="text-xl font-bold text-[#302817]">
            {emissionKg >= 1000
              ? `${(emissionKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`
              : `${emissionKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kgCO₂e`}
          </p>
          {emissionFactorSource && (
            <p className="text-[10px] text-[#302817]/35 mt-0.5">{emissionFactorSource}</p>
          )}
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
