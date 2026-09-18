'use client';
import { useState, useMemo, useCallback, useEffect } from 'react';
import useIsomorphicLayoutEffect from '@/lib/hooks/useIsomorphicLayoutEffect';
import useCountUp from '@/lib/hooks/useCountUp';
import { DASHBOARD_ANIM_STYLES } from '@/lib/constants/dashboardAnimations';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Sparkles,
  Package,
  Table2,
  Target,
  TrendingDown,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { api } from '@/lib/utils/api';
import {
  MONTHS_TR as MONTHS_TR_SHORT,
  MONTHS_EN as MONTHS_EN_SHORT,
} from '@/lib/constants/emissions';

// Shared card wrapper: entrance stagger + hover lift, same visual language as
// the Dashboard Overview / Emissions / Targets pages.
function ReportCard({ children, className = '', delay = 0 }) {
  return (
    <div
      className={`dash-fade-up rounded-[1.5rem] border border-[#072C0E]/10 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(7,44,14,0.10)] hover:border-[#2ABD41]/25 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function ReportingTab({ language, selectedYear, summary, entries, targets, questionnaireProfile }) {
  const [pdfLoading, setPdfLoading] = useState('');
  const [dlError, setDlError] = useState('');
  const tr = language === 'tr';
  const totalTonne = summary?.total_tonne || 0;
  const s1 = summary?.scope1_tonne || 0;
  const s2 = summary?.scope2_tonne || 0;
  const s3 = summary?.scope3_tonne || 0;

  // Gates the readiness bar / scope-breakdown bars / monthly-trend bars —
  // start at 0 and grow to their real value shortly after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // The ISO 14064-1 / inventory report is keyed to a CarbonReport (one of
  // possibly several inventories the company has submitted — different years,
  // divisions, or re-runs), while the emissions summary/CSV/Excel exports on
  // this tab are keyed to a year and read straight from EmissionEntry rows.
  // So the inventory has to be picked explicitly rather than assumed: this
  // loads every inventory once, defaults to the best match for the selected
  // year, and lets the user override that choice with the dropdown below.
  const [allReports, setAllReports] = useState([]);
  const [isoReportId, setIsoReportId] = useState(null);
  const [manualIsoPick, setManualIsoPick] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.listReports();
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        // This endpoint answers {reports: [...]} — not a bare array and not the
        // DRF {results: [...]} envelope. InventoryLibrary reads it the same way.
        const list = Array.isArray(data) ? data : (data.reports ?? data.results ?? []);
        if (!cancelled) setAllReports(list);
      } catch {
        if (!cancelled) setAllReports([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Re-derive the default pick whenever the year changes or the list loads,
  // but only while the user hasn't manually chosen a different inventory —
  // switching the year shouldn't silently discard an explicit selection.
  useEffect(() => {
    if (manualIsoPick) return;
    const forYear = allReports.filter(r => String(r.reporting_year) === String(selectedYear));
    const pick = forYear.find(r => r.status === 'completed') || forYear[0] || null;
    setIsoReportId(pick ? (pick.report_id ?? pick.id) : null);
  }, [allReports, selectedYear, manualIsoPick]);

  const completedReports = useMemo(
    () => allReports.filter(r => r.status === 'completed'),
    [allReports],
  );

  // Readiness — useMemo so this is only recalculated when data actually changes,
  // not on every local state update (e.g. pdfLoading spinner toggling).
  const { checks, readiness } = useMemo(() => {
    const list = [
      { done: !!questionnaireProfile?.is_complete, label: tr ? 'Anket tamamlandı' : 'Questionnaire completed' },
      { done: entries.length > 0, label: tr ? 'Emisyon verisi girildi' : 'Emission data entered' },
      { done: entries.length >= 5, label: tr ? 'Yeterli veri (5+ kayıt)' : 'Sufficient data (5+ entries)' },
      { done: totalTonne > 0, label: tr ? 'Scope haritalama tamam' : 'Scope mapping complete' },
      { done: targets.length > 0, label: tr ? 'Azaltma hedefi belirlendi' : 'Reduction target set' },
    ];
    return { checks: list, readiness: Math.round((list.filter(c => c.done).length / list.length) * 100) };
  }, [questionnaireProfile, entries.length, targets.length, totalTonne, tr]);
  const animatedReadiness = useCountUp(readiness, 900);

  // Monthly chart max — computed once, not inside the render IIFE
  const monthlyMaxKg = useMemo(
    () => Math.max(...(summary?.monthly?.map(x => x.total_kg) ?? []), 1),
    [summary?.monthly],
  );

  const handleDownload = useCallback(async (type, lang) => {
    // Fix 28D: prevent concurrent downloads before React flushes disabled state
    if (pdfLoading) return;
    setPdfLoading(type + lang);
    setDlError('');
    try {
      let res;
      // 'pack' (all three reports in one PDF), 'iso' (the full ISO 14064-1
      // report) and 'inv' (the shorter inventory profile) are all keyed to one
      // CarbonReport, so each needs a picked inventory; 'pdf'/'csv'/'excel'
      // are keyed to the selected year instead.
      if (type === 'pack' || type === 'iso' || type === 'inv') {
        if (!isoReportId) {
          setDlError(tr
            ? `${selectedYear} yılı için tamamlanmış bir envanter bulunamadı. Önce Karbon Envanteri anketini doldurun.`
            : `No inventory found for ${selectedYear}. Complete the Carbon Inventory questionnaire first.`);
          return;
        }
        res = type === 'pack'
          // The pack builds all three reports server-side, so it is the one
          // download that can take tens of seconds on a large inventory.
          ? await api.downloadCombinedReport(isoReportId, lang, selectedYear)
          : type === 'iso'
          ? await api.downloadIsoReport(isoReportId, lang)
          : await api.downloadQuestionnairePdf(isoReportId, lang);
      }
      else if (type === 'pdf') res = await api.downloadReport(selectedYear, lang);
      else if (type === 'csv') res = await api.downloadCsv(selectedYear);
      else res = await api.downloadExcel(selectedYear);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDlError(tr ? `İndirme hatası: ${err.error || res.status}` : `Download error: ${err.error || res.status}`);
        return;
      }

      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = type === 'pack'
        ? `ghg_reporting_pack_${selectedYear}_${lang}.pdf`
        : type === 'iso'
        ? `iso14064-1_full_report_${selectedYear}_${lang}.pdf`
        : type === 'inv'
        ? `carbon_inventory_report_${selectedYear}_${lang}.pdf`
        : type === 'pdf'
        ? `emissions_report_${selectedYear}_${lang}.pdf`
        : type === 'csv'
        ? `emissions_${selectedYear}.csv`
        : `emissions_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 30_000); // 30s — give browser time to start download
    } catch {
      setDlError(tr ? 'İndirme başarısız. Lütfen tekrar deneyin.' : 'Download failed. Please try again.');
    } finally {
      setPdfLoading('');
    }
  }, [selectedYear, pdfLoading, tr, isoReportId]); // pdfLoading added — read inside guard

  // Touch-tablet simplified view — useLayoutEffect runs before browser paint,
  // so the GPU-heavy complex view is never rendered to screen on Android tablets.
  const [isAndroidTablet, setIsAndroidTablet] = useState(false);
  useIsomorphicLayoutEffect(() => {
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    setIsAndroidTablet(isTouch && window.innerWidth >= 768);
  }, []);

  if (isAndroidTablet) {
    return (
      <div className="space-y-4 text-[#072C0E]">
        <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#2ABD41]">
            {tr ? 'Rapor merkezi' : 'Report center'}
          </p>
          <h1 className="mt-2 text-2xl font-black text-[#072C0E]">
            {tr ? 'Karbon Rapor Merkezi' : 'Carbon Report Center'}
          </h1>
        </div>
        <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
          <p className="text-xs text-[#072C0E]/50">{tr ? 'Rapor Hazırlığı' : 'Readiness'}</p>
          <p className="text-3xl font-black text-[#2ABD41]">{readiness}%</p>
        </div>
        <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-5">
          <p className="text-xs text-[#072C0E]/50">{tr ? 'Toplam Emisyon' : 'Total Emissions'}</p>
          <p className="text-3xl font-black text-[#072C0E]">{totalTonne.toFixed(2)} tCO₂e</p>
        </div>
        {dlError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
            {dlError}
          </div>
        )}
        {/* The same three report types as the full view, each with its two
            languages, then the bundle of all three, then the raw-data
            exports. */}
        {[
          { type: 'pdf', label: tr ? 'Emisyon Raporu' : 'Emissions Report', gated: false },
          { type: 'inv', label: tr ? 'Envanter Raporu' : 'Inventory Report', gated: true },
          { type: 'iso', label: tr ? 'Tam ISO 14064-1 Raporu' : 'Full ISO 14064-1 Report', gated: true, primary: true },
          { type: 'pack', label: tr ? 'Üçü tek PDF olarak' : 'All three as one PDF', gated: true },
        ].map(({ type, label, gated, primary }) => (
          <div
            key={type}
            className={`rounded-2xl border p-4 ${primary ? 'border-[#2ABD41]/35 bg-[#F1FCF2]' : 'border-[#072C0E]/10 bg-white'} ${gated && !isoReportId ? 'opacity-50' : ''}`}
          >
            <p className="text-sm font-bold text-[#072C0E]">{label}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {['tr', 'en'].map((l) => (
                <button
                  key={l}
                  onClick={() => handleDownload(type, l)}
                  disabled={gated && !isoReportId}
                  className="rounded-xl border border-[#072C0E]/10 bg-white p-3 text-center text-sm font-bold text-[#072C0E] disabled:opacity-50"
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handleDownload('csv', '')} className="rounded-2xl border border-[#072C0E]/10 bg-white p-4 text-center text-sm font-bold text-[#072C0E]">CSV</button>
          <button onClick={() => handleDownload('excel', '')} className="rounded-2xl border border-[#072C0E]/10 bg-white p-4 text-center text-sm font-bold text-[#072C0E]">Excel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#072C0E]">
      <style>{DASHBOARD_ANIM_STYLES}</style>
      {/* ─── Download error ─── */}
      {dlError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          <span>{dlError}</span>
          <button onClick={() => setDlError('')} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {/* ─── HERO ─── */}
      <div className="dash-fade-up relative rounded-[1.5rem] border border-[#072C0E]/10 bg-[#F1FCF2] p-5 shadow-sm">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2ABD41]">
              {tr ? 'Rapor merkezi' : 'Report center'}
            </p>
            <h1 className="mt-1.5 text-xl font-bold tracking-[-0.03em] sm:text-2xl">
              {tr ? 'Karbon Rapor Merkezi' : 'Carbon Report Center'}
            </h1>
            <p className="mt-1 text-sm text-[#072C0E]/55">
              {tr ? 'Denetim-hazır ESG & ISO 14064-1 raporları oluşturun' : 'Generate audit-ready ESG & ISO 14064-1 reports'}
            </p>
          </div>
          {/* One button per report type, in the report language; TR/EN for
              each is in the export centre below. The pack is set apart because
              it is the same three reports in one file, not a fourth type. */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleDownload('pdf', tr ? 'tr' : 'en')} disabled={!!pdfLoading} className="inline-flex items-center gap-1.5 rounded-full border border-[#072C0E]/15 bg-white px-4 py-2.5 text-xs font-bold text-[#072C0E] transition hover:bg-[#F8F8F8] disabled:opacity-60">
              <FileText className="h-3.5 w-3.5" />
              {pdfLoading?.startsWith('pdf') ? '...' : (tr ? 'Emisyon Raporu' : 'Emissions Report')}
            </button>
            <button onClick={() => handleDownload('inv', tr ? 'tr' : 'en')} disabled={!!pdfLoading || !isoReportId} title={!isoReportId ? (tr ? 'Önce bir envanter tamamlayın' : 'Complete an inventory first') : undefined} className="inline-flex items-center gap-1.5 rounded-full border border-[#072C0E]/15 bg-white px-4 py-2.5 text-xs font-bold text-[#072C0E] transition hover:bg-[#F8F8F8] disabled:opacity-60">
              <ClipboardList className="h-3.5 w-3.5" />
              {pdfLoading?.startsWith('inv') ? '...' : (tr ? 'Envanter Raporu' : 'Inventory Report')}
            </button>
            <button onClick={() => handleDownload('iso', tr ? 'tr' : 'en')} disabled={!!pdfLoading || !isoReportId} title={!isoReportId ? (tr ? 'Önce bir envanter tamamlayın' : 'Complete an inventory first') : undefined} className="inline-flex items-center gap-1.5 rounded-full bg-[#2ABD41] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#2ABD41]/20 transition-colors hover:bg-[#25a839] disabled:opacity-60">
              <Shield className="h-3.5 w-3.5" />
              {pdfLoading?.startsWith('iso') ? '...' : (tr ? 'Tam ISO 14064-1 Raporu' : 'Full ISO 14064-1 Report')}
            </button>
            <span className="mx-0.5 hidden h-5 w-px bg-[#072C0E]/10 sm:block" />
            <button onClick={() => handleDownload('pack', tr ? 'tr' : 'en')} disabled={!!pdfLoading || !isoReportId} title={!isoReportId ? (tr ? 'Önce bir envanter tamamlayın' : 'Complete an inventory first') : undefined} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-bold text-[#072C0E]/60 underline-offset-2 transition hover:text-[#072C0E] hover:underline disabled:opacity-60">
              <Package className="h-3.5 w-3.5" />
              {pdfLoading?.startsWith('pack') ? '...' : (tr ? 'Üçü tek PDF' : 'All three in one PDF')}
            </button>
          </div>
        </div>
      </div>

      {/* ─── ROW 1: Readiness + AI Insights ─── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Report Readiness */}
        <ReportCard delay={80}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2ABD41]/15 text-[#2ABD41] transition-transform duration-300 group-hover:scale-110">
                <Shield className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold">{tr ? 'Rapor Hazırlığı' : 'Report Readiness'}</h2>
            </div>
            <span className="text-2xl font-bold tabular-nums text-[#2ABD41]">{Math.round(animatedReadiness)}%</span>
          </div>
          {/* Progress ring simplified as bar */}
          <div className="mb-4 h-3 overflow-hidden rounded-full bg-[#072C0E]/6">
            <div className="h-full rounded-full bg-gradient-to-r from-[#175022] to-[#2ABD41] transition-all duration-700 ease-out" style={{ width: `${mounted ? readiness : 0}%` }} />
          </div>
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] ${c.done ? 'bg-[#2ABD41] text-white' : 'bg-[#072C0E]/8 text-[#072C0E]/30'}`}>
                  {c.done ? '✓' : ''}
                </span>
                <span className={`text-xs font-semibold ${c.done ? 'text-[#072C0E]/50 line-through' : 'text-[#072C0E]/70'}`}>{c.label}</span>
              </div>
            ))}
          </div>
        </ReportCard>

        {/* AI Insights — deep green (not brown/black) to stay on-theme with the carbon branding */}
        <div
          className="dash-fade-up group rounded-[1.5rem] border border-[#175022]/80 bg-gradient-to-br from-[#175022] to-[#1A7B2A] p-5 shadow-[0_6px_20px_rgba(23,80,34,0.25)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(23,80,34,0.35)]"
          style={{ animationDelay: '140ms' }}
        >
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#8BEA99]">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold text-white">{tr ? 'AI Karbon Analizi' : 'AI Carbon Insights'}</h2>
          </div>
          <div className="space-y-3">
            {totalTonne > 0 ? (
              <>
                <InsightItem text={tr ? `Scope 1 toplam emisyonun %${s1 > 0 ? ((s1/totalTonne)*100).toFixed(0) : 0}'ini oluşturuyor.` : `Scope 1 accounts for ${s1 > 0 ? ((s1/totalTonne)*100).toFixed(0) : 0}% of total emissions.`} />
                {s2 > s1 && <InsightItem text={tr ? 'Elektrik tüketimi Scope 2\'de baskın.' : 'Electricity consumption dominates Scope 2.'} />}
                {entries.length < 10 && <InsightItem text={tr ? 'Daha fazla veri girişi rapor kalitesini artırır.' : 'More data entries will improve report quality.'} type="warning" />}
                {entries.some(e => ['transport', 'business_travel', 'employee_commuting', 'mobile_combustion'].includes(e.category)) && (
                  <InsightItem text={tr ? 'Ulaşım aktivitelerinde azaltma potansiyeli tespit edildi.' : 'Reduction potential detected in transport activities.'} />
                )}
                {s3 > s1 + s2 && <InsightItem text={tr ? 'Scope 3 emisyonları baskın — tedarik zinciri odaklı azaltma önerilir.' : 'Scope 3 dominates — consider supply chain focused reductions.'} />}
              </>
            ) : (
              <InsightItem text={tr ? 'Veri girildikten sonra AI analizi burada görünecek.' : 'AI analysis will appear here after data entry.'} type="neutral" />
            )}
          </div>
        </div>
      </div>

      {/* ─── ROW 2: Scope Breakdown + Trend ─── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.2fr]">
        {/* Scope Breakdown */}
        <ReportCard delay={200}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8BEA99]/18 text-[#2ABD41] transition-transform duration-300 group-hover:scale-110">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold">{tr ? 'Kapsam Dağılımı' : 'Scope Breakdown'}</h2>
          </div>
          {totalTonne > 0 ? (
            <div className="space-y-4">
              {[
                { label: 'Scope 1', val: s1, pct: (s1/totalTonne*100), color: 'from-[#175022] to-[#2ABD41]' },
                { label: 'Scope 2', val: s2, pct: (s2/totalTonne*100), color: 'from-[#2ABD41] to-[#8BEA99]' },
                { label: 'Scope 3', val: s3, pct: (s3/totalTonne*100), color: 'from-[#1A7B2A] to-[#8BEA99]' },
              ].map(s => (
                <div key={s.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold">{s.label}</span>
                    <span className="text-[11px] font-bold text-[#072C0E]/45">{s.pct.toFixed(0)}% · {s.val.toFixed(2)} t</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#072C0E]/6">
                    <div className={`h-full rounded-full bg-gradient-to-r ${s.color} transition-all duration-700 ease-out`} style={{ width: `${mounted ? Math.min(s.pct, 100) : 0}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-3 rounded-xl bg-[#F8F8F8] px-3 py-2.5 text-center">
                <p className="text-[10px] font-bold uppercase text-[#072C0E]/35">{tr ? 'Toplam' : 'Total'}</p>
                <p className="text-lg font-bold text-[#072C0E]">{totalTonne.toFixed(2)} <span className="text-xs font-semibold text-[#072C0E]/40">tCO₂e</span></p>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-xs font-semibold text-[#072C0E]/35">{tr ? 'Veri yok' : 'No data'}</p>
          )}
        </ReportCard>

        {/* Monthly Trend */}
        <ReportCard delay={260}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2ABD41] text-white transition-transform duration-300 group-hover:scale-110">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{tr ? 'Aylık Emisyon Trendi' : 'Monthly Emission Trend'}</h2>
              <p className="text-[11px] text-[#072C0E]/40">{selectedYear}</p>
            </div>
          </div>
          {summary?.monthly && summary.monthly.some(m => m.total_kg > 0) ? (
            <div className="flex h-40 items-end gap-1.5">
              {(tr ? MONTHS_TR_SHORT : MONTHS_EN_SHORT).map((label, i) => {
                const m = summary.monthly[i] ?? { total_kg: 0 };
                const pct = (m.total_kg / monthlyMaxKg) * 100;
                return (
                  <div key={m.month ?? i + 1} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative h-32 w-full overflow-hidden rounded-lg bg-[#2ABD41]/8">
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-lg bg-gradient-to-t from-[#175022] to-[#2ABD41] transition-all duration-500 ease-out hover:brightness-110"
                        style={{
                          height: `${mounted ? Math.max(pct, m.total_kg > 0 ? 6 : 0) : 0}%`,
                          transitionDelay: `${i * 35}ms`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[#072C0E]/35">{label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="flex h-40 items-center justify-center text-xs font-semibold text-[#072C0E]/35">{tr ? 'Trend verisi yok' : 'No trend data'}</p>
          )}
        </ReportCard>
      </div>

      {/* ─── ROW 3: Export Center + Compliance ─── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Export Center */}
        <ReportCard delay={320}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2ABD41]/15 text-[#2ABD41] transition-transform duration-300 group-hover:scale-110">
              <Download className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold">{tr ? 'Dışa Aktarma' : 'Export Center'}</h2>
          </div>

          {/* Three distinct report types, each answering a different question:
              (1) the emissions report — what was emitted in the selected year,
              read straight from activity data; (2) the inventory report — how
              the inventory itself is set up (boundary, framework, coverage),
              read from the questionnaire; (3) the full ISO 14064-1 report —
              the complete disclosure a verifier asks for, which is (1) and (2)
              plus methodology, per-category analysis and the significance,
              uncertainty and management-system sections. (2) and (3) are keyed
              to one inventory submission, picked below, since a company can
              have more than one; (1) is keyed to the year. */}
          {completedReports.length > 0 && (
            <div className="mb-3">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[#072C0E]/40">
                {tr
                  ? 'Envanter (Envanter ve Tam ISO raporları için)'
                  : 'Inventory (for the Inventory and Full ISO reports)'}
              </label>
              <select
                value={isoReportId ?? ''}
                onChange={(e) => {
                  setManualIsoPick(true);
                  setIsoReportId(e.target.value || null);
                }}
                className="w-full rounded-xl border border-[#072C0E]/12 bg-[#F8F8F8] px-3 py-2.5 text-xs font-semibold text-[#072C0E] focus:outline-none focus:ring-2 focus:ring-[#2ABD41]/40"
              >
                {completedReports.map((r) => {
                  const id = r.report_id ?? r.id;
                  return (
                    <option key={id} value={id}>
                      {(r.title || (tr ? 'İsimsiz envanter' : 'Untitled inventory'))} — {r.reporting_year}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* The three report types, in the order they build on each other:
              what was emitted, how the inventory is set up, and the full
              disclosure. The pack below is not a fourth type — it is these
              three in one file. */}
          <div className="space-y-3">
            {/* Type 1 — what was emitted, scoped to the year selected at the
                top of the dashboard rather than to one inventory. */}
            <ReportType
              icon={FileText}
              title={tr ? 'Emisyon Raporu' : 'Emissions Report'}
              scope={`${selectedYear}`}
              desc={tr
                ? 'Girilen faaliyet verisinden hesaplanan emisyonlar: kapsam ve kategori dağılımı, aylık trend.'
                : 'Emissions calculated from entered activity data: scope and category breakdown, monthly trend.'}
              onDownload={(l) => handleDownload('pdf', l)}
              loading={pdfLoading}
              prefix="pdf"
              tr={tr}
            />
            {/* Type 2 — how the inventory is set up, from the questionnaire. */}
            <ReportType
              icon={ClipboardList}
              title={tr ? 'Envanter Raporu' : 'Inventory Report'}
              scope={tr ? 'Seçili envanter' : 'Selected inventory'}
              desc={tr
                ? 'Kurumsal profil, raporlama çerçevesi ve sınırlar, anket tamamlanma durumu ve ölçülen emisyonlar.'
                : 'Organizational profile, reporting framework and boundaries, questionnaire completion and quantified emissions.'}
              onDownload={(l) => handleDownload('inv', l)}
              loading={pdfLoading}
              prefix="inv"
              disabled={!isoReportId}
              tr={tr}
            />
            {/* Type 3 — the complete disclosure a verifier asks for, and the
                one built to the reference ISO 14064-1 report's structure.
                Highlighted because it is the deliverable of the three. */}
            <ReportType
              icon={Shield}
              title={tr ? 'Tam ISO 14064-1 Raporu' : 'Full ISO 14064-1 Report'}
              scope={tr ? 'Seçili envanter' : 'Selected inventory'}
              desc={tr
                ? 'Denetim-hazır tam rapor: metodoloji ve faktör referansları, gaz bazında envanter tablosu, altı kategorinin analizi, tesis ve faaliyet bazında değerlendirme, önemlilik, belirsizlik ve kalite yönetimi.'
                : 'Audit-ready full report: methodology and factor references, per-gas inventory table, analysis of all six categories, location- and activity-level evaluation, significance, uncertainty and quality management.'}
              onDownload={(l) => handleDownload('iso', l)}
              loading={pdfLoading}
              prefix="iso"
              disabled={!isoReportId}
              highlight
              tr={tr}
            />
          </div>

          {/* Not a fourth report type — the same three bound into one file,
              so it is offered after them rather than alongside them. */}
          <div className="mt-3 rounded-2xl border border-dashed border-[#072C0E]/15 bg-[#FAFCFA] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-[#072C0E]/50" />
                <div>
                  <p className="text-xs font-bold text-[#072C0E]">
                    {tr ? 'Üçü tek PDF olarak' : 'All three as one PDF'}
                  </p>
                  <p className="text-[10px] text-[#072C0E]/50">
                    {tr
                      ? 'Kesintisiz sayfa numaraları, içindekiler ve bölüm yer imleri. Biraz sürebilir.'
                      : 'Continuous page numbering, a contents page and per-part bookmarks. Takes a moment.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {['tr', 'en'].map((l) => (
                  <button
                    key={l}
                    onClick={() => handleDownload('pack', l)}
                    disabled={!!pdfLoading || !isoReportId}
                    className="rounded-lg border border-[#072C0E]/15 bg-white px-3 py-1.5 text-[11px] font-bold text-[#072C0E] transition hover:bg-[#F1FCF2] disabled:opacity-50"
                  >
                    {pdfLoading === `pack-${l}` ? '...' : l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {completedReports.length === 0 && (
            <p className="mt-2 text-[11px] font-semibold text-[#072C0E]/40">
              {tr
                ? 'Envanter ve tam ISO raporu için önce bir anketi tamamlayın.'
                : 'Complete a questionnaire to unlock the inventory and full ISO reports.'}
            </p>
          )}

          {/* Raw activity data — not a report, so kept visually separate. */}
          <div className="mt-4 border-t border-[#072C0E]/8 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#072C0E]/40">
              {tr ? `Ham veri (${selectedYear})` : `Raw data (${selectedYear})`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ExportBtn icon={Table2} label="CSV Export" loading={pdfLoading === 'csv'} onClick={() => handleDownload('csv', '')} />
              <ExportBtn icon={Table2} label="Excel Export" loading={pdfLoading === 'excel'} onClick={() => handleDownload('excel', '')} />
            </div>
          </div>
        </ReportCard>

        {/* Compliance Status */}
        <ReportCard delay={380}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#175022] text-white transition-transform duration-300 group-hover:scale-110">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold">{tr ? 'Uyumluluk Durumu' : 'Compliance Status'}</h2>
          </div>
          <div className="space-y-2">
            {[
              { done: entries.length > 0 && totalTonne > 0, label: 'ISO 14064-1' },
              { done: entries.length > 0 && totalTonne > 0, label: 'GHG Protocol' },
              { done: entries.some(e => e.proof_document), label: tr ? 'Kanıt eklendi' : 'Evidence attached' },
              { done: readiness >= 80, label: tr ? 'Denetim hazır' : 'Audit ready' },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2.5 rounded-lg bg-[#F8F8F8] px-3 py-2.5 transition-colors duration-300 hover:bg-[#DEFAE1]/60">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${c.done ? 'bg-[#2ABD41] text-white' : 'bg-[#072C0E]/8 text-[#072C0E]/30'}`}>
                  {c.done ? '✓' : ''}
                </span>
                <span className={`text-xs font-semibold ${c.done ? 'text-[#072C0E]' : 'text-[#072C0E]/45'}`}>{c.label}</span>
              </div>
            ))}
          </div>
        </ReportCard>
      </div>

      {/* ─── Inventory Config (if questionnaire complete) ───
           questionnaireProfile has two possible shapes depending on which flow
           completed it: the legacy QuestionnaireSession (period_type/base_year/
           report_language) or the newer 137-question CarbonReport flow
           (reporting_year/ef_database/boundary_approach/scope3_approach).
           Render whichever shape is present instead of forcing legacy field
           names onto CarbonReport data — that previously showed all '-'. */}
      {questionnaireProfile?.is_complete && (
        <ReportCard delay={440}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8BEA99]/18 text-[#2ABD41] transition-transform duration-300 group-hover:scale-110">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold">{tr ? 'Envanter Yapılandırması' : 'Inventory Configuration'}</h2>
            {questionnaireProfile.title && (
              <span className="ml-auto text-xs font-semibold text-[#072C0E]/40 truncate max-w-[45%]">{questionnaireProfile.title}</span>
            )}
          </div>
          {questionnaireProfile.reporting_year !== undefined ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <ConfigItem label={tr ? 'Raporlama Yılı' : 'Reporting Year'} value={questionnaireProfile.reporting_year || '-'} />
              <ConfigItem label={tr ? 'Faktör Kaynağı' : 'Factor Source'} value={questionnaireProfile.ef_database || '-'} />
              <ConfigItem label={tr ? 'Organizasyon Sınırı' : 'Org. Boundary'} value={questionnaireProfile.boundary_approach || '-'} />
              <ConfigItem label={tr ? 'Kapsam 3 Yaklaşımı' : 'Scope 3 Approach'} value={questionnaireProfile.scope3_approach || '-'} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <ConfigItem label={tr ? 'Dönem' : 'Period'} value={questionnaireProfile.period_type === 'calendar_year' ? `${tr ? 'Takvim' : 'Calendar'} ${questionnaireProfile.period_year || ''}` : questionnaireProfile.period_type} />
              <ConfigItem label={tr ? 'Baz Yıl' : 'Base Year'} value={questionnaireProfile.has_base_year ? questionnaireProfile.base_year : '-'} />
              <ConfigItem label={tr ? 'Faktör Kaynağı' : 'Factor Source'} value={questionnaireProfile.preferred_factor_source || '-'} />
              <ConfigItem label={tr ? 'Rapor Dili' : 'Report Language'} value={questionnaireProfile.report_language || '-'} />
            </div>
          )}
        </ReportCard>
      )}
    </div>
  );
}

function InsightItem({ text, type }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${type === 'warning' ? 'bg-amber-400' : type === 'neutral' ? 'bg-white/30' : 'bg-[#8BEA99]'}`} />
      <p className={`text-xs leading-5 ${type === 'neutral' ? 'text-white/50' : 'text-white/80'}`}>{text}</p>
    </div>
  );
}

// One of the three report types: what it is, what it is scoped to, and the
// two language buttons that produce it. Grouping the TR/EN pair under a named,
// described block is what makes the three types distinguishable — a flat grid
// of six identical buttons does not say which report answers which question.
function ReportType({ icon: Icon, title, scope, desc, onDownload, loading, prefix, disabled, highlight, tr }) {
  const busy = (l) => loading === prefix + l;
  return (
    <div className={`rounded-2xl border p-3.5 transition-colors ${
      highlight
        ? 'border-[#2ABD41]/35 bg-[#F1FCF2]'
        : 'border-[#072C0E]/8 bg-[#F8F8F8]'
    } ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          highlight ? 'bg-[#2ABD41] text-white' : 'bg-white text-[#2ABD41]'
        }`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-xs font-bold text-[#072C0E]">{title}</h3>
            <span className="rounded-full bg-[#072C0E]/6 px-2 py-0.5 text-[10px] font-bold text-[#072C0E]/50">
              {scope}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-[#072C0E]/55">{desc}</p>
          <div className="mt-2.5 flex gap-2">
            {['tr', 'en'].map((l) => (
              <button
                key={l}
                onClick={() => onDownload(l)}
                disabled={!!loading || disabled}
                title={disabled ? (tr ? 'Önce bir envanter tamamlayın' : 'Complete an inventory first') : undefined}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#072C0E]/10 bg-white px-3 py-1.5 text-[11px] font-bold text-[#072C0E] transition hover:bg-[#DEFAE1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="h-3 w-3 text-[#2ABD41]" />
                {busy(l) ? '...' : l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportBtn({ icon: Icon, label, loading, disabled, onClick }) {
  return (
    <button onClick={onClick} disabled={loading || disabled} className="flex items-center gap-2 rounded-xl border border-[#072C0E]/8 bg-[#F8F8F8] px-3.5 py-3 text-xs font-bold text-[#072C0E] transition hover:bg-[#DEFAE1] disabled:opacity-50">
      <Icon className="h-4 w-4 text-[#2ABD41]" />
      {loading ? '...' : label}
    </button>
  );
}

function ConfigItem({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F8F8F8] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase text-[#072C0E]/35">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-[#072C0E] capitalize">{value}</p>
    </div>
  );
}
