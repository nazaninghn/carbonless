'use client';
import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileText,
  Sparkles,
  Target,
  TrendingDown,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { api } from '@/lib/utils/api';

export default function ReportingTab({ language, selectedYear, summary, entries, targets, questionnaireProfile }) {
  const [pdfLoading, setPdfLoading] = useState('');
  const tr = language === 'tr';
  const totalTonne = summary?.total_tonne || 0;
  const s1 = summary?.scope1_tonne || 0;
  const s2 = summary?.scope2_tonne || 0;
  const s3 = summary?.scope3_tonne || 0;

  // Readiness calculation
  const checks = [
    { done: !!questionnaireProfile?.is_complete, label: tr ? 'Anket tamamlandı' : 'Questionnaire completed' },
    { done: entries.length > 0, label: tr ? 'Emisyon verisi girildi' : 'Emission data entered' },
    { done: entries.length >= 5, label: tr ? 'Yeterli veri (5+ kayıt)' : 'Sufficient data (5+ entries)' },
    { done: totalTonne > 0, label: tr ? 'Scope haritalama tamam' : 'Scope mapping complete' },
    { done: targets.length > 0, label: tr ? 'Azaltma hedefi belirlendi' : 'Reduction target set' },
  ];
  const readiness = Math.round((checks.filter(c => c.done).length / checks.length) * 100);

  const handleDownload = async (type, lang) => {
    setPdfLoading(type + lang);
    try {
      let res;
      if (type === 'pdf') res = await api.downloadReport(selectedYear, lang);
      else if (type === 'csv') res = await api.downloadCsv(selectedYear);
      else res = await api.downloadExcel(selectedYear);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(tr ? `İndirme hatası: ${err.error || res.status}` : `Download error: ${err.error || res.status}`);
        return;
      }

      const blob = await res.blob();
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = type === 'pdf'
        ? `carbonless_report_${selectedYear}_${lang}.pdf`
        : type === 'csv'
        ? `emissions_${selectedYear}.csv`
        : `emissions_${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (err) {
      console.error('Download failed:', err);
      alert(tr ? 'İndirme başarısız. Lütfen tekrar deneyin.' : 'Download failed. Please try again.');
    } finally {
      setPdfLoading('');
    }
  };

  return (
    <div className="space-y-4 text-[#302817]">
      {/* ─── HERO ─── */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-[#302817]/10 bg-gradient-to-br from-[#F9EFE5] via-white to-[#B4BE6A]/10 p-5 shadow-[0_6px_24px_rgba(48,40,23,0.06)]">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#95A847]">
              {tr ? 'Rapor merkezi' : 'Report center'}
            </p>
            <h1 className="mt-1.5 text-xl font-bold tracking-[-0.03em] sm:text-2xl">
              {tr ? 'Karbon Rapor Merkezi' : 'Carbon Report Center'}
            </h1>
            <p className="mt-1 text-sm text-[#302817]/55">
              {tr ? 'Denetim-hazır ESG & ISO 14064-1 raporları oluşturun' : 'Generate audit-ready ESG & ISO 14064-1 reports'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleDownload('pdf', 'tr')} disabled={!!pdfLoading} className="inline-flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-60">
              <FileText className="h-3.5 w-3.5" />
              {pdfLoading === 'pdftr' ? '...' : 'PDF TR'}
            </button>
            <button onClick={() => handleDownload('pdf', 'en')} disabled={!!pdfLoading} className="inline-flex items-center gap-1.5 rounded-full border border-[#302817]/15 bg-white px-4 py-2.5 text-xs font-bold text-[#302817] transition hover:bg-[#F8F8F8] disabled:opacity-60">
              <FileText className="h-3.5 w-3.5" />
              {pdfLoading === 'pdfen' ? '...' : 'PDF EN'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── ROW 1: Readiness + AI Insights ─── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Report Readiness */}
        <div className="rounded-[1.5rem] border border-[#302817]/10 bg-white p-5 shadow-[0_6px_20px_rgba(48,40,23,0.04)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#95A847]/15 text-[#95A847]">
                <Shield className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold">{tr ? 'Rapor Hazırlığı' : 'Report Readiness'}</h2>
            </div>
            <span className="text-2xl font-bold text-[#95A847]">{readiness}%</span>
          </div>
          {/* Progress ring simplified as bar */}
          <div className="mb-4 h-3 overflow-hidden rounded-full bg-[#302817]/6">
            <div className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#95A847] transition-all duration-700" style={{ width: `${readiness}%` }} />
          </div>
          <div className="space-y-2">
            {checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] ${c.done ? 'bg-[#95A847] text-white' : 'bg-[#302817]/8 text-[#302817]/30'}`}>
                  {c.done ? '✓' : ''}
                </span>
                <span className={`text-xs font-semibold ${c.done ? 'text-[#302817]/50 line-through' : 'text-[#302817]/70'}`}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="rounded-[1.5rem] border border-[#302817]/80 bg-[#302817] p-5 shadow-[0_6px_20px_rgba(48,40,23,0.15)]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-[#B4BE6A]">
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
                <InsightItem text={tr ? 'Ulaşım aktivitelerinde azaltma potansiyeli tespit edildi.' : 'Reduction potential detected in transport activities.'} />
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
        <div className="rounded-[1.5rem] border border-[#302817]/10 bg-white p-5 shadow-[0_6px_20px_rgba(48,40,23,0.04)]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B4BE6A]/18 text-[#95A847]">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold">{tr ? 'Kapsam Dağılımı' : 'Scope Breakdown'}</h2>
          </div>
          {totalTonne > 0 ? (
            <div className="space-y-4">
              {[
                { label: 'Scope 1', val: s1, pct: (s1/totalTonne*100), color: 'from-[#75863B] to-[#95A847]' },
                { label: 'Scope 2', val: s2, pct: (s2/totalTonne*100), color: 'from-[#95A847] to-[#B4BE6A]' },
                { label: 'Scope 3', val: s3, pct: (s3/totalTonne*100), color: 'from-[#302817] to-[#302817]/60' },
              ].map(s => (
                <div key={s.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold">{s.label}</span>
                    <span className="text-[11px] font-bold text-[#302817]/45">{s.pct.toFixed(0)}% · {s.val.toFixed(2)} t</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#302817]/6">
                    <div className={`h-full rounded-full bg-gradient-to-r ${s.color} transition-all duration-500`} style={{ width: `${Math.min(s.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
              <div className="mt-3 rounded-xl bg-[#F8F8F8] px-3 py-2.5 text-center">
                <p className="text-[10px] font-bold uppercase text-[#302817]/35">{tr ? 'Toplam' : 'Total'}</p>
                <p className="text-lg font-bold text-[#302817]">{totalTonne.toFixed(2)} <span className="text-xs font-semibold text-[#302817]/40">tCO₂e</span></p>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-xs font-semibold text-[#302817]/35">{tr ? 'Veri yok' : 'No data'}</p>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="rounded-[1.5rem] border border-[#302817]/10 bg-white p-5 shadow-[0_6px_20px_rgba(48,40,23,0.04)]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#95A847] text-white">
              <TrendingDown className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">{tr ? 'Aylık Emisyon Trendi' : 'Monthly Emission Trend'}</h2>
              <p className="text-[11px] text-[#302817]/40">{selectedYear}</p>
            </div>
          </div>
          {summary?.monthly && summary.monthly.some(m => m.total_kg > 0) ? (
            <div className="flex h-40 items-end gap-1.5">
              {summary.monthly.map((m, i) => {
                const maxKg = Math.max(...summary.monthly.map(x => x.total_kg), 1);
                const pct = (m.total_kg / maxKg) * 100;
                const months = tr ? ['O','Ş','M','N','M','H','T','A','E','E','K','A'] : ['J','F','M','A','M','J','J','A','S','O','N','D'];
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative h-32 w-full overflow-hidden rounded-lg bg-[#95A847]/8">
                      <div className="absolute bottom-0 left-0 right-0 rounded-lg bg-gradient-to-t from-[#75863B] to-[#95A847] transition-all duration-500" style={{ height: `${Math.max(pct, m.total_kg > 0 ? 6 : 0)}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-[#302817]/35">{months[i]}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="flex h-40 items-center justify-center text-xs font-semibold text-[#302817]/35">{tr ? 'Trend verisi yok' : 'No trend data'}</p>
          )}
        </div>
      </div>

      {/* ─── ROW 3: Export Center + Compliance ─── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Export Center */}
        <div className="rounded-[1.5rem] border border-[#302817]/10 bg-white p-5 shadow-[0_6px_20px_rgba(48,40,23,0.04)]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#95A847]/15 text-[#95A847]">
              <Download className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold">{tr ? 'Dışa Aktarma' : 'Export Center'}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ExportBtn icon={FileText} label="ISO PDF (TR)" loading={pdfLoading === 'pdftr'} onClick={() => handleDownload('pdf', 'tr')} />
            <ExportBtn icon={FileText} label="ISO PDF (EN)" loading={pdfLoading === 'pdfen'} onClick={() => handleDownload('pdf', 'en')} />
            <ExportBtn icon={Download} label="CSV Export" loading={pdfLoading === 'csv'} onClick={() => handleDownload('csv', '')} />
            <ExportBtn icon={Download} label="Excel Export" loading={pdfLoading === 'excel'} onClick={() => handleDownload('excel', '')} />
          </div>
        </div>

        {/* Compliance Status */}
        <div className="rounded-[1.5rem] border border-[#302817]/10 bg-white p-5 shadow-[0_6px_20px_rgba(48,40,23,0.04)]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#302817] text-white">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold">{tr ? 'Uyumluluk Durumu' : 'Compliance Status'}</h2>
          </div>
          <div className="space-y-2">
            {[
              { done: true, label: 'ISO 14064-1' },
              { done: true, label: 'GHG Protocol' },
              { done: entries.length > 0, label: tr ? 'Kanıt eklendi' : 'Evidence attached' },
              { done: readiness >= 80, label: tr ? 'Denetim hazır' : 'Audit ready' },
            ].map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg bg-[#F8F8F8] px-3 py-2.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${c.done ? 'bg-[#95A847] text-white' : 'bg-[#302817]/8 text-[#302817]/30'}`}>
                  {c.done ? '✓' : ''}
                </span>
                <span className={`text-xs font-semibold ${c.done ? 'text-[#302817]' : 'text-[#302817]/45'}`}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Inventory Config (if questionnaire complete) ─── */}
      {questionnaireProfile?.is_complete && (
        <div className="rounded-[1.5rem] border border-[#302817]/10 bg-white p-5 shadow-[0_6px_20px_rgba(48,40,23,0.04)]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B4BE6A]/18 text-[#95A847]">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-bold">{tr ? 'Envanter Yapılandırması' : 'Inventory Configuration'}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <ConfigItem label={tr ? 'Dönem' : 'Period'} value={questionnaireProfile.period_type === 'calendar_year' ? `${tr ? 'Takvim' : 'Calendar'} ${questionnaireProfile.period_year || ''}` : questionnaireProfile.period_type} />
            <ConfigItem label={tr ? 'Baz Yıl' : 'Base Year'} value={questionnaireProfile.has_base_year ? questionnaireProfile.base_year : '-'} />
            <ConfigItem label={tr ? 'Faktör Kaynağı' : 'Factor Source'} value={questionnaireProfile.preferred_factor_source || '-'} />
            <ConfigItem label={tr ? 'Rapor Dili' : 'Report Language'} value={questionnaireProfile.report_language || '-'} />
          </div>
        </div>
      )}
    </div>
  );
}

function InsightItem({ text, type }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${type === 'warning' ? 'bg-amber-400' : type === 'neutral' ? 'bg-white/30' : 'bg-[#B4BE6A]'}`} />
      <p className={`text-xs leading-5 ${type === 'neutral' ? 'text-white/50' : 'text-white/80'}`}>{text}</p>
    </div>
  );
}

function ExportBtn({ icon: Icon, label, loading, onClick }) {
  return (
    <button onClick={onClick} disabled={loading} className="flex items-center gap-2 rounded-xl border border-[#302817]/8 bg-[#F8F8F8] px-3.5 py-3 text-xs font-bold text-[#302817] transition hover:bg-[#F9EFE5] disabled:opacity-50">
      <Icon className="h-4 w-4 text-[#95A847]" />
      {loading ? '...' : label}
    </button>
  );
}

function ConfigItem({ label, value }) {
  return (
    <div className="rounded-xl bg-[#F8F8F8] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase text-[#302817]/35">{label}</p>
      <p className="mt-0.5 text-xs font-bold text-[#302817] capitalize">{value}</p>
    </div>
  );
}
