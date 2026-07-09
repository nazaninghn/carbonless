'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Eye, MoreVertical, Trash2 } from 'lucide-react';
import { api } from '@/lib/utils/api';
import { useInventory } from './InventoryWorkflow';

export default function InventoryLibrary({ tr = false }) {
  const {
    loading,
    error,
    startNewInventory,
    continueInventory,
    switchToReview
  } = useInventory();

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [showNamingDialog, setShowNamingDialog] = useState(false);
  const [surveyName, setSurveyName] = useState('');

  // Load all inventories
  useEffect(() => {
    loadInventories();
  }, []);

  const loadInventories = async () => {
    setLoadingReports(true);
    try {
      const res = await api.listReports();
      const data = await res.json().catch(() => ({}));
      if (data.reports) {
        setReports(data.reports);
        console.log('📋 Inventories loaded:', data.reports.length);
      }
    } catch (e) {
      console.error('Failed to load inventories:', e);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleStartNew = async () => {
    if (!surveyName.trim()) {
      alert(tr ? 'نام را وارد کنید' : 'Please enter a name');
      return;
    }

    const success = await startNewInventory(surveyName.trim());
    if (success) {
      setSurveyName('');
      setShowNamingDialog(false);
      await loadInventories();
    }
  };

  const handleContinue = async (reportId) => {
    const success = await continueInventory(reportId);
    if (success) {
      await loadInventories();
    }
  };

  const handleViewReport = (reportId) => {
    window.dispatchEvent(new CustomEvent('carboniq-navigate', {
      detail: { tab: 'reporting', reportId }
    }));
  };

  const drafts = reports.filter(r => r.status === 'draft' || r.status === 'in_progress');
  const completed = reports.filter(r => r.status === 'completed');

  if (loadingReports) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#244959]/20 border-t-[#244959] rounded-full mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#244959] mb-2">
          {tr ? 'کتابخانه موجودیت‌های کربن' : 'Carbon Inventory Library'}
        </h1>
        <p className="text-[#244959]/60">
          {tr ? 'مدیریت و ادامه موجودیت‌های کربن خود' : 'Manage your carbon inventories'}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Start New */}
      <div className="p-6 bg-gradient-to-br from-[#89E789]/10 to-[#89E789]/5 rounded-xl border border-[#89E789]/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#244959] mb-2">
              {tr ? 'موجودیت جدید' : 'New Inventory'}
            </h2>
            <p className="text-sm text-[#244959]/70">
              {tr ? 'شروع یک موجودیت کربنی جدید' : 'Create a new carbon inventory'}
            </p>
          </div>
          <button
            onClick={() => setShowNamingDialog(true)}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-[#244959] text-white font-semibold rounded-full hover:bg-[#1a3a2e] transition disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            {tr ? 'شروع' : 'Start'}
          </button>
        </div>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <div>
          <h3 className="font-bold text-[#244959] mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#244959]"></span>
            {tr ? 'پیش‌نویس‌ها' : 'Draft Inventories'}
            <span className="ml-2 text-sm text-[#244959]/50">({drafts.length})</span>
          </h3>
          <div className="space-y-3">
            {drafts.map(report => (
              <div
                key={report.report_id}
                className="flex items-center justify-between p-4 border border-[#244959]/20 rounded-lg bg-white hover:bg-[#244959]/5 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#244959] truncate">{report.title}</p>
                  <div className="flex items-center gap-4 text-xs text-[#244959]/60 mt-2">
                    <span>{report.progress?.percent || 0}% {tr ? 'مکمل' : 'complete'}</span>
                    <span>{report.progress?.completed || 0} / {report.progress?.total || 137} {tr ? 'سوالات' : 'questions'}</span>
                    <span>{tr ? 'به‌روزرسانی' : 'Updated'}: {new Date(report.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleContinue(report.report_id)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#244959] text-white text-sm font-semibold rounded-full hover:bg-[#1a3a2e] transition"
                  >
                    <Play className="w-4 h-4" />
                    {tr ? 'ادامه' : 'Continue'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h3 className="font-bold text-[#244959] mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#89E789]"></span>
            {tr ? 'تکمیل‌شده' : 'Completed Inventories'}
            <span className="ml-2 text-sm text-[#244959]/50">({completed.length})</span>
          </h3>
          <div className="space-y-3">
            {completed.map(report => (
              <div
                key={report.report_id}
                className="flex items-center justify-between p-4 border border-[#89E789]/40 rounded-lg bg-[#89E789]/5 hover:bg-[#89E789]/10 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#244959] truncate">{report.title}</p>
                  <p className="text-xs text-[#244959]/60 mt-1">
                    {report.reporting_year} • {tr ? 'تکمیل شده' : 'Completed'} {new Date(report.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleViewReport(report.report_id)}
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

      {/* Empty State */}
      {drafts.length === 0 && completed.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-[#244959]/60 mb-6">
            {tr ? 'موجودیتی وجود ندارد' : 'No inventories yet'}
          </p>
          <button
            onClick={() => setShowNamingDialog(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#244959] text-white font-semibold rounded-full hover:bg-[#1a3a2e] transition"
          >
            <Plus className="w-5 h-5" />
            {tr ? 'اولین موجودیت را ایجاد کنید' : 'Create your first inventory'}
          </button>
        </div>
      )}

      {/* Naming Dialog */}
      {showNamingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#244959] mb-4">
              {tr ? 'نام موجودیت' : 'Inventory Name'}
            </h2>

            <input
              type="text"
              value={surveyName}
              onChange={(e) => setSurveyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartNew();
                if (e.key === 'Escape') setShowNamingDialog(false);
              }}
              placeholder={tr ? 'مثال: سروی سال ۱۴۰۳' : 'e.g., 2024 Emissions Audit'}
              autoFocus
              className="w-full px-4 py-3 border border-[#244959]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#89E789] mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNamingDialog(false);
                  setSurveyName('');
                }}
                className="flex-1 px-4 py-3 border border-[#244959]/20 rounded-lg font-semibold text-[#244959] hover:bg-[#244959]/5 transition"
              >
                {tr ? 'لغو' : 'Cancel'}
              </button>
              <button
                onClick={handleStartNew}
                disabled={loading || !surveyName.trim()}
                className="flex-1 px-4 py-3 bg-[#244959] rounded-lg font-semibold text-white hover:bg-[#1a3a2e] transition disabled:opacity-50"
              >
                {loading ? (tr ? 'در حال شروع...' : 'Starting...') : (tr ? 'شروع' : 'Start')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
