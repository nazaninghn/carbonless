'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { ClipboardCheck, Check, X, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

const RISK_STYLES = {
  low:          'bg-[#8BEA99]/18 text-[#175022]',
  medium:       'bg-amber-100 text-amber-700',
  medium_high:  'bg-orange-100 text-orange-700',
  high:         'bg-orange-100 text-orange-700',
  critical:     'bg-red-100 text-red-600',
  warning:      'bg-amber-100 text-amber-700',
  positive:     'bg-[#2ABD41]/15 text-[#175022]',
};

const RISK_LABELS_TR = {
  low: 'Düşük', medium: 'Orta', medium_high: 'Orta-Yüksek', high: 'Yüksek',
  critical: 'Kritik', warning: 'Uyarı', positive: 'Olumlu',
};

export default function ReviewTab({ language, fetchData }) {
  const [pending, setPending] = useState([]);
  const [advisorPending, setAdvisorPending] = useState([]);
  const [loading, setLoading] = useState(true);
  // reject dialog is shared between the two lists — `rejectType` disambiguates
  // which approve/reject endpoint to call on submit.
  const [rejectTarget, setRejectTarget] = useState(null); // { id, type: 'entry' | 'advisor' }
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(null);
  const tr    = language === 'tr';
  const toast = useToast();

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, advisorRes] = await Promise.all([
        api.getPendingEntries(),
        api.getPendingAdvisorApprovals(),
      ]);
      if (entriesRes.ok) {
        // Fix 25A: coerce to array — backend may return paginated {results:[],count:0}
        const data = await entriesRes.json().catch(() => []);
        setPending(Array.isArray(data) ? data : (data.results ?? []));
      }
      if (advisorRes.ok) {
        const data = await advisorRes.json().catch(() => []);
        setAdvisorPending(Array.isArray(data) ? data : (data.results ?? []));
      }
      // non-ok (e.g. 403) is silently ignored — that list just stays empty
    } catch {
      // Network error: keep existing lists; spinner stops
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // Dismiss reject dialog on Escape — consistent with all other modals
  useEffect(() => {
    if (!rejectTarget) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setRejectTarget(null); setRejectReason(''); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rejectTarget]);

  const handleApprove = useCallback(async (id, type) => {
    setProcessing(id);
    try {
      const res = type === 'advisor'
        ? await api.approveAdvisorApproval(id, 'approve')
        : await api.approveEntry(id, 'approve');
      if (res.ok) toast.success(tr ? 'Kayıt onaylandı ✓' : 'Entry approved ✓');
      else toast.error(tr ? 'Onay başarısız' : 'Approval failed');
      await fetchPending();
      if (fetchData) fetchData();
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setProcessing(null);
    }
  }, [tr, toast, fetchPending, fetchData]);

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    const { id, type } = rejectTarget;
    const reason = rejectReason;   // capture before clearing state
    setProcessing(id);
    setRejectTarget(null);
    setRejectReason('');
    try {
      const res = type === 'advisor'
        ? await api.approveAdvisorApproval(id, 'reject', reason)
        : await api.approveEntry(id, 'reject', reason);
      if (res.ok) toast.warning(tr ? 'Kayıt reddedildi' : 'Entry rejected');
      else toast.error(tr ? 'Red işlemi başarısız' : 'Rejection failed');
      await fetchPending();
      if (fetchData) fetchData();
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setProcessing(null);
    }
  }, [rejectTarget, rejectReason, tr, toast, fetchPending, fetchData]);

  const totalPending = pending.length + advisorPending.length;

  return (
    <div className="space-y-3 text-[#072C0E]">
      {/* Header */}
      <div className="rounded-[1.25rem] border border-[#072C0E]/10 bg-gradient-to-br from-[#DEFAE1] via-white to-[#8BEA99]/8 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2ABD41]">
              {tr ? 'Onay süreci' : 'Approval workflow'}
            </p>
            <h1 className="mt-1 text-lg font-bold tracking-[-0.03em]">
              {tr ? 'Onay Bekleyenler' : 'Pending Review'}
            </h1>
            <p className="mt-0.5 text-xs text-[#072C0E]/50">
              {tr ? 'Onay bekleyen emisyon kayıtları ve danışman onayları' : 'Emission entries and advisor approvals awaiting review'}
            </p>
          </div>
          <div className="rounded-xl bg-[#2ABD41]/12 px-3 py-1.5 text-xs font-bold text-[#175022]">
            {totalPending} {tr ? 'bekleyen' : 'pending'}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#2ABD41] border-t-transparent"></div>
        </div>
      ) : totalPending === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-[1.25rem] border border-[#072C0E]/10 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#2ABD41]/12 text-[#2ABD41]">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold">{tr ? 'Bekleyen kayıt yok' : 'No pending entries'}</p>
          <p className="mt-0.5 text-[11px] text-[#072C0E]/45">{tr ? 'Tüm kayıtlar onaylanmış.' : 'All entries have been reviewed.'}</p>
        </div>
      ) : (
        <>
          {/* ── Danışman Onayı (Advisor Approval) ─────────────────────────── */}
          {advisorPending.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <ShieldAlert className="h-3.5 w-3.5 text-[#2ABD41]" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-[#072C0E]/60">
                  {tr ? 'Danışman Onayı' : 'Advisor Approval'} ({advisorPending.length})
                </h2>
              </div>
              {advisorPending.map(item => (
                <div key={`advisor-${item.id}`} className="rounded-[1.25rem] border border-[#072C0E]/10 bg-white p-3.5 shadow-sm transition hover:shadow-[0_6px_20px_rgba(7,44,14,0.07)]">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="truncate text-sm font-bold text-[#072C0E]">
                        {item.description || item.reason_code}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${RISK_STYLES[item.risk_level] || 'bg-[#072C0E]/10 text-[#072C0E]'}`}>
                          {tr ? (RISK_LABELS_TR[item.risk_level] || item.risk_level) : item.risk_level?.replace('_', '-')}
                        </span>
                        <span className="text-[11px] font-semibold text-[#072C0E]/50">{item.trigger_category}</span>
                        <span className="text-[10px] text-[#072C0E]/35 font-mono">{item.question_id}</span>
                        <span className="text-[10px] text-[#072C0E]/35">{item.report_title}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => handleApprove(item.id, 'advisor')}
                        disabled={processing === item.id}
                        className="inline-flex items-center gap-1 rounded-full bg-[#2ABD41]/12 px-3 py-2 text-[11px] font-bold text-[#175022] transition hover:bg-[#2ABD41]/22 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        {tr ? 'Onayla' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setRejectTarget({ id: item.id, type: 'advisor' })}
                        disabled={processing === item.id}
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-2 text-[11px] font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                        {tr ? 'Reddet' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Emission entries (manual dashboard data-entry approvals) ────── */}
          {pending.length > 0 && (
            <div className="space-y-2">
              {advisorPending.length > 0 && (
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <ClipboardCheck className="h-3.5 w-3.5 text-[#2ABD41]" />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-[#072C0E]/60">
                    {tr ? 'Emisyon Kayıtları' : 'Emission Entries'} ({pending.length})
                  </h2>
                </div>
              )}
              {pending.map(entry => (
                <div key={`entry-${entry.id}`} className="rounded-[1.25rem] border border-[#072C0E]/10 bg-white p-3.5 shadow-sm transition hover:shadow-[0_6px_20px_rgba(7,44,14,0.07)]">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="truncate text-sm font-bold text-[#072C0E]">
                        {tr && entry.emission_factor_name_tr ? entry.emission_factor_name_tr : entry.emission_factor_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          entry.scope === 'scope1' ? 'bg-[#072C0E]/10 text-[#072C0E]' :
                          entry.scope === 'scope2' ? 'bg-[#2ABD41]/15 text-[#175022]' :
                          'bg-[#8BEA99]/18 text-[#175022]'
                        }`}>{entry.scope?.replace('scope', 'S')}</span>
                        <span className="text-[11px] font-semibold text-[#072C0E]/50">{parseFloat(entry.quantity).toLocaleString()} {entry.unit}</span>
                        <span className="text-[11px] font-bold text-[#2ABD41]">{parseFloat(entry.calculated_co2e_kg).toFixed(1)} kg</span>
                        <span className="text-[10px] text-[#072C0E]/35">{tr ? 'Ay' : 'Mo'}: {entry.month}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => handleApprove(entry.id, 'entry')}
                        disabled={processing === entry.id}
                        className="inline-flex items-center gap-1 rounded-full bg-[#2ABD41]/12 px-3 py-2 text-[11px] font-bold text-[#175022] transition hover:bg-[#2ABD41]/22 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        {tr ? 'Onayla' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setRejectTarget({ id: entry.id, type: 'entry' })}
                        disabled={processing === entry.id}
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-2 text-[11px] font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                        {tr ? 'Reddet' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reject Dialog — shared by both lists */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-md">
          <div
            role="dialog" aria-modal="true" aria-labelledby="reject-dialog-title"
            className="w-full max-w-sm rounded-[1.25rem] border border-[#072C0E]/10 bg-white/95 p-5 shadow-[0_20px_60px_rgba(7,44,14,0.15)] backdrop-blur-2xl"
          >
            <h3 id="reject-dialog-title" className="text-sm font-bold text-[#072C0E]">{tr ? 'Reddetme Nedeni' : 'Rejection Reason'}</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={tr ? 'Neden reddedildi...' : 'Why is this rejected...'}
              className="mt-3 w-full rounded-xl border border-[#072C0E]/10 bg-[#F8F8F8] px-3.5 py-2.5 text-xs text-[#072C0E] outline-none placeholder:text-[#072C0E]/30 focus:ring-4 focus:ring-[#2ABD41]/15"
              rows={3}
            />
            <div className="mt-4 flex gap-2">
              <button onClick={handleReject} className="flex-1 rounded-full bg-red-500 py-2.5 text-xs font-bold text-white transition hover:bg-red-600">{tr ? 'Reddet' : 'Reject'}</button>
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="flex-1 rounded-full border border-[#072C0E]/10 py-2.5 text-xs font-bold text-[#072C0E] transition hover:bg-[#F8F8F8]">{tr ? 'İptal' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
