'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Flame, Zap, Truck, Briefcase,
  CheckCircle2, Clock, ArrowLeft,
  ChevronRight, X, Sparkles, MessageSquare, BarChart3,
} from 'lucide-react';
import { getReportFields, getCategoryStatus } from '@/lib/workspace/api';
import { ChatWorkspace } from '@/components/workspace/ChatWorkspace';
import { StationaryCombustionPanel } from '@/components/workspace/panels/StationaryCombustionPanel';
import { ElectricityPanel } from '@/components/workspace/panels/ElectricityPanel';
import { UpstreamTransportPanel } from '@/components/workspace/panels/UpstreamTransportPanel';
import { BusinessTravelPanel } from '@/components/workspace/panels/BusinessTravelPanel';
import { api } from '@/lib/utils/api';

/* ─── CSS animations ──────────────────────────────────────────────────────── */
const ANIM_STYLES = `
@keyframes heroFloat {
  0%,100% { transform: translateY(0px) rotate(-1deg) scale(1);
             filter: drop-shadow(0 18px 48px rgba(117,134,59,0.22)); }
  40%      { transform: translateY(-18px) rotate(2deg) scale(1.04);
             filter: drop-shadow(0 32px 72px rgba(117,134,59,0.42)); }
  70%      { transform: translateY(-8px) rotate(-0.5deg) scale(1.02);
             filter: drop-shadow(0 24px 56px rgba(117,134,59,0.30)); }
}
@keyframes glowPulse {
  0%,100% { opacity: 0.30; transform: scale(1); }
  50%      { opacity: 0.55; transform: scale(1.18); }
}
@keyframes dataRing {
  0%   { transform: rotate(0deg);   opacity: 0.7; }
  100% { transform: rotate(360deg); opacity: 0.7; }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0);    }
}
.hero-float   { animation: heroFloat  5.5s ease-in-out infinite; }
.glow-pulse   { animation: glowPulse  5.5s ease-in-out infinite; }
.data-ring    { animation: dataRing   9s   linear     infinite; }
.fade-up      { animation: fadeUp     0.5s ease-out   both; }
@media (prefers-reduced-motion: reduce) {
  .hero-float, .glow-pulse, .data-ring { animation: none !important; }
}
`;

/* ─── Constants ───────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: '3A', tab: 'S1',  scope: 1, icon: Flame,     color: 'text-orange-500', bg: 'bg-orange-50',  ring: 'ring-orange-200', panelBg: 'bg-orange-500', label: { tr: 'Sabit Yanma',    en: 'Stationary Combustion' }, desc: { tr: 'Yakıt tüketimi',      en: 'Fuel combustion'     } },
  { id: '4A', tab: 'S2',  scope: 2, icon: Zap,       color: 'text-yellow-600', bg: 'bg-yellow-50',  ring: 'ring-yellow-200', panelBg: 'bg-yellow-500', label: { tr: 'Elektrik',        en: 'Purchased Electricity' }, desc: { tr: 'Satın alınan el.',    en: 'Grid electricity'    } },
  { id: 'K4', tab: 'S3a', scope: 3, icon: Truck,     color: 'text-sky-500',    bg: 'bg-sky-50',     ring: 'ring-sky-200',    panelBg: 'bg-sky-500',    label: { tr: 'Upstream Taşıma', en: 'Upstream Transport'    }, desc: { tr: 'Lojistik & kargo',   en: 'Freight & logistics' } },
  { id: 'K5', tab: 'S3b', scope: 3, icon: Briefcase, color: 'text-violet-500', bg: 'bg-violet-50',  ring: 'ring-violet-200', panelBg: 'bg-violet-500', label: { tr: 'İş Seyahati',    en: 'Business Travel'       }, desc: { tr: 'Hava & kara & ray',  en: 'Air, road & rail'   } },
];

const SCOPE_GROUPS = [
  { id: 1, label: { tr: 'Kapsam 1 — Doğrudan', en: 'Scope 1 — Direct' },           cats: ['3A'], color: 'bg-orange-400',  text: 'text-orange-600' },
  { id: 2, label: { tr: 'Kapsam 2 — Enerji',   en: 'Scope 2 — Energy' },            cats: ['4A'], color: 'bg-yellow-400',  text: 'text-yellow-700' },
  { id: 3, label: { tr: 'Kapsam 3 — Dolaylı',  en: 'Scope 3 — Indirect' },          cats: ['K4','K5'], color: 'bg-sky-400', text: 'text-sky-600' },
];

const DEFRA_EF = {
  natural_gas: { 'm³': 2.02, m3: 2.02, kWh: 0.183, KWH: 0.183, GJ: 50.77, MCF: 57.17 },
  fuel_oil:    { litre: 2.52, kg: 2.96, GJ: 74.07  },
  diesel:      { litre: 2.54, GJ: 68.08             },
  lpg:         { litre: 1.51, kg: 2.94, GJ: 59.65  },
  coal:        { kg: 2.42, tonne: 2420, GJ: 88.34   },
};

function estimateKg(catId, vals) {
  if (catId === '3A') {
    const ef = DEFRA_EF[vals['rf.3a.fuel_type']]?.[vals['rf.3a.unit']];
    const c  = parseFloat(vals['rf.3a.consumption']);
    if (!isNaN(c) && ef) return c * ef;
  }
  if (catId === '4A') {
    const k = parseFloat(vals['rf.4a.consumption_kwh']);
    const e = parseFloat(vals['rf.4a.emission_factor']);
    const r = parseFloat(vals['rf.4a.renewable_on_site']) || 0;
    if (!isNaN(k) && !isNaN(e)) return Math.max(k - r, 0) * e;
  }
  if (catId === 'K4') { const v = parseFloat(vals['rf.k4.total_emission_kgco2e']); if (!isNaN(v)) return v; }
  if (catId === 'K5') {
    const d = parseFloat(vals['rf.k5.total_emission_kgco2e']);
    if (!isNaN(d) && d > 0) return d;
    let t = 0, has = false;
    [['rf.k5.air_domestic_pkm',0.264],['rf.k5.air_short_haul_pkm',0.153],
     ['rf.k5.air_long_haul_pkm',0.195],['rf.k5.rail_pkm',0.035],['rf.k5.car_km',0.149]]
      .forEach(([k, ef]) => { const v = parseFloat(vals[k]); if (!isNaN(v) && v > 0) { t += v * ef; has = true; } });
    return has ? t : null;
  }
  return null;
}

function fmt(kg) {
  if (kg === null || isNaN(kg)) return null;
  return kg >= 1000 ? `${(kg / 1000).toFixed(2)} tCO₂e` : `${Math.round(kg)} kgCO₂e`;
}

/* ─── Mode toggle ─────────────────────────────────────────────────────────── */
function ModeToggle({ mode, onChange, lang }) {
  const tr = lang === 'tr';
  return (
    <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#302817]/6 border border-[#302817]/8">
      <button
        onClick={() => onChange('chat')}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold transition-all duration-200 ${
          mode === 'chat'
            ? 'bg-[#75863B] text-white shadow-sm'
            : 'text-[#302817]/50 hover:text-[#302817]/80 hover:bg-[#302817]/5'
        }`}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
        <span>{tr ? 'Sohbet' : 'Chat'}</span>
      </button>
      <button
        onClick={() => onChange('questionnaire')}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-bold transition-all duration-200 ${
          mode === 'questionnaire'
            ? 'bg-[#75863B] text-white shadow-sm'
            : 'text-[#302817]/50 hover:text-[#302817]/80 hover:bg-[#302817]/5'
        }`}
      >
        <BarChart3 className="h-3.5 w-3.5 shrink-0" />
        <span>{tr ? 'Anket' : 'Questionnaire'}</span>
      </button>
    </div>
  );
}

/* ─── Category card (expert mode — WF-04 compact) ────────────────────────── */
function CategoryCard({ cat, lang, status, emission, onClick }) {
  const Icon = cat.icon;
  const st = status || 'missing';
  const tr = lang === 'tr';

  const dotColor = st === 'complete' ? 'bg-[#75863B]' : st === 'in_progress' ? 'bg-amber-400' : 'bg-[#302817]/18';
  const cardBg   = st === 'complete'
    ? 'bg-[#75863B]/6 border-[#75863B]/25 hover:border-[#75863B]/40'
    : st === 'in_progress'
    ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
    : 'bg-white border-[#302817]/10 hover:border-[#302817]/20';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 hover:shadow-sm group ${cardBg}`}
    >
      {/* Icon + status dot */}
      <div className="flex items-center justify-between mb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${cat.bg}`}>
          <Icon className={`h-4 w-4 ${cat.color}`} />
        </div>
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      </div>

      {/* Label */}
      <p className="text-[12px] font-bold text-[#302817] leading-tight">{cat.label[lang]}</p>
      <p className="text-[10px] text-[#302817]/40 mt-0.5 leading-snug">{cat.desc[lang]}</p>

      {/* Emission */}
      <div className="mt-2">
        {emission !== null
          ? <span className="text-[12px] font-extrabold text-[#527A1A] tabular-nums">{fmt(emission)}</span>
          : <span className="text-[10px] text-[#302817]/25 italic">{tr ? 'Veri yok' : 'No data'}</span>
        }
      </div>
    </button>
  );
}

/* ─── Expert view ─────────────────────────────────────────────────────────── */
function ExpertView({ lang, fieldValues, statuses, onCategoryClick }) {
  const tr = lang === 'tr';
  const grandKg = CATEGORIES.reduce((sum, c) => sum + (estimateKg(c.id, fieldValues) || 0), 0);
  const completedCount = Object.values(statuses).filter(s => s === 'complete').length;
  const totalCount = CATEGORIES.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-6 fade-up">

        {/* Hero total — only when data exists */}
        {grandKg > 0 ? (
          <div className="rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-br from-[#527A1A] to-[#75863B] p-5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">
                {tr ? 'Toplam Karbon Ayak İzi' : 'Total Carbon Footprint'}
              </p>
              <p className="text-[32px] font-extrabold tabular-nums leading-none">{fmt(grandKg)}</p>
              <p className="text-[10.5px] text-white/45 mt-1">
                ISO 14064-1 · {tr ? 'Tahmini değer · DEFRA 2023' : 'Estimated · DEFRA 2023'}
              </p>
            </div>
            {/* Progress bar */}
            <div className="bg-[#527A1A]/90 px-5 py-2.5 flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#B4BE6A] to-[#75863B] transition-all duration-700"
                  style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-white/50 shrink-0">
                {completedCount}/{totalCount} {tr ? 'kategori' : 'categories'}
              </span>
            </div>
          </div>
        ) : (
          /* Empty state hint */
          <div className="rounded-2xl border-2 border-dashed border-[#302817]/12 bg-[#302817]/3 px-5 py-6 text-center">
            <BarChart3 className="h-8 w-8 text-[#302817]/20 mx-auto mb-2" />
            <p className="text-[13px] font-bold text-[#302817]/40">
              {tr ? 'Veri girişi yapılmadı' : 'No data entered yet'}
            </p>
            <p className="text-[11px] text-[#302817]/28 mt-1 leading-relaxed">
              {tr
                ? 'Aşağıdaki kategorilere tıklayarak veri girişi yapabilir ya da\nRehberli moda geçerek AI\'ya anlatabilirsiniz.'
                : 'Click any category below to enter data manually,\nor switch to Guided mode to talk to the AI.'}
            </p>
          </div>
        )}

        {/* All categories — flat 4-col grid (WF-04) */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#302817]/30 mb-3 px-0.5">
            {tr ? 'Emisyon Kategorileri' : 'Emission Categories'}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIES.map(cat => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                lang={lang}
                status={statuses[cat.id]}
                emission={estimateKg(cat.id, fieldValues)}
                onClick={() => onCategoryClick(cat.id)}
              />
            ))}
          </div>
        </div>

        {/* Bottom tip */}
        <div className="rounded-xl border border-[#302817]/8 bg-[#302817]/3 px-4 py-3 flex items-start gap-2.5">
          <span className="text-base shrink-0 mt-px">💡</span>
          <p className="text-[11px] text-[#302817]/45 leading-relaxed">
            {tr
              ? 'Her kategoriye tıklayın ve sağdan açılan panele veri girin. Rehberli modda ise AI ile konuşarak veri aktarabilirsiniz.'
              : 'Click each category to open the data entry panel on the right. In Guided mode, you can share data by talking to the AI.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Panel slide-over ────────────────────────────────────────────────────── */
function PanelDrawer({
  open, onClose, reportId, fieldValues, statuses, lang, onSaved,
  onStartReport, startingReport, startReportErr, openToCategory,
}) {
  const tr = lang === 'tr';
  const isPreview = reportId === 'preview-001';
  const [active, setActive] = useState(openToCategory || '3A');

  /* Sync to the category that was clicked */
  useEffect(() => {
    if (open && openToCategory) setActive(openToCategory);
  }, [open, openToCategory]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-[#302817]/40 backdrop-blur-sm" onClick={onClose} />
      )}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[460px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#302817]/8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#75863B]">
              <LayoutDashboard className="h-3.5 w-3.5 text-white/80" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#302817]">
                {tr ? 'Veri Girişi Paneli' : 'Data Entry Panel'}
              </p>
              <p className="text-[10px] text-[#302817]/40">
                ISO 14064-1 · Scope 1 / 2 / 3
                {isPreview && (
                  <span className="ml-1 text-amber-500 font-bold">
                    · {tr ? 'Önizleme' : 'Preview'}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={tr ? 'Kapat' : 'Close panel'}
            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-[#302817]/5 text-[#302817]/40 hover:text-[#302817] transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview mode warning */}
        {isPreview && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2.5">
            <span className="text-[11px] shrink-0">👁</span>
            <div className="flex-1 min-w-0">
              <p className="text-[9.5px] font-semibold text-amber-700 truncate">
                {tr ? 'Önizleme — kaydetme devre dışı' : 'Preview — saving disabled'}
              </p>
              {startReportErr && (
                <p className="text-[9px] font-semibold text-red-600 truncate mt-0.5">{startReportErr}</p>
              )}
            </div>
            <button
              onClick={onStartReport}
              disabled={startingReport}
              className="shrink-0 text-[9.5px] font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 rounded-full px-2.5 py-1 transition disabled:opacity-60 whitespace-nowrap"
            >
              {startingReport ? '…' : (tr ? '🚀 Başlat' : '🚀 Start')}
            </button>
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-1.5 px-4 py-3 border-b border-[#302817]/6 bg-[#FAFAF8] mt-2">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const em = estimateKg(cat.id, fieldValues);
            const st = statuses[cat.id] || 'missing';
            const isA = active === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition ${
                  isA ? 'bg-[#75863B] shadow-sm' : 'hover:bg-[#302817]/5'
                }`}
              >
                <div className="relative">
                  <Icon className={`h-4 w-4 ${isA ? 'text-[#B4BE6A]' : cat.color}`} />
                  <span className={`absolute -top-0.5 -right-1 h-2 w-2 rounded-full border border-white ${
                    st === 'complete'    ? 'bg-[#75863B]' :
                    st === 'in_progress' ? 'bg-amber-400' : 'bg-[#302817]/20'
                  }`} />
                </div>
                <span className={`text-[8.5px] font-bold tracking-wide ${isA ? 'text-white' : 'text-[#302817]/40'}`}>
                  {cat.tab}
                </span>
                {em !== null && (
                  <span className={`text-[7.5px] font-bold ${isA ? 'text-[#B4BE6A]/80' : 'text-[#75863B]/60'}`}>
                    {fmt(em)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-5">
          {active === '3A' && <StationaryCombustionPanel reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} isPreview={isPreview} />}
          {active === '4A' && <ElectricityPanel          reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} isPreview={isPreview} />}
          {active === 'K4' && <UpstreamTransportPanel    reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} isPreview={isPreview} />}
          {active === 'K5' && <BusinessTravelPanel       reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} isPreview={isPreview} />}
        </div>
      </div>
    </>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function WorkspacePage() {
  const [lang,          setLang]          = useState('tr');
  const tr = lang === 'tr';

  /* Data */
  const [reportId,      setReportId]      = useState(null);
  const [fieldValues,   setFieldValues]   = useState({});
  const [statuses,      setStatuses]      = useState({});
  const [loading,       setLoading]       = useState(true);

  /* UI */
  const [workspaceMode, setWorkspaceMode] = useState('chat');   // 'chat' | 'questionnaire'
  const [panelOpen,     setPanelOpen]     = useState(false);
  const [openCategory,  setOpenCategory]  = useState('3A');     // which tab opens in drawer
  const [startingReport,setStartingReport]= useState(false);
  const [startReportErr,setStartReportErr]= useState('');

  const isPreviewMode = reportId === 'preview-001';

  /* ── Load report ── */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const isPreview = sp.get('preview') === '1';
    const isEmpty   = sp.get('empty')   === '1';

    if (isPreview) {
      if (!isEmpty) {
        const pf = {
          'rf.3a.fuel_type':'natural_gas','rf.3a.consumption':15000,'rf.3a.unit':'m³','rf.3a.facility':'Merkez Ofis',
          'rf.4a.consumption_kwh':18000,'rf.4a.grid_region':'turkey_teias','rf.4a.supplier':'TEDAŞ','rf.4a.emission_factor':0.439,
          'rf.k4.shipments':[{mode:'road_hgv_gt34t_full',weight_t:45,distance_km:1200}],'rf.k4.total_emission_kgco2e':3312,
          'rf.k5.air_domestic_pkm':5000,'rf.k5.air_short_haul_pkm':12000,'rf.k5.air_long_haul_pkm':18000,
          'rf.k5.rail_pkm':4000,'rf.k5.total_emission_kgco2e':6806,
        };
        setReportId('preview-001');
        setFieldValues(pf);
        const s = {}; CATEGORIES.forEach(c => { s[c.id] = getCategoryStatus(c.id, pf); }); setStatuses(s);
      } else {
        setReportId('preview-001');
      }
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await api.listReports();
        if (res.ok) {
          const data = await res.json();
          const reports = Array.isArray(data) ? data
            : Array.isArray(data.reports) ? data.reports
            : Array.isArray(data.results) ? data.results
            : [];
          if (reports.length > 0) {
            const firstId = reports[0].report_id ?? reports[0].id ?? null;
            if (firstId) {
              setReportId(String(firstId));
            } else {
              setReportId('preview-001');
            }
          } else {
            setReportId('preview-001');
            try {
              const saved = localStorage.getItem('ciq_preview_fields');
              if (saved) {
                const vals = JSON.parse(saved);
                setFieldValues(vals);
                const s = {}; CATEGORIES.forEach(c => { s[c.id] = getCategoryStatus(c.id, vals); }); setStatuses(s);
              }
            } catch {}
          }
        } else {
          setReportId('preview-001');
        }
      } catch {
        setReportId('preview-001');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadFields = useCallback(async () => {
    if (!reportId || reportId === 'preview-001') return;
    try {
      const data = await getReportFields(reportId);
      const vals = data.values || {};
      setFieldValues(vals);
      const s = {}; CATEGORIES.forEach(c => { s[c.id] = getCategoryStatus(c.id, vals); }); setStatuses(s);
    } catch {}
  }, [reportId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleFieldsSaved = useCallback(async () => {
    if (reportId === 'preview-001') {
      // In preview mode loadFields() is a no-op; reload from localStorage instead
      try {
        const raw = localStorage.getItem('ciq_preview_fields');
        if (raw) {
          const vals = JSON.parse(raw);
          setFieldValues(vals);
          const s = {}; CATEGORIES.forEach(c => { s[c.id] = getCategoryStatus(c.id, vals); }); setStatuses(s);
        }
      } catch {}
      return;
    }
    await loadFields();
  }, [loadFields, reportId]);
  const handlePreviewFields = useCallback((fields) => {
    setFieldValues(prev => {
      const u = { ...prev };
      fields.forEach(f => { u[f.field_id] = f.value; });
      const s = {}; CATEGORIES.forEach(c => { s[c.id] = getCategoryStatus(c.id, u); }); setStatuses(s);
      try { localStorage.setItem('ciq_preview_fields', JSON.stringify(u)); } catch {}
      return u;
    });
  }, []);

  const handleStartReport = useCallback(async () => {
    setStartingReport(true);
    setStartReportErr('');
    try {
      const res = await api.startCarbonReport();
      if (res.ok) {
        const data = await res.json();
        const newId = data.report_id ?? data.id ?? null;
        if (newId) {
          localStorage.removeItem('ciq_preview_fields');
          setReportId(String(newId));
          setFieldValues({});
          setStatuses({});
        } else {
          setStartReportErr(lang === 'tr' ? 'Rapor ID alınamadı.' : 'Could not get report ID.');
        }
      } else {
        setStartReportErr(lang === 'tr' ? 'Rapor oluşturulamadı. Tekrar deneyin.' : 'Failed to create report. Try again.');
      }
    } catch {
      setStartReportErr(lang === 'tr' ? 'Bağlantı hatası. Tekrar deneyin.' : 'Connection error. Try again.');
    }
    setStartingReport(false);
  }, [lang]);

  /* Open drawer to a specific category (expert mode) */
  const handleCategoryClick = useCallback((catId) => {
    setOpenCategory(catId);
    setPanelOpen(true);
  }, []);

  /* Derived */
  const completedCount = Object.values(statuses).filter(s => s === 'complete').length;
  const totalCount     = CATEGORIES.length;
  const grandKg        = CATEGORIES.reduce((sum, c) => sum + (estimateKg(c.id, fieldValues) || 0), 0);
  const hasData        = grandKg > 0;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F9F8F4]">
        <style>{ANIM_STYLES}</style>
        <div className="flex flex-col items-center gap-4">
          <div className="hero-float">
            <Image src="/carbon-hero.png" alt="CarbonIQ" width={140} height={105} className="opacity-80" />
          </div>
          <span className="text-sm font-semibold text-[#302817]/40">{tr ? 'Yükleniyor…' : 'Loading…'}</span>
        </div>
      </div>
    );
  }

  /* ── Main UI ── */
  return (
    <>
      <style>{ANIM_STYLES}</style>
      <div className="flex h-screen overflow-hidden font-sans bg-[#F9F8F4]">

        {/* ═══ MAIN CONTENT ══════════════════════════════════════════════════ */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* ── Top bar: logo (mobile) + mode toggle + panel button ── */}
          <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#302817]/8 bg-white shrink-0">
            {/* Logo */}
            <a href="/dashboard" className="flex items-center gap-2">
              <Image src="/carbonless.png" alt="Carbonless" width={30} height={30} className="h-7 w-7" />
              <span className="text-[13px] font-bold text-[#302817]/70">Carbonless</span>
            </a>

            {/* Mode toggle — centred on desktop, left-pushed on mobile */}
            <div className="flex-1 lg:flex-none flex justify-center lg:justify-start">
              <ModeToggle mode={workspaceMode} onChange={setWorkspaceMode} lang={lang} />
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Panel button — always visible */}
              <button
                onClick={() => setPanelOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-[#302817]/12 bg-[#302817]/4 px-3 py-1.5 text-[11px] font-bold text-[#302817]/60 transition hover:bg-[#302817]/8"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tr ? 'Veri Paneli' : 'Data Panel'}</span>
              </button>
              {/* Back */}
              <a href="/dashboard"
                aria-label={tr ? 'Kontrol Paneline Dön' : 'Back to Dashboard'}
                className="flex items-center gap-1 rounded-full border border-[#302817]/12 bg-[#302817]/4 px-3 py-1.5 text-[11px] font-bold text-[#302817]/50 transition hover:bg-[#302817]/8">
                <ArrowLeft className="h-3.5 w-3.5" />
              </a>
            </div>
          </header>

          {/* Mobile emission summary strip */}
          {hasData && (
            <div className="lg:hidden shrink-0 flex items-center gap-3 px-4 py-2 bg-[#F5F4EF] border-b border-[#302817]/6">
              <span className="text-[9.5px] font-bold uppercase tracking-widest text-[#302817]/35">
                {tr ? 'Toplam' : 'Total'}
              </span>
              <span className="text-[12px] font-bold text-[#527A1A]">{fmt(grandKg)}</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#302817]/8 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#B4BE6A] to-[#95A847]"
                  style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }} />
              </div>
              <span className="text-[9.5px] font-semibold text-[#75863B]">{completedCount}/{totalCount}</span>
              {isPreviewMode && (
                <span className="text-[8.5px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                  {tr ? 'Önizleme' : 'Preview'}
                </span>
              )}
            </div>
          )}

          {/* ── Content area ── */}
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatWorkspace
              reportId={reportId}
              lang={lang}
              onLangChange={setLang}
              onFieldsConfirmed={handleFieldsSaved}
              isPreview={reportId === 'preview-001'}
              onPreviewFields={handlePreviewFields}
              fieldValues={fieldValues}
              startQuestionnaire={workspaceMode === 'questionnaire'}
            />
          </div>
        </div>

        {/* ═══ PANEL DRAWER ════════════════════════════════════════════════ */}
        <PanelDrawer
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          reportId={reportId}
          fieldValues={fieldValues}
          statuses={statuses}
          lang={lang}
          onSaved={handleFieldsSaved}
          onStartReport={handleStartReport}
          startingReport={startingReport}
          startReportErr={startReportErr}
          openToCategory={openCategory}
        />
      </div>
    </>
  );
}
