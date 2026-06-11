'use client';
import { useState } from 'react';
import { CheckCircle2, X, Edit3, Loader2 } from 'lucide-react';

const CONFIDENCE_COLOR = (c) => {
  if (c >= 0.85) return 'text-green-600';
  if (c >= 0.65) return 'text-amber-500';
  return 'text-red-400';
};

const CONFIDENCE_BG = (c) => {
  if (c >= 0.85) return 'bg-green-50 border-green-200 text-green-700';
  if (c >= 0.65) return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-red-50 border-red-200 text-red-600';
};

const CATEGORY_LABELS = {
  '3A': { tr: 'Sabit Yanma — Kapsam 1',         en: 'Stationary Combustion — Scope 1' },
  '4A': { tr: 'Satın Alınan Elektrik — Kapsam 2', en: 'Purchased Electricity — Scope 2' },
  'K4': { tr: 'Upstream Taşımacılık — Kapsam 3',  en: 'Upstream Transport — Scope 3'    },
};

export function SuggestionReviewCard({ suggestion, onConfirm, onReject, lang = 'en' }) {
  const tr = lang === 'tr';
  const [editing,      setEditing]      = useState(false);
  const [editedValues, setEditedValues] = useState({});
  const [loading,      setLoading]      = useState(false);
  const [action,       setAction]       = useState(''); // 'confirming' | 'rejecting'

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
    <div className="rounded-2xl border border-[#B4BE6A]/40 bg-[#FAFAF8] overflow-hidden relative">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
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
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#302817]/6 bg-[#B4BE6A]/8 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#302817]/70 uppercase tracking-wider">
              {tr ? 'AI Önerisi — Onay Gerekli' : 'AI Suggestion — Needs Review'}
            </p>
            <p className="text-[11px] font-semibold text-[#302817]/50 mt-0.5 truncate">{catLabel}</p>
          </div>
        </div>
        {/* Overall confidence badge */}
        {confidence != null && (
          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${CONFIDENCE_BG(confidence)}`}>
            {Math.round(confidence * 100)}% {tr ? 'güven' : 'conf.'}
          </span>
        )}
      </div>

      {/* Fields table */}
      <div className="px-4 py-3">
        <div className="overflow-hidden rounded-xl border border-[#302817]/8">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#302817]/3 border-b border-[#302817]/6">
                <th className="px-3 py-2 text-left font-semibold text-[#302817]/50 w-[40%]">
                  {tr ? 'Alan' : 'Field'}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[#302817]/50">
                  {tr ? 'Değer' : 'Value'}
                </th>
                <th className="px-3 py-2 text-right font-semibold text-[#302817]/50 w-[50px]">
                  {tr ? 'Güven' : 'Conf.'}
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.field_id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#302817]/2'}>
                  <td className="px-3 py-2 text-[#302817]/65 font-medium leading-tight">
                    {f.label || f.field_id}
                    {f.unit && (
                      <span className="ml-1 text-[9px] text-[#302817]/35 font-normal">({f.unit})</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        type={typeof f.value === 'number' ? 'number' : 'text'}
                        className="w-full rounded-lg border border-[#302817]/15 bg-white px-2 py-1 text-xs text-[#302817] outline-none focus:border-[#B4BE6A]/50"
                        defaultValue={f.value}
                        onChange={e => setEditedValues(prev => ({ ...prev, [f.field_id]: e.target.value }))}
                      />
                    ) : (
                      <span className="font-semibold text-[#302817]">
                        {Array.isArray(f.value)
                          ? `${f.value.length} ${tr ? 'kayıt' : 'record(s)'}`
                          : f.value !== undefined && f.value !== null
                            ? String(f.value)
                            : '—'}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-bold ${CONFIDENCE_COLOR(f.confidence || 0)}`}>
                    {f.confidence ? `${Math.round(f.confidence * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {tr ? 'Onayla & Kaydet' : 'Confirm & Save'}
        </button>
        <button
          onClick={() => { setEditing(e => !e); setEditedValues({}); }}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-[#302817]/15 px-4 py-2 text-xs font-bold text-[#302817]/60 transition hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/8 hover:text-[#302817] disabled:opacity-40"
        >
          <Edit3 className="h-3.5 w-3.5" />
          {editing ? (tr ? 'Bitti' : 'Done') : (tr ? 'Düzenle' : 'Edit')}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-400 transition hover:bg-red-50 disabled:opacity-40 ml-auto"
        >
          <X className="h-3.5 w-3.5" />
          {tr ? 'Reddet' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
