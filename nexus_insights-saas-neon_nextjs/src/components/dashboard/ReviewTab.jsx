'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { ClipboardCheck, Check, X } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

export default function ReviewTab({ language, fetchData }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(null);
  const tr    = language === 'tr';
  const toast = useToast();

  // useCallback so the useEffect dep array stays stable and ESLint is satisfied.
  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPendingEntries();
      if (res.ok) {
        // Fix 25A: coerce to array — backend may return paginated {results:[],count:0}
        const data = await res.json().catch(() => []);
        setPending(Array.isArray(data) ? data : (data.results ?? []));
      }
      // non-ok (e.g. 403) is silently ignored — pending stays empty
    } catch {
      // Network error: keep existing list; spinner stops
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // Dismiss reject dialog on Escape — consistent with all other modals
  useEffect(() => {
    if (!rejectId) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setRejectId(null); setRejectReason(''); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rejectId]);

  const handleApprove = useCallback(async (id) => {
    setProcessing(id);
    try {
      const res = await api.approveEntry(id, 'approve');
      if (res.ok) toast.success(tr ? 'Kayıt onaylandı ✓' : 'Entry approved ✓');
      else toast.error(tr ? 'Onay başarısız' : 'Approval failed');
      await fetchPending();
      if (fetchData) fetchData();
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setProcessing(null);
    }
  }, [tr, fetchPending, fetchData]);

  const handleReject = useCallback(async () => {
    if (!rejectId) return;
    const id     = rejectId;
    const reason = rejectReason;   // capture before clearing state
    setProcessing(id);
    setRejectId(null);
    setRejectReason('');
    try {
      const res = await api.approveEntry(id, 'reject', reason);
      if (res.ok) toast.warning(tr ? 'Kayıt reddedildi' : 'Entry rejected');
      else toast.error(tr ? 'Red işlemi başarısız' : 'Rejection failed');
      await fetchPending();
      if (fetchData) fetchData();
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setProcessing(null);
    }
  }, [rejectId, rejectReason, tr, fetchPending, fetchData]);

  return (
    <div className="space-y-3 text-[#302817]">
      {/* Header */}
      <div className="rounded-[1.25rem] border border-[#302817]/10 bg-gradient-to-br from-[#F9EFE5] via-white to-[#B4BE6A]/8 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#95A847]">
              {tr ? 'Onay süreci' : 'Approval workflow'}
            </p>
            <h1 className="mt-1 text-lg font-bold tracking-[-0.03em]">
              {tr ? 'Onay Bekleyenler' : 'Pending Review'}
            </h1>
            <p className="mt-0.5 text-xs text-[#302817]/50">
              {tr ? 'Onay bekleyen emisyon kayıtları' : 'Emission entries awaiting approval'}
            </p>
          </div>
          <div className="rounded-xl bg-[#95A847]/12 px-3 py-1.5 text-xs font-bold text-[#75863B]">
            {pending.length} {tr ? 'bekleyen' : 'pending'}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#95A847] border-t-transparent"></div>
        </div>
      ) : pending.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-[1.25rem] border border-[#302817]/10 bg-white p-6 text-center shadow-sm">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#95A847]/12 text-[#95A847]">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold">{tr ? 'Bekleyen kayıt yok' : 'No pending entries'}</p>
          <p className="mt-0.5 text-[11px] text-[#302817]/45">{tr ? 'Tüm kayıtlar onaylanmış.' : 'All entries have been reviewed.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map(entry => (
            <div key={entry.id} className="rounded-[1.25rem] border border-[#302817]/10 bg-white p-3.5 shadow-sm transition hover:shadow-[0_6px_20px_rgba(48,40,23,0.07)]">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <h3 className="truncate text-sm font-bold text-[#302817]">
                    {tr && entry.emission_factor_name_tr ? entry.emission_factor_name_tr : entry.emission_factor_name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      entry.scope === 'scope1' ? 'bg-[#302817]/10 text-[#302817]' :
                      entry.scope === 'scope2' ? 'bg-[#95A847]/15 text-[#75863B]' :
                      'bg-[#B4BE6A]/18 text-[#75863B]'
                    }`}>{entry.scope?.replace('scope', 'S')}</span>
                    <span className="text-[11px] font-semibold text-[#302817]/50">{parseFloat(entry.quantity).toLocaleString()} {entry.unit}</span>
                    <span className="text-[11px] font-bold text-[#95A847]">{parseFloat(entry.calculated_co2e_kg).toFixed(1)} kg</span>
                    <span className="text-[10px] text-[#302817]/35">{tr ? 'Ay' : 'Mo'}: {entry.month}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => handleApprove(entry.id)}
                    disabled={processing === entry.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[#95A847]/12 px-3 py-2 text-[11px] font-bold text-[#75863B] transition hover:bg-[#95A847]/22 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    {tr ? 'Onayla' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setRejectId(entry.id)}
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

      {/* Reject Dialog */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-md">
          <div
            role="dialog" aria-modal="true" aria-labelledby="reject-dialog-title"
            className="w-full max-w-sm rounded-[1.25rem] border border-[#302817]/10 bg-white/95 p-5 shadow-[0_20px_60px_rgba(48,40,23,0.15)] backdrop-blur-2xl"
          >
            <h3 id="reject-dialog-title" className="text-sm font-bold text-[#302817]">{tr ? 'Reddetme Nedeni' : 'Rejection Reason'}</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={tr ? 'Neden reddedildi...' : 'Why is this rejected...'}
              className="mt-3 w-full rounded-xl border border-[#302817]/10 bg-[#F8F8F8] px-3.5 py-2.5 text-xs text-[#302817] outline-none placeholder:text-[#302817]/30 focus:ring-4 focus:ring-[#95A847]/15"
              rows={3}
            />
            <div className="mt-4 flex gap-2">
              <button onClick={handleReject} className="flex-1 rounded-full bg-red-500 py-2.5 text-xs font-bold text-white transition hover:bg-red-600">{tr ? 'Reddet' : 'Reject'}</button>
              <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="flex-1 rounded-full border border-[#302817]/10 py-2.5 text-xs font-bold text-[#302817] transition hover:bg-[#F8F8F8]">{tr ? 'İptal' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
