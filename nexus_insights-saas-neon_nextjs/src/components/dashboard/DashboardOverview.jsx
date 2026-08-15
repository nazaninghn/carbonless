'use client';

import { useMemo, useState, useEffect } from 'react';
import useIsomorphicLayoutEffect from '@/lib/hooks/useIsomorphicLayoutEffect';
import useCountUp from '@/lib/hooks/useCountUp';
import { DASHBOARD_ANIM_STYLES } from '@/lib/constants/dashboardAnimations';
import ScopeFlowDiagram from './ScopeFlowDiagram';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Layers,
  Leaf,
  Lock,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  BarChart2,
} from 'lucide-react';
import {
  CATEGORY_LABELS, catLabel,
  MONTHS_TR as MONTHS_TR_SHORT,
  MONTHS_EN as MONTHS_EN_SHORT,
} from '@/lib/constants/emissions';

// ─── Full month names (only needed here for the detailed monthly breakdown) ──
const MONTHS_TR_FULL = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const MONTHS_EN_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── SVG Donut Chart ───────────────────────────────────────────────────────
function DonutChart({ s1, s2, s3, total, tr }) {
  const R = 58, SW = 18;
  const C = 2 * Math.PI * R;
  const cx = 80, cy = 80;

  // Draw-in: segments start fully "unfilled" (dash=0) and animate out to their
  // real share shortly after mount, instead of just appearing at full size.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(t);
  }, []);
  const animatedTotal = useCountUp(total, 900);

  const segs = [
    { label: 'Scope 1', val: s1, color: '#1D9C31' },
    { label: 'Scope 2', val: s2, color: '#2ABD41' },
    { label: 'Scope 3', val: s3, color: '#51D766' },
  ].filter(s => s.val > 0);

  let cum = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={160} height={160} viewBox="0 0 160 160" className="overflow-visible">
          {/* track */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#072C0E" strokeOpacity={0.06} strokeWidth={SW} />
          {segs.map(s => {
            const f = s.val / total;
            const dash = f * C;
            const rot = cum * 360 - 90;
            cum += f;
            return (
              <circle
                key={s.label}
                cx={cx} cy={cy} r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={SW}
                strokeDasharray={`${drawn ? dash : 0} ${C}`}
                strokeLinecap="butt"
                transform={`rotate(${rot} ${cx} ${cy})`}
                style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
              />
            );
          })}
        </svg>
        {/* centre label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-bold leading-none tracking-tight text-[#072C0E]">
            {animatedTotal.toFixed(1)}
          </span>
          <span className="mt-0.5 text-[10px] font-bold text-[#072C0E]/40">tCO2e</span>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
        {[
          { label: 'Scope 1', val: s1, color: '#1D9C31' },
          { label: 'Scope 2', val: s2, color: '#2ABD41' },
          { label: 'Scope 3', val: s3, color: '#51D766' },
        ].filter(s => s.val > 0).map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] font-semibold text-[#072C0E]/60">{s.label}</span>
            <span className="text-[10px] font-bold text-[#072C0E]/35">{s.val.toFixed(1)}t</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Monthly Bar Chart ─────────────────────────────────────────────────────
function MonthlyChart({ monthly, selectedYear, tr }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  // Grow-in: bars start flat and rise to their real height in a left-to-right
  // cascade shortly after mount, instead of appearing at full height instantly.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);
  // Memoized so the spread+map only runs when monthly data changes, not on every hover state update
  const maxKg = useMemo(() => Math.max(...(monthly ?? []).map(m => m.total_kg), 1), [monthly]);
  const months = tr ? MONTHS_TR_SHORT : MONTHS_EN_SHORT; // module-level  -  no recreation
  const curMonth = new Date().getFullYear() === selectedYear ? new Date().getMonth() : -1;

  if (!monthly || !monthly.some(m => m.total_kg > 0)) {
    return (
      <EmptyState label={tr ? 'Henüz aylık veri yok' : 'No monthly data yet'} />
    );
  }

  return (
    <div className="flex h-44 items-end gap-[3px] sm:gap-1.5">
      {monthly.map((m, i) => {
        const pct = (m.total_kg / maxKg) * 100;
        const hasData = m.total_kg > 0;
        const isHovered = hoveredIdx === i;
        const isCur = i === curMonth;
        // Use m.month (1-12 from API) as stable key; fall back to index for safety
        return (
          <div
            key={m.month ?? i}
            className="group/bar relative flex flex-1 flex-col items-center gap-1"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Tooltip */}
            {isHovered && hasData && (
              <div className="absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#072C0E] px-2 py-1.5 text-[10px] font-bold text-white shadow-xl">
                {(m.total_kg / 1000).toFixed(2)} tCO2e
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#072C0E]" />
              </div>
            )}
            {/* Bar container */}
            <div className="relative h-36 w-full">
              <div
                className={`absolute inset-x-0 bottom-0 rounded-t-md transition-all ${isHovered ? 'scale-x-110' : ''} ${
                  hasData
                    ? isCur
                      ? 'bg-gradient-to-t from-[#1A6126] to-[#2ABD41]'
                      : isHovered
                      ? 'bg-gradient-to-t from-[#1D9C31] to-[#51D766]'
                      : 'bg-gradient-to-t from-[#1D9C31] to-[#2ABD41]'
                    : 'bg-[#072C0E]/4'
                }`}
                style={{
                  height: `${grown ? (hasData ? Math.max(pct, 5) : 4) : 0}%`,
                  transitionProperty: 'height, transform, background',
                  transitionDuration: '600ms, 200ms, 300ms',
                  transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${i * 35}ms`,
                }}
              />
            </div>
            <span className={`text-[9px] font-bold sm:text-[10px] transition-colors ${isCur ? 'text-[#072C0E]' : 'text-[#072C0E]/30'}`}>
              {months[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Category Breakdown ────────────────────────────────────────────────────
function CategoryChart({ entries, tr }) {
  const data = useMemo(() => {
    const map = {};
    (entries ?? []).forEach(e => {
      const cat = e.emission_factor?.category || e.category || 'unknown';
      map[cat] = (map[cat] || 0) + (parseFloat(e.calculated_co2e_kg) || 0);
    });
    return Object.entries(map)
      .map(([cat, kg]) => ({ cat, tonne: kg / 1000 }))
      .sort((a, b) => b.tonne - a.tonne)
      .slice(0, 6);
  }, [entries]);

  if (data.length === 0) return <EmptyState label={tr ? 'Kategori verisi yok' : 'No category data'} />;

  const maxT = data[0].tonne;
  const scopeColors = ['#1D9C31', '#2ABD41', '#51D766', '#072C0E', '#51D766', '#2ABD41'];

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.tonne / maxT) * 100;
        return (
          <div key={d.cat}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-bold text-[#072C0E]/80">{catLabel(d.cat, tr)}</span>
              <span className="shrink-0 text-[10px] font-bold text-[#072C0E]/40">{d.tonne.toFixed(2)}t</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#072C0E]/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: scopeColors[i % scopeColors.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Target Progress Ring ──────────────────────────────────────────────────
function TargetRing({ target, currentTonne, tr }) {
  const R = 32, SW = 7;
  const C = 2 * Math.PI * R;
  const cx = 40, cy = 40;

  const baseKg = parseFloat(target.base_emissions_kg) || 0;
  const currentKg = currentTonne * 1000;
  const reductionPct = baseKg > 0
    ? Math.max(0, Math.min(100, ((baseKg - currentKg) / baseKg) * 100))
    : 0;
  const goalPct = parseFloat(target.target_reduction_percent) || 1;
  const progress = Math.min(reductionPct / goalPct, 1);
  const dash = progress * C;

  const STATUS = {
    on_track:  { color: '#2ABD41', bg: 'bg-[#2ABD41]/12', text: 'text-[#1D9C31]', label: { tr: 'Yolunda', en: 'On Track' } },
    off_track: { color: '#f59e0b', bg: 'bg-amber-100',    text: 'text-amber-700', label: { tr: 'Geride',  en: 'Off Track' } },
    succeeded: { color: '#1D9C31', bg: 'bg-[#1D9C31]/12', text: 'text-[#1D9C31]', label: { tr: 'Başarıldı',en: 'Succeeded'} },
    failed:    { color: '#ef4444', bg: 'bg-red-100',      text: 'text-red-600',   label: { tr: 'Başarısız',en: 'Failed' } },
  };
  const s = STATUS[target.status] ?? STATUS.on_track;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#072C0E]/6 bg-white px-3 py-2.5">
      {/* Ring */}
      <div className="relative shrink-0">
        <svg width={80} height={80} viewBox="0 0 80 80">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#072C0E" strokeOpacity={0.06} strokeWidth={SW} />
          <circle
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={SW}
            strokeDasharray={`${dash} ${C}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.9s ease' }}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-bold leading-none text-[#072C0E]">{(progress * 100).toFixed(0)}%</span>
          <span className="text-[9px] font-semibold text-[#072C0E]/40">{tr ? 'tamamlandı' : 'done'}</span>
        </div>
      </div>
      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold text-[#072C0E]">{target.title}</p>
        <p className="text-[10px] text-[#072C0E]/45 mt-0.5">{target.base_year} {"→"} {target.target_year}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${s.bg} ${s.text}`}>
            {s.label[tr ? 'tr' : 'en']}
          </span>
          <span className="text-[9px] text-[#072C0E]/35">-{target.target_reduction_percent}% {tr ? 'hedef' : 'target'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────
function EmptyState({ label }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl bg-[#072C0E]/3">
      <p className="text-xs font-semibold text-[#072C0E]/35">{label}</p>
    </div>
  );
}

// ─── Chart Card wrapper ────────────────────────────────────────────────────
function ChartCard({ title, subtitle, icon: Icon, iconBg, children, className = '', action, delay = 0 }) {
  return (
    <section
      className={`dash-fade-up group flex flex-col rounded-[1.5rem] border border-[#072C0E]/8 bg-white p-4 shadow-[0_4px_20px_rgba(7,44,14,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(7,44,14,0.10)] hover:border-[#2ABD41]/25 sm:p-5 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 sm:h-9 sm:w-9 ${iconBg}`}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-[13px] font-bold text-[#072C0E] sm:text-sm">{title}</h2>
          {subtitle && <p className="text-[10px] text-[#072C0E]/40">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
// `value` is a raw number — the card animates it counting up itself, so callers
// no longer pre-format with .toFixed() (see call sites below).
function KPICard({ title, value, decimals = 2, unit, subtitle, accent, icon: Icon, topColor, delay = 0 }) {
  const animated = useCountUp(value, 900);
  return (
    <div
      className={`dash-fade-up group relative overflow-hidden rounded-[1.25rem] border p-3.5 transition-all duration-300 hover:-translate-y-1 sm:p-4 ${
        accent
          ? 'border-[#2ABD41] bg-[#DEFAE1] hover:shadow-[0_14px_30px_rgba(42,189,65,0.20)]'
          : 'border-[#DEFAE1] bg-white hover:shadow-[0_14px_30px_rgba(7,44,14,0.08)] hover:border-[#2ABD41]/30'
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top accent bar — brightens on hover for a subtle "alive" cue */}
      {topColor && (
        <div
          className="absolute inset-x-0 top-0 h-[3px] opacity-40 transition-opacity duration-300 group-hover:opacity-100"
          style={{ backgroundColor: topColor }}
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#072C0E]/40 sm:text-[10px]">{title}</p>
          <div className="mt-1 flex items-end gap-1">
            <span className="text-[18px] font-bold leading-none tracking-tight text-[#072C0E] tabular-nums sm:text-[22px]">
              {animated.toFixed(decimals)}
            </span>
            <span className="mb-0.5 text-[9px] font-bold text-[#072C0E]/35 sm:text-[10px]">{unit}</span>
          </div>
          {subtitle && <p className="mt-1 text-[9px] font-semibold text-[#072C0E]/40 sm:text-[10px]">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 sm:h-8 sm:w-8 ${
            accent ? 'bg-[#B2F2BB] text-[#1A7B2A]' : 'bg-[#EBEBEB] text-[#072C0E]'
          }`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function DashboardOverview({
  language,
  selectedYear,
  summary,
  entries,
  targets,
  facilityList,
  questionnaireProfile,
  setActiveTab,
  setShowAddForm,
}) {
  const tr = language === 'tr';
  const totalTonne = summary?.total_tonne  ?? 0;
  const s1         = summary?.scope1_tonne ?? 0;
  const s2         = summary?.scope2_tonne ?? 0;
  const s3         = summary?.scope3_tonne ?? 0;
  // Memoized so the array reference is stable  -  prevents false "dep changed every
  // render" warnings in the useMemo hooks below that depend on monthly.
  const monthly    = useMemo(() => summary?.monthly ?? [], [summary?.monthly]);

  // Derived: average monthly (only months with data)  -  memoized so the filter/reduce
  // only re-runs when monthly data changes, not on every local state update.
  const avgTonne = useMemo(() => {
    const active = monthly.filter(m => m.total_kg > 0);
    return active.length > 0
      ? active.reduce((a, m) => a + m.total_kg, 0) / active.length / 1000
      : 0;
  }, [monthly]);

  // Language-aware month name arrays (used in JSX, not inside any memo)
  const MONTHS_FULL = tr ? MONTHS_TR_FULL : MONTHS_EN_FULL;

  // Biggest monthly spike  -  memoized so it only recomputes when monthly data changes.
  // Returns a numeric index into `monthly`; the name lookup uses MONTHS_FULL at render time.
  const peakMonth = useMemo(
    () => monthly.reduce((best, m, i) => m.total_kg > (monthly[best]?.total_kg ?? 0) ? i : best, 0),
    [monthly],
  );

  // Touch-tablet simplified view  -  useLayoutEffect runs before browser paint,
  // so GPU-heavy complex view is never painted to screen on Android tablets.
  const [isAndroidTablet, setIsAndroidTablet] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    setIsAndroidTablet(isTouch && window.innerWidth >= 768);
  }, []);

  // Gates the Targets progress-bar grow-in — starts at 0% and animates to its
  // real width shortly after mount, same "alive on arrival" treatment as the
  // donut/bar charts above.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  if (isAndroidTablet) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#2ABD41]">
            {tr ? 'Karbon çalışma alanı' : 'Carbon workspace'}
          </p>
          <h1 className="mt-2 text-2xl font-black text-[#072C0E]">
            {tr ? 'Emisyon Profili' : 'Emission Profile'} · {selectedYear}
          </h1>
          <p className="mt-1 text-sm text-[#072C0E]/55">
            {tr ? 'Toplam' : 'Total'}: {totalTonne.toFixed(2)} tCO2e
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
            <p className="text-xs text-[#072C0E]/50">Scope 1</p>
            <p className="text-2xl font-black text-[#072C0E]">{s1.toFixed(2)} <span className="text-sm font-normal">tCO2e</span></p>
          </div>
          <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
            <p className="text-xs text-[#072C0E]/50">Scope 2</p>
            <p className="text-2xl font-black text-[#072C0E]">{s2.toFixed(2)} <span className="text-sm font-normal">tCO2e</span></p>
          </div>
          <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
            <p className="text-xs text-[#072C0E]/50">Scope 3</p>
            <p className="text-2xl font-black text-[#072C0E]">{s3.toFixed(2)} <span className="text-sm font-normal">tCO2e</span></p>
          </div>
        </div>
        <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
          <h2 className="text-sm font-bold text-[#072C0E]">{tr ? 'Başlangıç Rehberi' : 'Getting Started'}</h2>
          <div className="mt-3 space-y-2">
            {[
              { done: !!questionnaireProfile?.is_complete, label: tr ? 'Anketi tamamla' : 'Complete questionnaire' },
              { done: entries.length > 0, label: tr ? 'Emisyon verisi gir' : 'Enter emission data' },
              { done: targets.length > 0, label: tr ? 'Hedef belirle' : 'Set target' },
              { done: facilityList.length > 0, label: tr ? 'Tesis ekle' : 'Add facility' },
            ].map((s, i) => (
              <p key={i} className={`text-sm ${s.done ? 'text-[#2ABD41] line-through' : 'text-[#072C0E]/70'}`}>
                {s.done ? '✓' : `${i+1}.`} {s.label}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <style>{DASHBOARD_ANIM_STYLES}</style>

      {/* ── EMPTY STATE  -  when no data yet ─────────────────────────── */}
      {entries.length === 0 && (
        <div className="rounded-2xl border border-[#DEFAE1] bg-gradient-to-b from-[#F1FCF2]/60 to-white p-6 pb-8 sm:p-10 sm:pb-12 overflow-hidden">
          {/* Scope 1/2/3 explainer — custom image */}
          <div className="dash-fade-up mb-6">
            <img src="/scope-diagram.png" alt="GHG Protocol Scopes" className="w-[70%] sm:w-[60%] max-w-[500px] h-auto rounded-xl mx-auto" />
          </div>

          <div className="mx-auto max-w-lg flex flex-col items-center text-center gap-6">
            {/* Text */}
            <div className="dash-fade-up" style={{ animationDelay: '60ms' }}>
              <h2 className="text-[21px] font-bold text-[#072C0E]">
                {tr
                  ? 'Karbon ayak izinizi birlikte çıkaralım'
                  : "Let's map out your carbon footprint"}
              </h2>
              <p className="mt-2 text-[14px] text-[#072C0E]/50 leading-relaxed max-w-md">
                {tr
                  ? 'İlk verinizi girin, gerisini biz hesaplayalım. AI ile konuşarak (önerilen) veya bu panelden manuel olarak — her iki yol da aynı yere kaydedilir.'
                  : "Log your first entry and we'll take it from there. Talk to AI (recommended) or add it manually — both save to the same place."}
              </p>
            </div>

            {/* Action buttons — two equal ghost pills, icon in a colored badge */}
            <div className="dash-fade-up flex flex-col sm:flex-row gap-3 w-full max-w-sm" style={{ animationDelay: '120ms' }}>
              <button
                onClick={() => setActiveTab('ai_carbon')}
                className="flex-1 flex items-center justify-center gap-2 rounded-full border border-[#2ABD41] bg-[#F1FCF2] px-5 py-3 text-[13px] font-semibold text-[#175022] hover:bg-[#DEFAE1] transition"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#2ABD41] text-white">
                  <Sparkles className="h-3 w-3" />
                </span>
                {tr ? 'AI ile Başla' : 'Start with AI'}
              </button>
              <button
                onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }}
                className="flex-1 flex items-center justify-center gap-2 rounded-full border border-[#DEFAE1] bg-white px-5 py-3 text-[13px] font-semibold text-[#072C0E] hover:border-[#072C0E]/25 transition"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#F1FCF2] text-[#175022]">
                  <Plus className="h-3 w-3" />
                </span>
                {tr ? 'Manuel Giriş' : 'Manual Entry'}
              </button>
            </div>

            {/* How it works — connected as a journey (dotted line + arrows)
                instead of three disconnected boxes. */}
            <div className="dash-fade-up flex flex-col sm:flex-row items-stretch gap-0 w-full mt-2" style={{ animationDelay: '180ms' }}>
              {(tr ? [
                { step: '1', title: 'Veri Girin', desc: 'AI\'a söyleyin veya formdan girin' },
                { step: '2', title: 'Otomatik Hesaplama', desc: 'ISO 14064-1 uyumlu hesap' },
                { step: '3', title: 'Rapor Alın', desc: 'PDF veya Excel dışa aktarma' },
              ] : [
                { step: '1', title: 'Enter Data', desc: 'Tell AI or use the form' },
                { step: '2', title: 'Auto Calculate', desc: 'ISO 14064-1 compliant' },
                { step: '3', title: 'Get Report', desc: 'PDF or Excel export' },
              ]).map(({ step, title, desc }, i, arr) => (
                <div key={step} className="flex items-stretch flex-1">
                  <div className="flex-1 rounded-xl bg-[#F1FCF2] border border-[#DEFAE1] p-3 text-center">
                    <div className="h-6 w-6 rounded-full bg-[#2ABD41]/10 flex items-center justify-center mx-auto mb-2">
                      <span className="text-[10px] font-bold text-[#2ABD41]">{step}</span>
                    </div>
                    <p className="text-[12px] font-semibold text-[#072C0E]">{title}</p>
                    <p className="text-[10px] text-[#072C0E]/40 mt-0.5">{desc}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="hidden sm:flex items-center justify-center px-1.5 shrink-0">
                      <ChevronRight className="h-4 w-4 text-[#2ABD41]/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION HEADER (WF-03 style) ────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#072C0E]/35">
            {selectedYear} {tr ? 'Özet' : 'Summary'}
          </p>
          <h1 className="mt-0.5 text-base font-bold text-[#072C0E] sm:text-[17px]">
            {tr ? 'Ana Dashboard' : 'Main Dashboard'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2ABD41] px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#1D9C31]"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr ? 'Veri Ekle' : 'Add Data'}
          </button>
          <button
            onClick={() => setActiveTab('reporting')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#072C0E]/10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#072C0E]/60 transition hover:border-[#072C0E]/20"
          >
            {tr ? 'Rapor' : 'Report'}
          </button>
        </div>
      </div>

      {/* AI insight strip  -  shown only when data exists */}
      {totalTonne > 0 && (
        <div className="dash-fade-up flex items-start gap-2.5 rounded-xl border border-[#2ABD41]/20 bg-[#F1FCF2]/60 px-3.5 py-2.5">
          <span className="relative mt-0.5 shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-[#2ABD41]" />
            <span className="dash-pulse-dot absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#2ABD41]" />
          </span>
          <p className="text-[11px] font-semibold leading-5 text-[#072C0E]/65">
            {tr
              ? `Toplam ${totalTonne.toFixed(1)} tCO2e kaydedildi  -  en yüksek ay ${MONTHS_TR_FULL[peakMonth]}. Aylık ortalama ${avgTonne.toFixed(2)} tCO2e.`
              : `Total ${totalTonne.toFixed(1)} tCO2e recorded  -  peak month ${MONTHS_EN_FULL[peakMonth]}. Monthly average ${avgTonne.toFixed(2)} tCO2e.`}
          </p>
        </div>
      )}

      {/* ── QUESTIONNAIRE BANNER ─────────────────────────────────────── */}
      {questionnaireProfile && !questionnaireProfile.is_complete && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs font-semibold text-amber-800">
            {tr
              ? 'Karbon envanteri anketi tamamlanmadı  -  AI Carbon sekmesinden devam edin.'
              : 'Carbon inventory questionnaire incomplete  -  continue from the AI Carbon tab.'}
          </p>
          <button
            onClick={() => setActiveTab('ai_carbon')}
            className="ml-auto shrink-0 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold text-white transition hover:bg-amber-600"
          >
            {tr ? 'Devam' : 'Continue'}
          </button>
        </div>
      )}

      {/* ── KPI CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <KPICard title={tr ? 'Toplam' : 'Total'} value={totalTonne} unit="tCO2e" accent icon={Leaf} delay={0} />
        <KPICard title="Scope 1" value={s1} unit="tCO2e" subtitle={tr ? 'Doğrudan' : 'Direct'} topColor="#1D9C31" delay={60} />
        <KPICard title="Scope 2" value={s2} unit="tCO2e" subtitle={tr ? 'Enerji' : 'Energy'} topColor="#2ABD41" delay={120} />
        <KPICard title="Scope 3" value={s3} unit="tCO2e" subtitle={tr ? 'Dolaylı' : 'Indirect'} topColor="#51D766" delay={180} />
      </div>

      {/* ── ROW 2: Monthly trend + Scope donut ──────────────────────── */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-[1fr_300px]">

        {/* Monthly Trend */}
        <ChartCard
          title={tr ? 'Aylık Emisyon Trendi' : 'Monthly Emission Trend'}
          subtitle={String(selectedYear)}
          icon={TrendingDown}
          iconBg="bg-[#2ABD41] text-white"
          delay={240}
        >
          <MonthlyChart monthly={monthly} selectedYear={selectedYear} tr={tr} />
        </ChartCard>

        {/* Scope Donut */}
        <ChartCard
          title={tr ? 'Kapsam Dağılımı' : 'Scope Distribution'}
          subtitle={totalTonne > 0 ? `${totalTonne.toFixed(1)} tCO2e` : undefined}
          icon={Layers}
          iconBg="bg-[#51D766]/20 text-[#1D9C31]"
          delay={300}
        >
          {totalTonne > 0 ? (
            <div className="flex h-full items-center justify-center py-1">
              <DonutChart s1={s1} s2={s2} s3={s3} total={totalTonne} tr={tr} />
            </div>
          ) : (
            <EmptyState label={tr ? 'Veri ekleyin' : 'Add data to see distribution'} />
          )}
        </ChartCard>
      </div>

      {/* ── ROW 3: Benchmark + Pending Actions + Targets (WF-03 3-col) ── */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-3">

        {/* Benchmark mini (WF-03) */}
        <ChartCard
          title={tr ? 'Sektör Benchmarkı' : 'Sector Benchmark'}
          subtitle={tr ? 'Anonim karşılaştırma' : 'Anonymous comparison'}
          icon={BarChart2}
          iconBg="bg-[#2ABD41]/15 text-[#2ABD41]"
          action={<button onClick={() => setActiveTab('benchmark')} className="text-[11px] font-semibold text-[#2ABD41] hover:underline">{tr ? 'Detay ->' : 'Detail ->'}</button>}
          delay={360}
        >
          {totalTonne > 0 ? (
            <div className="space-y-3">
              {/* This mini chart used a fixed 48%/60% marker position and a
                  fixed "Below sector average" claim regardless of the user's
                  actual data — misleadingly definitive, since there's no real
                  sourced industry dataset behind it yet (see BenchmarkTab.jsx's
                  disclaimer for the full-page version of this same issue).
                  Kept as a purely illustrative bar (no position marker, no
                  comparative verdict) until real sector data is connected. */}
              <div className="relative h-5 overflow-hidden rounded-full bg-[#072C0E]/6">
                {/* Low zone */}
                <div className="absolute left-0 top-0 h-full w-[36%] rounded-l-full bg-[#F1FCF2]" />
                {/* Mid zone */}
                <div className="absolute top-0 h-full bg-[#51D766]/40" style={{ left: '36%', width: '28%' }} />
                {/* High zone */}
                <div className="absolute top-0 h-full rounded-r-full bg-amber-100" style={{ left: '64%', width: '36%' }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#072C0E]/45">
                <span>{tr ? 'Düşük' : 'Low'}</span>
                <span className="font-semibold text-[#072C0E]/40">{tr ? 'Örnek karşılaştırma' : 'Sample comparison'}</span>
                <span>{tr ? 'Yüksek' : 'High'}</span>
              </div>
              <button
                onClick={() => setActiveTab('benchmark')}
                className="flex w-full items-center justify-between rounded-lg bg-[#F1FCF2] px-3 py-2 text-[11px] font-semibold text-[#1D9C31] transition hover:bg-[#51D766]/30"
              >
                <span>{tr ? 'Tam benchmark raporu' : 'Full benchmark report'}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex h-20 flex-col items-center justify-center gap-1.5">
              <p className="text-[11px] font-semibold text-[#072C0E]/35">{tr ? 'Veri girilince görünür' : 'Visible once data is entered'}</p>
              <button onClick={() => setActiveTab('emissions')} className="text-[11px] font-bold text-[#2ABD41] hover:underline">{tr ? 'Veri ekle ->' : 'Add data ->'}</button>
            </div>
          )}
        </ChartCard>

        {/* Pending Actions (WF-03) */}
        <ChartCard
          title={tr ? 'Bekleyen Aksiyonlar' : 'Pending Actions'}
          subtitle={tr ? 'Tamamlanması gerekenler' : 'Items requiring attention'}
          icon={AlertTriangle}
          iconBg="bg-amber-50 text-amber-500"
          delay={420}
        >
          <div className="space-y-1.5">
            {[
              {
                dot: 'bg-[#2ABD41]',
                done: !!questionnaireProfile?.is_complete,
                tr: 'CarbonIQ anketi tamamlanmadı',
                en: 'CarbonIQ questionnaire incomplete',
                tab: 'ai_carbon',
              },
              {
                dot: entries.length === 0 ? 'bg-red-400' : 'bg-[#2ABD41]',
                done: entries.length > 0,
                tr: 'Emisyon verisi eksik',
                en: 'No emission data entered',
                tab: 'emissions',
              },
              {
                dot: targets.length === 0 ? 'bg-amber-400' : 'bg-[#2ABD41]',
                done: targets.length > 0,
                tr: 'Azaltım hedefi belirlenmedi',
                en: 'No reduction target set',
                tab: 'reduction',
              },
              {
                dot: facilityList.length === 0 ? 'bg-[#072C0E]/25' : 'bg-[#2ABD41]',
                done: facilityList.length > 0,
                tr: 'Tesis bilgisi eksik',
                en: 'No facility added',
                tab: 'settings',
              },
            ].map((item) => (
              !item.done && (
                <button
                  key={item.en}
                  onClick={() => setActiveTab(item.tab)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-[#072C0E]/4"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                  <span className="flex-1 text-left text-[11px] font-semibold text-[#072C0E]/70">{tr ? item.tr : item.en}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#072C0E]/25" />
                </button>
              )
            ))}
            {/* All done state */}
            {[questionnaireProfile?.is_complete, entries.length > 0, targets.length > 0, facilityList.length > 0].every(Boolean) && (
              <div className="flex h-20 flex-col items-center justify-center gap-1.5">
                <CheckCircle2 className="h-6 w-6 text-[#2ABD41]" />
                <p className="text-[11px] font-semibold text-[#072C0E]/50">{tr ? 'Tüm aksiyonlar tamamlandı' : 'All actions complete'}</p>
              </div>
            )}
          </div>
        </ChartCard>

        {/* Targets (WF-03) */}
        <ChartCard
          title={tr ? 'Hedefler' : 'Targets'}
          subtitle={tr ? 'Azaltım ilerleme durumu' : 'Reduction progress'}
          icon={Target}
          iconBg="bg-[#51D766]/20 text-[#1D9C31]"
          action={<button onClick={() => setActiveTab('reduction')} className="text-[11px] font-semibold text-[#2ABD41] hover:underline">{tr ? 'Tümü ->' : 'All ->'}</button>}
          delay={480}
        >
          {targets.length === 0 ? (
            <div className="flex h-24 flex-col items-center justify-center gap-2">
              <p className="text-[11px] font-semibold text-[#072C0E]/35">{tr ? 'Henüz hedef yok' : 'No targets yet'}</p>
              <button
                onClick={() => setActiveTab('reduction')}
                className="rounded-full border border-[#2ABD41]/30 px-3 py-1 text-[11px] font-bold text-[#1D9C31] transition hover:bg-[#2ABD41]/8"
              >
                {tr ? '+ Hedef ekle' : '+ Add target'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {targets.slice(0, 3).map(t => {
                const targetTonne = t.target_tonne || 0;
                const baseTonne   = t.base_tonne   || totalTonne || 1;
                const reduction   = baseTonne - targetTonne;
                const pct = Math.min(Math.max(Math.round((reduction > 0 ? (baseTonne - totalTonne) / reduction : 0) * 100), 0), 100);
                return (
                  <div key={t.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#072C0E]/70">{t.target_year || ' - '} {tr ? 'hedefi' : 'target'}</span>
                      <span className="text-[11px] font-bold text-[#1D9C31]">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#072C0E]/6">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1D9C31] to-[#51D766] transition-all duration-700 ease-out"
                        style={{ width: `${mounted ? pct : 0}%` }}
                      />
                    </div>
                    <div className="mt-0.5 flex justify-between text-[10px] text-[#072C0E]/35">
                      <span>{tr ? 'Hedef' : 'Target'}: {targetTonne.toFixed(0)} tCO2e</span>
                      <span>{tr ? 'Mevcut' : 'Current'}: {totalTonne.toFixed(0)} tCO2e</span>
                    </div>
                  </div>
                );
              })}
              {/* Pro notification lock (WF-03) */}
              <div className="flex items-center justify-between rounded-lg border border-[#072C0E]/8 bg-[#072C0E]/3 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] text-[#072C0E]/45">
                  <Lock className="h-3 w-3" />
                  <span>{tr ? 'Hatırlatma bildirimleri  -  Pro' : 'Reminder notifications  -  Pro'}</span>
                </div>
                <button onClick={() => setActiveTab('settings')} className="text-[10px] font-bold text-[#2ABD41] hover:underline">{tr ? 'Yükselt' : 'Upgrade'}</button>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── UPGRADE BANNER (WF-03 "Pro'ya Geç") ────────────────────── */}
      <div
        className="dash-fade-up group flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#2ABD41]/25 bg-gradient-to-r from-[#175022] to-[#1D9C31] px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(29,156,49,0.35)] sm:flex-row sm:gap-4"
        style={{ animationDelay: '540ms' }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2ABD41]/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Sparkles className="h-4 w-4 text-[#51D766]" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-white">
              {tr ? "Pro'ya geç  -  tüm özellikleri aç" : "Upgrade to Pro  -  unlock everything"}
            </p>
            <p className="text-[11px] text-white/50">
              {tr
                ? 'ISO 14064-1 raporları, AI analitik, sınırsız tesis'
                : 'ISO 14064-1 reports, AI analytics, unlimited facilities'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('settings')}
          className="shrink-0 rounded-xl bg-[#2ABD41] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#51D766]"
        >
          {tr ? "Pro'ya Geç ->" : "Upgrade to Pro ->"}
        </button>
      </div>
    </div>
  );
}
