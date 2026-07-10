'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { LayoutDashboard, ArrowLeft, X, Flame, Zap, Truck, Briefcase } from 'lucide-react';
import { getReportFields, getCategoryStatus } from '@/lib/workspace/api';
import { StationaryCombustionPanel } from '@/components/workspace/panels/StationaryCombustionPanel';
import { ElectricityPanel } from '@/components/workspace/panels/ElectricityPanel';
import { UpstreamTransportPanel } from '@/components/workspace/panels/UpstreamTransportPanel';
import { BusinessTravelPanel } from '@/components/workspace/panels/BusinessTravelPanel';
import CarbonAIPage from '@/components/dashboard/CarbonAIPage';
import { api } from '@/lib/utils/api';
import { calcScope1Kg, calcScope2Kg, calcK4Kg, calcK5Kg } from '@/lib/carboniq/emission-factors';

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: '3A', tab: 'S1',  icon: Flame,     color: 'text-orange-500', bg: 'bg-orange-50',  label: { tr: 'Sabit Yanma',    en: 'Stationary Combustion' } },
  { id: '4A', tab: 'S2',  icon: Zap,       color: 'text-yellow-600', bg: 'bg-yellow-50',  label: { tr: 'Elektrik',        en: 'Purchased Electricity' } },
  { id: 'K4', tab: 'S3a', icon: Truck,     color: 'text-sky-500',    bg: 'bg-sky-50',     label: { tr: 'Upstream Taşıma', en: 'Upstream Transport'    } },
  { id: 'K5', tab: 'S3b', icon: Briefcase, color: 'text-violet-500', bg: 'bg-violet-50',  label: { tr: 'İş Seyahati',    en: 'Business Travel'       } },
];

// Estimation math lives in emission-factors.js (shared with the chat/dashboard
// preview) so this drawer never shows a different number than the rest of the app.
function estimateKg(catId, vals) {
  if (catId === '3A') { const kg = calcScope1Kg(vals); return kg > 0 ? kg : null; }
  if (catId === '4A') { const kg = calcScope2Kg(vals); return kg > 0 ? kg : null; }
  if (catId === 'K4') { const kg = calcK4Kg(vals); return kg > 0 ? kg : null; }
  if (catId === 'K5') { const kg = calcK5Kg(vals); return kg > 0 ? kg : null; }
  return null;
}

/* ─── Panel Drawer ───────────────────────────────────────────────────────────── */
function PanelDrawer({ open, onClose, reportId, fieldValues, statuses, lang, onSaved, onStartReport, startingReport, startReportErr, openToCategory }) {
  const tr = lang === 'tr';
  const isPreview = reportId === 'preview-001';
  const [active, setActive] = useState(openToCategory || '3A');

  useEffect(() => {
    if (open && openToCategory) setActive(openToCategory);
  }, [open, openToCategory]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-[#072C0E]/40 backdrop-blur-sm" onClick={onClose} />
      )}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[460px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#072C0E]/8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1D9C31]">
              <LayoutDashboard className="h-3.5 w-3.5 text-white/80" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#072C0E]">
                {tr ? 'Veri Girişi Paneli' : 'Data Entry Panel'}
              </p>
              <p className="text-[10px] text-[#072C0E]/40">
                ISO 14064-1 · Scope 1 / 2 / 3
                {isPreview && <span className="ml-1 text-amber-500 font-bold">· {tr ? 'Önizleme' : 'Preview'}</span>}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-[#072C0E]/5 text-[#072C0E]/40 hover:text-[#072C0E] transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview warning */}
        {isPreview && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2.5">
            <span className="text-[11px] shrink-0">👁</span>
            <div className="flex-1 min-w-0">
              <p className="text-[9.5px] font-semibold text-amber-700 truncate">
                {tr ? 'Önizleme — kaydetme devre dışı' : 'Preview — saving disabled'}
              </p>
              {startReportErr && <p className="text-[9px] font-semibold text-red-600 truncate mt-0.5">{startReportErr}</p>}
            </div>
            <button onClick={onStartReport} disabled={startingReport}
              className="shrink-0 text-[9.5px] font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 rounded-full px-2.5 py-1 transition disabled:opacity-60 whitespace-nowrap">
              {startingReport ? '…' : (tr ? '🚀 Başlat' : '🚀 Start')}
            </button>
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-1.5 px-4 py-3 border-b border-[#072C0E]/6 bg-[#F1FCF2] mt-2">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const em = estimateKg(cat.id, fieldValues);
            const st = statuses[cat.id] || 'missing';
            const isA = active === cat.id;
            return (
              <button key={cat.id} onClick={() => setActive(cat.id)}
                className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 transition ${isA ? 'bg-[#1D9C31] shadow-sm' : 'hover:bg-[#072C0E]/5'}`}>
                <div className="relative">
                  <Icon className={`h-4 w-4 ${isA ? 'text-[#8BEA99]' : cat.color}`} />
                  <span className={`absolute -top-0.5 -right-1 h-2 w-2 rounded-full border border-white ${
                    st === 'complete' ? 'bg-[#1D9C31]' : st === 'in_progress' ? 'bg-amber-400' : 'bg-[#072C0E]/20'
                  }`} />
                </div>
                <span className={`text-[8.5px] font-bold tracking-wide ${isA ? 'text-white' : 'text-[#072C0E]/40'}`}>{cat.tab}</span>
                {em !== null && (
                  <span className={`text-[7.5px] font-bold ${isA ? 'text-[#8BEA99]/80' : 'text-[#1D9C31]/60'}`}>
                    {em >= 1000 ? `${(em/1000).toFixed(1)}t` : `${Math.round(em)}kg`}
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

/* ─── Main page ──────────────────────────────────────────────────────────────── */
export default function WorkspacePage() {
  const [lang, setLang] = useState('tr');
  const tr = lang === 'tr';

  const [reportId,      setReportId]      = useState(null);
  const [fieldValues,   setFieldValues]   = useState({});
  const [statuses,      setStatuses]      = useState({});
  const [loading,       setLoading]       = useState(true);
  const [panelOpen,     setPanelOpen]     = useState(false);
  const [openCategory,  setOpenCategory]  = useState('3A');
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
          'rf.4a.consumption_kwh':18000,'rf.4a.grid_region':'turkey_teias','rf.4a.supplier':'TEDAŞ','rf.4a.emission_factor':0.4199,
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
            : Array.isArray(data.results) ? data.results : [];
          if (reports.length > 0) {
            const firstId = reports[0].report_id ?? reports[0].id ?? null;
            setReportId(firstId ? String(firstId) : 'preview-001');
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

  const handleStartReport = useCallback(async () => {
    setStartingReport(true); setStartReportErr('');
    try {
      const res = await api.startCarbonReport();
      if (res.ok) {
        const data = await res.json();
        const newId = data.report_id ?? data.id ?? null;
        if (newId) {
          localStorage.removeItem('ciq_preview_fields');
          setReportId(String(newId)); setFieldValues({}); setStatuses({});
        } else {
          setStartReportErr(tr ? 'Rapor ID alınamadı.' : 'Could not get report ID.');
        }
      } else {
        setStartReportErr(tr ? 'Rapor oluşturulamadı.' : 'Failed to create report.');
      }
    } catch {
      setStartReportErr(tr ? 'Bağlantı hatası.' : 'Connection error.');
    }
    setStartingReport(false);
  }, [tr]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F1FCF2]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#1D9C31] flex items-center justify-center animate-pulse">
            <span className="text-white text-xl">✦</span>
          </div>
          <span className="text-sm font-semibold text-[#072C0E]/40">{tr ? 'Yükleniyor…' : 'Loading…'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F1FCF2]">

      {/* ── Top bar ── */}
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 border-b border-[#072C0E]/8 bg-white">
        {/* Logo */}
        <a href="/dashboard" className="flex items-center gap-2 shrink-0">
          <Image src="/carbonless.png" alt="Carbonless" width={30} height={30} className="h-7 w-7" />
          <span className="hidden sm:block text-[13px] font-bold text-[#072C0E]/70">Carbonless</span>
        </a>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {isPreviewMode && (
            <span className="hidden sm:block rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600">
              {tr ? 'Önizleme' : 'Preview'}
            </span>
          )}
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-[#072C0E]/12 bg-[#072C0E]/4 px-3 py-1.5 text-[11px] font-bold text-[#072C0E]/60 transition hover:bg-[#072C0E]/8"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr ? 'Veri Paneli' : 'Data Panel'}</span>
          </button>
          <a href="/dashboard"
            className="flex items-center gap-1 rounded-full border border-[#072C0E]/12 bg-[#072C0E]/4 px-3 py-1.5 text-[11px] font-bold text-[#072C0E]/50 transition hover:bg-[#072C0E]/8">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tr ? 'Geri' : 'Back'}</span>
          </a>
        </div>
      </header>

      {/* ── Content: CarbonAIPage with full Chat + Questionnaire ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CarbonAIPage language={lang} isVisible />
      </div>

      {/* ── Data Panel Drawer ── */}
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
  );
}
