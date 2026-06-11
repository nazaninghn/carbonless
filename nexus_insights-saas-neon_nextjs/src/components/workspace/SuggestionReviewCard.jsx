'use client';
import { useState } from 'react';
import { CheckCircle2, X, Edit3, ChevronDown, ChevronUp } from 'lucide-react';

const CONFIDENCE_COLOR = (c) => {
  if (c >= 0.85) return 'text-green-600';
  if (c >= 0.65) return 'text-amber-500';
  return 'text-red-400';
};

export function SuggestionReviewCard({ suggestion, onConfirm, onReject, lang = 'en' }) {
  const tr = lang === 'tr';
  const [editing, setEditing] = useState(false);
  const [editedValues, setEditedValues] = useState({});
  const [loading, setLoading] = useState(false);

  if (!suggestion) return null;

  const fields = suggestion.fields || [];

  const handleConfirm = async () => {
    setLoading(true);
    const edits = Object.keys(editedValues).length > 0
      ? fields.map(f => ({
          field_id: f.field_id,
          value: editedValues[f.field_id] !== undefined ? editedValues[f.field_id] : f.value,
        }))
      : null;
    await onConfirm(suggestion.id, edits);
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    await onReject(suggestion.id);
    setLoading(false);
  };

  const CATEGORY_LABELS = {
    '3A': tr ? 'Sabit Yanma (Kapsam 1)' : 'Stationary Combustion (Scope 1)',
    '4A': tr ? 'Elektrik (Kapsam 2)' : 'Electricity (Scope 2)',
    'K4': tr ? 'Yukarı Akış Taşımacılığı (Kapsam 3)' : 'Upstream Transport (Scope 3)',
  };

  return (
    <div className="rounded-2xl border border-[#B4BE6A]/40 bg-[#FAFAF8] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#302817]/6 bg-[#B4BE6A]/8">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-bold text-[#302817]/70 uppercase tracking-wider">
            {tr ? 'AI Önerisi — Onay Gerekli' : 'AI Suggestion — Needs Review'}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#95A847] bg-[#95A847]/10 px-2 py-0.5 rounded-full">
          {CATEGORY_LABELS[suggestion.category] || suggestion.category}
        </span>
      </div>

      {/* Fields table */}
      <div className="px-4 py-3">
        <div className="overflow-hidden rounded-xl border border-[#302817]/8">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#302817]/3 border-b border-[#302817]/6">
                <th className="px-3 py-2 text-left font-semibold text-[#302817]/50">
                  {tr ? 'Alan' : 'Field'}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[#302817]/50">
                  {tr ? 'Değer' : 'Value'}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-[#302817]/50">
                  {tr ? 'Güven' : 'Conf.'}
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => (
                <tr key={f.field_id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#302817]/2'}>
                  <td className="px-3 py-2 text-[#302817]/65 font-medium">{f.label || f.field_id}</td>
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
                        {f.value !== undefined && f.value !== null ? String(f.value) : '—'}
                        {f.unit ? <span className="ml-1 text-[#302817]/40 font-normal">{f.unit}</span> : null}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 font-bold ${CONFIDENCE_COLOR(f.confidence || 0)}`}>
                    {f.confidence ? `${Math.round(f.confidence * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-black disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {tr ? 'Onayla' : 'Confirm'}
        </button>
        <button
          onClick={() => setEditing(e => !e)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-[#302817]/15 px-4 py-2 text-xs font-bold text-[#302817]/60 transition hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/8 hover:text-[#302817] disabled:opacity-40"
        >
          <Edit3 className="h-3.5 w-3.5" />
          {editing ? (tr ? 'Bitti' : 'Done') : (tr ? 'Düzenle' : 'Edit')}
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-xs font-bold text-red-400 transition hover:bg-red-50 disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          {tr ? 'Reddet' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
