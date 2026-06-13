'use client';
import { useState } from 'react';
import { CheckCircle2, X, Edit3, Loader2, Sparkles } from 'lucide-react';

const CONFIDENCE_COLOR = (c) => {
  if (c >= 0.85) return 'text-[#527A1A]';
  if (c >= 0.65) return 'text-amber-600';
  return 'text-red-500';
};

const CONFIDENCE_BG = (c) => {
  if (c >= 0.85) return 'bg-[#95A847]/10 border-[#95A847]/25 text-[#527A1A]';
  if (c >= 0.65) return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-red-50 border-red-200 text-red-600';
};

const CONFIDENCE_BAR = (c) => {
  if (c >= 0.85) return 'bg-[#95A847]';
  if (c >= 0.65) return 'bg-amber-400';
  return 'bg-red-400';
};

const CATEGORY_LABELS = {
  '3A': { tr: 'Sabit Yanma — Kapsam 1',         en: 'Stationary Combustion — Scope 1' },
  '4A': { tr: 'Satın Alınan Elektrik — Kapsam 2', en: 'Purchased Electricity — Scope 2' },
  'K4': { tr: 'Upstream Taşımacılık — Kapsam 3',  en: 'Upstream Transport — Scope 3'    },
  'K5': { tr: 'İş Seyahati — Kapsam 3',           en: 'Business Travel — Scope 3'       },
};

export function SuggestionReviewCard({ suggestion, onConfirm, onReject, lang = 'en' }) {
  const tr = lang === 'tr';
  const [editing,      setEditing]      = useState(false);
  const [editedValues, setEditedValues] = useState({});
  const [loading,      setLoading]      = useState(false);
  const [action,       setAction]       = useState('');

  if (!suggestion) return null;

  const fields     = suggestion.fields || [];
  const confidence = suggestion.confidence;
  const catLabel   = CATEGORY_LABELS[suggestion.category]?.[lang]
                     || CATEGORY_LABELS[suggestion.category]?.en
                     || suggestion.category;

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
    <div className="rounded-2xl border border-[#302817]/10 bg-white overflow-hidden relative shadow-sm">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#75863B]" />
            <span className="text-[11px] font-semibold text-[#302817]/60">
              {action === 'confirming'
                ? (tr ? 'Kaydediliyor…' : 'Saving…')
                : (tr ? 'Reddediliyor…' : 'Rejecting…')}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 bg-[#302817] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#B4BE6A]/20">
            <Sparkles className="h-3.5 w-3.5 text-[#B4BE6A]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white/80">
              {tr ? 'AI Önerisi' : 'AI Suggestion'}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5 truncate">{catLabel}</p>
          </div>
        </div>
        {/* Overall confidence badge */}
        {confidence != null && (
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${CONFIDENCE_BG(confidence)}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${CONFIDENCE_BAR(confidence)}`} />
            {Math.round(confidence * 100)}% {tr ? 'güven' : 'conf.'}
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {fields.map((f, i) => (
          <div
            key={f.field_id}
            className="flex items-start gap-3 rounded-xl bg-[#FAFAF8] border border-[#302817]/6 px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-[#302817]/45 uppercase tracking-wide mb-1">
                {f.label || f.field_id}
                {f.unit && <span className="ml-1 normal-case font-normal">({f.unit})</span>}
              </p>
              {editing ? (
                <input
                  type={typeof f.value === 'number' ? 'number' : 'text'}
                  className="w-full rounded-lg border border-[#302817]/12 bg-white px-2 py-1 text-xs text-[#302817] outline-none focus:border-[#B4BE6A]/50 focus:ring-1 focus:ring-[#B4BE6A]/20"
                  // Controlled value so it resets correctly on toggle
                  value={editedValues[f.field_id] !== undefined ? editedValues[f.field_id] : f.value}
                  onChange={e => {
                    const raw = e.target.value;
                    // Preserve numeric type so backend receives numbers, not strings
                    const val = typeof f.value === 'number'
                      ? (raw === '' ? '' : (parseFloat(raw) ?? raw))
                      : raw;
                    setEditedValues(prev => ({ ...prev, [f.field_id]: val }));
                  }}
                />
              ) : (
                <p className="text-sm font-bold text-[#302817]">
                  {Array.isArray(f.value)
                    ? `${f.value.length} ${tr ? 'kayıt' : 'record(s)'}`
                    : f.value !== undefined && f.value !== null
                      ? String(f.value)
                      : '—'}
                </p>
              )}
            </div>
            {/* Per-field confidence */}
            {f.confidence != null && (
              <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                <span className={`text-[10px] font-bold ${CONFIDENCE_COLOR(f.confidence)}`}>
                  {Math.round(f.confidence * 100)}%
                </span>
                <div className="w-8 h-1 rounded-full bg-[#302817]/8 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CONFIDENCE_BAR(f.confidence)}`}
                    style={{ width: `${Math.round(f.confidence * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {tr ? 'Onayla & Kaydet' : 'Confirm & Save'}
        </button>
        <button
          onClick={() => { setEditing(e => !e); setEditedValues({}); }}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-[#302817]/12 px-3 py-2 text-xs font-bold text-[#302817]/55 transition hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/8 hover:text-[#302817] disabled:opacity-40"
        >
          <Edit3 className="h-3.5 w-3.5" />
          {editing ? (tr ? 'Bitti' : 'Done') : (tr ? 'Düzenle' : 'Edit')}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-[#302817]/10 px-3 py-2 text-xs font-bold text-[#302817]/35 transition hover:border-red-200 hover:bg-red-50 hover:text-red-400 disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          {tr ? 'Reddet' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
