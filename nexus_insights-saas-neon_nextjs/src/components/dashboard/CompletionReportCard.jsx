'use client';

import { FileText, Download, RotateCcw } from 'lucide-react';

export default function CompletionReportCard({
  report,
  loading,
  tr = false,
  onStartNew,
  onViewFull
}) {
  if (loading) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-xl border border-[#89E789]/40 animate-pulse">
        <div className="h-8 bg-[#244959]/10 rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-[#244959]/10 rounded w-full"></div>
          <div className="h-4 bg-[#244959]/10 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Success Card */}
      <div className="p-6 bg-gradient-to-br from-[#89E789]/10 to-[#89E789]/5 rounded-xl border border-[#89E789]/40 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#89E789]/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-[#5E7A2E]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-[#244959] mb-2">
              {tr ? '✅ سروی تکمیل شد!' : '✅ Survey Completed!'}
            </h3>
            <p className="text-sm text-[#244959]/70 mb-4">
              {tr
                ? 'گزارش کربن شما به موفقیت ایجاد شد. می‌توانید آن را دانلود کنید یا سروی جدید شروع کنید.'
                : 'Your carbon report has been successfully created. You can download it or start a new survey.'}
            </p>

            {/* Report Summary */}
            {report.reporting_year && (
              <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-white/50 rounded-lg">
                <div>
                  <p className="text-xs text-[#244959]/50">{tr ? 'سال گزارش' : 'Reporting Year'}</p>
                  <p className="font-bold text-[#244959]">{report.reporting_year}</p>
                </div>
                <div>
                  <p className="text-xs text-[#244959]/50">{tr ? 'وضعیت' : 'Status'}</p>
                  <p className="font-bold text-[#5E7A2E]">{tr ? 'تکمیل شده' : 'Completed'}</p>
                </div>
                {report.progress && (
                  <>
                    <div>
                      <p className="text-xs text-[#244959]/50">{tr ? 'سوالات' : 'Questions'}</p>
                      <p className="font-bold text-[#244959]">{report.progress.completed}/{report.progress.total}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#244959]/50">{tr ? 'درصد' : 'Progress'}</p>
                      <p className="font-bold text-[#244959]">{report.progress.percent}%</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <button
          onClick={onStartNew}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#244959] text-white font-semibold rounded-full hover:bg-[#1a3a2e] transition flex-1"
        >
          <RotateCcw className="w-4 h-4" />
          {tr ? 'سروی جدید' : 'New Survey'}
        </button>
        <button
          onClick={onViewFull}
          className="flex items-center justify-center gap-2 px-6 py-3 border-2 border-[#244959] text-[#244959] font-semibold rounded-full hover:bg-[#244959]/5 transition flex-1"
        >
          <Download className="w-4 h-4" />
          {tr ? 'دانلود گزارش' : 'Download Report'}
        </button>
      </div>

      {/* Additional Info */}
      <p className="text-xs text-[#244959]/50 text-center mt-4">
        {tr
          ? 'می‌توانید هر زمان به گزارش‌های خود از طریق بخش "گزارش‌ها" دسترسی داشته باشید.'
          : 'You can access all your reports anytime from the Reports section.'}
      </p>
    </div>
  );
}
