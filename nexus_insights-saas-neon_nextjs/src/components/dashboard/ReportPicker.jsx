'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Eye, Download } from 'lucide-react';
import { api } from '@/lib/utils/api';

export default function ReportPicker({
  onStartNew,
  onContinue,
  onView,
  tr = false
}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.listReports();
      const data = await res.json().catch(() => ({}));
      if (data.reports) {
        setReports(data.reports);
      }
    } catch (e) {
      setError(tr ? 'خطای بارگذاری' : 'Failed to load reports');
      console.error('Failed to load reports:', e);
    } finally {
      setLoading(false);
    }
  };

  const drafts = reports.filter(r => r.status === 'DRAFT' || r.status === 'IN_PROGRESS');
  const completed = reports.filter(r => r.status === 'COMPLETED');

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#244959]/20 border-t-[#244959] rounded-full mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-6 space-y-6">
      {/* Start New */}
      <div className="p-6 bg-gradient-to-br from-[#89E789]/10 to-[#89E789]/5 rounded-xl border border-[#89E789]/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#244959] mb-2">
              {tr ? 'سروی جدید' : 'Start New Report'}
            </h2>
            <p className="text-sm text-[#244959]/70">
              {tr ? 'یک گزارش جدید ایجاد کنید' : 'Create a new carbon report'}
            </p>
          </div>
          <button
            onClick={() => onStartNew()}
            className="flex items-center gap-2 px-6 py-3 bg-[#244959] text-white font-semibold rounded-full hover:bg-[#1a3a2e] transition"
          >
            <Plus className="w-5 h-5" />
            {tr ? 'شروع' : 'Start'}
          </button>
        </div>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-[#244959]">
            {tr ? 'پیش‌نویس‌ها' : 'Draft Reports'}
          </h3>
          <div className="space-y-2">
            {drafts.map(report => (
              <div
                key={report.report_id}
                className="flex items-center justify-between p-4 border border-[#244959]/20 rounded-lg bg-white hover:bg-[#244959]/5 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#244959] truncate">{report.title}</p>
                  <p className="text-xs text-[#244959]/60">
                    {report.progress?.percent || 0}% • {tr ? 'ایجاد شده' : 'Created'} {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => onContinue(report.report_id)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#244959] text-white text-sm font-semibold rounded-full hover:bg-[#1a3a2e] transition"
                >
                  <Play className="w-4 h-4" />
                  {tr ? 'ادامه' : 'Continue'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-[#244959]">
            {tr ? 'گزارش‌های تکمیل‌شده' : 'Completed Reports'}
          </h3>
          <div className="space-y-2">
            {completed.map(report => (
              <div
                key={report.report_id}
                className="flex items-center justify-between p-4 border border-[#89E789]/40 rounded-lg bg-[#89E789]/5 hover:bg-[#89E789]/10 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#244959] truncate">{report.title}</p>
                  <p className="text-xs text-[#244959]/60">
                    {report.reporting_year} • {tr ? 'تکمیل شده' : 'Completed'} {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => onView(report.report_id)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#244959] text-white text-sm font-semibold rounded-full hover:bg-[#1a3a2e] transition"
                >
                  <Eye className="w-4 h-4" />
                  {tr ? 'مشاهده' : 'View'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty */}
      {drafts.length === 0 && completed.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-[#244959]/60 mb-4">
            {tr ? 'گزارشی وجود ندارد' : 'No reports yet'}
          </p>
          <button
            onClick={() => onStartNew()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#244959] text-white font-semibold rounded-full hover:bg-[#1a3a2e] transition"
          >
            <Plus className="w-5 h-5" />
            {tr ? 'اولین سروی را شروع کنید' : 'Start your first report'}
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
