'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Briefcase, Plane, Train, Car, Plus, Trash2 } from 'lucide-react';
import { saveReportFields } from '@/lib/workspace/api';

// ── DEFRA 2023 emission factors ───────────────────────────────────────────────
// kg CO₂e per passenger-km (air/rail) or per vehicle-km (car)
const AIR_MODES = [
  {
    id: 'domestic',
    ef: 0.264,
    label: { tr: 'İç Hat Uçuş',       en: 'Domestic Flight'       },
    hint:  { tr: 'Yurt içi hat',        en: 'Within country'        },
    field: 'rf.k5.air_domestic_pkm',
  },
  {
    id: 'short_haul',
    ef: 0.153,
    label: { tr: 'Kısa Mesafe Uçuş',   en: 'Short-Haul Flight'      },
    hint:  { tr: '< 3.700 km',          en: '< 3,700 km'             },
    field: 'rf.k5.air_short_haul_pkm',
  },
  {
    id: 'long_haul',
    ef: 0.195,
    label: { tr: 'Uzun Mesafe Uçuş',   en: 'Long-Haul Flight'       },
    hint:  { tr: '≥ 3.700 km',          en: '≥ 3,700 km'             },
    field: 'rf.k5.air_long_haul_pkm',
  },
];

const GROUND_MODES = [
  {
    id: 'rail',
    ef: 0.035,
    icon: Train,
    label: { tr: 'Tren',               en: 'Rail'                   },
    hint:  { tr: 'Yolcu-km',           en: 'Passenger-km'           },
    field: 'rf.k5.rail_pkm',
    unit:  'pkm',
  },
  {
    id: 'car',
    ef: 0.149,
    icon: Car,
    label: { tr: 'Kiralık Araç / Taksi', en: 'Rental Car / Taxi'    },
    hint:  { tr: 'Araç-km',            en: 'Vehicle-km'             },
    field: 'rf.k5.car_km',
    unit:  'km',
  },
];

const INPUT_CLS =
  'w-full rounded-xl border border-[#302817]/10 bg-white px-3 py-2 text-sm text-[#302817] outline-none ' +
  'placeholder:text-[#302817]/25 focus:border-[#B4BE6A]/50 focus:ring-2 focus:ring-[#B4BE6A]/12 transition-colors';

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

function FieldRow({ label, hint, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-[#302817]/55">
        {label}
        {required && <span className="ml-0.5 text-orange-400">*</span>}
        {hint && <span className="ml-1 font-normal text-[#302817]/30">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

// ── Panel component ───────────────────────────────────────────────────────────
export function BusinessTravelPanel({ reportId, fieldValues = {}, lang = 'en', onSaved, isPreview = false }) {
  const tr = lang === 'tr';

  // Air travel: pkm per mode
  const [airVals, setAirVals] = useState(() =>
    Object.fromEntries(AIR_MODES.map(m => [m.id, fieldValues[m.field] || '']))
  );

  // Ground transport: km per mode
  const [groundVals, setGroundVals] = useState(() =>
    Object.fromEntries(GROUND_MODES.map(m => [m.id, fieldValues[m.field] || '']))
  );

  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [saveError, setSaveError] = useState('');

  // Sync when fieldValues updated externally (AI suggestion confirmed)
  useEffect(() => {
    setAirVals(Object.fromEntries(AIR_MODES.map(m => [m.id, fieldValues[m.field] || ''])));
    setGroundVals(Object.fromEntries(GROUND_MODES.map(m => [m.id, fieldValues[m.field] || ''])));
  }, [fieldValues]);

  // Live emission calculation
  const breakdown = [
    ...AIR_MODES.map(m => {
      const pkm = parseFloat(String(airVals[m.id]).replace(',', '.'));
      return { label: m.label[lang] || m.label.en, ef: m.ef, km: pkm, unit: 'pkm' };
    }),
    ...GROUND_MODES.map(m => {
      const km = parseFloat(String(groundVals[m.id]).replace(',', '.'));
      return { label: m.label[lang] || m.label.en, ef: m.ef, km, unit: m.unit };
    }),
  ].filter(b => !isNaN(b.km) && b.km > 0);

  const totalKg = breakdown.reduce((s, b) => s + b.km * b.ef, 0);
  const hasData = breakdown.length > 0;

  const handleSave = async () => {
    if (!reportId || !hasData) return;
    if (isPreview) {
      setSaveError(tr ? 'Önizleme modunda kaydedilemez. Gerçek rapor başlatın.' : 'Cannot save in preview mode. Start a real report.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      const fields = [
        ...AIR_MODES.map(m => ({
          field_id: m.field,
          value: parseFloat(String(airVals[m.id]).replace(',', '.')) || null,
        })).filter(f => f.value !== null && !isNaN(f.value)),
        ...GROUND_MODES.map(m => ({
          field_id: m.field,
          value: parseFloat(String(groundVals[m.id]).replace(',', '.')) || null,
        })).filter(f => f.value !== null && !isNaN(f.value)),
        { field_id: 'rf.k5.total_emission_kgco2e', value: Math.round(totalKg) },
      ];
      await saveReportFields(reportId, fields, 'dashboard');
      setSaved(true);
      if (onSaved) onSaved(fields.map(f => f.field_id));
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError(tr ? 'Kaydetme başarısız. Tekrar deneyin.' : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50">
          <Briefcase className="h-4 w-4 text-violet-500" />
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#302817]">
            {tr ? 'İş Seyahati' : 'Business Travel'}
          </p>
          <p className="text-[10px] text-[#302817]/40">
            Kapsam 3 · K5 · ISO 14064-1 §5.4
          </p>
        </div>
      </div>

      {/* Air travel */}
      <div className="flex flex-col gap-3">
        <SectionDivider>
          <span className="flex items-center gap-1.5">
            <Plane className="h-3 w-3" />
            {tr ? 'Hava Yolu (yolcu-km)' : 'Air Travel (passenger-km)'}
          </span>
        </SectionDivider>

        {AIR_MODES.map(mode => (
          <FieldRow
            key={mode.id}
            label={mode.label[lang] || mode.label.en}
            hint={mode.hint[lang] || mode.hint.en}
          >
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                className={INPUT_CLS}
                placeholder={tr ? 'Örn: 12000' : 'e.g. 12000'}
                value={airVals[mode.id]}
                onChange={e => setAirVals(prev => ({ ...prev, [mode.id]: e.target.value }))}
              />
              <div className="shrink-0 rounded-lg border border-[#302817]/8 bg-[#FAFAF8] px-2 py-1.5 text-center">
                <p className="text-[8.5px] text-[#302817]/35">DEFRA</p>
                <p className="text-[10px] font-bold text-[#302817]/55">{mode.ef}</p>
                <p className="text-[8px] text-[#302817]/30">kgCO₂e/pkm</p>
              </div>
            </div>
            {(() => {
              const pkm = parseFloat(String(airVals[mode.id]).replace(',', '.'));
              if (isNaN(pkm) || pkm <= 0) return null;
              const kg = pkm * mode.ef;
              return (
                <p className="text-[10.5px] font-semibold text-[#75863B]">
                  → {pkm.toLocaleString('tr-TR')} pkm × {mode.ef} = {kg >= 1000
                    ? `${(kg / 1000).toFixed(2)} tCO₂e`
                    : `${kg.toFixed(0)} kgCO₂e`}
                </p>
              );
            })()}
          </FieldRow>
        ))}
      </div>

      {/* Ground transport */}
      <div className="flex flex-col gap-3">
        <SectionDivider>
          <span className="flex items-center gap-1.5">
            <Train className="h-3 w-3" />
            {tr ? 'Kara / Tren' : 'Ground Transport'}
          </span>
        </SectionDivider>

        {GROUND_MODES.map(mode => {
          const ModeIcon = mode.icon;
          return (
            <FieldRow
              key={mode.id}
              label={
                <span className="flex items-center gap-1">
                  <ModeIcon className="h-3 w-3 text-[#302817]/40" />
                  {mode.label[lang] || mode.label.en}
                </span>
              }
              hint={mode.hint[lang] || mode.hint.en}
            >
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min="0"
                  className={INPUT_CLS}
                  placeholder={tr ? 'Örn: 4000' : 'e.g. 4000'}
                  value={groundVals[mode.id]}
                  onChange={e => setGroundVals(prev => ({ ...prev, [mode.id]: e.target.value }))}
                />
                <div className="shrink-0 rounded-lg border border-[#302817]/8 bg-[#FAFAF8] px-2 py-1.5 text-center">
                  <p className="text-[8.5px] text-[#302817]/35">DEFRA</p>
                  <p className="text-[10px] font-bold text-[#302817]/55">{mode.ef}</p>
                  <p className="text-[8px] text-[#302817]/30">kg/{mode.unit}</p>
                </div>
              </div>
              {(() => {
                const km = parseFloat(String(groundVals[mode.id]).replace(',', '.'));
                if (isNaN(km) || km <= 0) return null;
                const kg = km * mode.ef;
                return (
                  <p className="text-[10.5px] font-semibold text-[#75863B]">
                    → {km.toLocaleString('tr-TR')} {mode.unit} × {mode.ef} = {kg >= 1000
                      ? `${(kg / 1000).toFixed(2)} tCO₂e`
                      : `${kg.toFixed(0)} kgCO₂e`}
                  </p>
                );
              })()}
            </FieldRow>
          );
        })}
      </div>

      {/* Live total */}
      {hasData && (
        <div className="rounded-xl bg-gradient-to-br from-violet-50/80 to-violet-50/30 border border-violet-200/40 px-4 py-3">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-violet-600/70 mb-1">
            {tr ? 'Tahmini Toplam Emisyon (DEFRA 2023)' : 'Estimated Total Emission (DEFRA 2023)'}
          </p>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-bold text-[#302817]">
              {totalKg >= 1000
                ? (totalKg / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
                : totalKg.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs font-semibold text-violet-600">
              {totalKg >= 1000 ? 'tCO₂e' : 'kgCO₂e'}
            </span>
          </div>
          {/* Breakdown mini-bars */}
          <div className="space-y-1.5">
            {breakdown.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-[#302817]/50 w-[130px] truncate">{b.label}</span>
                <div className="flex-1 h-1 rounded-full bg-violet-200/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-400/60"
                    style={{ width: `${totalKg > 0 ? Math.round((b.km * b.ef / totalKg) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-violet-600 w-16 text-right shrink-0">
                  {(() => {
                    const kg = b.km * b.ef;
                    return kg >= 1000
                      ? `${(kg / 1000).toFixed(2)} t`
                      : `${kg.toFixed(0)} kg`;
                  })()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 font-medium">
          {saveError}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!hasData || saving}
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
          tr ? 'Kaydet' : 'Save'
        )}
      </button>
    </div>
  );
}
