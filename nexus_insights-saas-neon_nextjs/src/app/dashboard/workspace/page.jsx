'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, Sparkles, Flame, Zap, Truck, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Minus, Globe, Menu, X, ArrowLeft, Leaf,
} from 'lucide-react';
import { getReportFields, getCategoryStatus, REQUIRED_FIELDS } from '@/lib/workspace/api';
import { ChatWorkspace } from '@/components/workspace/ChatWorkspace';
import { StationaryCombustionPanel } from '@/components/workspace/panels/StationaryCombustionPanel';
import { ElectricityPanel } from '@/components/workspace/panels/ElectricityPanel';
import { UpstreamTransportPanel } from '@/components/workspace/panels/UpstreamTransportPanel';
import { api } from '@/lib/utils/api';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  complete:       { dot: 'bg-[#95A847]',    pill: 'bg-[#95A847]/10 border-[#95A847]/20 text-[#527A1A]',  icon: CheckCircle2, label: { tr: 'Tamamlandı',   en: 'Complete'    } },
  in_progress:    { dot: 'bg-amber-400',    pill: 'bg-amber-50 border-amber-200 text-amber-700',           icon: Clock,        label: { tr: 'Devam ediyor', en: 'In Progress' } },
  missing:        { dot: 'bg-[#302817]/18', pill: 'bg-[#302817]/5 border-[#302817]/10 text-[#302817]/45', icon: AlertCircle,  label: { tr: 'Veri yok',    en: 'No data'     } },
  not_applicable: { dot: 'bg-[#302817]/12', pill: '',                                                      icon: Minus,        label: { tr: 'Geçerli değil','en': 'N/A'       } },
};

function StatusDot({ status, size = 'md' }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.missing;
  const sz = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';
  return <span className={`inline-block ${sz} rounded-full shrink-0 ${cfg.dot}`} />;
}

function StatusPill({ status, lang }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.missing;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.pill}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label[lang] || cfg.label.en}
    </span>
  );
}

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: '3A', scope: 1,
    icon: Flame,
    color: 'text-orange-500', bg: 'bg-orange-50', bar: 'bg-orange-400',
    scopeBadge: 'bg-orange-50 text-orange-600 border-orange-100',
    label: { tr: 'Sabit Yanma',     en: 'Stationary Combustion' },
    desc:  { tr: 'Yakıt tüketimi',  en: 'Fuel combustion' },
  },
  {
    id: '4A', scope: 2,
    icon: Zap,
    color: 'text-yellow-500', bg: 'bg-yellow-50', bar: 'bg-yellow-400',
    scopeBadge: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    label: { tr: 'Elektrik',            en: 'Purchased Electricity' },
    desc:  { tr: 'Satın alınan elektrik', en: 'Grid electricity' },
  },
  {
    id: 'K4', scope: 3,
    icon: Truck,
    color: 'text-sky-500', bg: 'bg-sky-50', bar: 'bg-sky-400',
    scopeBadge: 'bg-sky-50 text-sky-600 border-sky-100',
    label: { tr: 'Upstream Taşıma',  en: 'Upstream Transport' },
    desc:  { tr: 'Lojistik ve taşıma', en: 'Logistics & freight' },
  },
];

const SCOPE_GROUPS = [
  { id: 1, label: { tr: 'Kapsam 1', en: 'Scope 1' }, cats: ['3A'] },
  { id: 2, label: { tr: 'Kapsam 2', en: 'Scope 2' }, cats: ['4A'] },
  { id: 3, label: { tr: 'Kapsam 3', en: 'Scope 3' }, cats: ['K4'] },
];

// ── Emission estimate helpers ─────────────────────────────────────────────────
const DEFRA_EF = {
  natural_gas: { 'm³': 2.02, m3: 2.02, kWh: 0.183, GJ: 50.77 },
  fuel_oil:    { litre: 2.52, kg: 2.96, GJ: 74.07 },
  diesel:      { litre: 2.54, GJ: 68.08 },
  lpg:         { litre: 1.51, kg: 2.94, GJ: 59.65 },
};

function estimateEmissionKg(catId, vals) {
  if (catId === '3A') {
    const fuel = vals['rf.3a.fuel_type'];
    const cons = parseFloat(vals['rf.3a.consumption']);
    const unit = vals['rf.3a.unit'];
    const ef = DEFRA_EF[fuel]?.[unit];
    if (!isNaN(cons) && ef) return cons * ef;
  }
  if (catId === '4A') {
    const kwh = parseFloat(vals['rf.4a.consumption_kwh']);
    const ef  = parseFloat(vals['rf.4a.emission_factor']);
    const ren = parseFloat(vals['rf.4a.renewable_on_site']) || 0;
    if (!isNaN(kwh) && !isNaN(ef)) return Math.max(kwh - ren, 0) * ef;
  }
  if (catId === 'K4') {
    const kg = parseFloat(vals['rf.k4.total_emission_kgco2e']);
    if (!isNaN(kg)) return kg;
  }
  return null;
}

function formatEmission(kg) {
  if (kg === null || isNaN(kg)) return null;
  return kg >= 1000
    ? `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`
    : `${kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kgCO₂e`;
}

// ── Scope Sidebar ─────────────────────────────────────────────────────────────
function ScopeSidebar({ selectedCat, onSelect, statuses, fieldValues, lang, open, onClose, completedCount, totalCount }) {
  const tr = lang === 'tr';
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/25 lg:hidden" onClick={onClose} />}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 shrink-0 border-r border-[#302817]/8 bg-[#FAFAF8]
        flex flex-col transition-transform duration-200
        lg:relative lg:inset-auto lg:z-auto lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[#302817]/6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#302817]">
                <Leaf className="h-3 w-3 text-[#B4BE6A]" />
              </div>
              <span className="text-[12px] font-bold text-[#302817]">CarbonIQ</span>
            </div>
            <button onClick={onClose} className="text-[#302817]/30 hover:text-[#302817] transition lg:hidden">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-[#302817]/40 mb-3">
            {tr ? 'ISO 14064-1 Veri Girişi' : 'ISO 14064-1 Data Entry'}
          </p>
          {/* Progress */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-[#302817]/40">
              {completedCount}/{totalCount} {tr ? 'tamamlandı' : 'complete'}
            </span>
            <span className="text-[10px] font-bold text-[#75863B]">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#302817]/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#B4BE6A] transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Scope groups */}
        <div className="flex-1 overflow-y-auto py-2">
          {SCOPE_GROUPS.map((group, gi) => {
            const cats = CATEGORIES.filter(c => group.cats.includes(c.id));
            const groupTotalKg = cats.reduce((sum, cat) => {
              const kg = estimateEmissionKg(cat.id, fieldValues);
              return sum + (kg || 0);
            }, 0);

            return (
              <div key={group.id}>
                {gi > 0 && <div className="mx-4 my-1 h-px bg-[#302817]/6" />}
                {/* Scope label row */}
                <div className="flex items-center justify-between px-4 pt-2 pb-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[#302817]/35">
                    {group.label[lang] || group.label.en}
                  </span>
                  {groupTotalKg > 0 && (
                    <span className="text-[10px] font-bold text-[#75863B]">
                      {formatEmission(groupTotalKg)}
                    </span>
                  )}
                </div>

                {cats.map(cat => {
                  const Icon   = cat.icon;
                  const status = statuses[cat.id] || 'missing';
                  const isActive = selectedCat === cat.id;
                  const emKg  = estimateEmissionKg(cat.id, fieldValues);

                  return (
                    <button
                      key={cat.id}
                      onClick={() => { onSelect(cat.id); onClose(); }}
                      className={`
                        relative w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition
                        ${isActive
                          ? 'bg-[#B4BE6A]/12 text-[#302817]'
                          : 'text-[#302817]/50 hover:bg-[#302817]/4 hover:text-[#302817]'
                        }
                      `}
                    >
                      {/* Left accent bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full bg-[#75863B]" />
                      )}

                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cat.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11.5px] font-semibold truncate ${isActive ? 'text-[#302817]' : ''}`}>
                            {cat.label[lang] || cat.label.en}
                          </span>
                          <StatusDot status={status} size="sm" />
                        </div>
                        {emKg !== null ? (
                          <p className="text-[10px] font-bold text-[#75863B]">{formatEmission(emKg)}</p>
                        ) : (
                          <p className="text-[10px] text-[#302817]/30">{STATUS_CONFIG[status]?.label[lang]}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Back to dashboard */}
        <div className="border-t border-[#302817]/6 p-3">
          <a
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#302817]/40 transition hover:bg-[#302817]/5 hover:text-[#302817]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {tr ? 'Dashboard\'a Dön' : 'Back to Dashboard'}
          </a>
        </div>
      </aside>
    </>
  );
}

// ── Category Card ─────────────────────────────────────────────────────────────
function CategoryCard({ cat, status, fieldValues, onClick, lang }) {
  const Icon        = cat.icon;
  const emKg        = estimateEmissionKg(cat.id, fieldValues);
  const emText      = formatEmission(emKg);
  const isComplete  = status === 'complete';
  const isProgress  = status === 'in_progress';

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex flex-col rounded-2xl border bg-white text-left
        shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 overflow-hidden
        ${isComplete ? 'border-[#95A847]/25'
          : isProgress ? 'border-amber-300/40'
          : 'border-[#302817]/8 hover:border-[#B4BE6A]/35'}
      `}
    >
      {/* Full-width accent strip at top */}
      <div className={`h-[3px] w-full shrink-0 transition-all ${
        isComplete  ? 'bg-gradient-to-r from-[#75863B] to-[#B4BE6A]'
        : isProgress ? 'bg-gradient-to-r from-amber-400 to-amber-300'
        : 'bg-[#302817]/5 group-hover:bg-[#B4BE6A]/30'
      }`} />

      <div className="flex flex-col gap-3.5 p-4 flex-1">
        {/* Header: icon + scope badge + status pill */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cat.bg}`}>
              <Icon className={`h-5 w-5 ${cat.color}`} />
            </div>
            <span className={`text-[9.5px] font-bold uppercase tracking-wide border px-2 py-0.5 rounded-full ${cat.scopeBadge}`}>
              {lang === 'tr' ? `Kapsam ${cat.scope}` : `Scope ${cat.scope}`}
            </span>
          </div>
          <StatusPill status={status} lang={lang} />
        </div>

        {/* Title + description */}
        <div className="flex-1">
          <p className="text-[14px] font-bold text-[#302817] leading-tight">
            {cat.label[lang] || cat.label.en}
          </p>
          <p className="mt-1 text-[11px] text-[#302817]/40 leading-relaxed">
            {cat.desc[lang] || cat.desc.en}
          </p>
        </div>

        {/* Emission figure or CTA */}
        {emText ? (
          <div className={`rounded-xl px-3 py-2.5 border ${
            isComplete
              ? 'bg-gradient-to-r from-[#95A847]/8 to-[#B4BE6A]/5 border-[#B4BE6A]/20'
              : 'bg-gradient-to-r from-amber-50/80 to-orange-50/40 border-amber-200/30'
          }`}>
            <p className="text-[9.5px] uppercase tracking-wide text-[#302817]/35">
              {lang === 'tr' ? 'Tahmini emisyon' : 'Est. emission'}
            </p>
            <p className={`text-[15px] font-bold mt-0.5 ${isComplete ? 'text-[#527A1A]' : 'text-amber-700'}`}>
              {emText}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-dashed border-[#302817]/12 px-3 py-2.5 group-hover:border-[#B4BE6A]/40 group-hover:bg-[#B4BE6A]/4 transition">
            <span className="text-[11px] text-[#302817]/35 group-hover:text-[#302817]/55 transition">
              {lang === 'tr' ? 'Veri girişi yapın' : 'Enter activity data'}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-[#302817]/25 group-hover:text-[#75863B] transition" />
          </div>
        )}
      </div>
    </button>
  );
}

// ── Right data-entry panel ────────────────────────────────────────────────────
function DataEntryPanel({ categoryId, reportId, fieldValues, lang, onSaved }) {
  if (!categoryId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <Globe className="h-10 w-10 text-[#302817]/10" />
        <div>
          <p className="text-sm font-bold text-[#302817]/35">
            {lang === 'tr' ? 'Kategori seçin' : 'Select a category'}
          </p>
          <p className="text-[11px] text-[#302817]/25 mt-1 leading-relaxed">
            {lang === 'tr' ? 'Soldan kategori seçerek veri girişi yapın' : 'Choose a scope category to enter data'}
          </p>
        </div>
      </div>
    );
  }
  if (categoryId === '3A') return <StationaryCombustionPanel reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />;
  if (categoryId === '4A') return <ElectricityPanel          reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />;
  if (categoryId === 'K4') return <UpstreamTransportPanel    reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />;
  const cat = CATEGORIES.find(c => c.id === categoryId);
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
      {cat && (
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cat.bg}`}>
          <cat.icon className={`h-6 w-6 ${cat.color}`} />
        </div>
      )}
      <p className="text-sm font-bold text-[#302817]">{cat?.label[lang]}</p>
      <p className="text-xs text-[#302817]/35">{lang === 'tr' ? 'Yakında eklenecek' : 'Coming soon'}</p>
    </div>
  );
}

// ── Main workspace page ───────────────────────────────────────────────────────
export default function WorkspacePage() {
  const [lang] = useState('tr');
  const tr = lang === 'tr';

  const [reportId,     setReportId]     = useState(null);
  const [fieldValues,  setFieldValues]  = useState({});
  const [statuses,     setStatuses]     = useState({});
  const [selectedCat,  setSelectedCat]  = useState('3A');
  const [mode,         setMode]         = useState('chat');      // chat-first: AI is the primary UX
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  // Load active report (or use preview mock data)
  useEffect(() => {
    const sp     = new URLSearchParams(window.location.search);
    const isPreview = sp.get('preview') === '1';
    const isEmpty   = sp.get('empty')   === '1';

    if (isPreview) {
      if (!isEmpty) {
        const pf = {
          'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000, 'rf.3a.unit': 'm³', 'rf.3a.facility': 'Merkez Ofis',
          'rf.4a.consumption_kwh': 18000, 'rf.4a.grid_region': 'turkey_teias', 'rf.4a.supplier': 'TEDAŞ', 'rf.4a.emission_factor': 0.439,
          'rf.k4.shipments': [{ mode: 'road_hgv_gt34t_full', weight_t: 45, distance_km: 1200 }],
          'rf.k4.total_emission_kgco2e': 3312,
        };
        setReportId('preview-001');
        setFieldValues(pf);
        const s = {};
        CATEGORIES.forEach(cat => { s[cat.id] = getCategoryStatus(cat.id, pf); });
        setStatuses(s);
      } else {
        setReportId('preview-001'); // still show workspace with onboarding when empty
      }
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await api('/questionnaire/');
        if (res.ok) {
          const data = await res.json();
          const reports = data.reports || [];
          if (reports.length > 0) setReportId(reports[0].report_id);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const loadFields = useCallback(async () => {
    if (!reportId || reportId === 'preview-001') return; // preview uses static mock data
    try {
      const data = await getReportFields(reportId);
      const vals = data.values || {};
      setFieldValues(vals);
      const s = {};
      CATEGORIES.forEach(cat => { s[cat.id] = getCategoryStatus(cat.id, vals); });
      setStatuses(s);
    } catch { /* ignore */ }
  }, [reportId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleFieldsSaved = useCallback(async () => {
    setRefreshing(true);
    await loadFields();
    setRefreshing(false);
  }, [loadFields]);

  const completedCount = Object.values(statuses).filter(s => s === 'complete').length;
  const totalCount     = CATEGORIES.length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F7F2]">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-[#B4BE6A] border-t-transparent animate-spin" />
          <span className="text-sm text-[#302817]/40">{tr ? 'Yükleniyor…' : 'Loading…'}</span>
        </div>
      </div>
    );
  }

  if (!reportId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#F8F7F2] px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#302817]">
          <Leaf className="h-7 w-7 text-[#B4BE6A]" />
        </div>
        <h2 className="text-xl font-bold text-[#302817]">
          {tr ? 'Aktif rapor bulunamadı' : 'No active report found'}
        </h2>
        <p className="text-sm text-[#302817]/50 max-w-sm leading-relaxed">
          {tr
            ? 'Workspace\'i kullanmak için önce CarbonIQ anketi üzerinden bir rapor başlatın.'
            : 'Start a report via the CarbonIQ questionnaire to use the Workspace.'}
        </p>
        <a href="/dashboard" className="rounded-full bg-[#302817] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-black transition">
          {tr ? 'Dashboard\'a Dön' : 'Back to Dashboard'}
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F7F2] font-sans">
      <ScopeSidebar
        selectedCat={selectedCat}
        onSelect={setSelectedCat}
        statuses={statuses}
        fieldValues={fieldValues}
        lang={lang}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        completedCount={completedCount}
        totalCount={totalCount}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* ── Topbar ── */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[#302817]/8 bg-white px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/5 hover:text-[#302817] transition lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#302817]">
                {tr ? 'Karbon Workspace' : 'Carbon Workspace'}
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-full bg-[#302817]/6 px-2 py-0.5 text-[9.5px] font-semibold text-[#302817]/45">
                ISO 14064-1
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-20 h-1 rounded-full bg-[#302817]/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#B4BE6A] transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-[#302817]/40">
                {completedCount}/{totalCount} {tr ? 'tamamlandı' : 'complete'}
              </span>
            </div>
          </div>

          {/* Mode switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-[#302817]/10 bg-[#302817]/3 p-1">
            <button
              onClick={() => setMode('dashboard')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === 'dashboard'
                  ? 'bg-white text-[#302817] shadow-sm'
                  : 'text-[#302817]/40 hover:text-[#302817]'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {tr ? 'Panel' : 'Dashboard'}
            </button>
            <button
              onClick={() => setMode('chat')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === 'chat'
                  ? 'bg-[#302817] text-white shadow-sm'
                  : 'text-[#302817]/40 hover:text-[#302817]'
              }`}
            >
              <Sparkles className={`h-3.5 w-3.5 ${mode === 'chat' ? 'text-[#B4BE6A]' : ''}`} />
              AI
              {mode === 'chat' && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#B4BE6A] animate-pulse" />
              )}
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Center content */}
          <div className="flex flex-1 flex-col overflow-y-auto min-w-0">
            {mode === 'dashboard' ? (
              <div className="p-5 flex flex-col gap-5">

                {/* Onboarding welcome — shown when no data entered yet */}
                {Object.keys(fieldValues).length === 0 && (
                  <div className="rounded-2xl border border-[#B4BE6A]/20 bg-gradient-to-br from-white to-[#F5F4EF] p-6 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#302817] shadow-md">
                        <Leaf className="h-5 w-5 text-[#B4BE6A]" />
                      </div>
                      <div>
                        <h2 className="text-[15px] font-bold text-[#302817]">
                          {tr ? 'CarbonIQ Workspace\'e Hoş Geldiniz' : 'Welcome to CarbonIQ Workspace'}
                        </h2>
                        <p className="text-[11px] text-[#302817]/40 mt-0.5">
                          ISO 14064-1 · GHG Protokolü · DEFRA 2023
                        </p>
                      </div>
                    </div>
                    {/* 3 action cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* AI */}
                      <button
                        onClick={() => setMode('chat')}
                        className="group flex flex-col gap-3 rounded-xl bg-[#302817] p-4 text-left hover:bg-[#1a1408] transition shadow-sm"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                          <Sparkles className="h-4 w-4 text-[#B4BE6A]" />
                        </div>
                        <div>
                          <p className="text-[12.5px] font-bold text-white leading-tight">
                            {tr ? 'AI Asistan ile Başla' : 'Start with AI Assistant'}
                          </p>
                          <p className="text-[10.5px] text-white/45 mt-1 leading-relaxed">
                            {tr ? 'Verilerinizi doğal dilde paylaşın' : 'Share data in natural language'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-[#B4BE6A] group-hover:gap-2 transition-all">
                          {tr ? 'Hemen Başla' : 'Get Started'} <ChevronRight className="h-3 w-3" />
                        </div>
                      </button>
                      {/* Select category */}
                      <button
                        onClick={() => setSelectedCat('3A')}
                        className="group flex flex-col gap-3 rounded-xl border border-[#302817]/8 bg-white p-4 text-left hover:border-[#B4BE6A]/40 hover:bg-[#B4BE6A]/4 transition shadow-sm"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
                          <Flame className="h-4 w-4 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-[12.5px] font-bold text-[#302817] leading-tight">
                            {tr ? 'Kategori Seçerek Başla' : 'Select a Category'}
                          </p>
                          <p className="text-[10.5px] text-[#302817]/40 mt-1 leading-relaxed">
                            {tr ? 'Kapsam 1, 2 veya 3 veri girişi yapın' : 'Enter Scope 1, 2 or 3 data'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-[#302817]/35 group-hover:text-[#75863B] transition">
                          {tr ? 'Formu Aç' : 'Open Form'} <ChevronRight className="h-3 w-3" />
                        </div>
                      </button>
                      {/* Import — coming soon */}
                      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[#302817]/10 bg-[#302817]/2 p-4 opacity-55">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#302817]/6">
                          <Globe className="h-4 w-4 text-[#302817]/40" />
                        </div>
                        <div>
                          <p className="text-[12.5px] font-bold text-[#302817]/60 leading-tight">
                            {tr ? 'Veri İçe Aktar' : 'Import Data'}
                          </p>
                          <p className="text-[10.5px] text-[#302817]/30 mt-1 leading-relaxed">
                            {tr ? 'Excel / CSV dosyası yükleyin' : 'Upload Excel or CSV file'}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#302817]/30">
                          {tr ? 'Yakında' : 'Coming Soon'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Category cards grid */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#302817]/35">
                      {tr ? 'Emisyon Kategorileri' : 'Emission Categories'}
                    </p>
                    <div className="flex-1 h-px bg-[#302817]/6" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {CATEGORIES.map(cat => (
                      <CategoryCard
                        key={cat.id}
                        cat={cat}
                        status={statuses[cat.id] || 'missing'}
                        fieldValues={fieldValues}
                        onClick={() => setSelectedCat(cat.id)}
                        lang={lang}
                      />
                    ))}
                  </div>
                </div>

                {/* Executive Summary — scope breakdown + total */}
                {Object.keys(fieldValues).length > 0 && (() => {
                  // Compute per-scope totals
                  const scopeTotals = SCOPE_GROUPS.map(group => {
                    const cats = CATEGORIES.filter(c => group.cats.includes(c.id));
                    const totalKg = cats.reduce((sum, cat) => {
                      const kg = estimateEmissionKg(cat.id, fieldValues);
                      return sum + (kg || 0);
                    }, 0);
                    const hasData = cats.some(cat => estimateEmissionKg(cat.id, fieldValues) !== null);
                    return { ...group, totalKg, hasData };
                  });
                  const grandTotalKg = scopeTotals.reduce((sum, s) => sum + s.totalKg, 0);
                  if (!scopeTotals.some(s => s.hasData)) return null;

                  const fmtTco2 = kg =>
                    (kg / 1000).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                  const scopeAccents = ['text-orange-300', 'text-yellow-300', 'text-sky-300'];

                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#302817]/35">
                          {tr ? 'Emisyon Özeti' : 'Emission Summary'}
                        </p>
                        <div className="flex-1 h-px bg-[#302817]/6" />
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-[#302817]/10 shadow-sm">

                        {/* ── Executive hero: total + scope breakdown ── */}
                        <div className="relative bg-[#302817] px-6 py-6 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#1a1408]/60 pointer-events-none" />
                          <div className="absolute right-0 top-0 h-full w-2/5 bg-gradient-to-l from-[#95A847]/10 to-transparent pointer-events-none" />

                          <div className="relative flex flex-wrap items-end gap-6 lg:gap-10">
                            {/* Grand total */}
                            <div>
                              <p className="text-[8.5px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">
                                {tr ? 'Toplam Tahmini Emisyon' : 'Total Estimated Emissions'}
                              </p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-bold tracking-tight text-white leading-none">
                                  {fmtTco2(grandTotalKg)}
                                </span>
                                <span className="text-lg font-semibold text-[#B4BE6A] pb-1">tCO₂e</span>
                              </div>
                              <p className="text-[10px] text-white/25 mt-2">
                                DEFRA 2023 · IEA 2023 · GLEC v3
                              </p>
                            </div>

                            {/* Vertical divider */}
                            <div className="hidden lg:block h-16 w-px bg-white/8 self-center" />

                            {/* Scope 1 / Scope 2 / Scope 3 tiles */}
                            <div className="flex gap-6 lg:gap-10">
                              {scopeTotals.map((scope, i) => (
                                <div key={scope.id} className="text-center">
                                  <p className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-white/30 mb-2">
                                    {scope.label[lang] || scope.label.en}
                                  </p>
                                  {scope.hasData ? (
                                    <>
                                      <p className={`text-[22px] font-bold leading-none ${scopeAccents[i]}`}>
                                        {fmtTco2(scope.totalKg)}
                                      </p>
                                      <p className="text-[9px] text-white/25 mt-1">tCO₂e</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[22px] font-bold leading-none text-white/18">—</p>
                                      <p className="text-[9px] text-white/20 mt-1">{tr ? 'Veri yok' : 'No data'}</p>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* ── Per-category breakdown rows ── */}
                        <div className="bg-white divide-y divide-[#302817]/5">
                          {CATEGORIES.map(cat => {
                            const catKg     = estimateEmissionKg(cat.id, fieldValues);
                            const catStatus = statuses[cat.id] || 'missing';
                            if (catStatus === 'missing') return null;
                            const Icon = cat.icon;
                            const pct = grandTotalKg > 0 && catKg
                              ? Math.round((catKg / grandTotalKg) * 100)
                              : 0;

                            return (
                              <button
                                key={cat.id}
                                onClick={() => setSelectedCat(cat.id)}
                                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-[#302817]/2 transition group"
                              >
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${cat.bg}`}>
                                  <Icon className={`h-4 w-4 ${cat.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[12px] font-semibold text-[#302817]">
                                        {cat.label[lang] || cat.label.en}
                                      </span>
                                      <span className={`text-[8.5px] font-bold uppercase border px-1.5 py-[1px] rounded-full ${cat.scopeBadge}`}>
                                        {lang === 'tr' ? `K.${cat.scope}` : `S${cat.scope}`}
                                      </span>
                                    </div>
                                    <span className="text-[12px] font-bold text-[#75863B] shrink-0 ml-2">
                                      {catKg !== null ? formatEmission(catKg) : '—'}
                                    </span>
                                  </div>
                                  {catKg !== null && grandTotalKg > 0 && (
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 rounded-full bg-[#302817]/6 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${cat.bar} transition-all duration-700`}
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="text-[9px] font-semibold text-[#302817]/30 shrink-0 w-7 text-right">
                                        {pct}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0">
                                  <StatusPill status={catStatus} lang={lang} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 overflow-hidden h-full">
                <ChatWorkspace
                  reportId={reportId}
                  lang={lang}
                  onFieldsConfirmed={handleFieldsSaved}
                />
              </div>
            )}
          </div>

          {/* ── Right data-entry panel ── */}
          <aside className="hidden w-[296px] shrink-0 border-l border-[#302817]/8 bg-white xl:flex flex-col">
            <div className="border-b border-[#302817]/6 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#302817]/40">
                  {tr ? 'Veri Girişi' : 'Data Entry'}
                </p>
                {selectedCat && (
                  <p className="text-[10px] text-[#302817]/30 mt-0.5">
                    {CATEGORIES.find(c => c.id === selectedCat)?.label[lang]}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {refreshing && (
                  <span className="flex items-center gap-1 text-[9.5px] font-bold text-[#75863B] animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#95A847]" />
                    {tr ? 'Güncelleniyor' : 'Updating'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <DataEntryPanel
                categoryId={selectedCat}
                reportId={reportId}
                fieldValues={fieldValues}
                lang={lang}
                onSaved={handleFieldsSaved}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

