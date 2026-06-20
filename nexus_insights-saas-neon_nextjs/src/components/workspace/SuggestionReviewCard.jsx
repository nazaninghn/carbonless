'use client';
import { useState } from 'react';
import { CheckCircle2, X, Edit3, Loader2, Flame, Zap, Truck, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';

// ── Category meta ──────────────────────────────────────────────────────────────
const CAT_META = {
  '3A': {
    icon: Flame,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200/60',
    accent: '#f97316',
    label: { tr: 'Kapsam 1 — Sabit Yanma', en: 'Scope 1 — Stationary Combustion' },
    scope: { tr: 'Kapsam 1', en: 'Scope 1' },
  },
  '4A': {
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200/60',
    accent: '#eab308',
    label: { tr: 'Kapsam 2 — Elektrik', en: 'Scope 2 — Electricity' },
    scope: { tr: 'Kapsam 2', en: 'Scope 2' },
  },
  'K4': {
    icon: Truck,
    color: 'text-sky-500',
    bg: 'bg-sky-50',
    border: 'border-sky-200/60',
    accent: '#0ea5e9',
    label: { tr: 'Kapsam 3 — Taşımacılık', en: 'Scope 3 — Transport' },
    scope: { tr: 'Kapsam 3', en: 'Scope 3' },
  },
  'K5': {
    icon: Briefcase,
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-200/60',
    accent: '#8b5cf6',
    label: { tr: 'Kapsam 3 — İş Seyahati', en: 'Scope 3 — Business Travel' },
    scope: { tr: 'Kapsam 3', en: 'Scope 3' },
  },
};

// Format kg to readable string
function fmtEmission(kg) {
  if (!kg || kg <= 0) return { value: '0', unit: 'kgCO₂e', tonnes: null };
  if (kg >= 1000) {
    return {
      value: (kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      unit: 'tCO₂e',
      tonnes: null,
    };
  }
  return {
    value: Math.round(kg).toLocaleString(),
    unit: 'kgCO₂e',
    tonnes: kg >= 100 ? `≈ ${(kg / 1000).toFixed(3)} t` : null,
  };
}

// Friendly label per field_id
const FIELD_LABELS = {
  'rf.3a.fuel_type':              { tr: 'Yakıt türü',            en: 'Fuel type'           },
  'rf.3a.consumption':            { tr: 'Tüketim miktarı',       en: 'Consumption'         },
  'rf.3a.unit':                   { tr: 'Birim',                 en: 'Unit'                },
  'rf.4a.consumption_kwh':        { tr: 'Elektrik tüketimi',     en: 'Electricity'         },
  'rf.4a.emission_factor':        { tr: 'Emisyon faktörü',       en: 'Emission factor'     },
  'rf.4a.supplier':               { tr: 'Tedarikçi',             en: 'Supplier'            },
  'rf.k4.total_emission_kgco2e':  { tr: 'Toplam emisyon',        en: 'Total emission'      },
  'rf.k5.air_domestic_pkm':       { tr: 'İç hat uçuş',          en: 'Domestic flight'     },
  'rf.k5.air_short_haul_pkm':     { tr: 'Kısa mesafe uçuş',     en: 'Short-haul flight'   },
  'rf.k5.air_long_haul_pkm':      { tr: 'Uzun mesafe uçuş',     en: 'Long-haul flight'    },
  'rf.k5.rail_pkm':               { tr: 'Tren seyahati',         en: 'Rail travel'         },
  'rf.k5.total_emission_kgco2e':  { tr: 'Toplam emisyon',        en: 'Total emission'      },
};

function getLabel(fieldId, fallback, lang) {
  const entry = FIELD_LABELS[fieldId];
  if (!entry) return fallback || fieldId;
  return entry[lang] || entry.en || fallback;
}

// Format a field value for display
function displayValue(f, lang) {
  if (Array.isArray(f.value)) return `${f.value.length} ${lang === 'tr' ? 'kayıt' : 'record(s)'}`;
  if (f.value === undefined || f.value === null) return '—';
  if (f.field_id === 'rf.3a.fuel_type') {
    const names = {
      natural_gas: { tr: 'Doğalgaz', en: 'Natural Gas' },
      diesel: { tr: 'Motorin', en: 'Diesel' },
      lpg: { tr: 'LPG', en: 'LPG' },
      fuel_oil: { tr: 'Fuel Oil', en: 'Fuel Oil' },
      coal: { tr: 'Kömür', en: 'Coal' },
      biomass: { tr: 'Biyokütle', en: 'Biomass' },
    };
    return names[f.value]?.[lang] || names[f.value]?.en || String(f.value);
  }
  if (f.field_id === 'rf.4a.supplier') return String(f.value);
  if (typeof f.value === 'number') {
    return f.unit
      ? `${f.value.toLocaleString()} ${f.unit}`
      : f.value.toLocaleString();
  }
  return String(f.value);
}

export function SuggestionReviewCard({ suggestion, onConfirm, onReject, lang = 'en' }) {
  const tr = lang === 'tr';
  const [editing,      setEditing]      = useState(true);
  // Conv-flow and fallback suggestions already have values from the conversation — pre-fill them.
  // AI-backend suggestions start empty so the user reviews before saving.
  const [editedValues, setEditedValues] = useState(() => {
    if (!suggestion?._localFields) return {};
    const init = {};
    (suggestion.fields || []).forEach(f => {
      if (f.value !== undefined && f.value !== null) init[f.field_id] = f.value;
    });
    return init;
  });
  const [showDetails,  setShowDetails]  = useState(true);
  const [loading,      setLoading]      = useState(false);
  const [action,       setAction]       = useState('');
  const isConvFlow = !!suggestion?._localFields;

  if (!suggestion) return null;

  const fields     = suggestion.fields || [];
  const confidence = suggestion.confidence ?? 0;
  const meta       = CAT_META[suggestion.category] || CAT_META['3A'];
  const CatIcon    = meta.icon;

  // Find the primary emission value from fields
  const emissionField = fields.find(f =>
    f.field_id?.includes('total_emission') ||
    f.field_id?.includes('kgco2e') ||
    f.unit === 'kgCO₂e'
  );
  // Prefer user-edited value; fall back to AI/conv-flow computed emKg
  const emittedFieldId = emissionField?.field_id;
  const userEmVal = emittedFieldId ? editedValues[emittedFieldId] : undefined;
  const hasUserEmission = userEmVal !== undefined && userEmVal !== '';
  const emKg = hasUserEmission ? Number(userEmVal) : (suggestion.emKg ?? null);
  const { value: emValue, unit: emUnit, tonnes } = emKg !== null ? fmtEmission(emKg) : { value: '—', unit: '', tonnes: null };

  // Fields to show in detail view (exclude the total emission, show it in hero)
  const detailFields = fields.filter(f => !f.field_id?.includes('total_emission') && !f.field_id?.includes('kgco2e'));
  const hasDetails = detailFields.length > 0;

  const handleConfirm = async () => {
    setLoading(true);
    setAction('confirming');
    const edits = Object.keys(editedValues).length > 0
      ? fields.map(f => ({
          field_id: f.field_id,
          value: editedValues[f.field_id] !== undefined ? editedValues[f.field_id] : f.value,
        }))
      : null;
    await onConfirm(suggestion.id, edits);
    setLoading(false);
    setAction('');
  };

  const handleReject = async () => {
    setLoading(true);
    setAction('rejecting');
    await onReject(suggestion.id);
    setLoading(false);
    setAction('');
  };

  return (
    <div className={`relative rounded-2xl border bg-white overflow-hidden shadow-sm ${meta.border}`}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/90 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#75863B]" />
            <span className="text-[11px] font-semibold text-[#302817]/60">
              {action === 'confirming'
                ? (tr ? 'Rapora kaydediliyor…' : 'Saving to report…')
                : (tr ? 'İptal ediliyor…' : 'Cancelling…')}
            </span>
          </div>
        </div>
      )}

      {/* ── Scope badge + category ── */}
      <div className={`flex items-center gap-2.5 px-4 pt-3.5 pb-2`}>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.bg}`}>
          <CatIcon className={`h-3.5 w-3.5 ${meta.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-[#302817]/80 truncate">
            {meta.label[lang] || meta.label.en}
          </p>
          <p className="text-[9.5px] text-[#302817]/35">
            {isConvFlow
              ? (tr ? 'Sohbetten toplanan veri' : 'Collected from conversation')
              : (tr ? 'AI tarafından çıkarıldı' : 'Extracted by AI')}
            {' · '}
            <span className={confidence >= 0.85 ? 'text-[#527A1A] font-semibold' : confidence >= 0.65 ? 'text-amber-600 font-semibold' : 'text-red-500 font-semibold'}>
              {Math.round(confidence * 100)}% {tr ? 'güven' : 'confidence'}
            </span>
          </p>
          {/* Confidence bar */}
          <div className="mt-1 h-[3px] w-full rounded-full bg-[#302817]/6 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                confidence >= 0.85 ? 'bg-[#75863B]' :
                confidence >= 0.65 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Hero emission number ── */}
      <div className={`mx-3 mb-3 rounded-xl ${meta.bg} border ${meta.border} px-4 py-3 text-center`}>
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#302817]/40 mb-1">
          {tr ? 'Hesaplanan Emisyon' : 'Calculated Emission'}
        </p>
        {emKg === null ? (
          <p className="text-[13px] text-[#302817]/30 py-1">
            {tr ? 'Değerleri girin, toplam hesaplanacak' : 'Enter values to calculate total'}
          </p>
        ) : (
          <div className="flex items-baseline justify-center gap-1.5">
            <span className="text-[32px] font-black text-[#302817] leading-none tabular-nums">
              {emValue}
            </span>
            <span className={`text-[14px] font-bold ${meta.color}`}>{emUnit}</span>
          </div>
        )}
        {tonnes && (
          <p className="text-[10px] text-[#302817]/35 mt-0.5">{tonnes}</p>
        )}
      </div>

      {/* ── Detail fields (collapsible) ── */}
      {hasDetails && (
        <div className="px-3 mb-2">
          <button
            onClick={() => setShowDetails(v => !v)}
            className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#302817]/6 transition text-[10.5px] font-semibold text-[#302817]/45"
          >
            <span>{tr ? 'Kaynak veriler' : 'Source data'}</span>
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showDetails && (
            <div className="mt-1 flex flex-col gap-1.5 pb-1">
              {(editing ? fields : detailFields).map((f) => (
                <div
                  key={f.field_id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[#FAFAF8] border border-[#302817]/6 px-3 py-2"
                >
                  <span className="text-[10px] text-[#302817]/45 shrink-0">
                    {getLabel(f.field_id, f.label, lang)}
                  </span>
                  {editing ? (
                    <input
                      type={typeof f.value === 'number' ? 'number' : 'text'}
                      placeholder={typeof f.value === 'number' ? '0' : '…'}
                      className="flex-1 min-w-0 text-right rounded-md border border-[#302817]/12 bg-white px-2 py-0.5 text-[11px] font-semibold text-[#302817] outline-none focus:border-[#B4BE6A]/60 focus:ring-1 focus:ring-[#B4BE6A]/20 max-w-[120px] ml-auto placeholder:text-[#302817]/20"
                      value={editedValues[f.field_id] !== undefined ? editedValues[f.field_id] : ''}
                      onChange={e => {
                        const raw = e.target.value;
                        const val = typeof f.value === 'number'
                          ? (raw === '' ? '' : (!isNaN(parseFloat(raw)) ? parseFloat(raw) : raw))
                          : raw;
                        setEditedValues(prev => ({ ...prev, [f.field_id]: val }));
                      }}
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-[#302817]">
                      {displayValue(f, lang)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Source citation ── */}
      <div className="mx-3 mb-3 flex items-center gap-1.5">
        <div className="h-px flex-1 bg-[#302817]/6" />
        <span className="text-[9px] text-[#302817]/25 font-semibold">
          DEFRA 2023 / IEA 2023 / GLEC v3
        </span>
        <div className="h-px flex-1 bg-[#302817]/6" />
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-2 px-3 pb-3.5">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#302817] px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-black active:scale-[0.98] disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {tr ? 'Rapora Kaydet' : 'Save to Report'}
        </button>

        <button
          onClick={() => {
            if (!editing) setEditedValues({});  // only reset when STARTING edit (not on Done)
            setEditing(e => !e);
            setShowDetails(true);
          }}
          disabled={loading}
          className="flex items-center gap-1 rounded-xl border border-[#302817]/10 px-3 py-2.5 text-[11px] font-bold text-[#302817]/50 transition hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/8 hover:text-[#302817] disabled:opacity-40"
        >
          <Edit3 className="h-3 w-3" />
          {editing ? (tr ? 'Bitti' : 'Done') : (tr ? 'Düzenle' : 'Edit')}
        </button>

        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center justify-center h-10 w-10 rounded-xl border border-[#302817]/8 text-[#302817]/25 transition hover:border-red-200 hover:bg-red-50 hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
          title={tr ? 'Reddet' : 'Dismiss'}
          aria-label={tr ? 'Reddet' : 'Dismiss'}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
