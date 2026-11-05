'use client';

import { useMemo, useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';
import useIsomorphicLayoutEffect from '@/lib/hooks/useIsomorphicLayoutEffect';
import useCountUp from '@/lib/hooks/useCountUp';
import { DASHBOARD_ANIM_STYLES } from '@/lib/constants/dashboardAnimations';
import { Card, KpiCard, TrendCard, ScopeCard, SourcesCard, PerformanceTable, ReductionCard, InsightsPanel, InventoryStatusCard, useInventoryStatus, SCOPE } from './DashboardWidgets';
import { buildInsights, scopeShares, yearComparison } from '@/lib/dashboard/insights';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  Leaf,
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
import { fixed } from '@/lib/formatNumber';
import { notCountedText, hasNotCounted } from '@/lib/notCounted';
import { roleLabel } from '@/lib/permissions';

// ─── Full month names (only needed here for the detailed monthly breakdown) ──
const MONTHS_TR_FULL = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const MONTHS_EN_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
              <span className="shrink-0 text-[10px] font-bold text-[#072C0E]/40">{fixed(d.tonne, 2)}t</span>
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
          <span className="text-[13px] font-bold leading-none text-[#072C0E]">{fixed((progress * 100), 0)}%</span>
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
function ChartCard({ title, subtitle, icon: Icon, children, className = '', action }) {
  return <Card title={title} subtitle={subtitle} icon={Icon} action={action} className={className}>{children}</Card>;
}

// Turkish dative after a year, by its last spoken word: 2024'e, 2026'ya,
// 2022'ye, 2029'a, 2030'a, 2000'e.
function trDative(year) {
  const n = Number(year);
  const ones = ["'e", "'e", "'ye", "'e", "'e", "'e", "'ya", "'ye", "'e", "'a"];
  const tens = ["'e", "'a", "'ye", "'a", "'a", "'ye", "'a", "'e", "'e", "'a"];
  if (n % 10) return ones[n % 10];
  if (n % 100) return tens[(n % 100) / 10];
  return "'e";
}

const ClipboardListIcon = () => (
  <svg className="h-3.5 w-3.5 shrink-0 text-[#072C0E]/35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </svg>
);

// ─── Main Component ────────────────────────────────────────────────────────
// Small targets (e.g. 0,35 t) must not round to "0": two decimals under 10 t.
const tonneLabel = (t, tr) => Number(t || 0).toLocaleString(tr ? 'tr-TR' : 'en-GB', {
  maximumFractionDigits: Math.abs(t) < 10 ? 2 : 0,
});

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
  onYearChange,
  canApprove = false,
  canEdit = true,
  member = null,
  inventory = null,
  inventoryId = null,
  yearInventoryCount = 0,
}) {
  const tr = language === 'tr';
  // A member who joined from an invite (any role but owner) in the last two
  // weeks is told once which team they joined and what their role lets them
  // do — they landed on an empty-year screen with no word of either.
  const welcomeKey = member?.id ? `carbonless_welcome_seen_${member.id}` : null;
  const [welcomeSeen, setWelcomeSeen] = useState(true);
  useEffect(() => {
    if (!welcomeKey) return;
    try { setWelcomeSeen(localStorage.getItem(welcomeKey) === '1'); } catch { setWelcomeSeen(true); }
  }, [welcomeKey]);
  const isNewMember = !!member?.role && member.role !== 'owner' && member.company_name
    && member.member_since && (Date.now() - new Date(member.member_since).getTime()) < 14 * 86400000;
  const roleHint = {
    admin: { tr: 'Kayıtları girebilir, onaylayabilir ve ekibi yönetebilirsiniz.', en: 'You can enter and approve data and manage the team.' },
    manager: { tr: 'Kayıt girebilir ve ekibin kayıtlarını onaylayabilirsiniz.', en: "You can enter data and approve the team's entries." },
    data_entry: { tr: 'Girdiğiniz kayıtlar, bir yönetici onayladıktan sonra toplamlara eklenir.', en: 'Your entries count in the totals once a manager approves them.' },
    auditor: { tr: 'Verileri ve raporları görüntüleyebilirsiniz; değişiklik yapamazsınız.', en: 'You can view the data and reports; you cannot change them.' },
  }[member?.role];
  const dismissWelcome = () => {
    setWelcomeSeen(true);
    try { localStorage.setItem(welcomeKey, '1'); } catch { /* shown again next time */ }
  };

  // Items waiting in "Onay Bekleyenler" (entries + advisor approvals), shown
  // to approvers under Pending Actions so they are not only in the bell.
  // Counted apart: "13 kayıt" read as 13 emission entries when 11 were
  // questionnaire answers waiting for an advisor approval.
  const [pendingCounts, setPendingCounts] = useState({ entries: 0, advisor: 0 });
  const pendingApprovals = pendingCounts.entries + pendingCounts.advisor;
  useEffect(() => {
    if (!canApprove) { setPendingCounts({ entries: 0, advisor: 0 }); return; }
    let cancelled = false;
    const count = async (req) => {
      try {
        const res = await req();
        if (!res.ok) return 0;
        const d = await res.json().catch(() => null);
        const list = Array.isArray(d) ? d : (d?.results ?? d?.entries ?? d?.approvals ?? []);
        return Array.isArray(list) ? list.length : 0;
      } catch { return 0; }
    };
    Promise.all([count(api.getPendingEntries), count(api.getPendingAdvisorApprovals)])
      .then(([a, b]) => { if (!cancelled) setPendingCounts({ entries: a, advisor: b }); });
    return () => { cancelled = true; };
  }, [canApprove, entries]);
  // Years other than the selected one that have entries (newest first).
  const otherYears = (summary?.years_with_data ?? []).filter(y => y !== Number(selectedYear));
  const totalTonne = summary?.total_tonne  ?? 0;
  // "2024'e göre ↓ %12,4": the year before, whole — or, for the running
  // year, the same months of last year (the server leaves it out when that
  // would not be a fair comparison).
  const yoy = (() => {
    const c = summary?.previous_year_change;
    if (!c || typeof c.change_pct !== 'number') return null;
    const pct = Math.abs(c.change_pct).toLocaleString(tr ? 'tr-TR' : 'en-US', { maximumFractionDigits: 1 });
    const arrow = c.change_pct <= 0 ? '↓' : '↑';
    const monthsTr = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const span = c.months < 12
      ? (tr ? `${monthsTr[0]}–${monthsTr[c.months - 1]} ${c.previous_year}` : `${monthsEn[0]}–${monthsEn[c.months - 1]} ${c.previous_year}`)
      : String(c.previous_year);
    return {
      down: c.change_pct <= 0,
      text: tr ? `${arrow} %${pct} · ${span}${trDative(c.previous_year)} göre` : `${arrow} ${pct}% vs ${span}`,
      title: tr
        ? `${span}: ${fixed(c.previous_kg / 1000, 2)} tCO2e → ${fixed(c.current_kg / 1000, 2)} tCO2e`
        : `${span}: ${fixed(c.previous_kg / 1000, 2)} tCO2e → ${fixed(c.current_kg / 1000, 2)} tCO2e`,
    };
  })();
  const s1         = summary?.scope1_tonne ?? 0;
  const s2         = summary?.scope2_tonne ?? 0;
  const s3         = summary?.scope3_tonne ?? 0;
  // Memoized so the array reference is stable  -  prevents false "dep changed every
  // render" warnings in the useMemo hooks below that depend on monthly.
  const monthly    = useMemo(() => summary?.monthly ?? [], [summary?.monthly]);

  // Derived: average monthly (only months with data)  -  memoized so the filter/reduce
  // only re-runs when monthly data changes, not on every local state update.
  const { avgTonne, activeMonths } = useMemo(() => {
    const active = monthly.filter(m => m.total_kg > 0);
    return {
      activeMonths: active.length,
      avgTonne: active.length > 0
        ? active.reduce((a, m) => a + m.total_kg, 0) / active.length / 1000
        : 0,
    };
  }, [monthly]);

  // Language-aware month name arrays (used in JSX, not inside any memo)
  const MONTHS_FULL = tr ? MONTHS_TR_FULL : MONTHS_EN_FULL;

  // Biggest monthly spike  -  memoized so it only recomputes when monthly data changes.
  // Returns a numeric index into `monthly`; the name lookup uses MONTHS_FULL at render time.
  const peakMonth = useMemo(
    () => monthly.reduce((best, m, i) => m.total_kg > (monthly[best]?.total_kg ?? 0) ? i : best, 0),
    [monthly],
  );

  // The selected inventory's own status from the server (keyed by its id: never another inventory's numbers).
  const invStatus = useInventoryStatus(inventoryId);

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
            {tr ? 'Toplam' : 'Total'}: {fixed(totalTonne, 2)} tCO2e
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
            <p className="text-xs text-[#072C0E]/50">{tr ? 'Kapsam 1' : 'Scope 1'}</p>
            <p className="text-2xl font-black text-[#072C0E]">{fixed(s1, 2)} <span className="text-sm font-normal">tCO2e</span></p>
          </div>
          <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
            <p className="text-xs text-[#072C0E]/50">{tr ? 'Kapsam 2' : 'Scope 2'}</p>
            <p className="text-2xl font-black text-[#072C0E]">{fixed(s2, 2)} <span className="text-sm font-normal">tCO2e</span></p>
          </div>
          <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
            <p className="text-xs text-[#072C0E]/50">{tr ? 'Kapsam 3' : 'Scope 3'}</p>
            <p className="text-2xl font-black text-[#072C0E]">{fixed(s3, 2)} <span className="text-sm font-normal">tCO2e</span></p>
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

  // Signup creates "Tesis 1", "Tesis 2"… from the number of facilities typed
  // there; until they are named (or given a city) entries and reports carry
  // those placeholders, so ask once, here, with a way to Settings → Tesisler.
  const unnamedFacilities = (facilityList || []).filter(
    f => /^(Tesis|Facility) \d+$/.test((f.name || '').trim()) && !(f.city || '').trim(),
  );
  // Facilities in Turkey with no grid connection: the official electricity
  // factor depends on it, so their electricity waits until it is chosen.
  const noConnectionFacilities = (facilityList || []).filter(
    f => f.is_active !== false && !f.grid_connection
      && ['tr', 'tur', 'türkiye', 'turkiye', 'turkey'].includes((f.country || '').trim().toLocaleLowerCase('tr-TR')),
  );
  // A grid connection a data-entry member gave in Q24, waiting for an approver.
  const proposedConnectionFacilities = (facilityList || []).filter(f => f.proposed_grid_connection);

  const hasData = totalTonne > 0 || entries.length > 0;
  const notCountedLine = hasNotCounted(summary?.not_counted) ? notCountedText(summary.not_counted, tr) : null;
  const insights = buildInsights({
    summary, targets, inventory, status: null, canApprove, pendingApprovals, notCountedLine, tr,
    facilitiesWithoutGrid: canApprove ? noConnectionFacilities.length : 0,
    categoryName: (c) => catLabel(c, tr),
  });
  // Every action carries the inventory the dashboard is on (inventoryId), never a guess.
  const runAction = (a) => {
    if (a.kind === 'tab') {
      if (a.tab === 'settings') { try { sessionStorage.setItem('carbonless_settings_section', 'facilities'); } catch { /* opens on Profile */ } }
      setActiveTab(a.tab);
    } else if (a.kind === 'continue') {
      try {
        if (inventoryId) sessionStorage.setItem('carbonless_continue_inventory', String(inventoryId));
        if (a.openPending) sessionStorage.setItem('carbonless_open_pending', '1');
      } catch { /* opens the library */ }
      setActiveTab('questionnaire');
    } else if (a.kind === 'ask-ai') {
      window.dispatchEvent(new CustomEvent('carbonless:assistant', { detail: { open: true, prefill: a.prefill } }));
    }
  };
  const shares = scopeShares(summary);
  const cmp = yearComparison(summary?.previous_year_change, tr);
  const notYet = tr ? 'Henüz hesaplanmadı' : 'Not calculated yet';
  const LS = (long, short) => (<><span className="max-sm:hidden">{long}</span><span className="sm:hidden">{short}</span></>);
  const share = (t) => (shares && t > 0 ? `${fixed((Math.max(t, 0) / shares.total) * 100, 0)}%` : null);
  const scopeCard = (key, label, sub, tonne) => (
    <KpiCard testid={`kpi-${key}`} scope={key} icon={SCOPE[key].Icon} label={label} value={tonne > 0 ? tonne : null} sub={sub}
      badge={share(tonne) ? { text: share(tonne), tone: 'neutral' } : null}
      unavailable={tonne > 0 ? null : (hasData ? (tr ? 'Hesaplanmış emisyon yok' : 'No emissions calculated') : notYet)} />
  );

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <style>{DASHBOARD_ANIM_STYLES}</style>

      {isNewMember && !welcomeSeen && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-[#2ABD41]/30 bg-[#F1FCF2] px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2ABD41]" />
          <div className="min-w-0 flex-1 text-xs text-[#175022]">
            <p className="font-bold">
              {tr
                ? `${member.company_name} ekibine ${roleLabel(member.role, true)} olarak katıldınız.`
                : `You joined ${member.company_name} as ${roleLabel(member.role, false)}.`}
            </p>
            {roleHint && <p className="mt-0.5">{tr ? roleHint.tr : roleHint.en}</p>}
          </div>
          <button onClick={dismissWelcome} className="shrink-0 rounded-full btn-primary px-3 py-1 text-[10px] font-bold transition">
            {tr ? 'Anladım' : 'Got it'}
          </button>
        </div>
      )}

      {canApprove && unnamedFacilities.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-[#2ABD41]/30 bg-[#F1FCF2] px-4 py-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#2ABD41]" />
          <p className="min-w-0 flex-1 text-xs font-semibold text-[#175022]">
            {tr
              ? `Tesislerinize ad ve şehir verin: ${unnamedFacilities.map(f => f.name).join(', ')}. Kayıtlarınızda ve raporlarınızda bu adlar görünür.`
              : `Give your facilities a name and city: ${unnamedFacilities.map(f => f.name).join(', ')}. These names appear on your entries and reports.`}
          </p>
          <button
            onClick={() => {
              try { sessionStorage.setItem('carbonless_settings_section', 'facilities'); } catch { /* opens on Profile */ }
              setActiveTab('settings');
            }}
            className="shrink-0 rounded-full btn-primary px-3 py-1 text-[10px] font-bold transition"
          >
            {tr ? 'Düzenle' : 'Edit'}
          </button>
        </div>
      )}

      {/* ── SLIM NOTICES (one line each; no welcome panel, no illustration) ─────────────────────────────── */}
      {entries.length === 0 && otherYears.length > 0 && !(summary?.custom_emissions?.approved_total_kg > 0) && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#E6EDE7] bg-white px-3 py-2 text-[12px] text-[#6B7A70]">
          <Info className="h-3.5 w-3.5 shrink-0 text-[#2ABD41]" />
          <span className="min-w-0 flex-1">
            {tr ? `${selectedYear} için henüz veri yok. Kayıtlarınız başka yıllarda: ${otherYears.join(', ')}.`
              : `No data for ${selectedYear} yet. Your entries are in other years: ${otherYears.join(', ')}.`}
          </span>
          {onYearChange && (
            <button onClick={() => onYearChange(otherYears[0])} className="rounded-md border border-[#CDE7D2] bg-[#F4FBF5] px-2.5 py-1 text-[11px] font-semibold text-[#175022] hover:bg-[#E3F7E7]">
              {tr ? `${otherYears[0]} yılına geç` : `Switch to ${otherYears[0]}`}
            </button>
          )}
        </div>
      )}
      {entries.length === 0 && otherYears.length === 0 && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[#CDE7D2] bg-[#F4FBF5] px-3 py-2 text-[12px] text-[#175022]">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#2ABD41]" />
          <span className="min-w-0 flex-1 font-medium">
            {tr ? 'İlk kaydınızı girin, gerisini biz hesaplayalım — AI ile (önerilen) ya da manuel.' : "Log your first entry and we'll take it from there — with AI (recommended) or manually."}
          </span>
          <button onClick={() => setActiveTab('ai_carbon')} className="inline-flex items-center gap-1 rounded-md btn-primary px-2.5 py-1 text-[11px] font-bold">
            <Sparkles className="h-3 w-3" />{tr ? 'AI ile Başla' : 'Start with AI'}
          </button>
          {canEdit && (
            <button onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }} className="inline-flex items-center gap-1 rounded-md border border-[#CDE7D2] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#175022] hover:bg-[#E3F7E7]">
              <Plus className="h-3 w-3" />{tr ? 'Manuel Giriş' : 'Manual Entry'}
            </button>
          )}
        </div>
      )}

      {/* ── TITLE AREA (compact) ─────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[19px] font-bold leading-tight tracking-tight text-[#0E2A14] sm:text-[20px]">
            {tr ? 'Karbon Emisyon Analitiği' : 'Carbon Emissions Analytics'}
          </h1>
          <p className="mt-0.5 text-[12px] leading-[1.4] text-[#6B7A70]">
            {tr
              ? 'Şirketinizin karbon ayak izini izleyin, azaltım ilerlemesini takip edin ve sürdürülebilir etki yaratın.'
              : "Monitor your company's carbon footprint, track reduction progress, and drive sustainable impact."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setActiveTab('reporting')}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E1E9E3] bg-white px-3 text-[12px] font-semibold text-[#0E2A14]/80 transition hover:bg-[#F6FAF7]">
            {tr ? 'Rapor' : 'Report'}
          </button>
          {/* An auditor can't add entries (read-only role). */}
          {canEdit && (
            <button onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg btn-primary px-3 text-[12px] font-bold transition">
              <Plus className="h-3.5 w-3.5" />{tr ? 'Veri Ekle' : 'Add Data'}
            </button>
          )}
        </div>
      </div>

      {/* ── KPI CARDS: the server's figures for this inventory; unavailable is an em dash, never a zero ─────── */}
      <div data-testid="kpi-row" className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <KpiCard testid="kpi-total" icon={Leaf} label={LS(tr ? 'Toplam CO₂e emisyonu' : 'Total CO₂e emissions', tr ? 'Toplam CO₂e' : 'Total CO₂e')} value={totalTonne > 0 ? totalTonne : null}
          sub={cmp ? LS(tr ? `${cmp.span} dönemine göre` : `vs ${cmp.span}`, tr ? 'Önceki dönem' : `vs ${cmp.span}`) : LS(tr ? 'Karşılaştırılabilir önceki dönem yok' : 'No comparable previous period', tr ? 'Önceki dönem yok' : 'No prior period')}
          badgeTestid="kpi-total-badge"
          badge={cmp ? { text: `${fixed(cmp.pct, 1)}%`, tone: cmp.down ? 'good' : 'bad', arrow: cmp.down ? 'down' : 'up' } : null}
          unavailable={totalTonne > 0 ? null : notYet} />
        {scopeCard('scope1', LS(tr ? 'Kapsam 1 emisyonları' : 'Scope 1 emissions', tr ? 'Kapsam 1' : 'Scope 1'), LS(tr ? 'Doğrudan emisyonlar' : 'Direct emissions', tr ? 'Doğrudan' : 'Direct'), s1)}
        {scopeCard('scope2', LS(tr ? 'Kapsam 2 emisyonları' : 'Scope 2 emissions', tr ? 'Kapsam 2' : 'Scope 2'), LS(tr ? 'Satın alınan enerji' : 'Purchased energy', tr ? 'Enerji' : 'Energy'), s2)}
        {scopeCard('scope3', LS(tr ? 'Kapsam 3 emisyonları' : 'Scope 3 emissions', tr ? 'Kapsam 3' : 'Scope 3'), LS(tr ? 'Dolaylı emisyonlar' : 'Indirect emissions', tr ? 'Dolaylı' : 'Indirect'), s3)}
      </div>

      {/* ── ANALYTICS ROW: trend, scope breakdown, breakdown by source / facility / Scope 3 (always drawn) ───── */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="lg:col-span-2 xl:col-span-1">
          <TrendCard monthly={monthly} annualKg={summary?.annual_kg ?? 0} selectedYear={selectedYear} tr={tr} />
        </div>
        <ScopeCard s1={s1} s2={s2} s3={s3} total={totalTonne} tr={tr} />
        <SourcesCard summary={summary} facilityList={facilityList} tr={tr} categoryName={(c) => catLabel(c, tr)} />
      </div>

      {/* ── LOWER ROW: the emissions table, the inventory status (shown once), reduction progress ───────────── */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:col-span-2 xl:col-span-1">
          <PerformanceTable summary={summary} facilityList={facilityList} tr={tr} categoryName={(c) => catLabel(c, tr)} />
        </div>
        <InventoryStatusCard inventory={inventory} status={invStatus} tr={tr} canEdit={canEdit} selectedYear={selectedYear}
          yearInventoryCount={yearInventoryCount} onAction={runAction} />
        <ReductionCard targets={targets} totalTonne={totalTonne} tr={tr} canApprove={canApprove} selectedYear={selectedYear}
          onAdd={() => setActiveTab('reduction')} onAll={() => setActiveTab('reduction')} />
      </div>

      {/* ── INSIGHTS: calculated findings, warnings, what is missing, and the AI action ──────────────────── */}
      <InsightsPanel wide insights={insights} tr={tr} onAction={runAction} hasInventory={!!inventory} />

    </div>
  );
}
