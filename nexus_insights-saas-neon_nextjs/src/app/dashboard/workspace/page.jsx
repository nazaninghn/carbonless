'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Sparkles, Flame, Zap, Truck, Briefcase,
  CheckCircle2, Clock, AlertCircle, Minus, ArrowLeft, Leaf, X,
  ChevronRight, Menu,
} from 'lucide-react';
import { getReportFields, getCategoryStatus } from '@/lib/workspace/api';
import { ChatWorkspace } from '@/components/workspace/ChatWorkspace';
import { StationaryCombustionPanel } from '@/components/workspace/panels/StationaryCombustionPanel';
import { ElectricityPanel } from '@/components/workspace/panels/ElectricityPanel';
import { UpstreamTransportPanel } from '@/components/workspace/panels/UpstreamTransportPanel';
import { BusinessTravelPanel } from '@/components/workspace/panels/BusinessTravelPanel';
import { api } from '@/lib/utils/api';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  complete:    { dot: 'bg-[#95A847]',    icon: CheckCircle2, label: { tr: 'Tamamlandı',   en: 'Complete'    } },
  in_progress: { dot: 'bg-amber-400',    icon: Clock,        label: { tr: 'Devam ediyor', en: 'In Progress' } },
  missing:     { dot: 'bg-white/15',     icon: AlertCircle,  label: { tr: 'Veri yok',    en: 'No data'     } },
  not_applicable: { dot: 'bg-white/8',   icon: Minus,        label: { tr: 'Geçerli değil', en: 'N/A'       } },
};

// ── Category definitions ──────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: '3A', scope: 1,
    icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/15',
    scopeBadge: 'bg-orange-500/15 text-orange-300 border-orange-400/20',
    label: { tr: 'Sabit Yanma',       en: 'Stationary Combustion' },
    desc:  { tr: 'Yakıt tüketimi',    en: 'Fuel combustion' },
  },
  {
    id: '4A', scope: 2,
    icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/15',
    scopeBadge: 'bg-yellow-500/15 text-yellow-300 border-yellow-400/20',
    label: { tr: 'Elektrik',              en: 'Purchased Electricity' },
    desc:  { tr: 'Satın alınan elektrik', en: 'Grid electricity' },
  },
  {
    id: 'K4', scope: 3,
    icon: Truck, color: 'text-sky-400', bg: 'bg-sky-500/15',
    scopeBadge: 'bg-sky-500/15 text-sky-300 border-sky-400/20',
    label: { tr: 'Upstream Taşıma',    en: 'Upstream Transport' },
    desc:  { tr: 'Lojistik ve taşıma', en: 'Logistics & freight' },
  },
  {
    id: 'K5', scope: 3,
    icon: Briefcase, color: 'text-violet-400', bg: 'bg-violet-500/15',
    scopeBadge: 'bg-violet-500/15 text-violet-300 border-violet-400/20',
    label: { tr: 'İş Seyahati',        en: 'Business Travel' },
    desc:  { tr: 'Hava, kara ve tren', en: 'Air, road & rail' },
  },
];

const SCOPE_GROUPS = [
  { id: 1, label: { tr: 'Kapsam 1', en: 'Scope 1' }, cats: ['3A'] },
  { id: 2, label: { tr: 'Kapsam 2', en: 'Scope 2' }, cats: ['4A'] },
  { id: 3, label: { tr: 'Kapsam 3', en: 'Scope 3' }, cats: ['K4', 'K5'] },
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
  if (catId === 'K5') {
    const direct = parseFloat(vals['rf.k5.total_emission_kgco2e']);
    if (!isNaN(direct) && direct > 0) return direct;
    let total = 0, hasData = false;
    const addKm = (key, ef) => {
      const v = parseFloat(vals[key]);
      if (!isNaN(v) && v > 0) { total += v * ef; hasData = true; }
    };
    addKm('rf.k5.air_domestic_pkm',   0.264);
    addKm('rf.k5.air_short_haul_pkm', 0.153);
    addKm('rf.k5.air_long_haul_pkm',  0.195);
    addKm('rf.k5.rail_pkm',           0.035);
    addKm('rf.k5.car_km',             0.149);
    return hasData ? total : null;
  }
  return null;
}

function formatKg(kg) {
  if (kg === null || isNaN(kg)) return null;
  return kg >= 1000
    ? `${(kg / 1000).toFixed(2)} tCO₂e`
    : `${Math.round(kg)} kgCO₂e`;
}

// ── Panel slide-over ──────────────────────────────────────────────────────────
function PanelDrawer({ open, onClose, reportId, fieldValues, statuses, lang, onSaved }) {
  const tr = lang === 'tr';
  const [activeCat, setActiveCat] = useState('3A');

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={`
          fixed right-0 top-0 bottom-0 z-50 w-full max-w-[440px] bg-white shadow-2xl
          flex flex-col transform transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#302817]/8 bg-[#302817]">
          <div>
            <p className="text-sm font-bold text-white">
              {tr ? 'Emisyon Kategorileri' : 'Emission Categories'}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">ISO 14064-1 · Scope 1 / 2 / 3</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Category tab bar */}
        <div className="flex gap-1 px-4 py-3 border-b border-[#302817]/6 bg-[#FAFAF8]">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const status = statuses[cat.id] || 'missing';
            const isActive = activeCat === cat.id;
            const emKg = estimateEmissionKg(cat.id, fieldValues);
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`
                  flex-1 flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1 transition
                  ${isActive
                    ? 'bg-[#302817] shadow-sm'
                    : 'hover:bg-[#302817]/5'}
                `}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#B4BE6A]' : 'text-[#302817]/40'}`} />
                <span className={`text-[9px] font-bold truncate w-full text-center ${isActive ? 'text-white' : 'text-[#302817]/40'}`}>
                  {cat.id}
                </span>
                <span className={`h-1 w-1 rounded-full ${STATUS_CONFIG[status]?.dot}`} />
              </button>
            );
          })}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeCat === '3A' && <StationaryCombustionPanel reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />}
          {activeCat === '4A' && <ElectricityPanel          reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />}
          {activeCat === 'K4' && <UpstreamTransportPanel    reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />}
          {activeCat === 'K5' && <BusinessTravelPanel       reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />}
        </div>
      </div>
    </>
  );
}

// ── Main workspace page ───────────────────────────────────────────────────────
export default function WorkspacePage() {
  const [lang] = useState('tr');
  const tr = lang === 'tr';

  const [reportId,    setReportId]    = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [statuses,    setStatuses]    = useState({});
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  // Load active report (or use preview mock data)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const isPreview = sp.get('preview') === '1';
    const isEmpty   = sp.get('empty')   === '1';

    if (isPreview) {
      if (!isEmpty) {
        const pf = {
          'rf.3a.fuel_type': 'natural_gas', 'rf.3a.consumption': 15000, 'rf.3a.unit': 'm³', 'rf.3a.facility': 'Merkez Ofis',
          'rf.4a.consumption_kwh': 18000, 'rf.4a.grid_region': 'turkey_teias', 'rf.4a.supplier': 'TEDAŞ', 'rf.4a.emission_factor': 0.439,
          'rf.k4.shipments': [{ mode: 'road_hgv_gt34t_full', weight_t: 45, distance_km: 1200 }],
          'rf.k4.total_emission_kgco2e': 3312,
          'rf.k5.air_domestic_pkm': 5000, 'rf.k5.air_short_haul_pkm': 12000,
          'rf.k5.air_long_haul_pkm': 18000, 'rf.k5.rail_pkm': 4000,
          'rf.k5.total_emission_kgco2e': 6806,
        };
        setReportId('preview-001');
        setFieldValues(pf);
        const s = {};
        CATEGORIES.forEach(cat => { s[cat.id] = getCategoryStatus(cat.id, pf); });
        setStatuses(s);
      } else {
        setReportId('preview-001');
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
    if (!reportId || reportId === 'preview-001') return;
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

  const handlePreviewFieldsSaved = useCallback((extractedFields) => {
    setFieldValues(prev => {
      const updated = { ...prev };
      extractedFields.forEach(f => { updated[f.field_id] = f.value; });
      const s = {};
      CATEGORIES.forEach(cat => { s[cat.id] = getCategoryStatus(cat.id, updated); });
      setStatuses(s);
      return updated;
    });
  }, []);

  // Compute totals for left panel
  const completedCount = Object.values(statuses).filter(s => s === 'complete').length;
  const totalCount     = CATEGORIES.length;
  const grandTotalKg   = CATEGORIES.reduce((sum, cat) => {
    const kg = estimateEmissionKg(cat.id, fieldValues);
    return sum + (kg || 0);
  }, 0);
  const scopeTotals = SCOPE_GROUPS.map(group => {
    const cats = CATEGORIES.filter(c => group.cats.includes(c.id));
    const kg = cats.reduce((s, cat) => s + (estimateEmissionKg(cat.id, fieldValues) || 0), 0);
    return { ...group, kg, hasData: kg > 0 };
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0D0B07]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-[#B4BE6A] border-t-transparent animate-spin" />
          <span className="text-sm text-white/30">{tr ? 'Yükleniyor…' : 'Loading…'}</span>
        </div>
      </div>
    );
  }

  // ── No report ─────────────────────────────────────────────────────────────
  if (!reportId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 bg-[#0D0B07] px-6 text-center">
        <Image src="/carbon-hero.png" alt="CarbonIQ" width={220} height={165} className="opacity-70" />
        <div>
          <h2 className="text-xl font-bold text-white">
            {tr ? 'Aktif rapor bulunamadı' : 'No active report found'}
          </h2>
          <p className="mt-2 text-sm text-white/40 max-w-sm leading-relaxed">
            {tr
              ? 'Workspace\'i kullanmak için önce CarbonIQ anketi üzerinden bir rapor başlatın.'
              : 'Start a report via the CarbonIQ questionnaire to use the Workspace.'}
          </p>
        </div>
        <a
          href="/dashboard"
          className="rounded-full bg-[#B4BE6A] px-6 py-2.5 text-sm font-bold text-[#302817] shadow-lg hover:bg-[#c8d27a] transition"
        >
          {tr ? 'Dashboard\'a Dön' : 'Back to Dashboard'}
        </a>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden font-sans">

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT HERO PANEL — dark, fixed width, shows carbon-hero.png
      ═══════════════════════════════════════════════════════════════════ */}
      <aside className="hidden lg:flex w-[300px] xl:w-[340px] shrink-0 flex-col bg-[#0D0B07] relative overflow-hidden">

        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(180,190,106,1) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(180,190,106,1) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Radial glow behind image */}
        <div className="pointer-events-none absolute top-[120px] left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-[#B4BE6A]/8 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-2.5 px-6 pt-6 pb-1">
          <a href="/dashboard" className="flex items-center gap-2.5 group">
            <Image
              src="/carbonless.png"
              alt="Carbonless"
              width={36}
              height={36}
              className="h-8 w-8 opacity-80 group-hover:opacity-100 transition"
            />
            <span className="text-[14px] font-bold text-white/60 group-hover:text-white/90 transition tracking-tight">
              Carbonless
            </span>
          </a>
        </div>

        {/* ── HERO IMAGE ── */}
        <div className="relative z-10 px-3 pt-3">
          <Image
            src="/carbon-hero.png"
            alt="Carbon AI"
            width={340}
            height={255}
            className="w-full object-contain drop-shadow-2xl"
            priority
          />
        </div>

        {/* Headline */}
        <div className="relative z-10 px-6 -mt-1">
          <h1 className="text-[18px] xl:text-[20px] font-bold text-white leading-snug tracking-tight">
            {tr ? 'Karbon raporlaması' : 'Carbon reporting'}
            <br />
            <span className="text-[#B4BE6A]">
              {tr ? 'AI ile basit.' : 'simplified by AI.'}
            </span>
          </h1>
          <p className="mt-1.5 text-[10.5px] text-white/30 leading-relaxed">
            {tr
              ? 'Verilerinizi konuşun — AI çıkarsın, siz onaylayın.'
              : 'Talk your data — AI extracts, you approve.'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full border border-[#B4BE6A]/20 bg-[#B4BE6A]/8 px-2 py-0.5 text-[9px] font-bold text-[#B4BE6A]/70">
              ISO 14064-1
            </span>
            <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[9px] font-bold text-white/30">
              DEFRA 2023
            </span>
            <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[9px] font-bold text-white/30">
              GHG Protocol
            </span>
          </div>
        </div>

        {/* ── Scope emission summary ── */}
        <div className="relative z-10 mt-auto px-6 pb-3 pt-4 border-t border-white/5">
          {/* Grand total */}
          {grandTotalKg > 0 && (
            <div className="mb-3 rounded-xl bg-[#B4BE6A]/8 border border-[#B4BE6A]/15 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#B4BE6A]/50 mb-0.5">
                {tr ? 'Toplam Emisyon' : 'Total Emission'}
              </p>
              <p className="text-[18px] font-bold text-[#B4BE6A] leading-none">
                {formatKg(grandTotalKg)}
              </p>
            </div>
          )}

          {/* Scope rows */}
          <div className="space-y-2.5">
            {scopeTotals.map(scope => (
              <div key={scope.id} className="flex items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5">
                  <span className="text-[8px] font-bold text-white/35">{scope.id}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-white/40 truncate">
                      {scope.label[lang] || scope.label.en}
                    </span>
                    {scope.hasData && (
                      <span className="text-[10px] font-bold text-[#B4BE6A]/80 shrink-0">
                        {formatKg(scope.kg)}
                      </span>
                    )}
                  </div>
                  <div className="h-[3px] rounded-full bg-white/6 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#B4BE6A] transition-all duration-700"
                      style={{
                        width: grandTotalKg > 0 && scope.hasData
                          ? `${Math.max(8, Math.round((scope.kg / grandTotalKg) * 100))}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="flex items-center justify-between mt-3 text-[9.5px] text-white/25">
            <span>{completedCount}/{totalCount} {tr ? 'kategori tamamlandı' : 'categories complete'}</span>
            <span className="font-bold text-[#B4BE6A]/50">
              {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* ── Bottom actions ── */}
        <div className="relative z-10 px-5 pb-6 pt-3 border-t border-white/5 space-y-2">
          {/* Panel button — PRIMARY */}
          <button
            onClick={() => setPanelOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-xl bg-white/6 border border-white/8 px-4 py-2.5 text-[12px] font-bold text-white/70 transition hover:bg-[#B4BE6A]/12 hover:border-[#B4BE6A]/25 hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4 text-[#B4BE6A]/70" />
            {tr ? 'Panel Görünümü' : 'Panel View'}
            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-40" />
          </button>

          {/* Back to dashboard */}
          <a
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold text-white/25 transition hover:text-white/50 rounded-xl hover:bg-white/4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {tr ? 'Kontrol Paneline Dön' : 'Back to Dashboard'}
          </a>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT — CHATBOT (full height, the main product)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col min-w-0 bg-[#F9F8F4]">

        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-[#302817]/8 bg-[#0D0B07]">
          <a href="/dashboard" className="flex items-center gap-2">
            <Image src="/carbonless.png" alt="Carbonless" width={30} height={30} className="h-7 w-7 opacity-80" />
            <span className="text-[13px] font-bold text-white/70">Carbonless</span>
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {tr ? 'Panel' : 'Panel'}
            </button>
            <a
              href="/dashboard"
              className="flex items-center gap-1 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-bold text-white/50 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </a>
          </div>
        </header>

        {/* ── CHATBOT — fills all available height ── */}
        <div className="flex-1 min-h-0">
          <ChatWorkspace
            reportId={reportId}
            lang={lang}
            onFieldsConfirmed={handleFieldsSaved}
            isPreview={reportId === 'preview-001'}
            onPreviewFields={handlePreviewFieldsSaved}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PANEL SLIDE-OVER — data entry panels (secondary, on demand)
      ═══════════════════════════════════════════════════════════════════ */}
      <PanelDrawer
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        reportId={reportId}
        fieldValues={fieldValues}
        statuses={statuses}
        lang={lang}
        onSaved={handleFieldsSaved}
      />
    </div>
  );
}
