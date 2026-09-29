'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Eye, MoreVertical, Trash2, FileText, FileBadge, Package, Loader2 } from 'lucide-react';
import { api } from '@/lib/utils/api';
import { useInventory } from './InventoryWorkflow';
import { getPermissions } from '@/lib/permissions';

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
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  // Auditors are read-only: they view and download inventories, but cannot
  // start, continue or delete one (the backend refuses those with a 403).
  const [canEdit, setCanEdit] = useState(true);
  useEffect(() => {
    api.getProfile()
      .then(res => (res.ok ? res.json() : null))
      .then(profile => { if (profile) setCanEdit(getPermissions(profile).canEdit); })
      .catch(() => {});
  }, []);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);

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
      }
    } catch (e) {
      console.error('Failed to load inventories:', e);
    } finally {
      setLoadingReports(false);
    }
  };

  // The name is optional: left empty, startNewInventory names the inventory
  // after today's date (the dialog says so). The Start button used to stay
  // disabled until something was typed, so that fallback was unreachable.
  const handleStartNew = async () => {
    if (loading) return;
    const success = await startNewInventory(surveyName.trim(), tr);
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

  const handleViewReport = (reportId, year) => {
    window.dispatchEvent(new CustomEvent('carboniq-navigate', {
      detail: { tab: 'reporting', reportId, year }
    }));
  };

  const handleDelete = async (reportId) => {
    setDeletingId(reportId);
    try {
      setDeleteError('');
      const res = await api.deleteReport(reportId);
      if (!res.ok && res.status !== 204) {
        setDeleteError(res.status === 403
          ? (tr ? 'Bu envanteri yalnızca oluşturan kişi veya şirket sahibi/yöneticisi silebilir.'
                : 'Only the person who created this inventory or a company owner/admin can delete it.')
          : (tr ? 'Envanter silinemedi. Lütfen tekrar deneyin.' : 'Could not delete the inventory. Please try again.'));
        return;
      }
      setReports(prev => prev.filter(r => r.report_id !== reportId));
    } catch (e) {
      console.error('Failed to delete inventory:', e);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // What deleting an inventory also removes, shown in the confirm step: the
  // emission records its questionnaire created — unless another inventory
  // covers the same year and shares them (the backend applies the same rule).
  const deleteNote = (report) => {
    const year = report.reporting_year;
    if (!year) return tr ? 'Silinsin mi?' : 'Delete?';
    const shared = reports.some(r => r.report_id !== report.report_id && String(r.reporting_year) === String(year));
    if (shared) {
      return tr
        ? `Silinsin mi? ${year} için başka bir envanter olduğundan emisyon kayıtları silinmez.`
        : `Delete? Another inventory covers ${year}, so the emission records are kept.`;
    }
    return tr
      ? `Silinsin mi? Bu anketten oluşan ${year} emisyon kayıtları da silinir (sohbet ve formla girilenler kalır).`
      : `Delete? The ${year} emission records created by this questionnaire are deleted too (chat and form entries stay).`;
  };

  // `kind` selects which document: the three-report pack, the full ISO 14064-1
  // inventory report, or the short questionnaire profile. All stream a PDF
  // blob back the same way.
  const handleDownloadPdf = async (reportId, kind = 'profile') => {
    if (pdfDownloadingId) return;
    const lang = tr ? 'tr' : 'en';
    setPdfDownloadingId(`${reportId}:${kind}`);
    let url;
    try {
      const res = kind === 'pack'
        ? await api.downloadCombinedReport(reportId, lang)
        : kind === 'iso'
        ? await api.downloadIsoReport(reportId, lang)
        : await api.downloadQuestionnairePdf(reportId, lang);
      if (!res.ok) {
        console.error('Failed to generate PDF:', res.status);
        return;
      }
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = kind === 'pack'
        ? `ghg_reporting_pack_${reportId}_${lang}.pdf`
        : kind === 'iso'
        ? `iso14064-1_inventory_report_${reportId}_${lang}.pdf`
        : `carbon_inventory_profile_${reportId}_${lang}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to download PDF:', e);
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setPdfDownloadingId(null);
    }
  };

  const drafts = reports.filter(r => r.status === 'draft' || r.status === 'in_progress');
  const completed = reports.filter(r => r.status === 'completed');

  if (loadingReports) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#175022]/20 border-t-[#175022] rounded-full mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto">
    <div className="w-full max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#175022] mb-2">
          {tr ? 'Karbon Envanter Kütüphanesi' : 'Carbon Inventory Library'}
        </h1>
        <p className="text-[#175022]/60">
          {tr ? 'Karbon envanterlerinizi yönetin' : 'Manage your carbon inventories'}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {deleteError && (
        <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {deleteError}
        </div>
      )}

      {!canEdit && (
        <div role="status" className="p-4 bg-[#8BEA99]/10 border border-[#8BEA99]/40 rounded-lg text-[#175022] text-sm">
          {tr
            ? 'Denetçi rolünüz salt okunur: envanterleri görüntüleyebilir ve raporlarını indirebilirsiniz, ancak yeni envanter başlatamaz, düzenleyemez veya silemezsiniz.'
            : 'Your auditor role is read-only: you can view inventories and download their reports, but not start, edit or delete one.'}
        </div>
      )}

      {/* Start New */}
      {canEdit && (
      <div className="p-6 bg-gradient-to-br from-[#8BEA99]/10 to-[#8BEA99]/5 rounded-xl border border-[#8BEA99]/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#175022] mb-2">
              {tr ? 'Yeni Envanter' : 'New Inventory'}
            </h2>
            <p className="text-sm text-[#175022]/70">
              {tr ? 'Yeni bir karbon envanteri oluşturun' : 'Create a new carbon inventory'}
            </p>
          </div>
          <button
            onClick={() => setShowNamingDialog(true)}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#175022] text-white font-semibold rounded-full hover:bg-[#175022] transition disabled:opacity-50 shrink-0"
          >
            <Plus className="w-5 h-5" />
            {tr ? 'Başla' : 'Start'}
          </button>
        </div>
      </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <div>
          <h3 className="font-bold text-[#175022] mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#175022]"></span>
            {tr ? 'Taslaklar' : 'Draft Inventories'}
            <span className="ml-2 text-sm text-[#175022]/50">({drafts.length})</span>
          </h3>
          <div className="space-y-3">
            {drafts.map(report => (
              <div
                key={report.report_id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border border-[#175022]/20 rounded-lg bg-white hover:bg-[#175022]/5 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#175022] truncate">{report.title}</p>
                  {report.created_by && (
                    <p className="text-xs text-[#175022]/50 mt-0.5 truncate">
                      {tr ? 'Oluşturan' : 'Created by'}: {report.created_by}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#175022]/60 mt-2">
                    <span>{report.progress?.percent || 0}% {tr ? 'tamamlandı' : 'complete'}</span>
                    <span>{report.progress?.completed || 0} / {report.progress?.total || 120} {tr ? 'soru' : 'questions'}</span>
                    <span>{tr ? 'Güncelleme' : 'Updated'}: {new Date(report.updated_at).toLocaleDateString(tr ? 'tr-TR' : 'en-GB')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {confirmDeleteId === report.report_id ? (
                    <>
                      <span className="max-w-xs text-xs font-bold text-red-500">
                        {deleteNote(report)}
                      </span>
                      <button
                        onClick={() => handleDelete(report.report_id)}
                        disabled={deletingId === report.report_id}
                        className="px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-full hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {tr ? 'Evet' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-2 border border-[#175022]/15 text-xs font-bold text-[#175022]/60 rounded-full hover:bg-[#175022]/5 transition"
                      >
                        {tr ? 'Hayır' : 'No'}
                      </button>
                    </>
                  ) : (
                    canEdit && <>
                      <button
                        onClick={() => handleContinue(report.report_id)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#175022] text-white text-sm font-semibold rounded-full hover:bg-[#175022] transition"
                      >
                        <Play className="w-4 h-4" />
                        {tr ? 'Devam Et' : 'Continue'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(report.report_id)}
                        title={tr ? 'Sil' : 'Delete'}
                        className="flex items-center justify-center h-9 w-9 text-[#175022]/40 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h3 className="font-bold text-[#175022] mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#8BEA99]"></span>
            {tr ? 'Tamamlanan Envanterler' : 'Completed Inventories'}
            <span className="ml-2 text-sm text-[#175022]/50">({completed.length})</span>
          </h3>
          <div className="space-y-3">
            {completed.map(report => (
              <div
                key={report.report_id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border border-[#8BEA99]/40 rounded-lg bg-[#8BEA99]/5 hover:bg-[#8BEA99]/10 transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#175022] truncate">{report.title}</p>
                  {report.created_by && (
                    <p className="text-xs text-[#175022]/50 mt-0.5 truncate">
                      {tr ? 'Oluşturan' : 'Created by'}: {report.created_by}
                    </p>
                  )}
                  <p className="text-xs text-[#175022]/60 mt-1">
                    {report.reporting_year} • {tr ? 'Tamamlandı' : 'Completed'} {new Date(report.updated_at).toLocaleDateString(tr ? 'tr-TR' : 'en-GB')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {confirmDeleteId === report.report_id ? (
                    <>
                      <span className="max-w-xs text-xs font-bold text-red-500">
                        {deleteNote(report)}
                      </span>
                      <button
                        onClick={() => handleDelete(report.report_id)}
                        disabled={deletingId === report.report_id}
                        className="px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-full hover:bg-red-600 transition disabled:opacity-50"
                      >
                        {tr ? 'Evet' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-2 border border-[#175022]/15 text-xs font-bold text-[#175022]/60 rounded-full hover:bg-[#175022]/5 transition"
                      >
                        {tr ? 'Hayır' : 'No'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleDownloadPdf(report.report_id, 'pack')}
                        disabled={!!pdfDownloadingId}
                        title={tr ? 'Tam rapor paketi indir (3 rapor)'
                                  : 'Download full report pack (3 reports)'}
                        className="flex items-center justify-center h-9 w-9 text-[#2ABD41] hover:text-[#175022] hover:bg-[#2ABD41]/10 rounded-full transition disabled:opacity-50"
                      >
                        {pdfDownloadingId === `${report.report_id}:pack`
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Package className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(report.report_id, 'iso')}
                        disabled={!!pdfDownloadingId}
                        title={tr ? 'ISO 14064-1 Envanter Raporu İndir'
                                  : 'Download ISO 14064-1 inventory report'}
                        className="flex items-center justify-center h-9 w-9 text-[#175022]/60 hover:text-[#175022] hover:bg-[#175022]/10 rounded-full transition disabled:opacity-50"
                      >
                        {pdfDownloadingId === `${report.report_id}:iso`
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <FileBadge className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(report.report_id, 'profile')}
                        disabled={!!pdfDownloadingId}
                        title={tr ? 'Envanter profili (özet) indir'
                                  : 'Download inventory profile (summary)'}
                        className="flex items-center justify-center h-9 w-9 text-[#175022]/40 hover:text-[#1A7B2A] hover:bg-[#1A7B2A]/10 rounded-full transition disabled:opacity-50"
                      >
                        {pdfDownloadingId === `${report.report_id}:profile`
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <FileText className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleViewReport(report.report_id, report.reporting_year)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#175022] text-white text-sm font-semibold rounded-full hover:bg-[#175022] transition"
                      >
                        <Eye className="w-4 h-4" />
                        {tr ? 'Görüntüle' : 'View'}
                      </button>
                      {canEdit && (
                      <button
                        onClick={() => setConfirmDeleteId(report.report_id)}
                        title={tr ? 'Sil' : 'Delete'}
                        className="flex items-center justify-center h-9 w-9 text-[#175022]/40 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {drafts.length === 0 && completed.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-[#175022]/60 mb-6">
            {tr ? 'Henüz envanter yok' : 'No inventories yet'}
          </p>
          <button
            onClick={() => setShowNamingDialog(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#175022] text-white font-semibold rounded-full hover:bg-[#175022] transition"
          >
            <Plus className="w-5 h-5" />
            {tr ? 'İlk envanterinizi oluşturun' : 'Create your first inventory'}
          </button>
        </div>
      )}

      {/* Naming Dialog */}
      {showNamingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[#175022] mb-4">
              {tr ? 'Envanter Adı' : 'Inventory Name'}
            </h2>

            <input
              type="text"
              value={surveyName}
              onChange={(e) => setSurveyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartNew();
                if (e.key === 'Escape') setShowNamingDialog(false);
              }}
              placeholder={tr ? 'Örnek: 2024 Emisyon Denetimi' : 'e.g., 2024 Emissions Audit'}
              autoFocus
              className="w-full px-4 py-3 border border-[#175022]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BEA99] mb-2"
            />
            <p className="mb-4 text-xs text-[#175022]/60">
              {tr
                ? `İsteğe bağlı. Boş bırakırsanız bugünün tarihi kullanılır (${new Date().toLocaleDateString('tr-TR')}).`
                : `Optional. If left empty, today's date is used (${new Date().toLocaleDateString('en-GB')}).`}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNamingDialog(false);
                  setSurveyName('');
                }}
                className="flex-1 px-4 py-3 border border-[#175022]/20 rounded-lg font-semibold text-[#175022] hover:bg-[#175022]/5 transition"
              >
                {tr ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={handleStartNew}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-[#175022] rounded-lg font-semibold text-white hover:bg-[#175022] transition disabled:opacity-50"
              >
                {loading ? (tr ? 'Başlatılıyor...' : 'Starting...') : (tr ? 'Başla' : 'Start')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
