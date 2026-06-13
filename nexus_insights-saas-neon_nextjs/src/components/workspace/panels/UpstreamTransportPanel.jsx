'use client';
import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { saveReportFields } from '@/lib/workspace/api';

// GLEC Framework v3 / DEFRA 2023 — kgCO2e per tonne-km
const TRANSPORT_MODES = [
  { group: 'Road',
    modes: [
      { value: 'road_hgv_full',    label: { tr: 'Karayolu HGV >34t (tam dolu)',    en: 'Road HGV >34t (full load)'     }, ef: 0.062 },
      { value: 'road_hgv_half',    label: { tr: 'Karayolu HGV >34t (%50 dolu)',    en: 'Road HGV >34t (50% load)'      }, ef: 0.097 },
      { value: 'road_hgv_light',   label: { tr: 'Karayolu HGV <7.5t',              en: 'Road HGV <7.5t'                }, ef: 0.180 },
      { value: 'road_van',         label: { tr: 'Panelvan / Hafif ticari',         en: 'Van / Light commercial'        }, ef: 0.246 },
    ],
  },
  { group: 'Rail',
    modes: [
      { value: 'rail_electric',    label: { tr: 'Demir yolu (elektrikli)',          en: 'Rail freight (electric)'       }, ef: 0.006 },
      { value: 'rail_diesel',      label: { tr: 'Demir yolu (dizel)',               en: 'Rail freight (diesel)'         }, ef: 0.028 },
    ],
  },
  { group: 'Sea',
    modes: [
      { value: 'sea_container_lg', label: { tr: 'Deniz konteyneri (büyük >8k TEU)', en: 'Sea container (large >8k TEU)' }, ef: 0.007 },
      { value: 'sea_container_sm', label: { tr: 'Deniz konteyneri (küçük)',         en: 'Sea container (small)'         }, ef: 0.012 },
      { value: 'sea_bulk',         label: { tr: 'Deniz kuru dökme',                en: 'Sea bulk carrier'              }, ef: 0.008 },
    ],
  },
  { group: 'Air',
    modes: [
      { value: 'air_long',         label: { tr: 'Hava kargo (uzun mesafe)',         en: 'Air freight (long-haul)'       }, ef: 1.130 },
      { value: 'air_short',        label: { tr: 'Hava kargo (kısa mesafe)',         en: 'Air freight (short-haul)'      }, ef: 2.120 },
    ],
  },
  { group: 'Inland Water',
    modes: [
      { value: 'inland_water',     label: { tr: 'İç su yolu',                      en: 'Inland waterway'               }, ef: 0.031 },
    ],
  },
];

const ALL_MODES = TRANSPORT_MODES.flatMap(g => g.modes);
const getModeData = (value) => ALL_MODES.find(m => m.value === value) || null;

const ENTRY_METHODS = [
  { value: 'shipment_detail', label: { tr: 'Sevkiyat detayı (ton + km + mod)', en: 'Shipment detail (tonnes + km + mode)' } },
  { value: 'glec_report',     label: { tr: 'GLEC/ISO 14083 raporu',           en: 'GLEC / ISO 14083 report'               } },
  { value: 'invoice',         label: { tr: 'Fatura tutarı (kaba tahmin)',      en: 'Invoice amount (rough estimate)'       } },
];

const DATA_SOURCES = [
  { value: 'waybill',       label: { tr: 'İrsaliye / Taşıma belgesi', en: 'Waybill / transport document' } },
  { value: 'invoice',       label: { tr: 'Fatura',                    en: 'Invoice'                      } },
  { value: 'gps_log',       label: { tr: 'GPS kayıtları',             en: 'GPS logs'                     } },
  { value: 'estimate',      label: { tr: 'Tahmin',                    en: 'Estimate'                     } },
  { value: 'glec_report',   label: { tr: 'GLEC raporu',               en: 'GLEC report'                  } },
];

const INPUT_CLS =
  'w-full rounded-xl border border-[#302817]/10 bg-white px-3 py-2 text-sm text-[#302817] outline-none ' +
  'placeholder:text-[#302817]/25 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/12 transition-colors';
const SELECT_CLS =
  'w-full rounded-xl border border-[#302817]/10 bg-white px-3 py-2 text-sm text-[#302817] outline-none ' +
  'focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/12 transition-colors';

function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#302817]/35 shrink-0">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#302817]/8" />
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-[#302817]/55">
        {label}
        {hint && <span className="ml-1 font-normal text-[#302817]/30">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function ShipmentRow({ s, index, lang, onRemove }) {
  const tr = lang === 'tr';
  const mode = getModeData(s.mode);
  const kg = s.tkm && mode ? s.tkm * mode.ef : null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-[#302817]/8 bg-white px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[#302817] truncate">
          #{index + 1} · {mode ? (mode.label[lang] || mode.label.en) : s.mode}
        </p>
        <p className="text-[10px] text-[#302817]/40 mt-0.5">
          {s.cargo_t} t · {s.distance_km} km
          {s.tkm ? ` · ${s.tkm.toLocaleString()} tkm` : ''}
        </p>
      </div>
      {kg !== null && (
        <span className="shrink-0 text-[11px] font-bold text-[#75863B]">
          {kg >= 1000 ? `${(kg/1000).toFixed(2)} tCO₂e` : `${kg.toFixed(0)} kgCO₂e`}
        </span>
      )}
      <button
        onClick={() => onRemove(index)}
        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg text-[#302817]/25 hover:bg-red-50 hover:text-red-400 transition"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

const EMPTY_SHIPMENT = { mode: 'road_hgv_full', cargo_t: '', distance_km: '' };

export function UpstreamTransportPanel({ reportId, fieldValues = {}, lang = 'en', onSaved, isPreview = false }) {
  const tr = lang === 'tr';

  const [entryMethod,   setEntryMethod]   = useState(fieldValues['rf.k4.entry_method'] || 'shipment_detail');
  const [dataSource,    setDataSource]    = useState(fieldValues['rf.k4.data_source']   || '');
  const [shipments,     setShipments]     = useState(() => {
    const stored = fieldValues['rf.k4.shipments'];
    return Array.isArray(stored) && stored.length > 0 ? stored : [];
  });
  // Direct total for glec_report / invoice entry methods (no shipment detail available)
  const [directTotalKg, setDirectTotalKg] = useState(
    fieldValues['rf.k4.total_emission_kgco2e'] ? String(fieldValues['rf.k4.total_emission_kgco2e']) : ''
  );

  const [draft, setDraft] = useState({ ...EMPTY_SHIPMENT });
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState('');

  // Sync when fieldValues update
  useEffect(() => {
    setEntryMethod(fieldValues['rf.k4.entry_method'] || 'shipment_detail');
    setDataSource( fieldValues['rf.k4.data_source']   || '');
    const stored = fieldValues['rf.k4.shipments'];
    if (Array.isArray(stored) && stored.length > 0) setShipments(stored);
    if (fieldValues['rf.k4.total_emission_kgco2e'])
      setDirectTotalKg(String(fieldValues['rf.k4.total_emission_kgco2e']));
  }, [fieldValues]);

  const draftMode   = getModeData(draft.mode);
  const draftCargo  = parseFloat(String(draft.cargo_t).replace(',', '.'));
  const draftDist   = parseFloat(String(draft.distance_km).replace(',', '.'));
  const draftTkm    = !isNaN(draftCargo) && !isNaN(draftDist) ? draftCargo * draftDist : null;
  const canAddDraft = !isNaN(draftCargo) && !isNaN(draftDist) && draftCargo > 0 && draftDist > 0;

  const addShipment = useCallback(() => {
    if (!canAddDraft) return;
    const s = {
      mode: draft.mode,
      cargo_t: draftCargo,
      distance_km: draftDist,
      tkm: draftTkm,
    };
    setShipments(prev => [...prev, s]);
    setDraft({ ...EMPTY_SHIPMENT });
  }, [draft, draftCargo, draftDist, draftTkm, canAddDraft]);

  const removeShipment = useCallback((idx) => {
    setShipments(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const totals = shipments.reduce((acc, s) => {
    const mode = getModeData(s.mode);
    acc.tkm += s.tkm || 0;
    acc.kgco2e += s.tkm && mode ? s.tkm * mode.ef : 0;
    return acc;
  }, { tkm: 0, kgco2e: 0 });

  const parsedDirectKg = parseFloat(String(directTotalKg).replace(',', '.'));
  const canSave = shipments.length > 0
    || canAddDraft
    || (entryMethod !== 'shipment_detail' && !isNaN(parsedDirectKg) && parsedDirectKg > 0);

  const handleSave = async () => {
    if (!reportId) return;
    if (isPreview) {
      setSaveError(tr ? 'Önizleme modunda kaydedilemez. Gerçek rapor başlatın.' : 'Cannot save in preview mode. Start a real report.');
      return;
    }
    let finalShipments = shipments;
    if (canAddDraft && entryMethod === 'shipment_detail') {
      finalShipments = [...shipments, {
        mode: draft.mode, cargo_t: draftCargo, distance_km: draftDist, tkm: draftTkm,
      }];
      setShipments(finalShipments);
      setDraft({ ...EMPTY_SHIPMENT });
    }

    const finalTkm = finalShipments.reduce((s, r) => s + (r.tkm || 0), 0);
    // For non-shipment-detail methods, use the directly entered total emission
    const finalKg  = entryMethod !== 'shipment_detail' && parsedDirectKg > 0
      ? parsedDirectKg
      : finalShipments.reduce((s, r) => {
          const m = getModeData(r.mode);
          return s + (r.tkm && m ? r.tkm * m.ef : 0);
        }, 0);

    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      await saveReportFields(reportId, [
        { field_id: 'rf.k4.entry_method',          value: entryMethod },
        { field_id: 'rf.k4.shipments',             value: finalShipments },
        { field_id: 'rf.k4.total_tkm',             value: Math.round(finalTkm * 10) / 10 },
        { field_id: 'rf.k4.total_emission_kgco2e', value: Math.round(finalKg * 10) / 10 },
        { field_id: 'rf.k4.data_source',           value: dataSource },
        { field_id: 'rf.k4.ef_source',             value: 'GLEC Framework v3' },
      ].filter(f => f.value !== null && f.value !== '' && !(Array.isArray(f.value) && f.value.length === 0)),
      'dashboard');
      setSaved(true);
      if (onSaved) onSaved(['rf.k4.shipments','rf.k4.total_tkm','rf.k4.total_emission_kgco2e']);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError(tr ? 'Kaydetme başarısız. Lütfen tekrar deneyin.' : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
          <Truck className="h-4.5 w-4.5 text-sky-500" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#302817]">
            {tr ? 'Upstream Taşımacılık' : 'Upstream Transport'}
          </p>
          <p className="text-[10px] text-[#302817]/40">
            {tr ? 'Kapsam 3 · Kat.4 · GLEC Framework v3' : 'Scope 3 · Cat.4 · GLEC Framework v3'}
          </p>
        </div>
      </div>

      {/* Giriş Yöntemi */}
      <div className="flex flex-col gap-3">
        <SectionDivider>{tr ? 'Giriş Yöntemi' : 'Entry Method'}</SectionDivider>
        <select
          className={SELECT_CLS}
          value={entryMethod}
          onChange={e => setEntryMethod(e.target.value)}
        >
          {ENTRY_METHODS.map(m => (
            <option key={m.value} value={m.value}>{m.label[lang] || m.label.en}</option>
          ))}
        </select>
      </div>

      {/* Direct total input for GLEC report / invoice methods */}
      {entryMethod !== 'shipment_detail' && (
        <div className="flex flex-col gap-3">
          <SectionDivider>{tr ? 'Toplam Emisyon Girişi' : 'Direct Total Emission'}</SectionDivider>
          <p className="text-[10.5px] text-[#302817]/45 leading-relaxed">
            {tr
              ? 'GLEC raporu veya faturanızdan toplam emisyon değerini girin (kgCO₂e).'
              : 'Enter the total emission from your GLEC report or invoice (kgCO₂e).'}
          </p>
          <FieldRow label={tr ? 'Toplam Emisyon (kgCO₂e)' : 'Total Emission (kgCO₂e)'}>
            <input
              type="number"
              min="0"
              step="0.1"
              className={INPUT_CLS}
              placeholder={tr ? 'Örn: 3316' : 'e.g. 3316'}
              value={directTotalKg}
              onChange={e => setDirectTotalKg(e.target.value)}
            />
          </FieldRow>
          {!isNaN(parsedDirectKg) && parsedDirectKg > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-[#302817]/4 border border-[#302817]/8 px-3 py-2.5">
              <span className="text-xs text-[#302817]/50">{tr ? 'Girilecek değer' : 'Value to save'}</span>
              <span className="text-sm font-bold text-[#302817]">
                {parsedDirectKg >= 1000
                  ? `${(parsedDirectKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`
                  : `${parsedDirectKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kgCO₂e`}
              </span>
            </div>
          )}
        </div>
      )}

      {entryMethod === 'shipment_detail' && (
        <>
          {/* Shipment form */}
          <div className="rounded-2xl border border-[#302817]/8 bg-[#FAFAF8] p-3 flex flex-col gap-3">
            <SectionDivider>{tr ? 'Sevkiyat Ekle' : 'Add Shipment'}</SectionDivider>

            <FieldRow label={tr ? 'Taşıma modu' : 'Transport mode'}>
              <select
                className={SELECT_CLS}
                value={draft.mode}
                onChange={e => setDraft(d => ({ ...d, mode: e.target.value }))}
              >
                {TRANSPORT_MODES.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.modes.map(m => (
                      <option key={m.value} value={m.value}>{m.label[lang] || m.label.en}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </FieldRow>

            <div className="grid grid-cols-2 gap-2">
              <FieldRow label={tr ? 'Yük (ton)' : 'Cargo (tonnes)'}>
                <input
                  type="number" min="0" step="0.01"
                  className={INPUT_CLS}
                  placeholder="e.g. 45"
                  value={draft.cargo_t}
                  onChange={e => setDraft(d => ({ ...d, cargo_t: e.target.value }))}
                />
              </FieldRow>
              <FieldRow label={tr ? 'Mesafe (km)' : 'Distance (km)'}>
                <input
                  type="number" min="0"
                  className={INPUT_CLS}
                  placeholder="e.g. 1200"
                  value={draft.distance_km}
                  onChange={e => setDraft(d => ({ ...d, distance_km: e.target.value }))}
                />
              </FieldRow>
            </div>

            {/* Tonne-km preview */}
            {draftTkm !== null && (
              <div className="flex items-center justify-between rounded-xl bg-white border border-[#302817]/8 px-3 py-2 text-xs">
                <span className="text-[#302817]/45">{tr ? 'Tonne-km (otomatik)' : 'Tonne-km (auto)'}</span>
                <span className="font-bold text-[#302817]">{draftTkm.toLocaleString(undefined, { maximumFractionDigits: 0 })} t·km</span>
              </div>
            )}

            {/* EF box */}
            {draftMode && (
              <div className="flex overflow-hidden rounded-xl border border-[#302817]/8">
                <div className="w-[3px] shrink-0 bg-[#75863B]" />
                <div className="flex-1 bg-white px-3 py-2.5">
                  <p className="text-[9.5px] text-[#302817]/40 mb-0.5">GLEC Framework v3</p>
                  <p className="text-[13px] font-bold text-[#302817]">{draftMode.ef} kgCO₂e/tonne-km</p>
                  <p className="text-[10px] text-[#302817]/40 mt-0.5">
                    {draftMode.label[lang] || draftMode.label.en}
                  </p>
                </div>
              </div>
            )}

            {/* Per-shipment estimate */}
            {draftTkm && draftMode && (() => {
              const kg = draftTkm * draftMode.ef;
              const display = kg >= 1000
                ? `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`
                : `${kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kgCO₂e`;
              return (
                <div className="flex items-center justify-between rounded-xl bg-[#302817]/4 border border-[#302817]/8 px-3 py-2.5">
                  <span className="text-xs text-[#302817]/50">{tr ? 'Bu sevkiyat tahmini' : 'This shipment estimate'}</span>
                  <span className="text-sm font-bold text-[#302817]">{display}</span>
                </div>
              );
            })()}

            {/* Add button */}
            <button
              onClick={addShipment}
              disabled={!canAddDraft}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#302817]/12 py-2 text-xs font-bold text-[#302817]/40 transition hover:border-[#B4BE6A]/50 hover:bg-[#B4BE6A]/5 hover:text-[#302817] disabled:opacity-30"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr ? 'Sevkiyat Ekle' : 'Add Shipment'}
            </button>
          </div>

          {/* Saved shipment list */}
          {shipments.length > 0 && (
            <div className="flex flex-col gap-2">
              <SectionDivider>
                {tr ? `Kaydedilen Sevkiyatlar (${shipments.length})` : `Saved Shipments (${shipments.length})`}
              </SectionDivider>
              {shipments.map((s, i) => (
                <ShipmentRow key={i} s={s} index={i} lang={lang} onRemove={removeShipment} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Veri Kaynağı */}
      <div className="flex flex-col gap-3">
        <SectionDivider>{tr ? 'Veri Kaynağı' : 'Data Source'}</SectionDivider>
        <select
          className={SELECT_CLS}
          value={dataSource}
          onChange={e => setDataSource(e.target.value)}
        >
          <option value="">{tr ? '— Seçin —' : '— Select —'}</option>
          {DATA_SOURCES.map(s => (
            <option key={s.value} value={s.value}>{s.label[lang] || s.label.en}</option>
          ))}
        </select>
      </div>

      {/* Total summary */}
      {(totals.tkm > 0 || (canAddDraft && entryMethod === 'shipment_detail')) && (() => {
        const previewTkm = totals.tkm + (canAddDraft ? (draftTkm || 0) : 0);
        const previewKg  = totals.kgco2e + (canAddDraft && draftMode ? (draftTkm || 0) * draftMode.ef : 0);
        if (previewTkm === 0) return null;
        return (
          <div className="rounded-xl bg-gradient-to-br from-[#95A847]/8 to-[#B4BE6A]/4 border border-[#B4BE6A]/20 px-4 py-3">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#75863B] mb-1">
              {tr ? 'Toplam Kat.4 Emisyonu (GLEC v3)' : 'Total Cat.4 Emission (GLEC v3)'}
            </p>
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-2xl font-bold text-[#302817]">
                {previewKg >= 1000
                  ? (previewKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : previewKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
              <span className="text-xs font-semibold text-[#75863B]">
                {previewKg >= 1000 ? 'tCO₂e' : 'kgCO₂e'}
              </span>
            </div>
            <p className="text-[10px] text-[#302817]/40">
              {previewTkm.toLocaleString(undefined, { maximumFractionDigits: 0 })} tonne-km ·{' '}
              {shipments.length + (canAddDraft ? 1 : 0)} {tr ? 'sevkiyat' : 'shipment(s)'}
            </p>
          </div>
        );
      })()}

      {/* Save error */}
      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 font-medium">
          {saveError}
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={(!canSave && shipments.length === 0) || saving}
        className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold shadow-sm transition ${
          saved
            ? 'bg-[#95A847]/15 border border-[#95A847]/30 text-[#527A1A]'
            : 'bg-[#302817] text-white hover:bg-black disabled:opacity-35'
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
