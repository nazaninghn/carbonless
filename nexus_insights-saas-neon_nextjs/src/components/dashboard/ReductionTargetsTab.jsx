'use client';

import { useState } from 'react';
import { api } from '@/lib/utils/api';
import { Plus, Target, X, TrendingDown, Zap, Calendar } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

function fmt(n, d = 1) {
  return parseFloat(n || 0).toLocaleString(undefined, { maximumFractionDigits: d });
}

// ─── Arc Gauge (top-half semicircle) ──────────────────────────────────────────
// cx=50, cy=54, r=46 → top of arc at y=8; viewBox "0 0 100 54" shows top half only
function ArcGauge({ achieved, status }) {
  const r = 46, cx = 50, cy = 54;
  const halfC = Math.PI * r; // ≈ 144.5 — half circumference
  const pct = Math.min(Math.max((achieved || 0) / 100, 0), 1);

  const trackCol = '#302817';
  const progCol =
    status === 'succeeded' ? '#75863B' :
    status === 'on_track'  ? '#95A847' : '#F87171';

  return (
    <svg viewBox="0 0 100 54" className="w-full max-w-[160px] mx-auto overflow-visible">
      {/* Track */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={trackCol} strokeOpacity="0.07"
        strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${halfC} 10000`}
        style={{ transform: `rotate(180deg)`, transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Progress */}
      <circle
        cx={cx} cy={cy} r={r}
        fill="none" stroke={progCol}
        strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${pct * halfC} 10000`}
        style={{
          transform: `rotate(180deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: 'stroke-dasharray 1.1s cubic-bezier(0.4,0,0.2,1)',
        }}
      />
    </svg>
  );
}

// ─── Timeline bar ─────────────────────────────────────────────────────────────
function TimelineBar({ baseYear, targetYear, currentYear, language }) {
  const tr = language === 'tr';
  const total = Math.max(targetYear - baseYear, 1);
  const elapsed = Math.min(Math.max(currentYear - baseYear, 0), total);
  const nowPct = (elapsed / total) * 100;

  return (
    <div className="mt-1">
      <div className="relative h-2 rounded-full bg-[#302817]/6">
        {/* elapsed fill */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#95A847] transition-all duration-700"
          style={{ width: `${nowPct}%` }}
        />
        {/* "now" tick */}
        {nowPct > 0 && nowPct < 100 && (
          <div
            className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-[#302817]/40"
            style={{ left: `${nowPct}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] font-bold text-[#302817]/30">
        <span>{baseYear}</span>
        {nowPct > 5 && nowPct < 95 && (
          <span
            className="absolute text-[9px] font-bold text-[#302817]/50"
            style={{ left: `${nowPct}%`, transform: 'translateX(-50%)' }}
          >
            {tr ? 'şimdi' : 'now'}
          </span>
        )}
        <span>{targetYear}</span>
      </div>
    </div>
  );
}

// ─── Target Card ──────────────────────────────────────────────────────────────
function TargetCard({ tgt, currentKg, language }) {
  const tr = language === 'tr';

  const baseKg     = parseFloat(tgt.base_emissions_kg) || 0;
  const reducePct  = parseFloat(tgt.target_reduction_percent) || 0;
  const targetKg   = baseKg * (1 - reducePct / 100);          // kg CO₂e at target
  const neededKg   = baseKg - targetKg;                        // total reduction needed
  const achievedKg = Math.max(baseKg - currentKg, 0);         // reduction so far
  const achievedPct = neededKg > 0
    ? Math.min((achievedKg / neededKg) * 100, 100)
    : 0;

  const yearsLeft = Math.max(tgt.target_year - CURRENT_YEAR, 0);
  const remainingKg = Math.max(currentKg - targetKg, 0);
  const annualNeededT = yearsLeft > 0 ? (remainingKg / yearsLeft / 1000) : 0;

  const STATUS = {
    on_track:  { bg: 'bg-[#95A847]/12', text: 'text-[#75863B]', label: tr ? 'Yolunda' : 'On Track' },
    succeeded: { bg: 'bg-[#75863B]/15', text: 'text-[#75863B]', label: tr ? 'Başarılı' : 'Succeeded' },
    off_track: { bg: 'bg-red-50',       text: 'text-red-500',   label: tr ? 'Geride'   : 'Off Track' },
  };
  const st = STATUS[tgt.status] ?? STATUS.off_track;

  return (
    <div className="group flex flex-col gap-4 rounded-[1.5rem] border border-[#302817]/10 bg-white/82 p-5 shadow-[0_6px_20px_rgba(48,40,23,0.04)] transition hover:shadow-[0_10px_32px_rgba(48,40,23,0.09)]">

      {/* Title + status */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold leading-tight text-[#302817]">{tgt.title}</h4>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${st.bg} ${st.text}`}>
          {st.label}
        </span>
      </div>

      {/* Arc gauge + center text */}
      <div className="relative flex flex-col items-center">
        <ArcGauge achieved={achievedPct} status={tgt.status} />
        {/* Overlay text centered under the arc opening */}
        <div className="-mt-2 text-center">
          <p className="text-2xl font-bold leading-none tracking-tight text-[#302817]">
            {Math.round(achievedPct)}<span className="text-sm font-bold">%</span>
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-[#302817]/40">
            {tr ? `${reducePct}% hedefine doğru` : `toward ${reducePct}% target`}
          </p>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#F8F8F8] px-2.5 py-2 text-center">
          <p className="text-[9px] font-bold uppercase text-[#302817]/30">{tr ? 'Baz' : 'Base'}</p>
          <p className="mt-0.5 text-xs font-bold text-[#302817]">{fmt(baseKg / 1000)} t</p>
        </div>
        <div className="rounded-xl bg-[#F8F8F8] px-2.5 py-2 text-center">
          <p className="text-[9px] font-bold uppercase text-[#302817]/30">{tr ? 'Şimdi' : 'Now'}</p>
          <p className="mt-0.5 text-xs font-bold text-[#302817]">
            {currentKg > 0 ? `${fmt(currentKg / 1000)} t` : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-[#95A847]/8 px-2.5 py-2 text-center">
          <p className="text-[9px] font-bold uppercase text-[#75863B]/60">{tr ? 'Hedef' : 'Goal'}</p>
          <p className="mt-0.5 text-xs font-bold text-[#75863B]">{fmt(targetKg / 1000)} t</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <TimelineBar
          baseYear={tgt.base_year}
          targetYear={tgt.target_year}
          currentYear={CURRENT_YEAR}
          language={language}
        />
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F8F8F8]/80 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-[#302817]/30" />
          <span className="text-[11px] font-semibold text-[#302817]/50">
            {yearsLeft > 0
              ? `${yearsLeft} ${tr ? 'yıl kaldı' : 'years left'}`
              : (tr ? 'Hedef yılı geçti' : 'Target year passed')}
          </span>
        </div>
        {annualNeededT > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-bold text-[#302817]/60">
              {fmt(annualNeededT)} t/yr
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReductionTargetsTab({
  language, targets, summary, fetchData,
}) {
  const tr = language === 'tr';
  const currentKg = (summary?.total_tonne || 0) * 1000;

  // ── Add target form state ────────────────────────────────────────────────
  const [showForm,   setShowForm]   = useState(false);
  const [title,      setTitle]      = useState('');
  const [baseYear,   setBaseYear]   = useState(new Date().getFullYear() - 1);
  const [tgtYear,    setTgtYear]    = useState(2030);
  const [baseEmit,   setBaseEmit]   = useState('');
  const [reducePct,  setReducePct]  = useState('');
  const [saving,     setSaving]     = useState(false);

  const resetForm = () => {
    setTitle(''); setBaseEmit(''); setReducePct('');
    setBaseYear(new Date().getFullYear() - 1); setTgtYear(2030);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await api.createTarget({
      title,
      base_year: parseInt(baseYear),
      target_year: parseInt(tgtYear),
      base_emissions_kg: parseFloat(baseEmit) * 1000,
      target_reduction_percent: parseFloat(reducePct),
    });
    if (res.ok) { setShowForm(false); resetForm(); fetchData(); }
    setSaving(false);
  };

  // ── Summary KPIs ─────────────────────────────────────────────────────────
  const onTrack   = targets.filter(t => t.status === 'on_track').length;
  const succeeded = targets.filter(t => t.status === 'succeeded').length;
  const offTrack  = targets.filter(t => t.status === 'off_track').length;
  const totalReductionPct = targets.length > 0
    ? (targets.reduce((s, t) => s + (parseFloat(t.target_reduction_percent) || 0), 0) / targets.length).toFixed(0)
    : 0;

  const FIELD = 'h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15';
  const LABEL = 'mb-1.5 block text-xs font-bold text-[#302817]/60';

  return (
    <div className="space-y-3 sm:space-y-4 text-[#302817]">

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-[#302817]/10 bg-gradient-to-br from-[#F9EFE5] via-white to-[#B4BE6A]/8 p-4 shadow-[0_6px_24px_rgba(48,40,23,0.05)] sm:p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#95A847]/8 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#95A847]">
              {tr ? 'Hedef yönetimi' : 'Target management'}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] sm:text-2xl">
              {tr ? 'Azaltma Hedefleri' : 'Reduction Targets'}
            </h1>
            <p className="mt-0.5 text-sm text-[#302817]/55">
              {tr
                ? 'Karbon azaltma taahhütlerinizi takip edin'
                : 'Track your carbon reduction commitments'}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#302817] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr ? 'Hedef Ekle' : 'Add Target'}
          </button>
        </div>
      </div>

      {/* ── KPI strip (only if targets exist) ───────────────────────────── */}
      {targets.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[
            { label: tr ? 'Toplam Hedef' : 'Total Targets', value: targets.length, color: null },
            { label: tr ? 'Yolunda'      : 'On Track',      value: onTrack,   color: '#95A847' },
            { label: tr ? 'Başarılı'     : 'Succeeded',     value: succeeded, color: '#75863B' },
            { label: tr ? 'Geride'       : 'Off Track',     value: offTrack,  color: '#F87171' },
          ].map(k => (
            <div key={k.label} className="relative overflow-hidden rounded-xl border border-[#302817]/7 bg-white/80 px-3 py-2.5">
              {k.color && (
                <div className="absolute left-3 right-3 top-0 h-[3px] rounded-b-full" style={{ backgroundColor: k.color }} />
              )}
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#302817]/40 sm:text-[10px]">{k.label}</p>
              <p className="mt-1 text-xl font-bold leading-none text-[#302817]">{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Overall progress bar (if >1 target) ─────────────────────────── */}
      {targets.length > 1 && (
        <div className="rounded-[1.25rem] border border-[#302817]/8 bg-white/80 px-5 py-4 shadow-[0_4px_16px_rgba(48,40,23,0.04)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold text-[#302817]/60">
              {tr ? 'Ortalama azaltma taahhüdü' : 'Average reduction commitment'}
            </p>
            <span className="text-sm font-bold text-[#75863B]">-{totalReductionPct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#302817]/6">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#95A847] transition-all duration-700"
              style={{ width: `${Math.min(parseFloat(totalReductionPct), 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center gap-4 text-[10px] font-semibold text-[#302817]/35">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#95A847]" />{onTrack} {tr ? 'yolunda' : 'on track'}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#75863B]" />{succeeded} {tr ? 'başarılı' : 'succeeded'}</span>
            {offTrack > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />{offTrack} {tr ? 'geride' : 'off track'}</span>}
          </div>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {targets.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-[#302817]/8 bg-white/80 p-12 text-center shadow-[0_4px_16px_rgba(48,40,23,0.04)]">
          {/* SVG illustration: target with arrow */}
          <svg viewBox="0 0 80 80" className="h-20 w-20 opacity-20" fill="none">
            <circle cx="40" cy="40" r="36" stroke="#302817" strokeWidth="3" />
            <circle cx="40" cy="40" r="24" stroke="#95A847" strokeWidth="3" />
            <circle cx="40" cy="40" r="12" stroke="#75863B" strokeWidth="3" />
            <circle cx="40" cy="40" r="4" fill="#302817" />
            <line x1="65" y1="15" x2="40" y2="40" stroke="#302817" strokeWidth="3" strokeLinecap="round" />
            <polyline points="58,12 65,15 62,22" stroke="#302817" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-base font-bold text-[#302817]">
              {tr ? 'Henüz hedef yok' : 'No targets yet'}
            </p>
            <p className="mt-1 text-sm text-[#302817]/50">
              {tr
                ? 'Karbon azaltma taahhüdünüzü belirleyin ve ilerlemenizi takip edin'
                : 'Set your carbon reduction commitment and track your progress'}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[#302817] px-6 py-3 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr ? 'İlk Hedefinizi Ekleyin' : 'Add Your First Target'}
          </button>
        </div>
      )}

      {/* ── Target cards grid ────────────────────────────────────────────── */}
      {targets.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {targets.map(tgt => (
            <TargetCard
              key={tgt.id}
              tgt={tgt}
              currentKg={currentKg}
              language={language}
            />
          ))}
        </div>
      )}

      {/* ── Trajectory note (if any off track) ──────────────────────────── */}
      {offTrack > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-3.5">
          <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-bold text-amber-800">
              {tr
                ? `${offTrack} hedefte düzeltici aksiyon gerekiyor`
                : `${offTrack} target${offTrack > 1 ? 's' : ''} need corrective action`}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700/70">
              {tr
                ? 'Emisyon azaltma faaliyetlerinizi gözden geçirin ve hızlandırın.'
                : 'Review and accelerate your emission reduction activities.'}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════ ADD TARGET MODAL ════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-md">
          <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#302817]/8 bg-white/94 shadow-[0_20px_60px_rgba(48,40,23,0.14)] backdrop-blur-2xl">

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#302817]/8 px-6 py-4">
              <div>
                <h2 className="text-base font-bold tracking-[-0.02em]">
                  {tr ? 'Yeni Azaltma Hedefi' : 'New Reduction Target'}
                </h2>
                <p className="mt-0.5 text-xs text-[#302817]/45">
                  {tr ? 'Karbon azaltma taahhüdü oluşturun' : 'Create a carbon reduction commitment'}
                </p>
              </div>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#302817]/40 transition hover:bg-[#302817]/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <form id="target-form" onSubmit={handleAdd} className="space-y-4">

                {/* Title */}
                <div>
                  <label className={LABEL}>{tr ? 'Hedef Başlığı' : 'Target Title'} *</label>
                  <input
                    type="text" value={title} onChange={e => setTitle(e.target.value)}
                    placeholder={tr ? 'Örn: 2030 Net Sıfır Hedefi' : 'e.g. 2030 Net Zero Goal'}
                    className={FIELD} required
                  />
                </div>

                {/* Years */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>{tr ? 'Baz Yıl' : 'Base Year'} *</label>
                    <input
                      type="number" min="2000" max="2030"
                      value={baseYear} onChange={e => setBaseYear(e.target.value)}
                      className={FIELD} required
                    />
                  </div>
                  <div>
                    <label className={LABEL}>{tr ? 'Hedef Yıl' : 'Target Year'} *</label>
                    <input
                      type="number" min="2025" max="2060"
                      value={tgtYear} onChange={e => setTgtYear(e.target.value)}
                      className={FIELD} required
                    />
                  </div>
                </div>

                {/* Emissions + reduction */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>{tr ? 'Baz Emisyon (tCO₂e)' : 'Base Emissions (tCO₂e)'} *</label>
                    <input
                      type="number" step="any" min="0"
                      value={baseEmit} onChange={e => setBaseEmit(e.target.value)}
                      placeholder="0.0"
                      className={FIELD} required
                    />
                  </div>
                  <div>
                    <label className={LABEL}>{tr ? 'Azaltma Hedefi (%)' : 'Reduction Target (%)'} *</label>
                    <input
                      type="number" step="any" min="1" max="100"
                      value={reducePct} onChange={e => setReducePct(e.target.value)}
                      placeholder="30"
                      className={FIELD} required
                    />
                  </div>
                </div>

                {/* Live preview */}
                {baseEmit && reducePct && (
                  <div className="rounded-2xl border border-[#95A847]/25 bg-[#95A847]/7 px-4 py-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#75863B]/60">
                      {tr ? 'Önizleme' : 'Preview'}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-[10px] text-[#302817]/40">{tr ? 'Baz' : 'Base'}</p>
                        <p className="text-sm font-bold">{fmt(parseFloat(baseEmit))} t</p>
                      </div>
                      <div className="flex-1 text-center text-xs font-bold text-[#75863B]">
                        → -{reducePct}% →
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-[#302817]/40">{tr ? 'Hedef' : 'Goal'}</p>
                        <p className="text-sm font-bold text-[#75863B]">
                          {fmt(parseFloat(baseEmit) * (1 - parseFloat(reducePct) / 100))} t
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-[#75863B]/60">
                      {tr
                        ? `${baseYear} → ${tgtYear} · ${Math.max(tgtYear - baseYear, 0)} yıllık dönem`
                        : `${baseYear} → ${tgtYear} · ${Math.max(tgtYear - baseYear, 0)}-year period`}
                    </p>
                  </div>
                )}
              </form>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-[#302817]/8 bg-[#F8F8F8]/80 px-6 py-4 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="rounded-full border border-[#302817]/10 bg-white px-5 py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8]"
              >
                {tr ? 'İptal' : 'Cancel'}
              </button>
              <button
                type="submit" form="target-form" disabled={saving}
                className="rounded-full bg-[#302817] px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-60"
              >
                {saving ? '…' : (tr ? 'Hedefi Kaydet' : 'Save Target')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
