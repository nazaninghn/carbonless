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
  const Icon   = cat.icon;
  const emKg   = estimateEmissionKg(cat.id, fieldValues);
  const emText = formatEmission(emKg);

  return (
    <button
      onClick={onClick}
      className={`
        group relative flex flex-col gap-3 rounded-2xl border bg-white p-4 text-left
        shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
        ${status === 'complete'
          ? 'border-[#95A847]/20'
          : status === 'in_progress'
            ? 'border-amber-300/30'
            : 'border-[#302817]/8 hover:border-[#B4BE6A]/30'}
      `}
    >
      {/* Status top bar */}
      <div className={`absolute top-0 inset-x-4 h-[2px] rounded-b-full transition-all ${
        status === 'complete'    ? 'bg-[#95A847]/50'
        : status === 'in_progress' ? 'bg-amber-400/40'
        : 'bg-transparent group-hover:bg-[#B4BE6A]/25'
      }`} />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cat.bg}`}>
            <Icon className={`h-4.5 w-4.5 ${cat.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[9.5px] font-bold uppercase tracking-wide border px-1.5 py-[1px] rounded-md ${cat.scopeBadge}`}>
                {lang === 'tr' ? `Kapsam ${cat.scope}` : `Scope ${cat.scope}`}
              </span>
              <span className="text-[9px] font-mono font-bold text-[#302817]/25">{cat.id}</span>
            </div>
          </div>
        </div>
        <StatusDot status={status} />
      </div>

      {/* Label + description */}
      <div className="flex-1">
        <p className="text-[13.5px] font-bold text-[#302817] leading-snug">
          {cat.label[lang] || cat.label.en}
        </p>
        <p className="mt-0.5 text-[11px] text-[#302817]/40 leading-relaxed">
          {cat.desc[lang] || cat.desc.en}
        </p>
      </div>

      {/* Emission or CTA */}
      {emText ? (
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-[#95A847]/8 to-[#B4BE6A]/4 border border-[#B4BE6A]/20 px-3 py-2">
          <span className="text-[10px] text-[#302817]/40">
            {lang === 'tr' ? 'Tahmini emisyon' : 'Est. emission'}
          </span>
          <span className="text-xs font-bold text-[#75863B]">{emText}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#302817]/30 group-hover:text-[#302817]/55 transition">
          <span>{lang === 'tr' ? 'Veri girişi yap' : 'Enter data'}</span>
          <ChevronRight className="h-3 w-3" />
        </div>
      )}
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
  const [mode,         setMode]         = useState('dashboard');
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);

  // Load active report
  useEffect(() => {
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
    if (!reportId) return;
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

                {/* Empty state banner */}
                {Object.keys(fieldValues).length === 0 && (
                  <div className="rounded-2xl border border-[#B4BE6A]/30 bg-[#B4BE6A]/6 px-5 py-4 flex items-start gap-3">
                    <div className="mt-0.5 h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-[#75863B]/10 text-[#75863B]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#302817]">
                        {tr ? 'Henüz aktivite verisi yok' : 'No activity data yet'}
                      </p>
                      <p className="text-[12px] text-[#302817]/55 mt-0.5 leading-relaxed max-w-lg">
                        {tr
                          ? 'AI Asistan ile başlayın veya aşağıdan bir kategori seçin. Örnek: "Geçen yıl 15.000 m³ doğalgaz kullandık."'
                          : 'Start with the AI Assistant or select a category below. Example: "We used 15,000 m³ natural gas last year."'}
                      </p>
                      <button
                        onClick={() => setMode('chat')}
                        className="mt-2.5 flex items-center gap-1.5 rounded-full bg-[#302817] px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-black"
                      >
                        <Sparkles className="h-3 w-3 text-[#B4BE6A]" />
                        {tr ? 'AI Asistan\'ı Aç' : 'Open AI Assistant'}
                      </button>
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

                {/* Summary — only shown when data exists */}
                {Object.keys(fieldValues).length > 0 && (() => {
                  const totalKg = CATEGORIES.reduce((sum, cat) => {
                    const kg = estimateEmissionKg(cat.id, fieldValues);
                    return sum + (kg || 0);
                  }, 0);
                  const hasAnyEstimate = CATEGORIES.some(cat => estimateEmissionKg(cat.id, fieldValues) !== null);
                  if (!hasAnyEstimate) return null;

                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#302817]/35">
                          {tr ? 'Emisyon Özeti' : 'Emission Summary'}
                        </p>
                        <div className="flex-1 h-px bg-[#302817]/6" />
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-[#302817]/10 shadow-sm">
                        {/* Dark hero */}
                        <div className="relative px-5 py-5 bg-[#302817] overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#1a1408]/50 pointer-events-none" />
                          <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-[#95A847]/15 to-transparent pointer-events-none" />
                          <p className="relative text-[9.5px] font-bold uppercase tracking-[0.15em] text-white/40 mb-2">
                            {tr ? 'Toplam Tahmini Emisyon' : 'Total Estimated Emission'}
                          </p>
                          <div className="relative flex items-baseline gap-2">
                            <span className="text-3xl font-bold tracking-tight text-white">
                              {totalKg >= 1000
                                ? (totalKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                : totalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-sm font-semibold text-[#B4BE6A]">
                              {totalKg >= 1000 ? 'tCO₂e' : 'kgCO₂e'}
                            </span>
                          </div>
                          <p className="relative text-[10px] text-white/30 mt-1.5">
                            DEFRA 2023 · IEA 2023 · GLEC v3 · {tr ? 'Tüm kapsamlar' : 'All scopes'}
                          </p>
                        </div>

                        {/* Per-category rows */}
                        <div className="bg-white divide-y divide-[#302817]/5">
                          {CATEGORIES.map(cat => {
                            const catKg     = estimateEmissionKg(cat.id, fieldValues);
                            const catStatus = statuses[cat.id] || 'missing';
                            if (catStatus === 'missing') return null;
                            const Icon = cat.icon;
                            const pctOfTotal = totalKg > 0 && catKg ? Math.round((catKg / totalKg) * 100) : 0;

                            return (
                              <button
                                key={cat.id}
                                onClick={() => setSelectedCat(cat.id)}
                                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-[#302817]/2 transition group"
                              >
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${cat.bg}`}>
                                  <Icon className={`h-4 w-4 ${cat.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[12px] font-semibold text-[#302817]">
                                      {cat.label[lang] || cat.label.en}
                                    </span>
                                    <span className="text-xs font-bold text-[#75863B] shrink-0 ml-2">
                                      {catKg !== null ? formatEmission(catKg) : '—'}
                                    </span>
                                  </div>
                                  {catKg !== null && totalKg > 0 && (
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1 rounded-full bg-[#302817]/8 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${cat.bar} transition-all duration-700`}
                                          style={{ width: `${pctOfTotal}%` }}
                                        />
                                      </div>
                                      <span className="text-[9px] text-[#302817]/30 shrink-0 w-6 text-right">
                                        {pctOfTotal}%
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
