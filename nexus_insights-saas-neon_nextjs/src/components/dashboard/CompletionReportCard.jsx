'use client';

import { useState } from 'react';
import { FileText, Download, RotateCcw, CheckCircle2, Building2, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/utils/api';

const EF_DATABASE_LABELS = {
  DEFRA: 'DEFRA 2023',
  DEFRA_TUIK: 'DEFRA + TÜİK',
  IPCC_AR6: 'IPCC AR6 2021',
  EPA: 'EPA',
  custom: { tr: 'Özel', en: 'Custom' },
};

const BOUNDARY_LABELS = {
  operational_control: { tr: 'Operasyonel Kontrol', en: 'Operational Control' },
  financial_control: { tr: 'Finansal Kontrol', en: 'Financial Control' },
  equity_share: { tr: 'Hisse Payı', en: 'Equity Share' },
};

const SCOPE3_APPROACH_LABELS = {
  materiality: { tr: 'Önemlilik Bazlı', en: 'Materiality Based' },
  full: { tr: 'Tüm 15 Kategori', en: 'Full 15 Categories' },
};

function resolveLabel(map, key, tr) {
  if (!key) return null;
  const entry = map[key];
  if (!entry) return key;
  if (typeof entry === 'string') return entry;
  return tr ? entry.tr : entry.en;
}

export default function CompletionReportCard({
  report,
  loading,
  tr = false,
  stageBreakdown = [],
  assumptions = [],
  onStartNew,
  onViewFull
}) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const handleDownloadPdf = async () => {
    if (pdfLoading || !report?.report_id) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      const res = await api.downloadQuestionnairePdf(report.report_id, tr ? 'tr' : 'en');
      if (!res.ok) {
        setPdfError(tr ? 'PDF oluşturulamadı.' : 'Could not generate PDF.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carbon_inventory_profile_${report.report_id}_${tr ? 'tr' : 'en'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setPdfError(tr ? 'Bağlantı hatası.' : 'Connection error.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-xl border border-[#8BEA99]/40 animate-pulse">
        <div className="h-8 bg-[#175022]/10 rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-[#175022]/10 rounded w-full"></div>
          <div className="h-4 bg-[#175022]/10 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const totalAnswered = stageBreakdown.reduce((sum, s) => sum + s.answeredCount, 0);
  const totalQuestions = stageBreakdown.reduce((sum, s) => sum + s.totalCount, 0);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Success Card */}
      <div className="p-6 bg-gradient-to-br from-[#8BEA99]/10 to-[#8BEA99]/5 rounded-xl border border-[#8BEA99]/40 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#8BEA99]/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-[#1A7B2A]" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-[#175022] mb-1">
              {tr ? '✅ Anket Tamamlandı!' : '✅ Survey Completed!'}
            </h3>
            {report.title && (
              <p className="text-sm font-semibold text-[#175022]/80 mb-2 truncate">{report.title}</p>
            )}
            <p className="text-sm text-[#175022]/70 mb-4">
              {tr
                ? 'Karbon raporunuz başarıyla oluşturuldu. Tüm ayrıntıları aşağıda inceleyin.'
                : 'Your carbon report has been successfully created. Review the full details below.'}
            </p>

            {/* Key facts grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 p-4 bg-white/60 rounded-lg">
              {report.reporting_year && (
                <div>
                  <p className="text-xs text-[#175022]/50">{tr ? 'Raporlama Yılı' : 'Reporting Year'}</p>
                  <p className="font-bold text-[#175022]">{report.reporting_year}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-[#175022]/50">{tr ? 'Durum' : 'Status'}</p>
                <p className="font-bold text-[#1A7B2A]">{tr ? 'Tamamlandı' : 'Completed'}</p>
              </div>
              {totalQuestions > 0 && (
                <div>
                  <p className="text-xs text-[#175022]/50">{tr ? 'Sorular' : 'Questions'}</p>
                  <p className="font-bold text-[#175022]">{totalAnswered}/{totalQuestions}</p>
                </div>
              )}
              {report.ef_database && (
                <div>
                  <p className="text-xs text-[#175022]/50">{tr ? 'EF Veritabanı' : 'EF Database'}</p>
                  <p className="font-bold text-[#175022]">{resolveLabel(EF_DATABASE_LABELS, report.ef_database, tr) || report.ef_database}</p>
                </div>
              )}
              {report.boundary_approach && (
                <div>
                  <p className="text-xs text-[#175022]/50">{tr ? 'Organizasyonel Sınır' : 'Org. Boundary'}</p>
                  <p className="font-bold text-[#175022]">{resolveLabel(BOUNDARY_LABELS, report.boundary_approach, tr) || report.boundary_approach}</p>
                </div>
              )}
              {report.scope3_approach && (
                <div>
                  <p className="text-xs text-[#175022]/50">{tr ? 'Kapsam 3 Yaklaşımı' : 'Scope 3 Approach'}</p>
                  <p className="font-bold text-[#175022]">{resolveLabel(SCOPE3_APPROACH_LABELS, report.scope3_approach, tr) || report.scope3_approach}</p>
                </div>
              )}
            </div>

            {/* Company */}
            {report.company?.name && (
              <div className="flex items-center gap-2 mb-4 text-sm text-[#175022]/70">
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="font-semibold text-[#175022]">{report.company.name}</span>
                {report.company.country && <span className="text-[#175022]/50">· {report.company.country}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section-by-section breakdown */}
      {stageBreakdown.length > 0 && (
        <div className="mb-6 p-5 bg-white rounded-xl border border-[#175022]/10">
          <h4 className="text-sm font-bold text-[#175022] mb-3">
            {tr ? 'Bölüm Özeti' : 'Section Summary'}
          </h4>
          <div className="space-y-2.5">
            {stageBreakdown.map(stage => {
              const pct = stage.totalCount > 0 ? Math.round((stage.answeredCount / stage.totalCount) * 100) : 0;
              const label = stage.title?.[tr ? 'tr' : 'en'] || stage.title?.en;
              return (
                <div key={stage.id} className="flex items-center gap-3">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 ${pct === 100 ? 'text-[#2ABD41]' : 'text-[#175022]/25'}`} />
                  <span className="text-xs font-semibold text-[#175022] flex-1 min-w-0 truncate">{label}</span>
                  <span className="text-[11px] font-bold text-[#175022]/50 shrink-0">
                    {stage.answeredCount}/{stage.totalCount} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {assumptions.length > 0 && (
        <div className="mb-6 p-5 bg-blue-50 rounded-xl border border-blue-200">
          <h4 className="flex items-center gap-2 text-sm font-bold text-blue-900 mb-3">
            <AlertTriangle className="w-4 h-4" />
            {tr ? `ISO 14064-1 Varsayımları (${assumptions.length})` : `ISO 14064-1 Assumptions (${assumptions.length})`}
          </h4>
          <ul className="space-y-1.5">
            {assumptions.slice(0, 8).map((a, i) => {
              const key = typeof a === 'object' ? `${a.questionId || ''}_${a.trigger || i}` : String(a);
              const text = typeof a === 'object'
                ? (typeof a.text === 'object' ? (a.text?.[tr ? 'tr' : 'en'] || a.text?.en) : a.text)
                : a;
              return <li key={key} className="text-xs text-blue-800">• {text}</li>;
            })}
            {assumptions.length > 8 && (
              <li className="text-xs text-blue-800/60 italic">
                {tr ? `+ ${assumptions.length - 8} tane daha` : `+ ${assumptions.length - 8} more`}
              </li>
            )}
          </ul>
        </div>
      )}

      {pdfError && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-center">
          {pdfError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <button
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1A7B2A] text-white font-semibold rounded-full hover:bg-[#1A6126] transition flex-1 disabled:opacity-50"
        >
          {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {pdfLoading ? (tr ? 'Hazırlanıyor...' : 'Preparing PDF...') : (tr ? 'PDF Raporu İndir' : 'Download PDF Report')}
        </button>
        <button
          onClick={onStartNew}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#175022] text-white font-semibold rounded-full hover:bg-[#175022] transition flex-1"
        >
          <RotateCcw className="w-4 h-4" />
          {tr ? 'Yeni Anket' : 'New Survey'}
        </button>
        <button
          onClick={onViewFull}
          className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-[#175022] text-[#175022] font-semibold rounded-full hover:bg-[#175022]/5 transition flex-1"
        >
          <Download className="w-4 h-4" />
          {tr ? 'Tam Raporu Görüntüle' : 'View Full Report'}
        </button>
      </div>

      {/* Additional Info */}
      <p className="text-xs text-[#175022]/50 text-center mt-4">
        {tr
          ? 'Raporlarınıza istediğiniz zaman "Raporlar" bölümünden erişebilirsiniz.'
          : 'You can access all your reports anytime from the Reports section.'}
      </p>
    </div>
  );
}
