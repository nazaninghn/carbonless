'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';
import { ClipboardCheck, Check, X, AlertCircle } from 'lucide-react';

export default function ReviewTab({ language, fetchData }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await api.getPendingEntries();
      if (res.ok) setPending(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (id) => {
    setProcessing(id);
    await api.approveEntry(id, 'approve');
    fetchPending();
    if (fetchData) fetchData();
    setProcessing(null);
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setProcessing(rejectId);
    await api.approveEntry(rejectId, 'reject', rejectReason);
    setRejectId(null);
    setRejectReason('');
    fetchPending();
    if (fetchData) fetchData();
    setProcessing(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate">{language === 'tr' ? 'Onay Bekleyenler' : 'Pending Review'}</h1>
        <p className="text-graphite mt-1">{language === 'tr' ? 'Onay bekleyen emisyon kayıtları' : 'Emission entries awaiting approval'}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-xl border border-black/[0.04] shadow-soft p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-graphite/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate mb-2">{language === 'tr' ? 'Bekleyen kayıt yok' : 'No pending entries'}</h3>
          <p className="text-graphite">{language === 'tr' ? 'Tüm kayıtlar onaylanmış.' : 'All entries have been reviewed.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(entry => (
            <div key={entry.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-lg transition">
              <div className="flex items-start justify-between gap-4">
                {/* LEFT */}
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === 'tr' && entry.emission_factor_name_tr ? entry.emission_factor_name_tr : entry.emission_factor_name}
                  </h3>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-2">
                    <span className="bg-slate-100 px-2 py-1 rounded-md">{entry.scope?.replace('scope', 'Scope ')}</span>
                    <span>{parseFloat(entry.quantity).toLocaleString()} {entry.unit}</span>
                    <span className="font-semibold text-emerald-600">{parseFloat(entry.calculated_co2e_kg).toFixed(2)} kg CO2e</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {language === 'tr' ? 'Ay' : 'Month'}: {entry.month} · {entry.facility || ''}
                  </div>
                </div>
                {/* RIGHT ACTIONS */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(entry.id)}
                    disabled={processing === entry.id}
                    className="flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {language === 'tr' ? 'Onayla' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setRejectId(entry.id)}
                    disabled={processing === entry.id}
                    className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    {language === 'tr' ? 'Reddet' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">{language === 'tr' ? 'Reddetme Nedeni' : 'Rejection Reason'}</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={language === 'tr' ? 'Neden reddedildi...' : 'Why is this rejected...'}
              className="w-full px-3 py-2 border border-black/[0.06] rounded-lg mb-4" rows={3}
            />
            <div className="flex gap-2">
              <button onClick={handleReject} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm">{language === 'tr' ? 'Reddet' : 'Reject'}</button>
              <button onClick={() => { setRejectId(null); setRejectReason(''); }} className="flex-1 py-2 border border-black/[0.06] rounded-lg text-sm">{language === 'tr' ? 'İptal' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
