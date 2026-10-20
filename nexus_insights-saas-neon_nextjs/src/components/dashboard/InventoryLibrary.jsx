'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Eye, MoreVertical, Trash2, FileText, FileBadge, Package, Loader2, Pencil } from 'lucide-react';
import { api } from '@/lib/utils/api';
import { useInventory } from './InventoryWorkflow';
import { getPermissions } from '@/lib/permissions';
import { getQuestionById } from '@/lib/carboniq/questions';

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
  // The list could not be fetched (offline, server down). Shown as its own
  // state: an empty "No inventories yet" told users their inventories were
  // gone and invited them to start a duplicate.
  const [loadFailed, setLoadFailed] = useState(false);
  const [showNamingDialog, setShowNamingDialog] = useState(false);
  const [surveyName, setSurveyName] = useState('');
  // Reporting year of the new inventory — asked here so it is not left to a
  // later default (which made an inventory named "2024" a 2026 one).
  const [surveyYear, setSurveyYear] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  // Auditors are read-only: they view and download inventories, but cannot
  // start, continue or delete one (the backend refuses those with a 403).
  const [canEdit, setCanEdit] = useState(true);
  // A teammate's inventory can be deleted only by an owner/admin (the backend
  // refuses others with a 403, after they had already confirmed).
  const [canManage, setCanManage] = useState(true);
  // Renaming an inventory: owner / admin / manager (the backend's rule).
  const [canRename, setCanRename] = useState(true);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  useEffect(() => {
    api.getProfile()
      .then(res => (res.ok ? res.json() : null))
      .then(profile => {
        if (!profile) return;
        const perms = getPermissions(profile);
        setCanEdit(perms.canEdit);
        setCanManage(perms.canManageTeam);
        setCanRename(perms.canApprove);
      })
      .catch(() => {});
  }, []);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);

  // Load all inventories
  useEffect(() => {
    loadInventories();
  }, []);

  // Coming back online retries a list that failed to load.
  useEffect(() => {
    if (!loadFailed) return;
    const retry = () => loadInventories();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [loadFailed]);

  const loadInventories = async () => {
    setLoadingReports(true);
    try {
      const res = await api.listReports();
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json().catch(() => ({}));
      if (data.reports) {
        setReports(data.reports);
      }
      setLoadFailed(false);
    } catch (e) {
      console.error('Failed to load inventories:', e);
      setLoadFailed(true);
    } finally {
      setLoadingReports(false);
    }
  };

  // The name is optional: left empty, startNewInventory names the inventory
  // after today's date (the dialog says so). The Start button used to stay
  // disabled until something was typed, so that fallback was unreachable.
  const handleStartNew = async () => {
    if (loading) return;
    const success = await startNewInventory(surveyName.trim(), tr, Number(surveyYear) || null);
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

  // "Devam et" on the dashboard's in-progress notice opens that inventory.
  useEffect(() => {
    let id = null;
    try {
      id = sessionStorage.getItem('carbonless_continue_inventory');
      sessionStorage.removeItem('carbonless_continue_inventory');
    } catch { /* stays on the library */ }
    if (id) handleContinue(Number(id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A finished inventory opens on the sign-off check (7C-1): its "Hayır —
  // bir bölüme dönüp düzeltmek istiyorum" lists the stages to fix, and after
  // the stage the survey comes back there to sign off again.
  const handleEditCompleted = async (reportId) => {
    await continueInventory(reportId, '7C-1');
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
          ? (tr ? 'Bu envanteri silme yetkiniz yok. Tamamlanmış bir envanteri yalnızca şirket sahibi veya yöneticisi silebilir; taslağı ise oluşturan kişi de silebilir.'
                : 'You cannot delete this inventory. A completed inventory can only be deleted by a company owner or admin; a draft also by the person who created it.')
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

  const saveRename = async (reportId) => {
    const title = renameValue.trim();
    if (!title) return;
    setRenameError('');
    try {
      const res = await api.renameReport(reportId, title);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRenameError(data.error || (tr ? 'Ad değiştirilemedi.' : 'Could not rename.'));
        return;
      }
      setReports(prev => prev.map(r => (r.report_id === reportId ? { ...r, title: data.title } : r)));
      setRenamingId(null);
    } catch {
      setRenameError(tr ? 'Bağlantı hatası' : 'Connection error');
    }
  };

  // The inventory's name, renamable in place, with what does not add up:
  // a year in the name that is not its reporting year, and another inventory
  // of the same reporting year (the two share their emission records).
  const titleBlock = (report) => {
    const titleYear = (String(report.title || '').match(/\b(19|20)\d{2}\b/) || [])[0];
    const yearMismatch = titleYear && report.reporting_year && Number(titleYear) !== Number(report.reporting_year);
    const sameYear = report.reporting_year
      && reports.some(r => r.report_id !== report.report_id && String(r.reporting_year) === String(report.reporting_year));
    return (
      <>
        {renamingId === report.report_id ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(report.report_id); if (e.key === 'Escape') setRenamingId(null); }}
              maxLength={200}
              autoFocus
              aria-label={tr ? 'Envanter adı' : 'Inventory name'}
              className="min-w-0 flex-1 rounded-lg border border-[#175022]/20 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BEA99]"
            />
            <button onClick={() => saveRename(report.report_id)} className="rounded-full bg-[#175022] px-3 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-[#0f3a18] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1">
              {tr ? 'Kaydet' : 'Save'}
            </button>
            <button onClick={() => setRenamingId(null)} className="rounded-full border border-[#175022]/15 px-3 py-1.5 text-xs font-bold text-[#175022]/60 transition-all duration-200 hover:bg-[#175022]/5 hover:text-[#175022] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1">
              {tr ? 'Vazgeç' : 'Cancel'}
            </button>
            {renameError && <span className="w-full text-xs text-red-600">{renameError}</span>}
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <p className="font-semibold text-[#175022] truncate">{report.title}</p>
            {canRename && (
              <button
                onClick={() => { setRenamingId(report.report_id); setRenameValue(report.title || ''); setRenameError(''); }}
                className="shrink-0 rounded text-[11px] font-semibold text-[#175022]/50 transition-colors duration-200 hover:text-[#175022] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
              >
                {tr ? 'Yeniden adlandır' : 'Rename'}
              </button>
            )}
          </div>
        )}
        {yearMismatch && (
          <p className="mt-1 text-[11px] font-semibold text-amber-700">
            {tr ? `Adındaki yıl (${titleYear}) raporlama yılıyla (${report.reporting_year}) uyuşmuyor.`
                : `The year in the name (${titleYear}) differs from the reporting year (${report.reporting_year}).`}
          </p>
        )}
        {sameYear && (
          <p className="mt-1 text-[11px] font-semibold text-amber-700">
            {tr ? `${report.reporting_year} için başka bir envanter daha var — ikisi aynı emisyon kayıtlarını paylaşır.`
                : `Another inventory also covers ${report.reporting_year} — the two share the same emission records.`}
          </p>
        )}
      </>
    );
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
  const yearOptions = getQuestionById('A4')?.options || [];
  // Default: the year after the latest completed inventory (not past this
  // year), otherwise last year — the usual year to report on.
  const openNewDialog = () => {
    const thisYear = new Date().getFullYear();
    const latest = Math.max(0, ...reports.filter(r => r.status === 'completed').map(r => Number(r.reporting_year) || 0));
    setSurveyYear(String(latest ? Math.min(latest + 1, thisYear) : thisYear - 1));
    setShowNamingDialog(true);
  };
  // A year typed in the name that differs from the chosen reporting year.
  const nameYear = (surveyName.match(/\b(19|20)\d{2}\b/) || [])[0];
  const nameYearMismatch = nameYear && surveyYear && nameYear !== surveyYear;
  const completed = reports.filter(r => r.status === 'completed');
  // An inventory already started or finished for the year picked in the new-inventory dialog.
  const sameYearReport = reports.find(r => String(r.reporting_year) === String(surveyYear)) || null;

  if (loadingReports) {
    return (
      <div className="w-full max-w-4xl mx-auto p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#175022]/20 border-t-[#175022] rounded-full mx-auto"></div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-5">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="text-sm font-semibold text-red-700">
            {tr ? 'Envanterleriniz yüklenemedi' : "Your inventories couldn't be loaded"}
          </p>
          <p className="mt-1 text-xs text-red-700/80">
            {tr
              ? 'İnternet bağlantınızı kontrol edip tekrar deneyin. Kayıtlı envanterleriniz silinmedi.'
              : 'Check your internet connection and try again. Your saved inventories are not deleted.'}
          </p>
          <button
            type="button"
            onClick={loadInventories}
            className="mt-3 rounded-lg bg-[#175022] px-4 py-2 text-xs font-semibold text-white hover:bg-[#072C0E]"
          >
            {tr ? 'Tekrar dene' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 overflow-y-auto">
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-5 space-y-5 sm:space-y-6">
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
      <div className="p-4 bg-gradient-to-br from-[#8BEA99]/10 to-[#8BEA99]/5 rounded-xl border border-[#8BEA99]/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#175022] mb-1">
              {tr ? 'Yeni Envanter' : 'New Inventory'}
            </h2>
            <p className="text-xs text-[#175022]/70">
              {tr ? 'Yeni bir karbon envanteri oluşturun' : 'Create a new carbon inventory'}
            </p>
          </div>
          <button
            onClick={openNewDialog}
            disabled={loading}
            className="flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 text-sm bg-[#175022] text-white font-semibold rounded-full shadow-sm transition-all duration-200 hover:bg-[#0f3a18] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            {tr ? 'Başla' : 'Start'}
          </button>
        </div>
      </div>
      )}

      {/* Drafts */}
      {drafts.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#175022] mb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#175022]"></span>
            {tr ? 'Taslaklar' : 'Draft Inventories'}
            <span className="ml-2 text-xs text-[#175022]/50">({drafts.length})</span>
          </h3>
          <div className="space-y-2">
            {drafts.map(report => (
              <div
                key={report.report_id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border border-[#175022]/20 rounded-lg bg-white hover:bg-[#175022]/5 transition"
              >
                <div className="flex-1 min-w-0">
                  {titleBlock(report)}
                  {report.created_by && (
                    <p className="text-xs text-[#175022]/50 mt-0.5 truncate">
                      {tr ? 'Oluşturan' : 'Created by'}: {report.created_by}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#175022]/60 mt-2">
                    {report.reporting_year && (
                      <span className="font-semibold text-[#175022]/80">{tr ? 'Raporlama yılı' : 'Reporting year'}: {report.reporting_year}</span>
                    )}
                    <span>{report.progress?.percent || 0}% {tr ? 'tamamlandı' : 'complete'}</span>
                    {/* No total before the first answer: the survey works it
                        out from the answers (it used to read "0 / 120"). */}
                    <span>{report.progress?.total
                      ? `${report.progress?.completed || 0} / ${report.progress.total} ${tr ? 'soru' : 'questions'}`
                      : (tr ? 'Henüz başlanmadı' : 'Not started yet')}</span>
                    <span>{tr ? 'Güncelleme' : 'Updated'}: {new Date(report.updated_at).toLocaleDateString(tr ? 'tr-TR' : 'en-GB')}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {confirmDeleteId === report.report_id ? (
                    <>
                      <span className="max-w-xs text-xs font-bold text-red-500">
                        {deleteNote(report)}
                      </span>
                      <button
                        onClick={() => handleDelete(report.report_id)}
                        disabled={deletingId === report.report_id}
                        className="px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-full transition-all duration-200 hover:bg-red-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1 disabled:opacity-50"
                      >
                        {tr ? 'Evet' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-2 border border-[#175022]/15 text-xs font-bold text-[#175022]/60 rounded-full transition-all duration-200 hover:bg-[#175022]/5 hover:text-[#175022] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
                      >
                        {tr ? 'Hayır' : 'No'}
                      </button>
                    </>
                  ) : (
                    canEdit && <>
                      <button
                        onClick={() => handleContinue(report.report_id)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#175022] text-white text-sm font-semibold rounded-full shadow-sm transition-all duration-200 hover:bg-[#0f3a18] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2"
                      >
                        <Play className="w-4 h-4" />
                        {tr ? 'Devam Et' : 'Continue'}
                      </button>
                      {(!report.created_by || canManage) && (
                      <button
                        onClick={() => setConfirmDeleteId(report.report_id)}
                        title={tr ? 'Sil' : 'Delete'}
                        className="flex items-center justify-center h-8 w-8 shrink-0 text-[#175022]/40 rounded-full transition-all duration-200 hover:text-red-600 hover:bg-red-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#175022] mb-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8BEA99]"></span>
            {tr ? 'Tamamlanan Envanterler' : 'Completed Inventories'}
            <span className="ml-2 text-xs text-[#175022]/50">({completed.length})</span>
          </h3>
          <div className="space-y-2">
            {completed.map(report => (
              <div
                key={report.report_id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 border border-[#8BEA99]/40 rounded-lg bg-[#8BEA99]/5 hover:bg-[#8BEA99]/10 transition"
              >
                <div className="flex-1 min-w-0">
                  {titleBlock(report)}
                  {report.created_by && (
                    <p className="text-xs text-[#175022]/50 mt-0.5 truncate">
                      {tr ? 'Oluşturan' : 'Created by'}: {report.created_by}
                    </p>
                  )}
                  <p className="text-xs text-[#175022]/60 mt-1">
                    {report.reporting_year} • {tr ? 'Tamamlandı' : 'Completed'} {new Date(report.signed_at || report.updated_at).toLocaleDateString(tr ? 'tr-TR' : 'en-GB')}
                  </p>
                  {/* Danışman Onayı items still open, or rejected and not yet
                      corrected — a signed inventory said nothing of them. */}
                  {(report.advisor_pending > 0 || report.advisor_rejected > 0) && (
                    <p className="mt-1 text-xs font-semibold text-amber-800">
                      {[
                        report.advisor_pending > 0 && (tr ? `${report.advisor_pending} danışman onayı bekliyor` : `${report.advisor_pending} advisor approval${report.advisor_pending > 1 ? 's' : ''} waiting`),
                        report.advisor_rejected > 0 && (tr ? `${report.advisor_rejected} danışman maddesi reddedildi — cevabı düzeltin` : `${report.advisor_rejected} advisor item${report.advisor_rejected > 1 ? 's' : ''} rejected — correct the answer`),
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {/* An answer fixed after the sign-off is already in the
                      numbers; the card used to move its date to that day as
                      if it had been signed again. */}
                  {report.edited_after_signing_at && (
                    <div role="status" className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-800">
                      <span>
                        {tr
                          ? `${new Date(report.edited_after_signing_at).toLocaleDateString('tr-TR')} tarihinde düzenlendi — imza yenilenmedi.`
                          : `Edited on ${new Date(report.edited_after_signing_at).toLocaleDateString('en-GB')} — not signed again.`}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => continueInventory(report.report_id, '7C-2')}
                          className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100"
                        >
                          {tr ? 'Yeniden imzala' : 'Sign again'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  {confirmDeleteId === report.report_id ? (
                    <>
                      <span className="max-w-xs text-xs font-bold text-red-500">
                        {deleteNote(report)}
                      </span>
                      <button
                        onClick={() => handleDelete(report.report_id)}
                        disabled={deletingId === report.report_id}
                        className="px-3 py-2 bg-red-500 text-white text-xs font-bold rounded-full transition-all duration-200 hover:bg-red-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1 disabled:opacity-50"
                      >
                        {tr ? 'Evet' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-2 border border-[#175022]/15 text-xs font-bold text-[#175022]/60 rounded-full transition-all duration-200 hover:bg-[#175022]/5 hover:text-[#175022] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
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
                        className="flex items-center justify-center h-8 w-8 shrink-0 text-[#2ABD41] rounded-full transition-all duration-200 hover:text-[#175022] hover:bg-[#2ABD41]/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1 disabled:opacity-50"
                      >
                        {pdfDownloadingId === `${report.report_id}:pack`
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Package className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(report.report_id, 'iso')}
                        disabled={!!pdfDownloadingId}
                        title={tr ? 'ISO 14064-1 Envanter Raporu İndir'
                                  : 'Download ISO 14064-1 inventory report'}
                        className="flex items-center justify-center h-8 w-8 shrink-0 text-[#175022]/60 rounded-full transition-all duration-200 hover:text-[#175022] hover:bg-[#175022]/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1 disabled:opacity-50"
                      >
                        {pdfDownloadingId === `${report.report_id}:iso`
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <FileBadge className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDownloadPdf(report.report_id, 'profile')}
                        disabled={!!pdfDownloadingId}
                        title={tr ? 'Envanter profili (özet) indir'
                                  : 'Download inventory profile (summary)'}
                        className="flex items-center justify-center h-8 w-8 shrink-0 text-[#175022]/40 rounded-full transition-all duration-200 hover:text-[#1A7B2A] hover:bg-[#1A7B2A]/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1 disabled:opacity-50"
                      >
                        {pdfDownloadingId === `${report.report_id}:profile`
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <FileText className="w-3.5 h-3.5" />}
                      </button>
                      {canEdit && (
                      <button
                        onClick={() => handleEditCompleted(report.report_id)}
                        title={tr ? 'Bir bölümü düzelt' : 'Fix a section'}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-[#175022]/30 text-[#175022] text-sm font-semibold rounded-full transition-all duration-200 hover:bg-[#1A7B2A]/10 hover:border-[#175022]/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2"
                      >
                        <Pencil className="w-4 h-4" />
                        {tr ? 'Düzenle' : 'Edit'}
                      </button>
                      )}
                      <button
                        onClick={() => handleViewReport(report.report_id, report.reporting_year)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#175022] text-white text-sm font-semibold rounded-full shadow-sm transition-all duration-200 hover:bg-[#0f3a18] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2"
                      >
                        <Eye className="w-4 h-4" />
                        {tr ? 'Görüntüle' : 'View'}
                      </button>
                      {/* A completed inventory carries approved figures and a signed
                          report: only an owner/admin deletes it, not its creator. */}
                      {canEdit && canManage && (
                      <button
                        onClick={() => setConfirmDeleteId(report.report_id)}
                        title={tr ? 'Sil' : 'Delete'}
                        className="flex items-center justify-center h-8 w-8 shrink-0 text-[#175022]/40 rounded-full transition-all duration-200 hover:text-red-600 hover:bg-red-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
        <div className="text-center py-8">
          <p className="text-sm text-[#175022]/60 mb-4">
            {tr ? 'Henüz envanter yok' : 'No inventories yet'}
          </p>
          {/* An auditor can't start one (the notice above says so). */}
          {canEdit && (
            <button
              onClick={openNewDialog}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[#175022] text-white font-semibold rounded-full shadow-sm transition-all duration-200 hover:bg-[#0f3a18] hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2"
            >
              <Plus className="w-4 h-4" />
              {tr ? 'İlk envanterinizi oluşturun' : 'Create your first inventory'}
            </button>
          )}
        </div>
      )}

      {/* Naming Dialog */}
      {showNamingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          {/* A real dialog: DialogFocus keeps Tab inside it (it walked out to
              the page behind) and Escape closes it from any of its controls. */}
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            role="dialog" aria-modal="true" aria-labelledby="new-inventory-title"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowNamingDialog(false); } }}>
            <h2 id="new-inventory-title" className="text-lg font-bold text-[#175022] mb-4">
              {tr ? 'Envanter Adı' : 'Inventory Name'}
            </h2>

            <input
              type="text"
              value={surveyName}
              onChange={(e) => setSurveyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !sameYearReport) handleStartNew();
                if (e.key === 'Escape') setShowNamingDialog(false);
              }}
              placeholder={tr ? 'Örnek: 2024 Emisyon Denetimi' : 'e.g., 2024 Emissions Audit'}
              aria-labelledby="new-inventory-title"
              autoFocus
              className="w-full px-4 py-2.5 border border-[#175022]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8BEA99] mb-2"
            />
            <p className="mb-4 text-xs text-[#175022]/60">
              {tr
                ? `İsteğe bağlı. Boş bırakırsanız bugünün tarihi kullanılır (${new Date().toLocaleDateString('tr-TR')}).`
                : `Optional. If left empty, today's date is used (${new Date().toLocaleDateString('en-GB')}).`}
            </p>

            <label htmlFor="new-inventory-year" className="block text-sm font-bold text-[#175022] mb-1">
              {tr ? 'Raporlama yılı' : 'Reporting year'}
            </label>
            <select
              id="new-inventory-year"
              value={surveyYear}
              onChange={(e) => setSurveyYear(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#175022]/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#8BEA99] mb-2"
            >
              {yearOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label?.[tr ? 'tr' : 'en'] || o.value}</option>
              ))}
            </select>
            {sameYearReport ? (
              // The year already has an inventory: a company has one inventory per year
              // (the server refuses a second one) — open that one instead.
              <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {tr
                  ? `${surveyYear} yılı için zaten bir envanteriniz var: “${sameYearReport.title || surveyYear}” (${sameYearReport.status === 'completed' ? 'tamamlandı' : 'devam ediyor'}). Bir şirket için her yıla en fazla bir envanter olabilir (emisyon kayıtları şirkete ve yıla bağlıdır). Değişiklik için mevcut envanteri açın.`
                  : `There is already an inventory for ${surveyYear}: “${sameYearReport.title || surveyYear}” (${sameYearReport.status === 'completed' ? 'completed' : 'in progress'}). A company can have one inventory per year (emission entries belong to the company and year). To change something, open the existing one.`}
              </p>
            ) : nameYearMismatch ? (
              <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {tr
                  ? `Adda ${nameYear} yazıyor ama raporlama yılı ${surveyYear} seçili. Doğru yılı seçtiğinizden emin olun.`
                  : `The name says ${nameYear} but the reporting year is ${surveyYear}. Make sure the right year is selected.`}
              </p>
            ) : (
              <p className="mb-4 text-xs text-[#175022]/60">
                {tr ? 'Bu envanterdeki tüm veriler bu yıla ait olacak.' : 'All data in this inventory will be for this year.'}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNamingDialog(false);
                  setSurveyName('');
                }}
                className="flex-1 px-4 py-2.5 border border-[#175022]/20 rounded-lg font-semibold text-[#175022] transition-all duration-200 hover:bg-[#175022]/5 hover:border-[#175022]/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2"
              >
                {tr ? 'İptal' : 'Cancel'}
              </button>
              {sameYearReport ? (
                <button
                  onClick={() => {
                    setShowNamingDialog(false);
                    setSurveyName('');
                    if (sameYearReport.status === 'completed') handleEditCompleted(sameYearReport.report_id);
                    else handleContinue(sameYearReport.report_id);
                  }}
                  className="flex-1 px-4 py-2.5 bg-[#175022] rounded-lg font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#0f3a18] hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2"
                >
                  {tr ? 'Mevcut envanteri aç' : 'Open the existing one'}
                </button>
              ) : (
                <button
                  onClick={handleStartNew}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-[#175022] rounded-lg font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#0f3a18] hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? (tr ? 'Başlatılıyor...' : 'Starting...') : (tr ? 'Başla' : 'Start')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
