'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, MessageSquare, Flame, Zap, Truck, ChevronRight,
  CheckCircle2, Clock, AlertCircle, Minus, Globe, Menu, X, ArrowLeft,
} from 'lucide-react';
import { getReportFields, getCategoryStatus, REQUIRED_FIELDS } from '@/lib/workspace/api';
import { ChatWorkspace } from '@/components/workspace/ChatWorkspace';
import { StationaryCombustionPanel } from '@/components/workspace/panels/StationaryCombustionPanel';
import { ElectricityPanel } from '@/components/workspace/panels/ElectricityPanel';
import { UpstreamTransportPanel } from '@/components/workspace/panels/UpstreamTransportPanel';
import { api } from '@/lib/utils/api';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  complete:       { dot: 'bg-[#95A847]',     ring: 'border-[#95A847]/30 bg-[#95A847]/5',  icon: CheckCircle2, label: { tr: 'Tamamlandı', en: 'Complete'      } },
  in_progress:    { dot: 'bg-amber-400',     ring: 'border-amber-300/40 bg-amber-50/60',   icon: Clock,        label: { tr: 'Devam ediyor', en: 'In Progress'   } },
  missing:        { dot: 'bg-[#302817]/20',  ring: 'border-[#302817]/10',                  icon: AlertCircle,  label: { tr: 'Veri yok', en: 'No data'          } },
  not_applicable: { dot: 'bg-[#302817]/15',  ring: '',                                      icon: Minus,        label: { tr: 'Geçerli değil', en: 'N/A'         } },
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
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.ring}`}>
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
    color: 'text-orange-500', bg: 'bg-orange-50',
    label: { tr: 'Sabit Yanma',   en: 'Stationary Combustion' },
    desc:  { tr: 'Kapsam 1 · Yakıt tüketimi', en: 'Scope 1 · Fuel combustion' },
    efField: 'rf.3a.consumption', unitField: 'rf.3a.unit',
  },
  {
    id: '4A', scope: 2,
    icon: Zap,
    color: 'text-yellow-500', bg: 'bg-yellow-50',
    label: { tr: 'Elektrik',      en: 'Electricity' },
    desc:  { tr: 'Kapsam 2 · Satın alınan elektrik', en: 'Scope 2 · Purchased electricity' },
    efField: 'rf.4a.emission_factor', consumptionField: 'rf.4a.consumption_kwh',
  },
  {
    id: 'K4', scope: 3,
    icon: Truck,
    color: 'text-blue-500', bg: 'bg-blue-50',
    label: { tr: 'Upstream Taşıma', en: 'Upstream Transport' },
    desc:  { tr: 'Kapsam 3 · Lojistik ve taşıma', en: 'Scope 3 · Logistics and freight' },
    emissionField: 'rf.k4.total_emission_kgco2e',
  },
];

const SCOPE_GROUPS = [
  { id: 1, label: { tr: 'Kapsam 1', en: 'Scope 1' }, cats: ['3A'] },
  { id: 2, label: { tr: 'Kapsam 2', en: 'Scope 2' }, cats: ['4A'] },
  { id: 3, label: { tr: 'Kapsam 3', en: 'Scope 3' }, cats: ['K4'] },
];

// ── Emission estimate helpers (client-side) ───────────────────────────────────
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
    ? `${(kg / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`
    : `${kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kgCO₂e`;
}

// ── Scope sidebar ─────────────────────────────────────────────────────────────
function ScopeSidebar({ selectedCat, onSelect, statuses, fieldValues, lang, open, onClose, completedCount, totalCount }) {
  const tr = lang === 'tr';
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      {open && <div className="fixed inset-0 z-20 bg-black/20 lg:hidden" onClick={onClose} />}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-56 shrink-0 border-r border-[#302817]/6 bg-[#FAFAF8]
        flex flex-col transition-transform duration-200
        lg:relative lg:inset-auto lg:z-auto lg:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar header + progress */}
        <div className="border-b border-[#302817]/6 px-4 py-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#302817]/45">
              {tr ? 'Emisyon Kapsamları' : 'Emission Scopes'}
            </span>
            <button onClick={onClose} className="text-[#302817]/35 hover:text-[#302817] transition lg:hidden">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-[#302817]/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#95A847] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-[#302817]/40 shrink-0">
              {completedCount}/{totalCount}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {SCOPE_GROUPS.map(group => {
            const cats = CATEGORIES.filter(c => group.cats.includes(c.id));
            return (
              <div key={group.id}>
                <p className="px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#302817]/35">
                  {group.label[lang] || group.label.en}
                </p>
                {cats.map(cat => {
                  const Icon   = cat.icon;
                  const status = statuses[cat.id] || 'missing';
                  const isActive = selectedCat === cat.id;
                  const emKg  = estimateEmissionKg(cat.id, fieldValues);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { onSelect(cat.id); onClose(); }}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                        isActive
                          ? 'bg-[#302817] text-white shadow-sm'
                          : 'text-[#302817]/55 hover:bg-[#302817]/5 hover:text-[#302817]'
                      }`}
                    >
                      <StatusDot status={status} size="sm" />
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-white/10' : cat.bg}`}>
                        <Icon className={`h-3 w-3 ${isActive ? 'text-white' : cat.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11.5px] font-semibold truncate ${isActive ? 'text-white' : ''}`}>
                          {cat.label[lang] || cat.label.en}
                        </p>
                        {emKg !== null ? (
                          <p className={`text-[10px] font-bold ${isActive ? 'text-white/60' : 'text-[#75863B]'}`}>
                            {formatEmission(emKg)}
                          </p>
                        ) : (
                          <p className={`text-[10px] ${isActive ? 'text-white/50' : 'text-[#302817]/35'}`}>
                            {STATUS_CONFIG[status]?.label[lang]}
                          </p>
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
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#302817]/45 transition hover:bg-[#302817]/5 hover:text-[#302817]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {tr ? 'Dashboard' : 'Dashboard'}
          </a>
        </div>
      </aside>
    </>
  );
}

// ── Category card grid ────────────────────────────────────────────────────────
function CategoryCard({ cat, status, fieldValues, onClick, lang }) {
  const Icon   = cat.icon;
  const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.missing;
  const emKg   = estimateEmissionKg(cat.id, fieldValues);
  const emText = formatEmission(emKg);

  return (
    <button
      onClick={onClick}
      className={`
        group flex flex-col gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition
        hover:shadow-md hover:border-[#B4BE6A]/40
        ${status === 'complete' ? 'border-[#95A847]/20' : 'border-[#302817]/8'}
      `}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cat.bg}`}>
          <Icon className={`h-5 w-5 ${cat.color}`} />
        </div>
        <StatusPill status={status} lang={lang} />
      </div>

      <div>
        <p className="text-sm font-bold text-[#302817]">{cat.label[lang] || cat.label.en}</p>
        <p className="mt-0.5 text-[11px] text-[#302817]/40">{cat.desc[lang] || cat.desc.en}</p>
      </div>

      {emText ? (
        <div className="flex items-center justify-between rounded-xl bg-[#B4BE6A]/8 border border-[#B4BE6A]/20 px-3 py-1.5">
          <span className="text-[10px] text-[#302817]/45">{lang === 'tr' ? 'Tahmini emisyon' : 'Est. emission'}</span>
          <span className="text-xs font-bold text-[#75863B]">{emText}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-[11px] font-semibold text-[#302817]/35">
          {lang === 'tr' ? 'Veri gir' : 'Enter data'}
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
        <Globe className="h-10 w-10 text-[#302817]/12" />
        <div>
          <p className="text-sm font-bold text-[#302817]/35">
            {lang === 'tr' ? 'Kategori seçin' : 'Select a category'}
          </p>
          <p className="text-[11px] text-[#302817]/25 mt-1">
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

  const handleFieldsSaved = useCallback(() => loadFields(), [loadFields]);

  const completedCount = Object.values(statuses).filter(s => s === 'complete').length;
  const totalCount     = CATEGORIES.length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F7F2]">
        <div className="text-sm text-[#302817]/40">{tr ? 'Yükleniyor…' : 'Loading…'}</div>
      </div>
    );
  }

  if (!reportId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#F8F7F2] px-6 text-center">
        <h2 className="text-xl font-bold text-[#302817]">
          {tr ? 'Aktif rapor bulunamadı' : 'No active report found'}
        </h2>
        <p className="text-sm text-[#302817]/50">
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
        {/* Topbar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-[#302817]/6 bg-white px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/5 hover:text-[#302817] transition lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-[#302817] truncate">
              {tr ? 'Karbon Workspace' : 'Carbon Workspace'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-20 h-1 rounded-full bg-[#302817]/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#95A847] transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-[#302817]/40">
                {completedCount}/{totalCount} {tr ? 'tamamlandı' : 'complete'}
              </span>
            </div>
          </div>
          {/* Mode switcher */}
          <div className="flex items-center rounded-xl border border-[#302817]/10 bg-[#302817]/3 p-0.5">
            {[
              { key: 'dashboard', icon: LayoutDashboard, label: { tr: 'Panel', en: 'Dashboard' } },
              { key: 'chat',      icon: MessageSquare,   label: { tr: 'AI',    en: 'AI Chat'   } },
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  mode === m.key
                    ? 'bg-white text-[#302817] shadow-sm'
                    : 'text-[#302817]/40 hover:text-[#302817]'
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label[lang] || m.label.en}
              </button>
            ))}
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Center */}
          <div className="flex flex-1 flex-col overflow-y-auto min-w-0">
            {mode === 'dashboard' ? (
              <div className="p-5 flex flex-col gap-5">
                {/* Category cards */}
                <div>
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#302817]/35">
                    {tr ? 'Emisyon Kategorileri' : 'Emission Categories'}
                  </p>
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

                {/* Overall summary */}
                {Object.keys(fieldValues).length > 0 && (() => {
                  const totalKg = CATEGORIES.reduce((sum, cat) => {
                    const kg = estimateEmissionKg(cat.id, fieldValues);
                    return sum + (kg || 0);
                  }, 0);
                  return (
                    <div className="rounded-2xl border border-[#302817]/8 bg-white p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#302817]/35">
                          {tr ? 'Toplam Tahmini Emisyon' : 'Total Estimated Emission'}
                        </p>
                        <span className="text-[10px] text-[#302817]/30">DEFRA 2023 / GLEC v3</span>
                      </div>
                      {totalKg > 0 && (
                        <p className="text-2xl font-bold text-[#302817] mb-3">
                          {totalKg >= 1000
                            ? `${(totalKg / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} tCO₂e`
                            : `${totalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kgCO₂e`}
                        </p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(fieldValues).map(([k, v]) => (
                          <div key={k} className="rounded-xl border border-[#302817]/6 bg-[#FAFAF8] px-3 py-2">
                            <p className="text-[9.5px] text-[#302817]/35 font-mono truncate">{k.replace('rf.', '')}</p>
                            <p className="text-xs font-bold text-[#302817] truncate">
                              {Array.isArray(v) ? `${v.length} entries` : String(v)}
                            </p>
                          </div>
                        ))}
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

          {/* Right data-entry panel */}
          <aside className="hidden w-[288px] shrink-0 border-l border-[#302817]/6 bg-white xl:flex flex-col">
            <div className="border-b border-[#302817]/6 px-4 py-3 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#302817]/40">
                {tr ? 'Veri Girişi' : 'Data Entry'}
              </p>
              {selectedCat && (
                <span className="text-[10px] font-bold text-[#302817]/30">{selectedCat}</span>
              )}
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
