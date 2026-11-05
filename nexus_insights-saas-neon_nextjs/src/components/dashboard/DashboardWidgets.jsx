'use client';

// The building blocks of the Carbon Emissions Analytics dashboard (DashboardOverview composes them).
// One compact design system: white cards (14px radius, hairline green-grey border, very soft shadow) with 12px padding,
// 13px panel titles with a muted unit, 11px labels, bold figures, small pill badges, and the three scope colours used
// everywhere (SCOPE). Each block shows only what the server calculated for the ONE inventory shown.
//
// Honesty rule: every chart keeps its FRAME when there is nothing to plot (axes, gridlines, month and category labels,
// the scope legend, an empty ring, the table header) so the dashboard looks like itself from the first day — but a frame
// carries labels, never numbers: no bar, ring segment, trend or value is drawn unless the server calculated it, and a
// missing value is an em dash, never a zero.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, FileText, Flame,
  Info, Leaf, Sparkles, CircleDashed, Truck, Zap,
} from 'lucide-react';
import { api } from '@/lib/utils/api';
import useCountUp from '@/lib/hooks/useCountUp';
import { fixed } from '@/lib/formatNumber';
import { quarterly, fmt } from '@/lib/dashboard/insights';

// The scope palette: distinguishable, brand-green family, identical in cards, donut, bars and tables.
export const SCOPE = {
  scope1: { color: '#175022', tint: '#E4EEE6', Icon: Flame },
  scope2: { color: '#2ABD41', tint: '#E3F7E7', Icon: Zap },
  scope3: { color: '#5CCDB8', tint: '#E3F6F2', Icon: Truck },
};
export const SCOPE_COLORS = { scope1: SCOPE.scope1.color, scope2: SCOPE.scope2.color, scope3: SCOPE.scope3.color };
const MUTED = 'text-[#6B7A70]';
const GHOST = 'bg-[#0E2A14]/[0.06]';

// ── the card shell all panels share ────────────────────────────────────────────────────────────────────────────
export function Card({ title, subtitle, action, children, className = '', testid, bodyClassName = '' }) {
  return (
    <section data-testid={testid}
      className={`flex min-w-0 flex-col rounded-[14px] border border-[#E6EDE7] bg-white p-3 shadow-[0_1px_2px_rgba(16,40,20,0.04)] ${className}`}>
      {(title || action) && (
        <header className="mb-2 flex min-h-[24px] items-center gap-2">
          <h2 className="min-w-0 truncate text-[13px] font-semibold text-[#0E2A14]">
            {title}{subtitle && <span className={`ml-1.5 text-[10px] font-normal ${MUTED}`}>{subtitle}</span>}
          </h2>
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

// A compact dropdown in the card header (a real <select>, so it works by keyboard and screen reader).
export function MiniSelect({ value, onChange, options, label }) {
  return (
    <span className="relative inline-flex items-center">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-6 appearance-none rounded-md border border-[#E1E9E3] bg-white py-0 pl-2 pr-5 text-[11px] font-medium text-[#0E2A14]/80 outline-none transition hover:border-[#C9DACD] focus-visible:ring-2 focus-visible:ring-[#2ABD41]/40">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-[#0E2A14]/50" aria-hidden="true" />
    </span>
  );
}

// ── KPI card (icon tile, label, figure + unit; comparison text and a badge underneath) ───────────────────────────
// `value` null = not calculated: the card says so. `badge` is { text, tone: 'good' | 'bad' | 'neutral', arrow? }.
export function KpiCard({ testid, label, value, unit = 'tCO2e', decimals = 2, icon: Icon, scope, sub, badge, unavailable, badgeTestid }) {
  const tone = SCOPE[scope] || { color: '#1D9C31', tint: '#E3F7E7' };
  const has = value != null && Number.isFinite(Number(value)) && !unavailable;
  const animated = useCountUp(has ? Number(value) : 0, 700);
  const badgeCls = { good: 'bg-[#E3F7E7] text-[#1B7F2C]', bad: 'bg-[#FDE8E8] text-[#B42318]', neutral: 'bg-[#EEF3EF] text-[#51625A]' };
  return (
    <div data-testid={testid} className="min-w-0 rounded-[14px] border border-[#E6EDE7] bg-white p-3 shadow-[0_1px_2px_rgba(16,40,20,0.04)]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] max-sm:h-8 max-sm:w-8" style={{ backgroundColor: tone.tint }}>
          {Icon && <Icon className="h-5 w-5 max-sm:h-4 max-sm:w-4" style={{ color: tone.color }} strokeWidth={2} aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className={`truncate text-[11px] font-medium ${MUTED}`}>{label}</p>
          {has ? (
            <p className="flex flex-wrap items-baseline gap-x-1">
              <span className="text-[22px] font-bold leading-[1.15] tracking-tight text-[#0E2A14] tabular-nums max-sm:text-[18px]">{fixed(animated, decimals)}</span>
              <span className={`text-[10px] ${MUTED}`}>{unit}</span>
            </p>
          ) : (
            <p className="text-[22px] font-bold leading-[1.15] text-[#0E2A14]/25 max-sm:text-[18px]" title={unavailable || undefined}>—</p>
          )}
        </div>
      </div>
      <div className={`mt-2 flex min-h-[20px] items-center justify-between gap-2 text-[10.5px] ${MUTED}`}>
        <span className="min-w-0 truncate">{unavailable || sub}</span>
        {badge && has && (
          <span data-testid={badgeTestid} className={`inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${badgeCls[badge.tone || 'neutral']}`}>
            {badge.arrow === 'down' && <ArrowDownRight className="h-3 w-3" />}{badge.arrow === 'up' && <ArrowUpRight className="h-3 w-3" />}{badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ── the inventory status, read from the server (one inventory, keyed by its id) ─────────────────────────────────
// required_unanswered is the completion check's own list; pending_questions the server's applicable "answer later" marks.
// Unknown (not loaded / failed) is null, never 0, and a response for another inventory is discarded.
const NO_STATUS = { requiredUnanswered: null, pending: null, answered: null, status: null, loaded: false };
export function useInventoryStatus(inventoryId) {
  const [state, setState] = useState({ inventoryId: null, ...NO_STATUS });
  const gen = useRef(0);
  const load = useCallback(async () => {
    const mine = ++gen.current;
    if (!inventoryId) { setState({ inventoryId: null, ...NO_STATUS, loaded: true }); return; }
    try {
      const res = await api.getReportStatus(inventoryId);
      if (!res.ok) throw new Error('status');
      const d = await res.json();
      if (mine !== gen.current) return;
      setState({
        inventoryId, loaded: true,
        requiredUnanswered: Array.isArray(d.required_unanswered) ? d.required_unanswered.length : null,
        pending: Array.isArray(d.pending_questions) ? d.pending_questions.length : null,
        answered: Array.isArray(d.completed_steps) ? d.completed_steps.length : null,
        status: d.status ?? null,
      });
    } catch {
      if (mine === gen.current) setState({ inventoryId, ...NO_STATUS, loaded: true });
    }
  }, [inventoryId]);
  useEffect(() => { load(); return () => { gen.current++; }; }, [load]);
  useEffect(() => {
    let t = null;
    const h = () => { clearTimeout(t); t = setTimeout(load, 700); };
    window.addEventListener('carbonless:emissions-updated', h);
    return () => { clearTimeout(t); window.removeEventListener('carbonless:emissions-updated', h); };
  }, [load]);
  return state.inventoryId === (inventoryId || null) ? state : { inventoryId: inventoryId || null, ...NO_STATUS };
}

// ── emissions trend: the full chart frame always; bars only where the server has values ─────────────────────────
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
const PLOT_H = 128;

export function TrendCard({ monthly, annualKg = 0, selectedYear, tr }) {
  const [view, setView] = useState('monthly');
  const [hover, setHover] = useState(null);
  const list = Array.isArray(monthly) ? monthly : [];
  const hasMonthly = list.some(m => Number(m?.total_kg) > 0);
  const q = quarterly(list);
  const names = tr ? MONTHS_TR : MONTHS_EN;
  const bars = view === 'monthly'
    ? Array.from({ length: 12 }, (_, i) => ({ key: i, label: names[i], kg: Number(list.find(m => Number(m.month) === i + 1)?.total_kg) || 0 }))
    : [1, 2, 3, 4].map(n => ({ key: n, label: `Q${n}`, kg: q ? q[n - 1].total_kg : 0 }));
  const maxT = niceMax(Math.max(...bars.map(b => b.kg / 1000), 0));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map(f => f * maxT);
  const step = maxT / 4;
  const tickDecimals = Number.isInteger(step) ? 0 : Number.isInteger(step * 10) ? 1 : 2;
  const note = annualKg > 0 ? (tr
    ? `Yıllık envanter (anket): ${fmt(annualKg / 1000, tr, 1)} tCO2e — yıllık tutar olduğu için aylara dağıtılmadı.`
    : `Annual inventory (questionnaire): ${fmt(annualKg / 1000, tr, 1)} tCO2e — an annual amount, so not split by month.`) : null;
  return (
    <Card testid="trend-card" title={tr ? 'Emisyon trendi' : 'Emissions trend'} subtitle="tCO2e"
      action={<MiniSelect label={tr ? 'Görünüm' : 'View'} value={view} onChange={setView}
        options={[{ value: 'monthly', label: tr ? 'Aylık' : 'Monthly' }, { value: 'quarterly', label: tr ? 'Çeyreklik' : 'Quarterly' }]} />}>
      <div className="flex gap-1.5" onMouseLeave={() => setHover(null)}>
        <div className={`flex shrink-0 flex-col justify-between text-right text-[9.5px] tabular-nums ${MUTED}`} style={{ height: PLOT_H, width: 28 }} aria-hidden="true">
          {ticks.map((t, i) => <span key={i} className="leading-none">{hasMonthly ? fmt(t, tr, tickDecimals) : '—'}</span>)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: PLOT_H }}>
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              {ticks.map((_, i) => <div key={i} className="border-t border-dashed border-[#E3EAE5]" />)}
            </div>
            <div className="absolute inset-0 flex items-end gap-1 sm:gap-1.5" role="img" aria-label={tr ? 'Emisyon trendi' : 'Emissions trend'}>
              {bars.map((b, i) => {
                const prev = i > 0 ? bars[i - 1].kg : 0;
                const delta = prev > 0 && b.kg > 0 ? ((b.kg - prev) / prev) * 100 : null;
                return (
                  <div key={b.key} className="relative flex h-full flex-1 items-end" onMouseEnter={() => hasMonthly && setHover(i)} onFocus={() => hasMonthly && setHover(i)} tabIndex={hasMonthly ? 0 : -1}
                    aria-label={hasMonthly ? `${b.label}: ${fmt(b.kg / 1000, tr, 2)} tCO2e` : b.label}>
                    {b.kg > 0 && (
                      <div className={`w-full rounded-t-[5px] transition-colors ${hover === i ? 'bg-[#1D9C31]' : 'bg-[#2ABD41]'}`}
                        style={{ height: `${(b.kg / 1000 / maxT) * 100}%`, minHeight: 3 }} />
                    )}
                    {hover === i && (
                      <div className={`pointer-events-none absolute bottom-full z-10 mb-1.5 w-max min-w-[7.5rem] rounded-lg border border-[#E6EDE7] bg-white px-2.5 py-1.5 text-[11px] shadow-[0_6px_20px_rgba(16,40,20,0.12)] ${i > bars.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
                        <p className={MUTED}>{b.label} {selectedYear}</p>
                        <p className="text-[13px] font-bold tabular-nums text-[#0E2A14]">{b.kg > 0 ? `${fmt(b.kg / 1000, tr, 2)} tCO2e` : (tr ? 'Kayıt yok' : 'No entries')}</p>
                        {delta != null && (
                          <p className={`font-semibold ${delta <= 0 ? 'text-[#1B7F2C]' : 'text-[#B42318]'}`}>
                            {delta <= 0 ? '↓' : '↑'} {fmt(Math.abs(delta), tr, 1)}% {view === 'monthly' ? (tr ? 'önceki aya göre' : 'vs previous month') : (tr ? 'önceki çeyreğe göre' : 'vs previous quarter')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!hasMonthly && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#6B7A70]">
                  {tr ? 'Henüz aylık kayıt yok — veri girildikçe görünür' : 'No monthly entries yet — bars appear as data is entered'}
                </span>
              </div>
            )}
          </div>
          <div className={`mt-1 flex gap-1 sm:gap-1.5 text-center text-[9.5px] ${MUTED}`} aria-hidden="true">
            {bars.map(b => <span key={b.key} className="flex-1">{b.label}</span>)}
          </div>
        </div>
      </div>
      {note && <p className={`mt-1.5 text-[10px] leading-4 ${MUTED}`}>{note}</p>}
    </Card>
  );
}

// ── scope breakdown: the donut component always (a neutral ring when nothing is calculated), legend always ───────
export function ScopeCard({ s1, s2, s3, total, tr }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(t); }, []);
  const R = 38, SW = 15, C = 2 * Math.PI * R, SIZE = 108, M = SIZE / 2;
  const items = [['scope1', tr ? 'Kapsam 1' : 'Scope 1', s1], ['scope2', tr ? 'Kapsam 2' : 'Scope 2', s2], ['scope3', tr ? 'Kapsam 3' : 'Scope 3', s3]];
  const sum = items.reduce((a, [, , v]) => a + Math.max(Number(v) || 0, 0), 0);
  let cum = 0;
  return (
    <Card testid="scope-card" title={tr ? 'Kapsam dağılımı' : 'Scope breakdown'} subtitle="tCO2e">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 py-0.5">
        <div className="relative shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={tr ? 'Kapsam dağılımı' : 'Scope breakdown'}>
            <circle cx={M} cy={M} r={R} fill="none" stroke={sum > 0 ? '#0E2A14' : '#DCE6DE'} strokeOpacity={sum > 0 ? 0.06 : 1} strokeWidth={SW} strokeDasharray={sum > 0 ? undefined : '3 4'} />
            {sum > 0 && items.filter(([, , v]) => v > 0).map(([k, , v]) => {
              const f = v / sum; const dash = f * C; const rot = cum * 360 - 90; cum += f;
              return <circle key={k} cx={M} cy={M} r={R} fill="none" stroke={SCOPE[k].color} strokeWidth={SW}
                strokeDasharray={`${drawn ? Math.max(dash - 1.5, 0) : 0} ${C}`} transform={`rotate(${rot} ${M} ${M})`}
                style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)' }} />;
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[17px] font-bold leading-none tabular-nums ${sum > 0 ? 'text-[#0E2A14]' : 'text-[#0E2A14]/25'}`}>{sum > 0 ? fmt(total || sum, tr, 1) : '—'}</span>
            <span className={`mt-0.5 text-[9.5px] ${MUTED}`}>tCO2e</span>
          </div>
        </div>
        <ul className="min-w-[7rem] space-y-2">
          {items.map(([k, label, v]) => (
            <li key={k} className="flex items-start gap-2">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: SCOPE[k].color }} />
              <div className="leading-tight">
                <p className="text-[11.5px] font-semibold text-[#0E2A14]">{label}</p>
                <p className={`text-[10.5px] tabular-nums ${MUTED}`}>
                  {v > 0 ? <><span className="font-semibold text-[#0E2A14]/80">{fmt((v / sum) * 100, tr, 0)}%</span> · {fmt(v, tr, 2)} t</> : '—'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {!(sum > 0) && <p className={`mt-1 text-center text-[10px] ${MUTED}`}>{tr ? 'Hesaplanmış emisyon yok' : 'No calculated emissions yet'}</p>}
    </Card>
  );
}

// ── breakdowns: one data builder for the bar panel and the table; `labels` are the frame when nothing is calculated ──
const PLACEHOLDER_SOURCES = ['stationary_combustion', 'mobile_combustion', 'electricity', 'purchased_goods', 'business_travel', 'waste'];
function breakdown(view, summary, facilityList, tr, categoryName) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  if (view === 'scope3') {
    const all = (summary?.scope3_by_category || []).map(c => ({ key: c.category, label: `${c.ghg_number}. ${tr ? c.name_tr : c.name_en}`, kg: num(c.total_co2e_kg) }));
    return { rows: all.filter(r => r.kg > 0), labels: all.slice(0, 6).map(r => ({ key: r.key, label: r.label })) };
  }
  if (view === 'facilities') {
    const byId = new Map((facilityList || []).map(f => [Number(f.id), f]));
    const rows = (summary?.by_facility || []).map(f => {
      const meta = byId.get(Number(f.facility_id));
      return { key: `f${f.facility_id}`, label: f.facility_name, sub: [meta?.city, meta?.country].filter(Boolean).join(', ') || undefined, kg: num(f.total_kg) };
    });
    if (num(summary?.unassigned_kg) > 0) rows.push({ key: 'unassigned', label: tr ? 'Tesise atanmamış' : 'Not assigned to a facility', kg: num(summary.unassigned_kg) });
    // The facilities the company has registered are real configuration, so they label the empty frame.
    const labels = (facilityList || []).filter(f => f.is_active !== false).slice(0, 6).map(f => ({ key: `f${f.id}`, label: f.name, sub: [f.city, f.country].filter(Boolean).join(', ') || undefined }));
    return { rows: rows.filter(r => r.kg > 0), labels };
  }
  const rows = (summary?.by_category || []).map(c => ({ key: c.category, label: categoryName(c.category), kg: num(c.total_kg) }));
  return { rows: rows.filter(r => r.kg > 0), labels: PLACEHOLDER_SOURCES.map(k => ({ key: k, label: categoryName(k) })) };
}
const VIEW_OPTIONS = (tr) => [
  { value: 'sources', label: tr ? 'Kaynağa göre' : 'By source' },
  { value: 'facilities', label: tr ? 'Tesise göre' : 'By facility' },
  { value: 'scope3', label: tr ? 'Kapsam 3' : 'Scope 3' },
];

export function SourcesCard({ summary, facilityList, tr, categoryName }) {
  const [view, setView] = useState('sources');
  const { rows: raw, labels } = breakdown(view, summary, facilityList, tr, categoryName);
  const rows = [...raw].sort((a, b) => b.kg - a.kg);
  const empty = rows.length === 0;
  const shown = empty ? labels : rows.slice(0, 6);
  return (
    <Card testid="sources-card" title={tr ? 'Emisyon dağılımı' : 'Emissions breakdown'} subtitle="tCO2e"
      action={<MiniSelect label={tr ? 'Dağılım' : 'Breakdown'} value={view} onChange={setView} options={VIEW_OPTIONS(tr)} />}>
      {shown.length === 0 ? (
        <p className={`flex h-[150px] items-center justify-center text-center text-[11px] ${MUTED}`}>{tr ? 'Bu dağılım için tanımlı kalem yok' : 'Nothing configured for this breakdown yet'}</p>
      ) : (
        <ul className="space-y-[9px]">
          {shown.map((r, i) => (
            <li key={r.key} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-2">
              <span className={`truncate text-[11.5px] ${empty ? 'text-[#0E2A14]/55' : 'text-[#0E2A14]/80'}`} title={r.label}>{r.label}</span>
              <div className={`h-[7px] overflow-hidden rounded-full ${GHOST}`}>
                {!empty && <div className="h-full rounded-full" style={{ width: `${(r.kg / rows[0].kg) * 100}%`, backgroundColor: i === 0 ? '#175022' : '#2ABD41' }} />}
              </div>
              <span className={`w-12 text-right text-[11.5px] font-semibold tabular-nums ${empty ? 'text-[#0E2A14]/25' : 'text-[#0E2A14]/85'}`}>{empty ? '—' : fmt(r.kg / 1000, tr, r.kg / 1000 < 10 ? 2 : 1)}</span>
            </li>
          ))}
        </ul>
      )}
      {empty && shown.length > 0 && <p className={`mt-2 text-center text-[10px] ${MUTED}`}>{tr ? 'Hesaplanmış emisyon yok — veri girildikçe çubuklar dolar' : 'No calculated emissions yet — bars fill as data is entered'}</p>}
    </Card>
  );
}

// The emissions table: facilities (with their location), sources or Scope 3 categories, from the server's own groupings.
export function PerformanceTable({ summary, facilityList, tr, categoryName }) {
  const [chosen, setChosen] = useState('facilities');
  let view = chosen;
  let { rows: raw, labels } = breakdown(view, summary, facilityList, tr, categoryName);
  if (view === 'facilities' && raw.length === 0 && labels.length === 0) {      // no facility to show: the frame is labelled by source
    view = 'sources';
    ({ rows: raw, labels } = breakdown(view, summary, facilityList, tr, categoryName));
  }
  const rows = [...raw].sort((a, b) => b.kg - a.kg);
  const empty = rows.length === 0;
  const shown = empty ? labels.slice(0, 4) : rows.slice(0, 6);
  const total = rows.reduce((a, r) => a + r.kg, 0);
  const head = view === 'facilities' ? (tr ? 'Tesis' : 'Facility') : view === 'scope3' ? (tr ? 'Kategori' : 'Category') : (tr ? 'Kaynak' : 'Source');
  return (
    <Card testid="performance-table" title={tr ? 'Emisyon performansı' : 'Emissions performance'} subtitle="tCO2e"
      action={<MiniSelect label={tr ? 'Tablo görünümü' : 'Table view'} value={view} onChange={setChosen} options={VIEW_OPTIONS(tr)} />}>
      <div className="overflow-hidden rounded-lg border border-[#EDF2EE]">
        <table className="w-full text-left text-[11.5px]">
          <thead>
            <tr className={`bg-[#F7FAF8] text-[9.5px] font-semibold uppercase tracking-wide ${MUTED}`}>
              <th className="px-2.5 py-1.5 font-semibold">{head}</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">{tr ? 'Emisyon (tCO2e)' : 'Emissions (tCO2e)'}</th>
              <th className="hidden px-2.5 py-1.5 font-semibold sm:table-cell">{tr ? 'Pay' : 'Share'}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr className="border-t border-[#EDF2EE]"><td colSpan={3} className={`px-2.5 py-5 text-center ${MUTED}`}>{tr ? 'Henüz tanımlı kalem yok' : 'Nothing configured for this view yet'}</td></tr>
            ) : shown.map((r, i) => (
              <tr key={r.key} className="border-t border-[#EDF2EE]">
                <td className="px-2.5 py-1.5">
                  <p className={`max-w-[16rem] truncate font-semibold ${empty ? 'text-[#0E2A14]/55' : 'text-[#0E2A14]'}`} title={r.label}>{r.label}</p>
                  {r.sub && <p className={`truncate text-[9.5px] leading-3 ${MUTED}`}>{r.sub}</p>}
                </td>
                <td className={`px-2.5 py-1.5 text-right font-semibold tabular-nums ${empty ? 'text-[#0E2A14]/25' : 'text-[#0E2A14]/85'}`}>{empty ? '—' : fmt(r.kg / 1000, tr, 2)}</td>
                <td className="hidden px-2.5 py-1.5 sm:table-cell">
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full ${GHOST}`}>
                      {!empty && <div className="h-full rounded-full" style={{ width: `${(r.kg / total) * 100}%`, backgroundColor: i === 0 ? '#175022' : '#2ABD41' }} />}
                    </div>
                    <span className={`w-8 text-right tabular-nums ${empty ? 'text-[#0E2A14]/25' : MUTED}`}>{empty ? '—' : `${fmt((r.kg / total) * 100, tr, 0)}%`}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {empty ? (
          <p className={`border-t border-[#EDF2EE] px-2.5 py-1.5 text-center text-[10px] ${MUTED}`}>{tr ? 'Hesaplanmış emisyon yok — değerler veri girildikçe görünür' : 'No calculated emissions yet — values appear as data is entered'}</p>
        ) : rows.length > shown.length && (
          <p className={`border-t border-[#EDF2EE] px-2.5 py-1 text-[10px] ${MUTED}`}>{tr ? `+${rows.length - shown.length} diğer` : `+${rows.length - shown.length} more`}</p>
        )}
      </div>
    </Card>
  );
}

// ── carbon reduction progress: each target against the inventory shown (the same figures as the Targets tab) ─────
export function ReductionCard({ targets, totalTonne, tr, canApprove, selectedYear, onAdd, onAll }) {
  const tonne = (t) => Number(t || 0).toLocaleString(tr ? 'tr-TR' : 'en-GB', { maximumFractionDigits: Math.abs(t) < 10 ? 2 : 0 });
  return (
    <Card testid="reduction-card" title={tr ? 'Azaltım ilerlemesi' : 'Reduction progress'}
      action={<button type="button" onClick={onAll} className="text-[10.5px] font-semibold text-[#1D9C31] hover:underline">{tr ? 'Tümü' : 'All targets'}</button>}>
      {(!targets || targets.length === 0) ? (
        <div>
          <div className={`h-2 rounded-full ${GHOST}`} aria-hidden="true" />
          <div className={`mt-1 flex justify-between text-[10px] ${MUTED}`} aria-hidden="true"><span>{tr ? 'Hedef' : 'Target'}: —</span><span>{tr ? 'Mevcut' : 'Current'}: —</span></div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className={`text-[11px] ${MUTED}`}>{tr ? 'Henüz hedef yok' : 'No targets yet'}</p>
            {canApprove && <button type="button" onClick={onAdd} className="rounded-md border border-[#CDE7D2] px-2.5 py-1 text-[10.5px] font-bold text-[#1D9C31] hover:bg-[#F1FCF2]">{tr ? '+ Hedef ekle' : '+ Add target'}</button>}
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {targets.slice(0, 3).map(t => {
            // The target's own base and reduction %, exactly as the Targets tab computes them.
            const baseTonne = (parseFloat(t.base_emissions_kg) || 0) / 1000;
            const targetTonne = baseTonne * (1 - (parseFloat(t.target_reduction_percent) || 0) / 100);
            const reduction = baseTonne - targetTonne;
            const pct = Math.min(Math.max(Math.round((reduction > 0 ? (baseTonne - totalTonne) / reduction : 0) * 100), 0), 100);
            const noData = !(totalTonne > 0);
            const above = baseTonne > 0 && totalTonne > baseTonne;
            return (
              <li key={t.id}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[11.5px] font-semibold text-[#0E2A14]">{t.title || `${t.target_year || ' - '} ${tr ? 'hedefi' : 'target'}`}</span>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${noData ? 'bg-[#EEF3EF] text-[#51625A]' : above ? 'bg-[#FDE8E8] text-[#B42318]' : 'bg-[#E3F7E7] text-[#1B7F2C]'}`}>
                    {noData ? (tr ? 'Veri yok' : 'No data') : above ? (tr ? `Bazın %${Math.round((totalTonne / baseTonne - 1) * 100)} üzerinde` : `${Math.round((totalTonne / baseTonne - 1) * 100)}% above base`) : `${pct}%`}
                  </span>
                </div>
                <div className={`h-2 overflow-hidden rounded-full ${GHOST}`}>
                  <div className="h-full rounded-full bg-[#2ABD41]" style={{ width: `${noData || above ? 0 : pct}%` }} />
                </div>
                <div className={`mt-1 flex justify-between text-[10px] ${MUTED}`}>
                  <span>{tr ? 'Hedef' : 'Target'}: {tonne(targetTonne)} tCO2e</span>
                  <span>{tr ? 'Mevcut' : 'Current'}: {totalTonne > 0 ? `${tonne(totalTonne)} tCO2e` : (tr ? `${selectedYear} için kayıt yok` : `nothing for ${selectedYear}`)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ── insights: calculated facts / warnings / missing information / the AI action — never mixed ──────────────────
const KIND = {
  fact:    { icon: CheckCircle2, chip: 'bg-[#E3F7E7] text-[#1B7F2C]', dot: 'text-[#2ABD41]', en: 'Calculated', tr: 'Hesaplanan' },
  warning: { icon: AlertTriangle, chip: 'bg-amber-50 text-amber-700', dot: 'text-amber-500', en: 'Warning', tr: 'Uyarı' },
  missing: { icon: CircleDashed, chip: 'bg-slate-100 text-slate-600', dot: 'text-slate-400', en: 'Missing', tr: 'Eksik' },
};
const ORDER = ['warning', 'missing', 'fact'];

export function InsightsPanel({ insights, tr, onAction, hasInventory, wide = false }) {
  const [all, setAll] = useState(false);
  const ai = insights.find(i => i.kind === 'ai') || null;           // an action, kept apart from the findings
  const sorted = insights.filter(i => i.kind !== 'ai').sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  // Collapsed: the most important warnings/gaps AND the first calculated findings, so the panel never shows only problems.
  const facts = sorted.filter(i => i.kind === 'fact');
  // The gaps that block the inventory come first (nothing calculated yet, required questions open), then the warnings.
  const weight = (i) => (['no-emissions', 'required-open'].includes(i.id) ? 0 : i.kind === 'warning' ? 1 : 2);
  const rest = sorted.filter(i => i.kind !== 'fact').sort((a, b) => weight(a) - weight(b));
  const list = all ? sorted : [...rest.slice(0, wide ? 4 : 3), ...facts.slice(0, wide ? 4 : 2)];
  const hidden = sorted.length - list.length;
  return (
    <Card testid="insights-panel" title={tr ? 'Karbon zekâsı' : 'Carbon intelligence'} subtitle={tr ? 'bulgular, uyarılar, eksikler' : 'findings, warnings, gaps'}>
      {list.length === 0 ? (
        <div className="flex h-16 items-center justify-center gap-2 rounded-lg bg-[#0E2A14]/[0.03] px-4 text-center">
          <Info className="h-4 w-4 text-[#0E2A14]/30" />
          <p className={`text-[11.5px] font-medium ${MUTED}`}>
            {hasInventory ? (tr ? 'Henüz yorumlanacak yeterli veri yok' : 'Not enough data yet to draw insights')
              : (tr ? 'Bu yıl için envanter yok' : 'There is no inventory for this year')}
          </p>
        </div>
      ) : (
        <ul className={wide ? 'grid gap-1.5 md:grid-cols-2' : 'space-y-1.5'}>
          {list.map(i => {
            const k = KIND[i.kind];
            const Icon = k.icon;
            return (
              <li key={i.id} data-testid={i.id === 'unassigned' ? 'unassigned-note' : `insight-${i.id}`} data-kind={i.kind}
                className="flex items-start gap-2 rounded-lg border border-[#EDF2EE] px-2.5 py-2">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${k.dot}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${k.chip}`}>{tr ? k.tr : k.en}</span>
                    <span className="text-[11.5px] font-semibold text-[#0E2A14]">{i.title}</span>
                  </p>
                  <p className={`mt-0.5 text-[11.5px] leading-[1.4] ${MUTED}`}>{i.text}</p>
                  {i.action && (
                    <button type="button" onClick={() => onAction(i.action)}
                      className="mt-0.5 inline-flex items-center gap-0.5 text-[10.5px] font-bold text-[#1D9C31] hover:underline">
                      {i.action.label}<ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {(hidden > 0 || all) && (
        <button type="button" onClick={() => setAll(v => !v)} className="mt-1.5 text-[10.5px] font-bold text-[#1D9C31] hover:underline">
          {all ? (tr ? 'Daha az göster' : 'Show less') : (tr ? `Tümünü göster (${sorted.length})` : `Show all (${sorted.length})`)}
        </button>
      )}
      {ai && (
        <div data-testid="insight-ask-ai" data-kind="ai" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-[#0E2A14] px-3 py-2 text-white">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#51D766]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-white/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide">{tr ? 'AI asistan' : 'AI assistant'}</span>
              <span className="text-[11.5px] font-semibold">{ai.title}</span>
            </p>
            <p className="mt-0.5 text-[10.5px] leading-[1.4] text-white/70">{ai.text}</p>
          </div>
          <button type="button" onClick={() => onAction(ai.action)}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-[#51D766] px-2.5 py-1 text-[10.5px] font-bold text-[#0E2A14] hover:bg-[#6BE07D]">
            {ai.action.label}<ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </Card>
  );
}

// ── the inventory shown: its status, data quality and the ways to carry on (the ONE place this is shown) ───────
export function InventoryStatusCard({ inventory, status, tr, canEdit, yearInventoryCount, onAction, selectedYear }) {
  if (!inventory) {
    return (
      <Card testid="inventory-status" title={tr ? 'Envanter durumu' : 'Inventory status'}>
        <div>
          <div className={`h-2 rounded-full ${GHOST}`} aria-hidden="true" />
          <div className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden="true">
            {[tr ? 'Yanıtlanan' : 'Answered', tr ? 'Zorunlu, açık' : 'Required open', tr ? 'Sonraya bırakılan' : 'Deferred'].map(l => (
              <div key={l} className="rounded-lg bg-[#F6FAF7] px-2 py-1.5"><p className="text-[15px] font-bold leading-none text-[#0E2A14]/25">—</p><p className={`mt-0.5 text-[9.5px] ${MUTED}`}>{l}</p></div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className={`text-[11px] leading-4 ${MUTED}`}>{tr ? `${selectedYear} için envanter yok.` : `No inventory for ${selectedYear}.`}</p>
            {canEdit && (
              <button type="button" onClick={() => onAction({ kind: 'tab', tab: 'questionnaire' })}
                className="shrink-0 rounded-md btn-primary px-3 py-1.5 text-[11px] font-bold">{tr ? 'Envanter başlat' : 'Start an inventory'}</button>
            )}
          </div>
        </div>
      </Card>
    );
  }
  const done = inventory.status === 'completed';
  const signed = !!inventory.signed_at;
  const percent = Number.isFinite(Number(inventory.progress?.percent)) ? Number(inventory.progress.percent) : null;
  const answered = status.answered ?? (Number.isFinite(Number(inventory.progress?.completed)) ? Number(inventory.progress.completed) : null);
  const stateLabel = signed ? (tr ? 'İmzalandı' : 'Signed') : done ? (tr ? 'Tamamlandı' : 'Completed') : (tr ? 'Devam ediyor' : 'In progress');
  const stateChip = signed || done ? 'bg-[#E3F7E7] text-[#1B7F2C]' : 'bg-amber-50 text-amber-700';
  const stat = (label, value, tone = '') => (
    <div className="rounded-lg bg-[#F6FAF7] px-2 py-1.5">
      <p className={`text-[15px] font-bold leading-none tabular-nums ${tone || 'text-[#0E2A14]'}`}>{value == null ? '—' : value}</p>
      <p className={`mt-0.5 text-[9.5px] font-medium leading-3 ${MUTED}`}>{label}</p>
    </div>
  );
  const updated = inventory.updated_at ? new Date(inventory.updated_at).toLocaleDateString(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const open = (status.requiredUnanswered ?? 0) + (status.pending ?? 0) > 0;
  const btn = 'inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition';
  return (
    <Card testid="inventory-status" title={tr ? 'Envanter durumu' : 'Inventory status'}
      subtitle={yearInventoryCount > 1 ? `1/${yearInventoryCount}` : undefined}
      action={<span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold ${stateChip}`}>{stateLabel}</span>}>
      <p className="flex items-baseline gap-1.5 truncate">
        <span data-testid="inventory-status-title" className="truncate text-[13.5px] font-bold text-[#0E2A14]">{inventory.title || `#${inventory.report_id}`}</span>
        <span className={`shrink-0 text-[10px] ${MUTED}`}>{inventory.reporting_year}{updated ? ` · ${updated}` : ''}</span>
      </p>
      <div className="mt-2">
        <div className={`mb-0.5 flex items-center justify-between text-[10.5px] font-medium ${MUTED}`}>
          <span>{tr ? 'Tamamlanma' : 'Completion'}</span><span className="tabular-nums font-semibold text-[#0E2A14]/80">{percent == null ? '—' : `${percent}%`}</span>
        </div>
        <div className={`h-1.5 overflow-hidden rounded-full ${GHOST}`} role="progressbar" aria-valuenow={percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#2ABD41]" style={{ width: `${percent ?? 0}%` }} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {stat(tr ? 'Yanıtlanan' : 'Answered', answered)}
        {stat(tr ? 'Zorunlu, açık' : 'Required open', status.requiredUnanswered, (status.requiredUnanswered ?? 0) > 0 ? 'text-[#B42318]' : '')}
        {stat(tr ? 'Sonraya bırakılan' : 'Deferred', status.pending, (status.pending ?? 0) > 0 ? 'text-amber-600' : '')}
      </div>
      <p className={`mt-1.5 flex items-center gap-1.5 text-[10.5px] ${MUTED}`} data-testid="report-status">
        <FileText className="h-3 w-3 shrink-0 opacity-60" />
        {signed ? (tr ? 'Rapor: imzalı envanterden hazır' : 'Report: ready from the signed inventory')
          : done ? (tr ? 'Rapor: hazır, oluşturulabilir' : 'Report: ready to generate')
            : (tr ? 'Rapor: envanter tamamlanınca oluşturulabilir' : 'Report: available once the inventory is completed')}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button type="button" data-testid="action-continue" onClick={() => onAction({ kind: 'continue' })} className={`${btn} btn-dark`}>
          <ClipboardList className="h-3 w-3" />{done ? (tr ? 'Görüntüle' : 'View') : (tr ? 'Devam et' : 'Continue')}
        </button>
        <button type="button" data-testid="action-emissions" onClick={() => onAction({ kind: 'tab', tab: 'emissions' })}
          className={`${btn} border border-[#E1E9E3] bg-white text-[#0E2A14]/80 hover:bg-[#F6FAF7]`}><Leaf className="h-3 w-3" />{tr ? 'Emisyonlar' : 'Emissions'}</button>
        <button type="button" data-testid="action-report" onClick={() => onAction({ kind: 'tab', tab: 'reporting' })}
          className={`${btn} border border-[#E1E9E3] bg-white text-[#0E2A14]/80 hover:bg-[#F6FAF7]`}><FileText className="h-3 w-3" />{tr ? 'Rapor' : 'Report'}</button>
        {open && (
          <button type="button" data-testid="action-pending" onClick={() => onAction({ kind: 'continue', openPending: true })}
            className={`${btn} col-span-3 border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100`}>{tr ? 'Bekleyen soruları incele' : 'Review pending questions'}</button>
        )}
      </div>
    </Card>
  );
}
