'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Layers,
  Leaf,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  BarChart2,
} from 'lucide-react';
import FacilityChart from '@/components/dashboard/FacilityChart';

// ─── Category display names ────────────────────────────────────────────────
const CATEGORY_LABELS = {
  combustion:          { tr: 'Sabit Yanma',       en: 'Stationary Combustion' },
  fleet_vehicles:      { tr: 'Araç Filosu',        en: 'Fleet Vehicles' },
  electricity:         { tr: 'Elektrik',           en: 'Electricity' },
  business_travel:     { tr: 'İş Seyahati',        en: 'Business Travel' },
  freight:             { tr: 'Yük Taşıma',         en: 'Freight' },
  waste:               { tr: 'Atık',               en: 'Waste' },
  water:               { tr: 'Su',                 en: 'Water' },
  purchased_goods:     { tr: 'Satın Alınan Ürün',  en: 'Purchased Goods' },
  employee_commuting:  { tr: 'İşe Gidiş-Geliş',   en: 'Employee Commuting' },
  capital_goods:       { tr: 'Sermaye Malları',    en: 'Capital Goods' },
  upstream_transport:  { tr: 'Üst. Taşımacılık',   en: 'Upstream Transport' },
  downstream_transport:{ tr: 'Alt. Taşımacılık',   en: 'Downstream Transport' },
  refrigerants:        { tr: 'Soğutucu Gaz',       en: 'Refrigerants' },
  process_emissions:   { tr: 'Proses Emisyonu',    en: 'Process Emissions' },
  steam_heat:          { tr: 'Buhar / Isı',        en: 'Steam / Heat' },
};

function catLabel(key, tr) {
  return CATEGORY_LABELS[key]?.[tr ? 'tr' : 'en'] ?? key;
}

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
                style={{
                  transform: `rotate(${rot}deg)`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)',
                }}
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
  const maxKg = Math.max(...(monthly ?? []).map(m => m.total_kg), 1);
  const months = tr
    ? ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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
        return (
          <div
            key={i}
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
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, transition: 'stroke-dasharray 0.9s ease' }}
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
function ChartCard({ title, subtitle, icon: Icon, iconBg, children, className = '' }) {
  return (
    <section className={`flex flex-col rounded-[1.5rem] border border-[#302817]/8 bg-white p-4 shadow-[0_4px_20px_rgba(48,40,23,0.05)] sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-9 sm:w-9 ${iconBg}`}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
        <div>
          <h2 className="text-[13px] font-bold text-[#302817] sm:text-sm">{title}</h2>
          {subtitle && <p className="text-[10px] text-[#302817]/40">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────
function KPICard({ title, value, unit, subtitle, accent, icon: Icon, topColor }) {
  return (
    <div className={`relative overflow-hidden rounded-[1.25rem] border p-3.5 transition-colors sm:p-4 ${
      accent
        ? 'border-[#95A847]/35 bg-gradient-to-br from-[#95A847]/10 to-[#B4BE6A]/6'
        : 'border-[#302817]/7 bg-white'
    }`}>
      {topColor && (
        <div className="absolute left-4 right-4 top-0 h-[3px] rounded-b-full" style={{ backgroundColor: topColor }} />
      )}
      {accent && (
        <div className="absolute left-4 right-4 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-[#75863B] to-[#B4BE6A]" />
      )}
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
            accent ? 'bg-[#95A847]/15 text-[#95A847]' : 'bg-[#302817]/5 text-[#302817]/40'
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
  const monthly    = summary?.monthly ?? [];

  // Derived: average monthly (only months with data)
  const activeMos = monthly.filter(m => m.total_kg > 0);
  const avgTonne  = activeMos.length > 0
    ? activeMos.reduce((a, m) => a + m.total_kg, 0) / activeMos.length / 1000
    : 0;

  // Biggest monthly spike
  const peakMonth = monthly.reduce((best, m, i) =>
    m.total_kg > (monthly[best]?.total_kg ?? 0) ? i : best, 0);
  const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <div className="space-y-3 sm:space-y-4">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-[#302817]/10 bg-gradient-to-br from-[#F9EFE5] via-white to-[#B4BE6A]/10 p-4 shadow-[0_6px_24px_rgba(48,40,23,0.06)] sm:p-5">

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#95A847]">
              {tr ? 'Karbon çalışma alanı' : 'Carbon workspace'}
            </p>
            <h1 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#302817] sm:text-2xl">
              {tr ? 'Emisyon Profili' : 'Emission Profile'} · {selectedYear}
            </h1>
            <p className="mt-0.5 text-[12px] text-[#302817]/55 sm:text-sm">
              {tr ? 'Şirketinizin karbon emisyon özetleri' : 'Carbon emission overview for your company'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition-colors hover:bg-black"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr ? 'Veri Ekle' : 'Add Data'}
            </button>
            <button
              onClick={() => setActiveTab('ai_carbon')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#95A847]/40 bg-[#95A847]/10 px-4 py-2 text-xs font-bold text-[#75863B] transition hover:bg-[#95A847]/18"
            >
              <Bot className="h-3.5 w-3.5" />
              CarbonIQ
            </button>
            <button
              onClick={() => setActiveTab('reporting')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#302817]/10 bg-white/70 px-4 py-2 text-xs font-bold text-[#302817]/70 transition hover:bg-white"
            >
              {tr ? 'Rapor' : 'Report'}
            </button>
          </div>
        </div>

        {/* AI insight strip */}
        {totalTonne > 0 && (
          <div className="relative mt-3 flex items-start gap-2.5 rounded-xl border border-[#95A847]/20 bg-[#F9EFE5]/60 px-3.5 py-2.5 sm:mt-4">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#95A847]" />
            <p className="text-[11px] font-semibold leading-5 text-[#302817]/70 sm:text-xs">
              {tr
                ? `Toplam ${totalTonne.toFixed(1)} tCO₂e kaydedildi — en yüksek ay ${MONTHS_TR[peakMonth]}. Aylık ortalama ${avgTonne.toFixed(2)} tCO₂e.`
                : `Total ${totalTonne.toFixed(1)} tCO₂e recorded — peak month ${MONTHS_EN[peakMonth]}. Monthly average ${avgTonne.toFixed(2)} tCO₂e.`}
            </p>
          </div>
        )}
      </div>

      {/* ── QUESTIONNAIRE BANNER ─────────────────────────────────────── */}
      {questionnaireProfile && !questionnaireProfile.is_complete && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-2.5">
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

      {/* ── ROW 3: Category breakdown + Targets ─────────────────────── */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-2">

        {/* Category Breakdown */}
        <ChartCard
          title={tr ? 'Kategori Dağılımı' : 'Category Breakdown'}
          subtitle={tr ? 'İlk 6 emisyon kaynağı' : 'Top 6 emission sources'}
          icon={BarChart2}
          iconBg="bg-[#302817]/8 text-[#302817]/60"
        >
          <CategoryChart entries={entries} tr={tr} />
        </ChartCard>

        {/* Reduction Targets */}
        <ChartCard
          title={tr ? 'Azaltım Hedefleri' : 'Reduction Targets'}
          subtitle={tr ? 'İlerleme takibi' : 'Progress tracking'}
          icon={Target}
          iconBg="bg-[#B4BE6A]/20 text-[#75863B]"
        >
          {targets.length === 0 ? (
            <div className="flex h-28 flex-col items-center justify-center gap-2">
              <p className="text-xs font-semibold text-[#302817]/35">{tr ? 'Henüz hedef yok' : 'No targets yet'}</p>
              <button
                onClick={() => setActiveTab('reduction')}
                className="rounded-full border border-[#95A847]/30 px-3 py-1 text-[11px] font-bold text-[#75863B] transition hover:bg-[#95A847]/8"
              >
                {tr ? '+ Hedef ekle' : '+ Add target'}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {targets.slice(0, 3).map(t => (
                <TargetRing key={t.id} target={t} currentTonne={totalTonne} tr={tr} />
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── ROW 4: Facilities + Getting Started ─────────────────────── */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-2">

        {/* Facility Comparison */}
        <ChartCard
          title={tr ? 'Tesis Karşılaştırması' : 'Facility Comparison'}
          subtitle={tr ? 'Tesis bazında emisyon' : 'Emissions by facility'}
          icon={TrendingUp}
          iconBg="bg-[#95A847]/15 text-[#95A847]"
        >
          <FacilityChart language={language} selectedYear={selectedYear} compact />
        </ChartCard>

        {/* Getting Started */}
        <ChartCard
          title={tr ? 'Başlangıç Kılavuzu' : 'Getting Started'}
          subtitle={tr ? 'Tamamlama durumu' : 'Completion status'}
          icon={CheckCircle2}
          iconBg="bg-[#302817] text-white"
        >
          <div className="space-y-1.5">
            {[
              {
                done: !!questionnaireProfile?.is_complete,
                tr: 'CarbonIQ anketini tamamla',
                en: 'Complete CarbonIQ questionnaire',
                tab: 'ai_carbon',
              },
              {
                done: entries.length > 0,
                tr: 'İlk emisyon verisini gir',
                en: 'Enter first emission data',
                tab: 'emissions',
              },
              {
                done: targets.length > 0,
                tr: 'Azaltım hedefi belirle',
                en: 'Set a reduction target',
                tab: 'reduction',
              },
              {
                done: facilityList.length > 0,
                tr: 'Tesis ekle',
                en: 'Add a facility',
                tab: 'settings',
              },
              {
                done: entries.filter(e => e.proof_document).length > 0,
                tr: 'Kanıt belgesi yükle',
                en: 'Upload a proof document',
                tab: 'emissions',
              },
            ].map((step, i) => (
              <button
                key={i}
                onClick={() => !step.done && setActiveTab(step.tab)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-[#302817]/4 disabled:cursor-default"
                disabled={step.done}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                  step.done ? 'bg-[#95A847] text-white' : 'bg-[#302817]/8 text-[#302817]/35'
                }`}>
                  {step.done ? '✓' : i + 1}
                </span>
                <span className={`text-left text-[11px] font-semibold sm:text-xs ${
                  step.done ? 'text-[#302817]/30 line-through' : 'text-[#302817]/70'
                }`}>
                  {tr ? step.tr : step.en}
                </span>
                {!step.done && (
                  <span className="ml-auto text-[9px] font-bold text-[#95A847]">→</span>
                )}
              </button>
            ))}
          </div>
          {/* Progress bar */}
          {(() => {
            const steps = [
              !!questionnaireProfile?.is_complete,
              entries.length > 0,
              targets.length > 0,
              facilityList.length > 0,
              entries.filter(e => e.proof_document).length > 0,
            ];
            const done = steps.filter(Boolean).length;
            return (
              <div className="mt-3 border-t border-[#302817]/6 pt-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#302817]/40">{tr ? 'İlerleme' : 'Progress'}</span>
                  <span className="text-[10px] font-bold text-[#302817]/40">{done}/5</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#302817]/6">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#B4BE6A] transition-all duration-700"
                    style={{ width: `${(done / 5) * 100}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </ChartCard>
      </div>
    </div>
  );
}
