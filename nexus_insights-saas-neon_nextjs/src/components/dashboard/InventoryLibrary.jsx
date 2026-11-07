'use client';

import { useState, useEffect } from 'react';
import { Plus, Play, Eye, Trash2, FileText, FileBadge, Package, Loader2, Pencil, FilePlus2, CalendarDays, Clock, User } from 'lucide-react';
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
  // Why it failed: 'network' (no answer), 'server' (the server answered with a 5xx), 'auth' (401/403) or
  // 'other'. Only the kind and the status number are kept; the server's own text is never shown.
  const [loadError, setLoadError] = useState({ kind: 'network', status: 0 });
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
      if (!res.ok) {
        const status = Number(res.status) || 0;
        setLoadError({ kind: status >= 500 ? 'server' : (status === 401 || status === 403) ? 'auth' : 'other', status });
        console.warn('Inventory list request failed with HTTP', status);
        setLoadFailed(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.reports) {
        setReports(data.reports);
      }
      setLoadFailed(false);
    } catch (e) {
      // No answer at all (offline, server down, request blocked)
      setLoadError({ kind: 'network', status: 0 });
      console.warn('Inventory list request got no answer:', e?.message || e);
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
      // The deleted inventory's emission entries are gone: the dashboard keeps
      // its own copy of the totals, so tell it to reload. Not 'inventory' —
      // that source moves the dashboard to the inventory's year.
      window.dispatchEvent(new CustomEvent('carbonless:emissions-updated', {
        detail: { source: 'inventory-deleted' },
      }));
    } catch (e) {
      console.error('Failed to delete inventory:', e);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  // What deleting an inventory also removes, shown in the confirm step: the
  // emission records of THIS inventory only. Other inventories are never touched,
  // even when they cover the same reporting year.
  const deleteNote = (report) => {
    const year = report.reporting_year;
    if (!year) {
      return tr
        ? 'Bu envanter ve kayıtları silinir; diğer envanterlere dokunulmaz.'
        : 'This inventory and its records are deleted; other inventories are not touched.';
    }
    return tr
      ? `Yalnızca bu envanterin ${year} emisyon kayıtları silinir; diğer envanterlere dokunulmaz.`
      : `Only this inventory's ${year} emission records are deleted; other inventories are not touched.`;
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
            {{
              network: tr
                ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin. Kayıtlı envanterleriniz silinmedi.'
                : 'The server could not be reached. Check your internet connection and try again. Your saved inventories are not deleted.',
              server: tr
                ? `Sunucu envanter listesini yüklerken bir hata verdi (HTTP ${loadError.status}). Bu sizin bağlantınızdan kaynaklanmıyor. Biraz sonra tekrar deneyin; sürerse destek ekibine bildirin. Kayıtlı envanterleriniz silinmedi.`
                : `The server hit an error while loading the inventory list (HTTP ${loadError.status}). This is not caused by your connection. Try again in a moment; if it keeps happening, tell support. Your saved inventories are not deleted.`,
              auth: tr
                ? 'Oturumunuzun süresi dolmuş olabilir veya bu envanterlere erişim izniniz yok. Yeniden giriş yapıp tekrar deneyin.'
                : 'Your session may have expired, or you may not have access to these inventories. Sign in again and retry.',
              other: tr
                ? `Envanter listesi yüklenemedi (HTTP ${loadError.status}). Tekrar deneyin. Kayıtlı envanterleriniz silinmedi.`
                : `The inventory list could not be loaded (HTTP ${loadError.status}). Try again. Your saved inventories are not deleted.`,
            }[loadError.kind] || ''}
          </p>
          <button
            type="button"
            onClick={loadInventories}
            className="mt-3 rounded-lg btn-dark px-4 py-2 text-xs font-semibold"
          >
            {tr ? 'Tekrar dene' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  // ── view helpers (plain functions, not components: the rename input must keep focus while typing) ──────────────
  const fmtDate = (value) => (value ? new Date(value).toLocaleDateString(tr ? 'tr-TR' : 'en-GB') : '—');

  const statusOf = (report) => {
    if (report.status === 'completed') {
      return { label: tr ? 'Tamamlandı' : 'Completed', cls: 'bg-[#2ABD41]/12 text-[#175022] ring-[#2ABD41]/30', dot: 'bg-[#2ABD41]' };
    }
    if (report.status === 'in_progress') {
      return { label: tr ? 'Devam ediyor' : 'In progress', cls: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' };
    }
    return { label: tr ? 'Taslak' : 'Draft', cls: 'bg-[#F1F5F2] text-[#4B5B50] ring-[#DCE6DE]', dot: 'bg-[#8A988E]' };
  };

  const ICON_BTN = 'inline-flex h-10 w-10 max-lg:h-11 max-lg:w-11 shrink-0 items-center justify-center rounded-[10px] border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1 disabled:opacity-60 lg:h-8 lg:w-8';
  const ICON_BTN_NEUTRAL = `${ICON_BTN} border-[#DCE6DE] bg-white text-[#175022] hover:border-[#BFE3C6] hover:bg-[#F1FCF2]`;
  const ICON_BTN_DANGER = `${ICON_BTN} border-red-100 bg-white text-red-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600`;
  const ACT_BTN = 'h-11 flex-1 lg:h-[var(--app-control-h-sm)] lg:flex-none transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1';

  const progressBlock = (report) => {
    const percent = Math.max(0, Math.min(100, Number(report.progress?.percent) || 0));
    const total = report.progress?.total;
    return (
      <div className="min-w-0">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold text-[#6B7A70]">{tr ? 'İlerleme' : 'Progress'}</span>
          <span className="text-[13px] font-bold tabular-nums text-[#0E2A14]">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={tr ? 'Tamamlanma yüzdesi' : 'Completion percentage'}
          className="h-1.5 w-full overflow-hidden rounded-full bg-[#E6EDE7]"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-[#1D9C31] to-[#2ABD41]" style={{ width: `${percent}%` }} />
        </div>
        {/* No total before the first answer: the survey works it out from the answers (it used to read "0 / 120"). */}
        <p className="mt-1 text-[11px] text-[#6B7A70]">
          {total
            ? `${report.progress?.completed || 0} / ${total} ${tr ? 'soru yanıtlandı' : 'questions answered'}`
            : (tr ? 'Henüz başlanmadı' : 'Not started yet')}
        </p>
      </div>
    );
  };

  const metaChip = (Icon, text, strong = false) => (
    <span className={`inline-flex items-center gap-1 text-[11.5px] ${strong ? 'font-semibold text-[#175022]' : 'text-[#6B7A70]'}`}>
      <Icon className="h-3 w-3 shrink-0 text-[#2ABD41]" aria-hidden="true" />
      {text}
    </span>
  );

  const inventoryCard = (report) => {
    const done = report.status === 'completed';
    const st = statusOf(report);
    return (
      <div
        key={report.report_id}
        className={`grid gap-x-5 gap-y-3 rounded-[14px] border bg-white p-3 shadow-[0_1px_2px_rgba(16,40,20,0.04)] transition-colors duration-150 hover:border-[#BFE3C6] lg:grid-cols-[minmax(0,1.35fr)_minmax(190px,1fr)_auto] lg:items-center ${done ? 'border-[#CFE9D4]' : 'border-[#E6EDE7]'}`}
      >
        {/* identity */}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {renamingId === report.report_id ? null : titleHeading(report)}
            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${st.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
              {st.label}
            </span>
          </div>
          {titleEditor(report)}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {report.reporting_year && metaChip(CalendarDays, `${tr ? 'Raporlama yılı' : 'Reporting year'}: ${report.reporting_year}`, true)}
            {metaChip(Clock, `${done ? (tr ? 'Tamamlandı' : 'Completed') : (tr ? 'Güncelleme' : 'Updated')}: ${fmtDate(done ? (report.signed_at || report.updated_at) : report.updated_at)}`)}
            {report.created_by && metaChip(User, `${tr ? 'Oluşturan' : 'Created by'}: ${report.created_by}`)}
          </div>
          {done && (report.advisor_pending > 0 || report.advisor_rejected > 0) && (
            <p className="mt-1.5 text-[11.5px] font-semibold text-amber-800">
              {[
                report.advisor_pending > 0 && (tr ? `${report.advisor_pending} danışman onayı bekliyor` : `${report.advisor_pending} advisor approval${report.advisor_pending > 1 ? 's' : ''} waiting`),
                report.advisor_rejected > 0 && (tr ? `${report.advisor_rejected} danışman maddesi reddedildi — cevabı düzeltin` : `${report.advisor_rejected} advisor item${report.advisor_rejected > 1 ? 's' : ''} rejected — correct the answer`),
              ].filter(Boolean).join(' · ')}
            </p>
          )}
          {/* An answer fixed after the sign-off is already in the numbers; the card must not move its date to that day. */}
          {done && report.edited_after_signing_at && (
            <div role="status" className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] font-semibold text-amber-800">
              <span>
                {tr
                  ? `${new Date(report.edited_after_signing_at).toLocaleDateString('tr-TR')} tarihinde düzenlendi — imza yenilenmedi.`
                  : `Edited on ${new Date(report.edited_after_signing_at).toLocaleDateString('en-GB')} — not signed again.`}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => continueInventory(report.report_id, '7C-2')}
                  className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 transition hover:bg-amber-100"
                >
                  {tr ? 'Yeniden imzala' : 'Sign again'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* progress (completed inventories show the full bar too: the number comes from the same data) */}
        {progressBlock(report)}

        {/* actions */}
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end">
          {done ? (
            <>
              {[
                ['pack', Package, tr ? 'Tam rapor paketi indir (3 rapor)' : 'Download full report pack (3 reports)'],
                ['iso', FileBadge, tr ? 'ISO 14064-1 Envanter Raporu İndir' : 'Download ISO 14064-1 inventory report'],
                ['profile', FileText, tr ? 'Envanter profili (özet) indir' : 'Download inventory profile (summary)'],
              ].map(([kind, Icon, label]) => (
                <button
                  key={kind}
                  onClick={() => handleDownloadPdf(report.report_id, kind)}
                  disabled={!!pdfDownloadingId}
                  aria-busy={pdfDownloadingId === `${report.report_id}:${kind}` ? 'true' : undefined}
                  aria-label={label}
                  title={label}
                  className={ICON_BTN_NEUTRAL}
                >
                  {pdfDownloadingId === `${report.report_id}:${kind}`
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Icon className="h-3.5 w-3.5" />}
                </button>
              ))}
              {canEdit && !report.signed_at && (
                <button
                  onClick={() => handleEditCompleted(report.report_id)}
                  title={tr ? 'Bir bölümü düzelt' : 'Fix a section'}
                  className={`app-btn app-btn-sm border border-[#175022]/25 bg-white text-[#175022] hover:border-[#175022]/45 hover:bg-[#F1FCF2] ${ACT_BTN}`}
                >
                  <Pencil />
                  {tr ? 'Düzenle' : 'Edit'}
                </button>
              )}
              <button
                onClick={() => handleViewReport(report.report_id, report.reporting_year)}
                className={`app-btn app-btn-sm btn-dark ${ACT_BTN}`}
              >
                <Eye />
                {tr ? 'Görüntüle' : 'View'}
              </button>
              {/* A completed inventory carries approved figures and a signed report: only an owner/admin deletes it. */}
              {canEdit && canManage && deleteTrigger(report)}
            </>
          ) : (
            canEdit && (
              <>
                <button
                  onClick={() => handleContinue(report.report_id)}
                  className={`app-btn app-btn-sm btn-dark ${ACT_BTN}`}
                >
                  <Play />
                  {tr ? 'Devam Et' : 'Continue'}
                </button>
                {(!report.created_by || canManage) && deleteTrigger(report)}
              </>
            )
          )}
        </div>
      </div>
    );
  };

  const deleteTrigger = (report) => {
    const label = tr ? 'Sil' : 'Delete';
    return (
      <button
        onClick={() => setConfirmDeleteId(report.report_id)}
        title={label}
        aria-label={label}
        className={ICON_BTN_DANGER}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    );
  };

  // The name; renaming happens in place (titleEditor) and the plain name hides meanwhile.
  const titleHeading = (report) => (
    <div className="flex min-w-0 items-center gap-1.5">
      <p className="min-w-0 truncate text-[15px] font-bold leading-tight text-[#0E2A14]" title={report.title}>{report.title}</p>
      {canRename && (
        <button
          onClick={() => { setRenamingId(report.report_id); setRenameValue(report.title || ''); setRenameError(''); }}
          className="inline-flex min-h-[26px] max-lg:min-h-11 shrink-0 items-center gap-1 rounded-md border border-transparent px-1.5 text-[11px] font-semibold text-[#175022]/70 transition-colors hover:border-[#DCE6DE] hover:bg-[#F1FCF2] hover:text-[#175022] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
          {tr ? 'Yeniden adlandır' : 'Rename'}
        </button>
      )}
    </div>
  );

  const titleEditor = (report) => {
    const titleYear = (String(report.title || '').match(/\b(19|20)\d{2}\b/) || [])[0];
    const yearMismatch = titleYear && report.reporting_year && Number(titleYear) !== Number(report.reporting_year);
    return (
      <>
        {renamingId === report.report_id && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(report.report_id); if (e.key === 'Escape') setRenamingId(null); }}
              maxLength={200}
              autoFocus
              aria-label={tr ? 'Envanter adı' : 'Inventory name'}
              className="app-input min-w-0 flex-1"
            />
            <button onClick={() => saveRename(report.report_id)} className="app-btn app-btn-sm btn-dark">
              {tr ? 'Kaydet' : 'Save'}
            </button>
            <button onClick={() => setRenamingId(null)} className="app-btn app-btn-sm border border-[#DCE6DE] bg-white text-[#175022]/70 hover:bg-[#F1FCF2]">
              {tr ? 'Vazgeç' : 'Cancel'}
            </button>
            {renameError && <span className="w-full text-xs text-red-600">{renameError}</span>}
          </div>
        )}
        {yearMismatch && (
          <p className="mt-1 text-[11px] font-semibold text-amber-700">
            {tr ? `Adındaki yıl (${titleYear}) raporlama yılıyla (${report.reporting_year}) uyuşmuyor.`
                : `The year in the name (${titleYear}) differs from the reporting year (${report.reporting_year}).`}
          </p>
        )}
      </>
    );
  };

  const sectionHeading = (dot, text, count) => (
    <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#0E2A14]">
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {text}
      <span className="rounded-full bg-[#EEF4EF] px-1.5 py-px text-[10.5px] font-bold tabular-nums text-[#4B5B50]">{count}</span>
    </h3>
  );

  const deleting = confirmDeleteId != null ? reports.find(r => r.report_id === confirmDeleteId) : null;

  return (
    <div className="w-full">
      <div className="grid w-full gap-3 max-lg:pb-24 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        {/* ── New inventory: a compact action card; on wide screens it sits in the right rail ── */}
        {canEdit && (
          <div className="rounded-[14px] border border-[#CFE9D4] bg-gradient-to-br from-[#F1FCF2] to-white p-3 shadow-[0_1px_2px_rgba(16,40,20,0.04)] xl:order-2 xl:sticky xl:top-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:flex-col xl:items-stretch">
              <div className="flex min-w-0 items-center gap-3 xl:items-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2ABD41]/14 text-[#1D9C31] ring-1 ring-[#2ABD41]/25">
                  <FilePlus2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-bold leading-tight text-[#0E2A14]">{tr ? 'Yeni Envanter' : 'New Inventory'}</h2>
                  <p className="mt-0.5 text-[12px] leading-snug text-[#6B7A70]">
                    {tr
                      ? 'Bağımsız yeni bir karbon envanteri oluşturun. Aynı raporlama yılında birden fazla envanter olabilir.'
                      : 'Create another independent carbon inventory. Several inventories can share a reporting year.'}
                  </p>
                </div>
              </div>
              <button
                onClick={openNewDialog}
                disabled={loading}
                className="app-btn btn-dark h-10 max-lg:h-11 w-full shrink-0 shadow-sm transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2 sm:h-[var(--app-control-h)] sm:w-auto xl:w-full"
              >
                <Plus />
                {tr ? 'Başla' : 'Start'}
              </button>
            </div>
            {reports.length > 0 && (
              <dl className="mt-3 hidden grid-cols-3 gap-2 border-t border-[#DCE9DE] pt-3 text-center xl:grid">
                {[
                  [reports.length, tr ? 'Toplam' : 'Total'],
                  [drafts.length, tr ? 'Devam eden' : 'Open'],
                  [completed.length, tr ? 'Tamamlanan' : 'Completed'],
                ].map(([n, label]) => (
                  <div key={label}>
                    <dd className="text-[18px] font-bold leading-none tabular-nums text-[#0E2A14]">{n}</dd>
                    <dt className="mt-1 text-[10.5px] font-semibold text-[#6B7A70]">{label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        {/* ── Lists ── */}
        <div className="min-w-0 space-y-4 xl:order-1">
          {error && (
            <div className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {deleteError && (
            <div role="alert" className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div>
          )}
          {!canEdit && (
            <div role="status" className="rounded-[10px] border border-[#8BEA99]/40 bg-[#8BEA99]/10 p-3 text-sm text-[#175022]">
              {tr
                ? 'Denetçi rolünüz salt okunur: envanterleri görüntüleyebilir ve raporlarını indirebilirsiniz, ancak yeni envanter başlatamaz, düzenleyemez veya silemezsiniz.'
                : 'Your auditor role is read-only: you can view inventories and download their reports, but not start, edit or delete one.'}
            </div>
          )}

          {drafts.length > 0 && (
            <section aria-label={tr ? 'Taslaklar' : 'Draft Inventories'}>
              {sectionHeading('bg-[#175022]', tr ? 'Taslaklar' : 'Draft Inventories', drafts.length)}
              <div className="space-y-2">{drafts.map(inventoryCard)}</div>
            </section>
          )}

          {completed.length > 0 && (
            <section aria-label={tr ? 'Tamamlanan Envanterler' : 'Completed Inventories'}>
              {sectionHeading('bg-[#2ABD41]', tr ? 'Tamamlanan Envanterler' : 'Completed Inventories', completed.length)}
              <div className="space-y-2">{completed.map(inventoryCard)}</div>
            </section>
          )}

          {/* Empty State */}
          {drafts.length === 0 && completed.length === 0 && !loading && (
            <div className="rounded-[14px] border border-dashed border-[#CFE9D4] bg-white px-4 py-8 text-center">
              <p className="text-sm font-semibold text-[#0E2A14]">{tr ? 'Henüz envanter yok' : 'No inventories yet'}</p>
              {/* An auditor can't start one (the notice above says so). */}
              {canEdit && (
                <button
                  onClick={openNewDialog}
                  className="app-btn btn-dark mt-3 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-2"
                >
                  <Plus />
                  {tr ? 'İlk envanterinizi oluşturun' : 'Create your first inventory'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation: nothing is deleted before this is answered. */}
      {deleting && (
        <div
          className="fixed inset-0 z-[90] flex overflow-y-auto bg-black/40 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !deletingId) setConfirmDeleteId(null); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-inventory-title"
            aria-describedby="delete-inventory-note"
            className="m-auto w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
            onKeyDown={(e) => { if (e.key === 'Escape' && !deletingId) { e.stopPropagation(); setConfirmDeleteId(null); } }}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 ring-1 ring-red-100">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="delete-inventory-title" className="text-[15px] font-bold text-[#0E2A14]">
                  {tr ? 'Bu envanter silinsin mi?' : 'Delete this inventory?'}
                </h2>
                <p className="mt-0.5 truncate text-[12.5px] font-semibold text-[#175022]" title={deleting.title}>{deleting.title}</p>
                <p id="delete-inventory-note" className="mt-2 text-[12.5px] leading-snug text-[#4B5B50]">{deleteNote(deleting)}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                autoFocus
                onClick={() => setConfirmDeleteId(null)}
                disabled={!!deletingId}
                className="app-btn border border-[#DCE6DE] bg-white text-[#175022] hover:bg-[#F1FCF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
              >
                {tr ? 'Vazgeç' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(deleting.report_id)}
                disabled={deletingId === deleting.report_id}
                className="app-btn btn-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1"
              >
                {deletingId === deleting.report_id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {tr ? 'Evet, sil' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Naming Dialog */}
      {showNamingDialog && (
        <div className="fixed inset-0 z-[90] flex overflow-y-auto bg-black/40 p-4">
          <div className="m-auto w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl"
            role="dialog" aria-modal="true" aria-labelledby="new-inventory-title"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShowNamingDialog(false); } }}>
            <h2 id="new-inventory-title" className="mb-3 text-[15px] font-bold text-[#0E2A14]">
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
              aria-labelledby="new-inventory-title"
              autoFocus
              className="app-input"
            />
            <p className="mb-3 mt-1.5 text-xs text-[#6B7A70]">
              {tr
                ? `İsteğe bağlı. Boş bırakırsanız bugünün tarihi kullanılır (${new Date().toLocaleDateString('tr-TR')}).`
                : `Optional. If left empty, today's date is used (${new Date().toLocaleDateString('en-GB')}).`}
            </p>

            <label htmlFor="new-inventory-year" className="app-label mb-1 block">
              {tr ? 'Raporlama yılı' : 'Reporting year'}
            </label>
            <select
              id="new-inventory-year"
              value={surveyYear}
              onChange={(e) => setSurveyYear(e.target.value)}
              className="app-input"
            >
              {yearOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label?.[tr ? 'tr' : 'en'] || o.value}</option>
              ))}
            </select>
            {nameYearMismatch ? (
              <p role="alert" className="mb-3 mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {tr
                  ? `Adda ${nameYear} yazıyor ama raporlama yılı ${surveyYear} seçili. Doğru yılı seçtiğinizden emin olun.`
                  : `The name says ${nameYear} but the reporting year is ${surveyYear}. Make sure the right year is selected.`}
              </p>
            ) : (
              <p className="mb-3 mt-1.5 text-xs text-[#6B7A70]">
                {tr ? 'Bu envanterdeki tüm veriler bu yıla ait olacak.' : 'All data in this inventory will be for this year.'}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNamingDialog(false);
                  setSurveyName('');
                }}
                className="app-btn border border-[#DCE6DE] bg-white text-[#175022] hover:bg-[#F1FCF2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
              >
                {tr ? 'İptal' : 'Cancel'}
              </button>
              <button
                onClick={handleStartNew}
                disabled={loading}
                className="app-btn btn-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BEA99] focus-visible:ring-offset-1"
              >
                {loading ? (tr ? 'Başlatılıyor...' : 'Starting...') : (tr ? 'Başla' : 'Start')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
