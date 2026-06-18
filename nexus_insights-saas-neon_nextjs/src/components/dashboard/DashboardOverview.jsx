'use client';

import { useMemo, useState, useEffect } from 'react';
import useIsomorphicLayoutEffect from '@/lib/hooks/useIsomorphicLayoutEffect';
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

  const segs = [
    { label: 'Scope 1', val: s1, color: '#75863B' },
    { label: 'Scope 2', val: s2, color: '#95A847' },
    { label: 'Scope 3', val: s3, color: '#B4BE6A' },
  ].filter(s => s.val > 0);

  let cum = 0;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={160} height={160} viewBox="0 0 160 160" className="overflow-visible">
          {/* track */}
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#302817" strokeOpacity={0.06} strokeWidth={SW} />
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
                strokeDasharray={`${dash} ${C}`}
                strokeLinecap="butt"
                transform={`rotate(${rot} ${cx} ${cy})`}
              />
            );
          })}
        </svg>
        {/* centre label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-bold leading-none tracking-tight text-[#302817]">
            {total.toFixed(1)}
          </span>
          <span className="mt-0.5 text-[10px] font-bold text-[#302817]/40">tCO₂e</span>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
        {[
          { label: 'Scope 1', val: s1, color: '#75863B' },
          { label: 'Scope 2', val: s2, color: '#95A847' },
          { label: 'Scope 3', val: s3, color: '#B4BE6A' },
        ].filter(s => s.val > 0).map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[11px] font-semibold text-[#302817]/60">{s.label}</span>
            <span className="text-[10px] font-bold text-[#302817]/35">{s.val.toFixed(1)}t</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Monthly Bar Chart ─────────────────────────────────────────────────────
function MonthlyChart({ monthly, selectedYear, tr }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  // Memoized so the spread+map only runs when monthly data changes, not on every hover state update
  const maxKg = useMemo(() => Math.max(...(monthly ?? []).map(m => m.total_kg), 1), [monthly]);
  const months = tr ? MONTHS_TR_SHORT : MONTHS_EN_SHORT; // module-level — no recreation
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
              <div className="absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#302817] px-2 py-1.5 text-[10px] font-bold text-white shadow-xl">
                {(m.total_kg / 1000).toFixed(2)} tCO₂e
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#302817]" />
              </div>
            )}
            {/* Bar container */}
            <div className="relative h-36 w-full">
              <div
                className={`absolute inset-x-0 bottom-0 rounded-t-md transition-all duration-500 ${
                  hasData
                    ? isCur
                      ? 'bg-gradient-to-t from-[#302817] to-[#302817]/70'
                      : isHovered
                      ? 'bg-gradient-to-t from-[#75863B] to-[#B4BE6A]'
                      : 'bg-gradient-to-t from-[#75863B] to-[#95A847]'
                    : 'bg-[#302817]/4'
                }`}
                style={{ height: `${hasData ? Math.max(pct, 5) : 4}%` }}
              />
            </div>
            <span className={`text-[9px] font-bold sm:text-[10px] ${isCur ? 'text-[#302817]' : 'text-[#302817]/30'}`}>
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
  const scopeColors = ['#75863B', '#95A847', '#B4BE6A', '#302817', '#B4BE6A', '#95A847'];

  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.tonne / maxT) * 100;
        return (
          <div key={d.cat}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-bold text-[#302817]/80">{catLabel(d.cat, tr)}</span>
              <span className="shrink-0 text-[10px] font-bold text-[#302817]/40">{d.tonne.toFixed(2)}t</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#302817]/5">
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
    on_track:  { color: '#95A847', bg: 'bg-[#95A847]/12', text: 'text-[#75863B]', label: { tr: 'Yolunda', en: 'On Track' } },
    off_track: { color: '#f59e0b', bg: 'bg-amber-100',    text: 'text-amber-700', label: { tr: 'Geride',  en: 'Off Track' } },
    succeeded: { color: '#75863B', bg: 'bg-[#75863B]/12', text: 'text-[#75863B]', label: { tr: 'Başarıldı',en: 'Succeeded'} },
    failed:    { color: '#ef4444', bg: 'bg-red-100',      text: 'text-red-600',   label: { tr: 'Başarısız',en: 'Failed' } },
  };
  const s = STATUS[target.status] ?? STATUS.on_track;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#302817]/6 bg-white px-3 py-2.5">
      {/* Ring */}
      <div className="relative shrink-0">
        <svg width={80} height={80} viewBox="0 0 80 80">
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#302817" strokeOpacity={0.06} strokeWidth={SW} />
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
          <span className="text-[13px] font-bold leading-none text-[#302817]">{(progress * 100).toFixed(0)}%</span>
          <span className="text-[9px] font-semibold text-[#302817]/40">{tr ? 'tamamlandı' : 'done'}</span>
        </div>
      </div>
      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold text-[#302817]">{target.title}</p>
        <p className="text-[10px] text-[#302817]/45 mt-0.5">{target.base_year} → {target.target_year}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${s.bg} ${s.text}`}>
            {s.label[tr ? 'tr' : 'en']}
          </span>
          <span className="text-[9px] text-[#302817]/35">-{target.target_reduction_percent}% {tr ? 'hedef' : 'target'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────
function EmptyState({ label }) {
  return (
    <div className="flex h-28 items-center justify-center rounded-xl bg-[#302817]/3">
      <p className="text-xs font-semibold text-[#302817]/35">{label}</p>
    </div>
  );
}

// ─── Chart Card wrapper ────────────────────────────────────────────────────
function ChartCard({ title, subtitle, icon: Icon, iconBg, children, className = '', action }) {
  return (
    <section className={`flex flex-col rounded-[1.5rem] border border-[#302817]/8 bg-white p-4 shadow-[0_4px_20px_rgba(48,40,23,0.05)] sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${iconBg}`}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-[13px] font-bold text-[#302817] sm:text-sm">{title}</h2>
          {subtitle && <p className="text-[10px] text-[#302817]/40">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
function KPICard({ title, value, unit, subtitle, accent, icon: Icon, topColor }) {
  return (
    <div className={`relative rounded-[1.25rem] border p-3.5 sm:p-4 ${
      accent
        ? 'border-[#95A847] bg-[#EFF4DA]'
        : 'border-[#E2E8D8] bg-white'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#302817]/40 sm:text-[10px]">{title}</p>
          <div className="mt-1 flex items-end gap-1">
            <span className="text-[18px] font-bold leading-none tracking-tight text-[#302817] sm:text-[22px]">{value}</span>
            <span className="mb-0.5 text-[9px] font-bold text-[#302817]/35 sm:text-[10px]">{unit}</span>
          </div>
          {subtitle && <p className="mt-1 text-[9px] font-semibold text-[#302817]/40 sm:text-[10px]">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8 ${
            accent ? 'bg-[#D6E4A0] text-[#5A6B28]' : 'bg-[#EBEBEB] text-[#302817]'
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
  // Memoized so the array reference is stable — prevents false "dep changed every
  // render" warnings in the useMemo hooks below that depend on monthly.
  const monthly    = useMemo(() => summary?.monthly ?? [], [summary?.monthly]);

  // Derived: average monthly (only months with data) — memoized so the filter/reduce
  // only re-runs when monthly data changes, not on every local state update.
  const avgTonne = useMemo(() => {
    const active = monthly.filter(m => m.total_kg > 0);
    return active.length > 0
      ? active.reduce((a, m) => a + m.total_kg, 0) / active.length / 1000
      : 0;
  }, [monthly]);

  // Language-aware month name arrays (used in JSX, not inside any memo)
  const MONTHS_FULL = tr ? MONTHS_TR_FULL : MONTHS_EN_FULL;

  // Biggest monthly spike — memoized so it only recomputes when monthly data changes.
  // Returns a numeric index into `monthly`; the name lookup uses MONTHS_FULL at render time.
  const peakMonth = useMemo(
    () => monthly.reduce((best, m, i) => m.total_kg > (monthly[best]?.total_kg ?? 0) ? i : best, 0),
    [monthly],
  );

  // Touch-tablet simplified view — useLayoutEffect runs before browser paint,
  // so GPU-heavy complex view is never painted to screen on Android tablets.
  const [isAndroidTablet, setIsAndroidTablet] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    setIsAndroidTablet(isTouch && window.innerWidth >= 768);
  }, []);

  if (isAndroidTablet) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#302817]/10 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#95A847]">
            {tr ? 'Karbon çalışma alanı' : 'Carbon workspace'}
          </p>
          <h1 className="mt-2 text-2xl font-black text-[#302817]">
            {tr ? 'Emisyon Profili' : 'Emission Profile'} · {selectedYear}
          </h1>
          <p className="mt-1 text-sm text-[#302817]/55">
            {tr ? 'Toplam' : 'Total'}: {totalTonne.toFixed(2)} tCO₂e
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#302817]/10 bg-white p-5">
            <p className="text-xs text-[#302817]/50">Scope 1</p>
            <p className="text-2xl font-black text-[#302817]">{s1.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span></p>
          </div>
          <div className="rounded-2xl border border-[#302817]/10 bg-white p-5">
            <p className="text-xs text-[#302817]/50">Scope 2</p>
            <p className="text-2xl font-black text-[#302817]">{s2.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span></p>
          </div>
          <div className="rounded-2xl border border-[#302817]/10 bg-white p-5">
            <p className="text-xs text-[#302817]/50">Scope 3</p>
            <p className="text-2xl font-black text-[#302817]">{s3.toFixed(2)} <span className="text-sm font-normal">tCO₂e</span></p>
          </div>
        </div>
        <div className="rounded-2xl border border-[#302817]/10 bg-white p-5">
          <h2 className="text-sm font-bold text-[#302817]">{tr ? 'Başlangıç Rehberi' : 'Getting Started'}</h2>
          <div className="mt-3 space-y-2">
            {[
              { done: !!questionnaireProfile?.is_complete, label: tr ? 'Anketi tamamla' : 'Complete questionnaire' },
              { done: entries.length > 0, label: tr ? 'Emisyon verisi gir' : 'Enter emission data' },
              { done: targets.length > 0, label: tr ? 'Hedef belirle' : 'Set target' },
              { done: facilityList.length > 0, label: tr ? 'Tesis ekle' : 'Add facility' },
            ].map((s, i) => (
              <p key={i} className={`text-sm ${s.done ? 'text-[#95A847] line-through' : 'text-[#302817]/70'}`}>
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

      {/* ── SECTION HEADER (WF-03 style) ────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#302817]/35">
            {selectedYear} {tr ? 'Özet' : 'Summary'}
          </p>
          <h1 className="mt-0.5 text-base font-bold text-[#302817] sm:text-[17px]">
            {tr ? 'Ana Dashboard' : 'Main Dashboard'}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#95A847] px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#75863B]"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr ? 'Veri Ekle' : 'Add Data'}
          </button>
          <button
            onClick={() => setActiveTab('ai_carbon')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#302817]/10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#302817]/60 transition hover:border-[#B4BE6A]/40"
          >
            <Bot className="h-3.5 w-3.5" />
            AI Chatbot
          </button>
          <button
            onClick={() => setActiveTab('reporting')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#302817]/10 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#302817]/60 transition hover:border-[#302817]/20"
          >
            {tr ? 'Rapor' : 'Report'}
          </button>
        </div>
      </div>

      {/* AI insight strip — shown only when data exists */}
      {totalTonne > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#95A847]/20 bg-[#EEF3D8]/60 px-3.5 py-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#95A847]" />
          <p className="text-[11px] font-semibold leading-5 text-[#302817]/65">
            {tr
              ? `Toplam ${totalTonne.toFixed(1)} tCO₂e kaydedildi — en yüksek ay ${MONTHS_TR_FULL[peakMonth]}. Aylık ortalama ${avgTonne.toFixed(2)} tCO₂e.`
              : `Total ${totalTonne.toFixed(1)} tCO₂e recorded — peak month ${MONTHS_EN_FULL[peakMonth]}. Monthly average ${avgTonne.toFixed(2)} tCO₂e.`}
          </p>
        </div>
      )}

      {/* ── QUESTIONNAIRE BANNER ─────────────────────────────────────── */}
      {questionnaireProfile && !questionnaireProfile.is_complete && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs font-semibold text-amber-800">
            {tr
              ? 'Karbon envanteri anketi tamamlanmadı — AI Carbon sekmesinden devam edin.'
              : 'Carbon inventory questionnaire incomplete — continue from the AI Carbon tab.'}
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
        <KPICard title={tr ? 'Toplam' : 'Total'} value={totalTonne.toFixed(2)} unit="tCO₂e" accent icon={Leaf} />
        <KPICard title="Scope 1" value={s1.toFixed(2)} unit="tCO₂e" subtitle={tr ? 'Doğrudan' : 'Direct'} topColor="#75863B" />
        <KPICard title="Scope 2" value={s2.toFixed(2)} unit="tCO₂e" subtitle={tr ? 'Enerji' : 'Energy'} topColor="#95A847" />
        <KPICard title="Scope 3" value={s3.toFixed(2)} unit="tCO₂e" subtitle={tr ? 'Dolaylı' : 'Indirect'} topColor="#B4BE6A" />
      </div>

      {/* ── ROW 2: Monthly trend + Scope donut ──────────────────────── */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-[1fr_300px]">

        {/* Monthly Trend */}
        <ChartCard
          title={tr ? 'Aylık Emisyon Trendi' : 'Monthly Emission Trend'}
          subtitle={String(selectedYear)}
          icon={TrendingDown}
          iconBg="bg-[#95A847] text-white"
        >
          <MonthlyChart monthly={monthly} selectedYear={selectedYear} tr={tr} />
        </ChartCard>

        {/* Scope Donut */}
        <ChartCard
          title={tr ? 'Kapsam Dağılımı' : 'Scope Distribution'}
          subtitle={totalTonne > 0 ? `${totalTonne.toFixed(1)} tCO₂e` : undefined}
          icon={Layers}
          iconBg="bg-[#B4BE6A]/20 text-[#75863B]"
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
          iconBg="bg-[#95A847]/15 text-[#95A847]"
          action={<button onClick={() => setActiveTab('benchmark')} className="text-[11px] font-semibold text-[#95A847] hover:underline">{tr ? 'Detay →' : 'Detail →'}</button>}
        >
          {totalTonne > 0 ? (
            <div className="space-y-3">
              {/* Bar chart showing your position vs sector average */}
              <div className="relative h-5 overflow-hidden rounded-full bg-[#302817]/6">
                {/* Low zone */}
                <div className="absolute left-0 top-0 h-full w-[36%] rounded-l-full bg-[#EEF3D8]" />
                {/* Mid zone */}
                <div className="absolute top-0 h-full bg-[#B4BE6A]/40" style={{ left: '36%', width: '28%' }} />
                {/* High zone */}
                <div className="absolute top-0 h-full rounded-r-full bg-amber-100" style={{ left: '64%', width: '36%' }} />
                {/* Your position marker */}
                <div className="absolute top-0 h-full w-0.5 bg-[#302817]" style={{ left: '48%' }}>
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-[#302817]">
                    {tr ? 'Siz' : 'You'}
                  </span>
                </div>
                {/* Sector avg marker */}
                <div className="absolute top-0 h-full w-0.5 bg-amber-500/60" style={{ left: '60%' }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#302817]/45">
                <span>{tr ? 'Düşük' : 'Low'}</span>
                <span className="font-semibold text-[#75863B]">{tr ? 'Ortalamanın altındasınız' : 'Below sector average'}</span>
                <span>{tr ? 'Yüksek' : 'High'}</span>
              </div>
              <button
                onClick={() => setActiveTab('benchmark')}
                className="flex w-full items-center justify-between rounded-lg bg-[#EEF3D8] px-3 py-2 text-[11px] font-semibold text-[#75863B] transition hover:bg-[#B4BE6A]/30"
              >
                <span>{tr ? 'Tam benchmark raporu' : 'Full benchmark report'}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex h-20 flex-col items-center justify-center gap-1.5">
              <p className="text-[11px] font-semibold text-[#302817]/35">{tr ? 'Veri girilince görünür' : 'Visible once data is entered'}</p>
              <button onClick={() => setActiveTab('emissions')} className="text-[11px] font-bold text-[#95A847] hover:underline">{tr ? 'Veri ekle →' : 'Add data →'}</button>
            </div>
          )}
        </ChartCard>

        {/* Pending Actions (WF-03) */}
        <ChartCard
          title={tr ? 'Bekleyen Aksiyonlar' : 'Pending Actions'}
          subtitle={tr ? 'Tamamlanması gerekenler' : 'Items requiring attention'}
          icon={AlertTriangle}
          iconBg="bg-amber-50 text-amber-500"
        >
          <div className="space-y-1.5">
            {[
              {
                dot: 'bg-[#95A847]',
                done: !!questionnaireProfile?.is_complete,
                tr: 'CarbonIQ anketi tamamlanmadı',
                en: 'CarbonIQ questionnaire incomplete',
                tab: 'ai_carbon',
              },
              {
                dot: entries.length === 0 ? 'bg-red-400' : 'bg-[#95A847]',
                done: entries.length > 0,
                tr: 'Emisyon verisi eksik',
                en: 'No emission data entered',
                tab: 'emissions',
              },
              {
                dot: targets.length === 0 ? 'bg-amber-400' : 'bg-[#95A847]',
                done: targets.length > 0,
                tr: 'Azaltım hedefi belirlenmedi',
                en: 'No reduction target set',
                tab: 'reduction',
              },
              {
                dot: facilityList.length === 0 ? 'bg-[#302817]/25' : 'bg-[#95A847]',
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
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-[#302817]/4"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
                  <span className="flex-1 text-left text-[11px] font-semibold text-[#302817]/70">{tr ? item.tr : item.en}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#302817]/25" />
                </button>
              )
            ))}
            {/* All done state */}
            {[questionnaireProfile?.is_complete, entries.length > 0, targets.length > 0, facilityList.length > 0].every(Boolean) && (
              <div className="flex h-20 flex-col items-center justify-center gap-1.5">
                <CheckCircle2 className="h-6 w-6 text-[#95A847]" />
                <p className="text-[11px] font-semibold text-[#302817]/50">{tr ? 'Tüm aksiyonlar tamamlandı' : 'All actions complete'}</p>
              </div>
            )}
          </div>
        </ChartCard>

        {/* Targets (WF-03) */}
        <ChartCard
          title={tr ? 'Hedefler' : 'Targets'}
          subtitle={tr ? 'Azaltım ilerleme durumu' : 'Reduction progress'}
          icon={Target}
          iconBg="bg-[#B4BE6A]/20 text-[#75863B]"
          action={<button onClick={() => setActiveTab('reduction')} className="text-[11px] font-semibold text-[#95A847] hover:underline">{tr ? 'Tümü →' : 'All →'}</button>}
        >
          {targets.length === 0 ? (
            <div className="flex h-24 flex-col items-center justify-center gap-2">
              <p className="text-[11px] font-semibold text-[#302817]/35">{tr ? 'Henüz hedef yok' : 'No targets yet'}</p>
              <button
                onClick={() => setActiveTab('reduction')}
                className="rounded-full border border-[#95A847]/30 px-3 py-1 text-[11px] font-bold text-[#75863B] transition hover:bg-[#95A847]/8"
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
                      <span className="text-[11px] font-semibold text-[#302817]/70">{t.target_year || '—'} {tr ? 'hedefi' : 'target'}</span>
                      <span className="text-[11px] font-bold text-[#75863B]">{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#302817]/6">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#B4BE6A] transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-0.5 flex justify-between text-[10px] text-[#302817]/35">
                      <span>{tr ? 'Hedef' : 'Target'}: {targetTonne.toFixed(0)} tCO₂e</span>
                      <span>{tr ? 'Mevcut' : 'Current'}: {totalTonne.toFixed(0)} tCO₂e</span>
                    </div>
                  </div>
                );
              })}
              {/* Pro notification lock (WF-03) */}
              <div className="flex items-center justify-between rounded-lg border border-[#302817]/8 bg-[#302817]/3 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] text-[#302817]/45">
                  <Lock className="h-3 w-3" />
                  <span>{tr ? 'Hatırlatma bildirimleri — Pro' : 'Reminder notifications — Pro'}</span>
                </div>
                <button onClick={() => setActiveTab('settings')} className="text-[10px] font-bold text-[#95A847] hover:underline">{tr ? 'Yükselt' : 'Upgrade'}</button>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── UPGRADE BANNER (WF-03 "Pro'ya Geç") ────────────────────── */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#95A847]/25 bg-gradient-to-r from-[#302817] to-[#3d3520] px-5 py-4 sm:flex-row sm:gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#95A847]/20">
            <Sparkles className="h-4 w-4 text-[#B4BE6A]" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-white">
              {tr ? "Pro'ya geç — tüm özellikleri aç" : "Upgrade to Pro — unlock everything"}
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
          className="shrink-0 rounded-xl bg-[#95A847] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#B4BE6A]"
        >
          {tr ? "Pro'ya Geç →" : "Upgrade to Pro →"}
        </button>
      </div>
    </div>
  );
}
