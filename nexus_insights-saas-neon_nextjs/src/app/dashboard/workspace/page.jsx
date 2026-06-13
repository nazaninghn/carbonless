'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Flame, Zap, Truck, Briefcase,
  CheckCircle2, Clock, AlertCircle, Minus, ArrowLeft,
  ChevronRight, X, Sparkles,
} from 'lucide-react';
import { getReportFields, getCategoryStatus } from '@/lib/workspace/api';
import { ChatWorkspace } from '@/components/workspace/ChatWorkspace';
import { StationaryCombustionPanel } from '@/components/workspace/panels/StationaryCombustionPanel';
import { ElectricityPanel } from '@/components/workspace/panels/ElectricityPanel';
import { UpstreamTransportPanel } from '@/components/workspace/panels/UpstreamTransportPanel';
import { BusinessTravelPanel } from '@/components/workspace/panels/BusinessTravelPanel';
import { api } from '@/lib/utils/api';

/* ─── CSS animations (injected once) ─────────────────────────────────────── */
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
`;

/* ─── Constants ───────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: '3A', scope: 1, icon: Flame,    color: 'text-orange-500', bg: 'bg-orange-50',  panelBg: 'bg-orange-500', label: { tr: 'Sabit Yanma',    en: 'Stationary Combustion' }, desc: { tr: 'Yakıt tüketimi',     en: 'Fuel combustion'    } },
  { id: '4A', scope: 2, icon: Zap,      color: 'text-yellow-600', bg: 'bg-yellow-50',  panelBg: 'bg-yellow-500', label: { tr: 'Elektrik',        en: 'Purchased Electricity' }, desc: { tr: 'Satın alınan el.', en: 'Grid electricity'   } },
  { id: 'K4', scope: 3, icon: Truck,    color: 'text-sky-500',    bg: 'bg-sky-50',     panelBg: 'bg-sky-500',    label: { tr: 'Upstream Taşıma', en: 'Upstream Transport'    }, desc: { tr: 'Lojistik',          en: 'Freight & logistics'} },
  { id: 'K5', scope: 3, icon: Briefcase,color: 'text-violet-500', bg: 'bg-violet-50',  panelBg: 'bg-violet-500', label: { tr: 'İş Seyahati',    en: 'Business Travel'       }, desc: { tr: 'Hava & kara',       en: 'Air, road & rail'  } },
];

const SCOPE_GROUPS = [
  { id: 1, label: { tr: 'Kapsam 1', en: 'Scope 1' }, cats: ['3A'], color: 'bg-orange-400' },
  { id: 2, label: { tr: 'Kapsam 2', en: 'Scope 2' }, cats: ['4A'], color: 'bg-yellow-400' },
  { id: 3, label: { tr: 'Kapsam 3', en: 'Scope 3' }, cats: ['K4', 'K5'], color: 'bg-sky-400' },
];

const DEFRA_EF = {
  natural_gas: { 'm³': 2.02, m3: 2.02, kWh: 0.183, GJ: 50.77 },
  fuel_oil:    { litre: 2.52, kg: 2.96, GJ: 74.07  },
  diesel:      { litre: 2.54, GJ: 68.08             },
  lpg:         { litre: 1.51, kg: 2.94, GJ: 59.65  },
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

/* ─── Panel slide-over ────────────────────────────────────────────────────── */
function PanelDrawer({ open, onClose, reportId, fieldValues, statuses, lang, onSaved }) {
  const tr = lang === 'tr';
  const [active, setActive] = useState('3A');
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-[#302817]/40 backdrop-blur-sm" onClick={onClose} />}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[460px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#302817]/8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#302817]">
              <LayoutDashboard className="h-3.5 w-3.5 text-[#B4BE6A]" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#302817]">{tr ? 'Veri Girişi Paneli' : 'Data Entry Panel'}</p>
              <p className="text-[10px] text-[#302817]/40">ISO 14064-1 · Scope 1 / 2 / 3</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-[#302817]/5 text-[#302817]/40 hover:text-[#302817] transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* tabs */}
        <div className="flex gap-1.5 px-4 py-3 border-b border-[#302817]/6 bg-[#FAFAF8]">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const em = estimateKg(cat.id, fieldValues);
            const isA = active === cat.id;
            return (
              <button key={cat.id} onClick={() => setActive(cat.id)}
                className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition ${isA ? 'bg-[#302817] shadow-sm' : 'hover:bg-[#302817]/5'}`}>
                <Icon className={`h-4 w-4 ${isA ? 'text-[#B4BE6A]' : cat.color}`} />
                <span className={`text-[8.5px] font-bold ${isA ? 'text-white' : 'text-[#302817]/40'}`}>{cat.id}</span>
                {em !== null && <span className={`text-[7.5px] font-bold ${isA ? 'text-[#B4BE6A]/80' : 'text-[#75863B]/60'}`}>{fmt(em)}</span>}
              </button>
            );
          })}
        </div>
        {/* content */}
        <div className="flex-1 overflow-y-auto p-5">
          {active === '3A' && <StationaryCombustionPanel reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />}
          {active === '4A' && <ElectricityPanel          reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />}
          {active === 'K4' && <UpstreamTransportPanel    reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />}
          {active === 'K5' && <BusinessTravelPanel       reportId={reportId} fieldValues={fieldValues} lang={lang} onSaved={onSaved} />}
        </div>
      </div>
    </>
  );
}

/* ─── Main page ───────────────────────────────────────────────────────────── */
export default function WorkspacePage() {
  const [lang] = useState('tr');
  const tr = lang === 'tr';

  const [reportId,    setReportId]    = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [statuses,    setStatuses]    = useState({});
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [loading,     setLoading]     = useState(true);

  /* Load report ── on failure/missing → fall back to preview so chatbot always shows */
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
        const res = await api('/questionnaire/');
        if (res.ok) {
          const data = await res.json();
          const reports = data.reports || [];
          if (reports.length > 0) {
            setReportId(reports[0].report_id);
          } else {
            /* No report yet — show chatbot in onboarding/preview mode */
            setReportId('preview-001');
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

  const handleFieldsSaved   = useCallback(async () => { await loadFields(); }, [loadFields]);
  const handlePreviewFields = useCallback((fields) => {
    setFieldValues(prev => {
      const u = { ...prev };
      fields.forEach(f => { u[f.field_id] = f.value; });
      const s = {}; CATEGORIES.forEach(c => { s[c.id] = getCategoryStatus(c.id, u); }); setStatuses(s);
      return u;
    });
  }, []);

  const completedCount = Object.values(statuses).filter(s => s === 'complete').length;
  const totalCount     = CATEGORIES.length;
  const grandKg        = CATEGORIES.reduce((sum, c) => sum + (estimateKg(c.id, fieldValues) || 0), 0);
  const hasData        = grandKg > 0;
  const scopeTotals    = SCOPE_GROUPS.map(g => {
    const cats = CATEGORIES.filter(c => g.cats.includes(c.id));
    const kg   = cats.reduce((s, c) => s + (estimateKg(c.id, fieldValues) || 0), 0);
    return { ...g, kg, pct: grandKg > 0 ? Math.max(4, Math.round((kg / grandKg) * 100)) : 0, hasData: kg > 0 };
  });

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

        {/* ═══ LEFT HERO PANEL ═══════════════════════════════════════════════ */}
        <aside className="hidden lg:flex w-[300px] xl:w-[330px] shrink-0 flex-col bg-white border-r border-[#302817]/8 relative overflow-hidden">

          {/* Subtle dot texture */}
          <div className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(48,40,23,0.04) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

          {/* Top gradient accent */}
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#75863B] via-[#B4BE6A] to-[#95A847]" />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-2.5 px-5 pt-5 pb-2">
            <a href="/dashboard" className="flex items-center gap-2.5 group">
              <Image src="/carbonless.png" alt="Carbonless" width={34} height={34} className="h-8 w-8 group-hover:scale-105 transition-transform" />
              <span className="text-[14px] font-bold text-[#302817]/70 group-hover:text-[#302817] transition tracking-tight">Carbonless</span>
            </a>
          </div>

          {/* ── Animated globe ── */}
          <div className="relative z-10 flex items-center justify-center px-4 pt-4 pb-1">
            {/* Glow behind globe */}
            <div className="glow-pulse absolute h-44 w-44 rounded-full bg-[#B4BE6A]/15 blur-2xl" />
            {/* Extra ring when has data */}
            {hasData && (
              <svg className="data-ring absolute h-56 w-56 opacity-30" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" stroke="#B4BE6A" strokeWidth="1.5" strokeDasharray="12 8" />
              </svg>
            )}
            <div className="hero-float relative">
              <Image src="/carbon-hero.png" alt="Carbon AI" width={230} height={172} className="w-full object-contain" priority />
            </div>
          </div>

          {/* Headline */}
          <div className="relative z-10 px-5 pb-3 text-center">
            <h1 className="text-[17px] xl:text-[19px] font-bold text-[#302817] leading-snug tracking-tight">
              {tr ? 'Karbon raporlaması' : 'Carbon reporting'}
              <br />
              <span className="text-[#75863B]">{tr ? 'AI ile basit.' : 'simplified by AI.'}</span>
            </h1>
            <p className="mt-1.5 text-[10.5px] text-[#302817]/40 leading-relaxed">
              {tr ? 'Verilerinizi konuşun — AI çıkarsın, siz onaylayın.' : 'Talk your data — AI extracts, you approve.'}
            </p>
            {/* Standard badges */}
            <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
              {['ISO 14064-1', 'DEFRA 2023', 'GHG Protocol'].map(b => (
                <span key={b} className="rounded-full border border-[#302817]/10 bg-[#302817]/4 px-2 py-0.5 text-[8.5px] font-bold text-[#302817]/45">{b}</span>
              ))}
            </div>
          </div>

          {/* ── Emission summary (only when data exists) ── */}
          <div className="relative z-10 mx-4 mt-1 flex-1">
            {hasData ? (
              <div className="rounded-2xl border border-[#302817]/8 bg-[#F5F4EF] p-3.5 space-y-2.5">
                {/* Grand total */}
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-bold uppercase tracking-widest text-[#302817]/35">
                    {tr ? 'Toplam Emisyon' : 'Total Emission'}
                  </span>
                  <span className="text-[13px] font-bold text-[#527A1A]">{fmt(grandKg)}</span>
                </div>
                {/* Scope rows */}
                {scopeTotals.map(scope => (
                  <div key={scope.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-[#302817]/50">{scope.label[lang] || scope.label.en}</span>
                      {scope.hasData && <span className="text-[10px] font-bold text-[#75863B]">{fmt(scope.kg)}</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-[#302817]/8 overflow-hidden">
                      <div className={`h-full rounded-full ${scope.color} transition-all duration-700`} style={{ width: `${scope.pct}%` }} />
                    </div>
                  </div>
                ))}
                {/* Progress */}
                <div className="flex items-center justify-between pt-1 border-t border-[#302817]/6">
                  <span className="text-[9px] text-[#302817]/35">{completedCount}/{totalCount} {tr ? 'tamamlandı' : 'complete'}</span>
                  <span className="text-[9px] font-bold text-[#75863B]">{Math.round((completedCount / totalCount) * 100)}%</span>
                </div>
              </div>
            ) : (
              /* Onboarding hint when no data */
              <div className="rounded-2xl border border-dashed border-[#B4BE6A]/30 bg-[#B4BE6A]/5 p-4 text-center space-y-2">
                <Sparkles className="h-5 w-5 text-[#B4BE6A] mx-auto" />
                <p className="text-[11px] font-semibold text-[#302817]/50 leading-relaxed">
                  {tr
                    ? 'Sağdaki chatbot ile emisyon verilerinizi paylaşın.'
                    : 'Share your emission data with the chatbot on the right.'}
                </p>
              </div>
            )}
          </div>

          {/* ── Bottom actions ── */}
          <div className="relative z-10 px-4 pb-5 pt-4 space-y-2">
            {/* Panel button */}
            <button
              onClick={() => setPanelOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[#302817]/10 bg-[#302817] px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#1a1408] shadow-sm"
            >
              <LayoutDashboard className="h-4 w-4 text-[#B4BE6A]" />
              {tr ? 'Panel Görünümü' : 'Panel View'}
              <ChevronRight className="h-3.5 w-3.5 ml-auto text-white/40" />
            </button>
            {/* Back link */}
            <a href="/dashboard"
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold text-[#302817]/35 transition hover:text-[#302817]/70 rounded-xl hover:bg-[#302817]/4">
              <ArrowLeft className="h-3.5 w-3.5" />
              {tr ? 'Kontrol Paneline Dön' : 'Back to Dashboard'}
            </a>
          </div>
        </aside>

        {/* ═══ RIGHT — CHATBOT ════════════════════════════════════════════════ */}
        <div className="flex flex-1 flex-col min-w-0">

          {/* Mobile topbar */}
          <header className="lg:hidden flex items-center justify-between gap-3 px-4 py-3 border-b border-[#302817]/8 bg-white">
            <a href="/dashboard" className="flex items-center gap-2">
              <Image src="/carbonless.png" alt="Carbonless" width={30} height={30} className="h-7 w-7" />
              <span className="text-[13px] font-bold text-[#302817]/70">Carbonless</span>
            </a>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPanelOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-[#302817]/12 bg-[#302817]/4 px-3 py-1.5 text-[11px] font-bold text-[#302817]/60 transition hover:bg-[#302817]/8"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                {tr ? 'Panel' : 'Panel'}
              </button>
              <a href="/dashboard"
                className="flex items-center gap-1 rounded-full border border-[#302817]/12 bg-[#302817]/4 px-3 py-1.5 text-[11px] font-bold text-[#302817]/50 transition hover:bg-[#302817]/8">
                <ArrowLeft className="h-3.5 w-3.5" />
              </a>
            </div>
          </header>

          {/* Chatbot — full remaining height */}
          <div className="flex-1 min-h-0">
            <ChatWorkspace
              reportId={reportId}
              lang={lang}
              onFieldsConfirmed={handleFieldsSaved}
              isPreview={reportId === 'preview-001'}
              onPreviewFields={handlePreviewFields}
            />
          </div>
        </div>

        {/* ═══ PANEL DRAWER ═══════════════════════════════════════════════════ */}
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
    </>
  );
}
