'use client';
import FactorCountryBadge from '@/components/FactorCountryBadge';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { ClipboardCheck, Check, X, ShieldAlert, Paperclip } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { downloadProofDocument } from '@/lib/proofDownload';
import { useToast } from '@/components/ToastProvider';
import { noPermissionMessage } from '@/lib/permissions';
import { REVIEW_FOCUS_KEY, REVIEW_FOCUS_EVENT } from '@/lib/reviewFocus';
import { advisorReasonText, advisorCategoryLabel } from '@/lib/advisorReasons';
import { formatAdvisorAnswer } from '@/lib/advisorAnswer';
import { MONTHS_TR, MONTHS_EN, unitLabel } from '@/lib/constants/emissions';
import { entrySourceLabel, entryPeriodLabel, autoDescriptionLabel } from '@/lib/entryDescription';
const num = (v, tr, digits = 2) =>
  Number(v || 0).toLocaleString(tr ? 'tr-TR' : 'en-GB', { maximumFractionDigits: digits });

const RISK_STYLES = {
  low:          'bg-[#8BEA99]/18 text-[#175022]',
  medium:       'bg-amber-100 text-amber-800',
  medium_high:  'bg-amber-200 text-amber-900',
  high:         'bg-amber-200 text-amber-900',
  critical:     'bg-red-100 text-red-600',
  warning:      'bg-amber-100 text-amber-800',
  positive:     'bg-[#2ABD41]/15 text-[#175022]',
};

const RISK_LABELS_TR = {
  low: 'Düşük', medium: 'Orta', medium_high: 'Orta-Yüksek', high: 'Yüksek',
  critical: 'Kritik', warning: 'Uyarı', positive: 'Olumlu',
};

export default function ReviewTab({ language, fetchData, canApprove = true, canEdit = true }) {
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
        api.getPendingEntries(tr ? 'tr' : 'en'),
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
  }, [tr]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // An "Onay bekleyen kayıt" notification opens this page on that entry: it
  // sat below every advisor card (about three screens down on a phone).
  const [focusId, setFocusId] = useState(null);
  useEffect(() => {
    const take = () => {
      try {
        const id = sessionStorage.getItem(REVIEW_FOCUS_KEY);
        if (id) { sessionStorage.removeItem(REVIEW_FOCUS_KEY); setFocusId(Number(id)); }
      } catch { /* opens at the top */ }
    };
    take();
    window.addEventListener(REVIEW_FOCUS_EVENT, take);
    return () => window.removeEventListener(REVIEW_FOCUS_EVENT, take);
  }, []);
  useEffect(() => {
    if (!focusId || loading) return;
    const el = document.querySelector(`[data-review-entry-id="${focusId}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => setFocusId(null), 4000);
    return () => clearTimeout(t);
  }, [focusId, loading, pending]);
  const jumpTo = (id) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  // Dismiss reject dialog on Escape — consistent with all other modals
  useEffect(() => {
    if (!rejectTarget) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setRejectTarget(null); setRejectReason(''); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rejectTarget]);

  // Same hand-off as Emisyon Yönetimi's "Ankette düzelt": the Karbon
  // Envanteri tab picks this up and opens the inventory on that question.
  const openInQuestionnaire = useCallback((item) => {
    try {
      sessionStorage.setItem('carboniq_open_request',
        JSON.stringify({ report_id: item.report_id, step_id: item.question_id }));
    } catch {}
    window.dispatchEvent(new CustomEvent('carboniq-navigate', { detail: { tab: 'questionnaire' } }));
  }, []);

  // `id` may be several entries: one inventory save's rows, one per answer
  // they belong to (approving one row of an answer approves all its rows).
  const handleApprove = useCallback(async (id, type) => {
    setProcessing(Array.isArray(id) ? id.join(',') : id);
    try {
      let res;
      for (const one of (Array.isArray(id) ? id : [id])) {
        res = type === 'advisor'
          ? await api.approveAdvisorApproval(one, 'approve')
          : await api.approveEntry(one, 'approve');
        if (!res.ok) break;
      }
      const body = res.ok ? await res.clone().json().catch(() => ({})) : {};
      if (res.ok && body.status === 'deleted') toast.success(tr ? 'Kayıt silindi ✓' : 'Entry deleted ✓');
      else if (res.ok) toast.success(tr ? 'Kayıt onaylandı ✓' : 'Entry approved ✓');
      else toast.error(res.status === 403 ? noPermissionMessage(tr) : (tr ? 'Onay başarısız' : 'Approval failed'));
      await fetchPending();
      if (fetchData) fetchData();
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setProcessing(null);
    }
  }, [tr, toast, fetchPending, fetchData]);

  // "Tümünü onayla" for new entries (twelve months of bills): one confirm
  // instead of one click each. Changes to an approved value and inventory
  // answers stay one by one — those are reviewed against what they replace.
  const bulkEntries = pending.filter(e => !e.replaces && !e.delete_requested && !(e.description || '').startsWith('Questionnaire step'));
  const bulkKg = bulkEntries.reduce((sum, e) => sum + Number(e.calculated_co2e_kg || 0), 0);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const handleApproveAllEntries = useCallback(async () => {
    setConfirmBulk(false);
    setProcessing('entries-all');
    let ok = 0, failed = 0;
    try {
      for (const e of bulkEntries) {
        const res = await api.approveEntry(e.id, 'approve');
        if (res.ok) ok += 1; else failed += 1;
      }
      if (ok) toast.success(tr ? `${ok} kayıt onaylandı ✓` : `${ok} entries approved ✓`);
      if (failed) toast.error(tr ? `${failed} kayıt onaylanamadı` : `${failed} entries could not be approved`);
      await fetchPending();
      if (fetchData) fetchData();
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setProcessing(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, tr, toast, fetchPending, fetchData]);

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    const { id, type } = rejectTarget;
    const reason = rejectReason;   // capture before clearing state
    setProcessing(Array.isArray(id) ? id.join(',') : id);
    setRejectTarget(null);
    setRejectReason('');
    try {
      let res;
      for (const one of (Array.isArray(id) ? id : [id])) {
        res = type === 'advisor'
          ? await api.approveAdvisorApproval(one, 'reject', reason)
          : await api.approveEntry(one, 'reject', reason);
        if (!res.ok) break;
      }
      const body = res.ok ? await res.clone().json().catch(() => ({})) : {};
      if (res.ok && body.status === 'kept') toast.info(tr ? 'Silme talebi reddedildi — kayıt kalıyor' : 'Deletion refused — the entry stays');
      else if (res.ok) toast.warning(tr ? 'Kayıt reddedildi' : 'Entry rejected');
      else toast.error(res.status === 403 ? noPermissionMessage(tr) : (tr ? 'Red işlemi başarısız' : 'Rejection failed'));
      await fetchPending();
      if (fetchData) fetchData();
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setProcessing(null);
    }
  }, [rejectTarget, rejectReason, tr, toast, fetchPending, fetchData]);

  // One inventory can raise a dozen flags (every Scope 3 category answered
  // "No" is one); approving them one by one was the only way. Each inventory
  // gets a single "approve all", behind a confirmation listing the count.
  const advisorByReport = advisorPending.reduce((acc, item) => {
    const g = acc.find(x => x.report_id === item.report_id);
    if (g) g.items.push(item);
    else acc.push({ report_id: item.report_id, title: item.report_title, items: [item] });
    return acc;
  }, []);

  const handleApproveAll = useCallback(async (group) => {
    const ok = window.confirm(tr
      ? `"${group.title}" envanterindeki ${group.items.length} danışman onayının tümü onaylanacak. Her birinin cevabın bilerek verildiği anlamına geldiğini doğruluyor musunuz?`
      : `All ${group.items.length} advisor approvals of "${group.title}" will be approved. Do you confirm each answer was given on purpose?`);
    if (!ok) return;
    setProcessing(`report-${group.report_id}`);
    let failed = 0;
    let forbidden = false;
    try {
      for (const item of group.items) {
        const res = await api.approveAdvisorApproval(item.id, 'approve');
        if (!res.ok) { failed += 1; if (res.status === 403) forbidden = true; }
      }
      if (forbidden) toast.error(noPermissionMessage(tr));
      else if (failed) toast.error(tr ? `${failed} onay başarısız oldu` : `${failed} approvals failed`);
      else toast.success(tr ? `${group.items.length} onay verildi ✓` : `${group.items.length} approved ✓`);
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      await fetchPending();
      if (fetchData) fetchData();
      setProcessing(null);
    }
  }, [tr, toast, fetchPending, fetchData]);

  const totalPending = pending.length + advisorPending.length;

  // A data-entry member's one inventory save can leave several rows waiting
  // (the answer they changed, and rows it recalculated elsewhere): they are
  // one change, shown and approved together.
  const stepOf = (e) => ((e.description || '').match(/^Questionnaire step (\S+)/) || [])[1];
  const pendingItems = (() => {
    const out = [];
    const byBatch = new Map();
    for (const e of pending) {
      if (e.change_batch) {
        if (!byBatch.has(e.change_batch)) {
          const item = { batch: e.change_batch, rows: [] };
          byBatch.set(e.change_batch, item);
          out.push(item);
        }
        byBatch.get(e.change_batch).rows.push(e);
      } else out.push({ entry: e });
    }
    return out;
  })();

  const renderEntry = (entry, inBatch = false) => (
                <div key={`entry-${entry.id}`} data-review-entry-id={entry.id} className={`${inBatch
                  ? 'rounded-xl border border-[#072C0E]/8 bg-white px-3 py-2.5'
                  : 'rounded-[1.25rem] border border-[#072C0E]/10 bg-white p-3.5 shadow-sm transition hover:shadow-[0_6px_20px_rgba(7,44,14,0.07)]'}${focusId === entry.id ? ' ring-2 ring-[#2ABD41]' : ''}`}>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="truncate text-sm font-bold text-[#072C0E]">
                        {entry.delete_requested && (
                          <span className="mr-1.5 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[10px] font-bold text-amber-800">
                            {tr ? 'Silme talebi' : 'Deletion request'}
                          </span>
                        )}
                        {tr && entry.emission_factor_name_tr ? entry.emission_factor_name_tr : entry.emission_factor_name}
                      </h3>
                      {entry.delete_requested && (
                        <p className="text-[11px] text-[#072C0E]/55">
                          {canApprove
                            ? (tr ? 'Onaylarsanız kayıt silinir; reddederseniz kalır. Onaylanana kadar toplamlarda kalır.'
                                  : 'Approving deletes the entry; rejecting keeps it. Until approved it stays in the totals.')
                            : (tr ? 'Onaycı onaylarsa kayıt silinir; reddederse kalır. Onaylanana kadar toplamlarda kalır.'
                                  : 'If an approver approves, the entry is deleted; if they reject, it stays. Until approved it stays in the totals.')}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          entry.scope === 'scope1' ? 'bg-[#072C0E]/10 text-[#072C0E]' :
                          entry.scope === 'scope2' ? 'bg-[#2ABD41]/15 text-[#175022]' :
                          'bg-[#8BEA99]/18 text-[#175022]'
                        }`}>{entry.scope?.replace('scope', 'S')}</span>
                        <span className="text-[11px] font-semibold text-[#072C0E]/50">{num(entry.quantity, tr)} {unitLabel(entry.unit, tr)}</span>
                        <span className="text-[11px] font-bold text-[#2ABD41]">{num(entry.calculated_co2e_kg, tr, 1)} kg CO₂e</span>
                        <span className="text-[10px] text-[#072C0E]/45">
                          {entryPeriodLabel(entry, tr ? MONTHS_TR : MONTHS_EN, tr)} {entry.year}
                        </span>
                        {entry.facility_name && (
                          <span className="text-[10px] font-semibold text-[#072C0E]/60">
                            {tr ? 'Tesis' : 'Facility'}: {entry.facility_name}
                          </span>
                        )}
                        <FactorCountryBadge entry={entry} tr={tr} />
                        {entry.proof_document && (
                          <button
                            type="button"
                            onClick={() => downloadProofDocument(entry.id, toast, tr)}
                            className={`inline-flex items-center gap-1 text-[10px] font-bold hover:underline ${entry.proof_available === false ? 'text-amber-600' : 'text-[#1D9C31]'}`}
                          >
                            <Paperclip className="h-3 w-3" />
                            {entry.proof_available === false
                              ? (tr ? 'Belge sunucuda yok' : 'File missing on the server')
                              : (tr ? 'Belgeyi aç' : 'Open document')}
                          </button>
                        )}
                        {entry.description && !autoDescriptionLabel(entry.description, tr) && (
                          <span className="w-full text-[11px] italic text-[#072C0E]/60">“{entry.description}”</span>
                        )}
                        {entry.replaces_entry && entry.replaces && (
                          // A form entry's change: what else moved besides the amount.
                          <>
                            {(entry.replaces.month !== entry.month || entry.replaces.year !== entry.year) && (
                              <span className="w-full text-[11px] font-semibold text-[#175022]">
                                {tr ? 'Dönem' : 'Period'}: {(tr ? MONTHS_TR : MONTHS_EN)[entry.replaces.month - 1]} {entry.replaces.year} → {(tr ? MONTHS_TR : MONTHS_EN)[entry.month - 1]} {entry.year}
                              </span>
                            )}
                            {(entry.replaces.facility ?? null) !== (entry.facility ?? null) && (
                              <span className="w-full text-[11px] font-semibold text-[#175022]">
                                {tr ? 'Tesis' : 'Facility'}: {entry.replaces.facility_name || '—'} → {entry.facility_name || '—'}
                              </span>
                            )}
                          </>
                        )}
                        {entry.replaces && !entry.replaces_entry && entry.replaces.quantity != null
                          && Number(entry.replaces.quantity) === Number(entry.quantity) && entry.replaces.unit === entry.unit
                          && Math.abs(Number(entry.calculated_co2e_kg) - entry.replaces.co2e_kg) < 0.05 ? (
                          // Another facility of the same answer, not changed itself:
                          // it is approved with the changed rows.
                          <span className="w-full text-[11px] text-[#072C0E]/50">
                            {tr ? 'Bu satır değişmedi — aynı cevabın diğer satırlarıyla birlikte onaylanır.' : 'This row did not change — it is approved together with the rest of the answer.'}
                          </span>
                        ) : entry.replaces && !(entry.replaces_entry && Number(entry.replaces.quantity) === Number(entry.quantity)) && (
                          // An inventory answer changed: what it replaces, which
                          // stays in the totals until this is approved.
                          <span className="w-full text-[11px] font-semibold text-[#175022]">
                            {tr ? 'Değişiklik' : 'Change'}:{' '}
                            {(() => {
                              // Same amount, another factor (e.g. a grid connection chosen): the CO₂e is what changed.
                              const byAmount = entry.replaces.quantity != null
                                && !(Number(entry.replaces.quantity) === Number(entry.quantity) && entry.replaces.unit === entry.unit);
                              return byAmount
                                ? `${num(entry.replaces.quantity, tr)} ${unitLabel(entry.replaces.unit, tr)} → ${num(entry.quantity, tr)} ${unitLabel(entry.unit, tr)}`
                                : `${num(entry.replaces.co2e_kg, tr, 1)} kg CO₂e → ${num(entry.calculated_co2e_kg, tr, 1)} kg CO₂e`;
                            })()}
                            {' '}({(Number(entry.calculated_co2e_kg) - entry.replaces.co2e_kg) >= 0 ? '+' : '−'}{num(Math.abs(Number(entry.calculated_co2e_kg) - entry.replaces.co2e_kg), tr, 1)} kg CO₂e)
                            <span className="font-normal text-[#072C0E]/45"> · {tr ? 'onaylanana kadar önceki değer toplamlarda kalır' : 'the previous value stays in the totals until approved'}</span>
                          </span>
                        )}
                        {entry.replaces?.proof_carried && (
                          // The proof came from the approved row this one replaces.
                          <span className="w-full text-[11px] font-semibold text-amber-700">
                            {tr ? 'Kanıt belgesi önceki değerden taşındı — yeni değere ait olmayabilir.'
                                : 'The proof document was carried over from the previous value — it may not belong to the new value.'}
                          </span>
                        )}
                        {(entry.description || '').startsWith('Questionnaire step') && (
                          <span className="w-full truncate text-[10px] text-[#072C0E]/45" title={entrySourceLabel(entry, tr)}>{entrySourceLabel(entry, tr)}</span>
                        )}
                        {(entry.entered_by || (entry.description || '').startsWith('Questionnaire step')) && (
                          <span className="text-[10px] text-[#072C0E]/45">
                            {(entry.description || '').startsWith('Questionnaire step')
                              ? (tr ? 'Kaynak: Anket' : 'Source: Questionnaire')
                              : null}
                            {(entry.description || '').startsWith('Questionnaire step') && entry.entered_by ? ' · ' : ''}
                            {entry.entered_by ? `${tr ? 'Giren' : 'Entered by'}: ${entry.entered_by}` : ''}
                          </span>
                        )}
                        {/* The author was warned the year's inventory already
                            holds this source, and sent it anyway. */}
                        {entry.overlap_warning && (
                          <p role="note" className="w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-amber-800">
                            ⚠ {tr ? entry.overlap_warning.tr : entry.overlap_warning.en}
                          </p>
                        )}
                      </div>
                    </div>
                    {canApprove && !inBatch && <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => handleApprove(entry.id, 'entry')}
                        disabled={processing === entry.id}
                        className="inline-flex items-center gap-1 rounded-full bg-[#2ABD41]/12 px-3 py-2 text-[11px] font-bold text-[#175022] transition hover:bg-[#2ABD41]/22 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        {entry.delete_requested ? (tr ? 'Silmeyi onayla' : 'Approve deletion') : (tr ? 'Onayla' : 'Approve')}
                      </button>
                      <button
                        onClick={() => setRejectTarget({ id: entry.id, type: 'entry' })}
                        disabled={processing === entry.id}
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-2 text-[11px] font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                        {tr ? 'Reddet' : 'Reject'}
                      </button>
                    </div>}
                  </div>
                </div>
  );

  const renderBatch = ({ batch, rows }) => {
    const reps = [...new Map(rows.map(r => [stepOf(r) || r.id, r.id])).values()];
    const busy = processing === reps.join(',');
    // Approved rows the change removes with nothing in their place (e.g. a
    // facility whose electricity is no longer calculated).
    const removed = [...new Map(rows.flatMap(r => r.removed_by_change || []).map(x => [x.id, x])).values()];
    const delta = rows.reduce((sum, r) => sum + Number(r.calculated_co2e_kg || 0) - (r.replaces ? Number(r.replaces.co2e_kg || 0) : 0), 0)
      - removed.reduce((sum, x) => sum + Number(x.co2e_kg || 0), 0);
    const main = rows[0];
    const sign = delta >= 0 ? '+' : '−';
    // A small change in kg: "−0 tCO₂e" reads as no change.
    const effect = Math.abs(delta) < 10
      ? `${sign}${num(Math.abs(delta), tr, 1)} kg CO₂e`
      : `${sign}${num(Math.abs(delta) / 1000, tr, 2)} tCO₂e`;
    return (
      <div key={`batch-${batch}`} className="rounded-[1.25rem] border border-[#2ABD41]/30 bg-green-50 p-3.5 shadow-sm">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#175022]/55">
              {tr ? 'Envanter cevabı değişikliği' : 'Inventory answer change'}
            </p>
            <h3 className="text-sm font-bold text-[#072C0E]">
              {main.change_question} {tr ? 'değiştirildi' : 'changed'}
              {main.entered_by && <span className="font-semibold text-[#072C0E]/50"> · {main.entered_by}</span>}
            </h3>
            <p className="text-[11px] text-[#072C0E]/60">
              {tr
                ? `Etkisi: ${effect} · ${rows.length} satır birlikte onaylanır; onaylanana kadar önceki değerler toplamlarda kalır.`
                : `Effect: ${effect} · ${rows.length} rows are approved together; until then the previous values stay in the totals.`}
            </p>
            {removed.length > 0 && (
              <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
                <p className="font-semibold">
                  {tr ? 'Onaylanınca toplamlardan çıkar (yerine yeni satır yok):' : 'Removed from the totals on approval (no new row takes its place):'}
                </p>
                <ul className="mt-0.5 list-disc pl-4">
                  {removed.map(x => (
                    <li key={x.id}>
                      {[x.facility_name, (tr && x.factor_name_tr) || x.factor_name].filter(Boolean).join(' — ')} · {num(x.quantity, tr)} {unitLabel(x.unit, tr)} (−{num(x.co2e_kg, tr, 1)} kg CO₂e)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {canApprove && <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => handleApprove(reps, 'entry')}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full bg-[#2ABD41]/12 px-3 py-2 text-[11px] font-bold text-[#175022] transition hover:bg-[#2ABD41]/22 disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {tr ? 'Değişikliği onayla' : 'Approve change'}
            </button>
            <button
              onClick={() => setRejectTarget({ id: reps, type: 'entry' })}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-2 text-[11px] font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
            >
              <X className="h-3 w-3" />
              {tr ? 'Reddet' : 'Reject'}
            </button>
          </div>}
        </div>
        <div className="mt-2.5 space-y-1.5">{rows.map(r => renderEntry(r, true))}</div>
      </div>
    );
  };

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

      {!canApprove && (
        <p className="rounded-xl border border-[#072C0E]/10 bg-smoke px-3 py-2 text-[11px] font-semibold text-[#072C0E]/55">
          {tr
            ? 'Kayıtları yalnızca şirket sahibi, yönetici veya müdür onaylayabilir. Buradan durumlarını takip edebilirsiniz.'
            : 'Only the company owner, admins and managers can approve entries. You can follow their status here.'}
        </p>
      )}

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
          {/* Both lists waiting: say so up top, with a way to each. */}
          {pending.length > 0 && advisorPending.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1">
              <button type="button" onClick={() => jumpTo('review-entries')}
                className="rounded-full border border-[#2ABD41]/40 bg-white px-3 py-1.5 text-[11px] font-bold text-[#175022] hover:bg-[#F1FCF2]">
                {tr ? `Kayıtlar (${pending.length})` : `Entries (${pending.length})`}
              </button>
              <button type="button" onClick={() => jumpTo('review-advisor')}
                className="rounded-full border border-[#072C0E]/12 bg-white px-3 py-1.5 text-[11px] font-bold text-[#072C0E]/70 hover:bg-smoke">
                {tr ? `Danışman onayı (${advisorPending.length})` : `Advisor approval (${advisorPending.length})`}
              </button>
            </div>
          )}

          {/* ── Emission entries (manual dashboard data-entry approvals) ────── */}
          {pending.length > 0 && (
            <div id="review-entries" className="scroll-mt-20 space-y-2">
              {advisorPending.length > 0 && (
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <ClipboardCheck className="h-3.5 w-3.5 text-[#2ABD41]" />
                  <h2 className="text-xs font-bold uppercase tracking-wide text-[#072C0E]/60">
                    {tr ? 'Emisyon Kayıtları' : 'Emission Entries'} ({pending.length})
                  </h2>
                </div>
              )}
              {canApprove && bulkEntries.length > 1 && (
                <div className="flex flex-wrap gap-2 px-1">
                  <button
                    type="button"
                    disabled={processing !== null}
                    onClick={() => setConfirmBulk(true)}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#2ABD41]/40 bg-white px-3 py-1.5 text-[11px] font-bold text-[#175022] hover:bg-[#F1FCF2] disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {processing === 'entries-all'
                      ? (tr ? 'Onaylanıyor…' : 'Approving…')
                      : (tr ? `Yeni kayıtların tümünü onayla (${bulkEntries.length})` : `Approve all new entries (${bulkEntries.length})`)}
                  </button>
                </div>
              )}
              {pendingItems.map(item => (item.rows ? renderBatch(item) : renderEntry(item.entry)))}
            </div>
          )}

          {/* ── Danışman Onayı (Advisor Approval) ─────────────────────────── */}
          {advisorPending.length > 0 && (
            <div id="review-advisor" className="scroll-mt-20 space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <ShieldAlert className="h-3.5 w-3.5 text-[#2ABD41]" />
                <h2 className="text-xs font-bold uppercase tracking-wide text-[#072C0E]/60">
                  {tr ? 'Danışman Onayı' : 'Advisor Approval'} ({advisorPending.length})
                </h2>
              </div>
              <p className="px-1 text-[11px] leading-5 text-[#072C0E]/55">
                {tr
                  ? 'Anketteki bazı cevaplar ISO 14064-1 doğrulamasında açıklama gerektirir. Onaylarsanız cevabın bilerek verildiği kaydedilir; reddederseniz cevabın gözden geçirilip düzeltilmesi gerektiği not edilir. Aynı kural her envanter için ayrı listelenir.'
                  : 'Some questionnaire answers need a justification in an ISO 14064-1 verification. Approving records that the answer was given on purpose; rejecting notes that it must be reviewed and corrected. Each inventory is listed separately.'}
              </p>
              {canApprove && advisorByReport.some(g => g.items.length > 1) && (
                <div className="flex flex-wrap gap-2 px-1">
                  {advisorByReport.filter(g => g.items.length > 1).map(g => (
                    <button
                      key={`all-${g.report_id}`}
                      type="button"
                      disabled={processing !== null}
                      onClick={() => handleApproveAll(g)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#2ABD41]/40 bg-white px-3 py-1.5 text-[11px] font-bold text-[#175022] hover:bg-[#F1FCF2] disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {processing === `report-${g.report_id}`
                        ? (tr ? 'Onaylanıyor…' : 'Approving…')
                        : (tr ? `${g.title} — tümünü onayla (${g.items.length})` : `${g.title} — approve all (${g.items.length})`)}
                    </button>
                  ))}
                </div>
              )}
              {advisorPending.map(item => { const reason = advisorReasonText(item, tr); const given = formatAdvisorAnswer(item.question_id, item.answer, tr); return (
                <div key={`advisor-${item.id}`} className="rounded-[1.25rem] border border-[#072C0E]/10 bg-white p-3.5 shadow-sm transition hover:shadow-[0_6px_20px_rgba(7,44,14,0.07)]">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="text-sm font-bold text-[#072C0E]">
                        {reason.text}
                      </h3>
                      {reason.question && (
                        <p className="line-clamp-2 text-[11px] text-[#072C0E]/55">{reason.question}</p>
                      )}
                      {given && (
                        <p className="rounded-lg bg-[#F1FCF2] px-2.5 py-1.5 text-[11px] leading-5 text-[#072C0E]/75">
                          <span className="font-bold text-[#072C0E]">{tr ? 'Verilen cevap: ' : 'Answer given: '}</span>{given}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${RISK_STYLES[item.risk_level] || 'bg-[#072C0E]/10 text-[#072C0E]'}`}>
                          {tr ? (RISK_LABELS_TR[item.risk_level] || item.risk_level) : item.risk_level?.replace('_', '-')}
                        </span>
                        <span className="text-[11px] font-semibold text-[#072C0E]/50">{advisorCategoryLabel(item.trigger_category, tr)}</span>
                        <span className="text-[10px] text-[#072C0E]/45">
                          {tr ? 'Envanter' : 'Inventory'}: {item.report_title}
                          {item.reporting_year ? ` (${tr ? 'raporlama yılı' : 'reporting year'} ${item.reporting_year})` : ''}
                        </span>
                        {/* The question and its answer are shown above; opening the
                            survey is for changing the answer, which a read-only
                            role (auditor) can't do. */}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openInQuestionnaire(item)}
                            className="text-[10px] font-bold text-[#2ABD41] hover:underline"
                          >
                            {tr ? 'Ankette aç →' : 'Open in questionnaire →'}
                          </button>
                        )}
                      </div>
                    </div>
                    {canApprove && <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => handleApprove(item.id, 'advisor')}
                        disabled={processing === item.id || String(processing).startsWith("report-")}
                        className="inline-flex items-center gap-1 rounded-full bg-[#2ABD41]/12 px-3 py-2 text-[11px] font-bold text-[#175022] transition hover:bg-[#2ABD41]/22 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />
                        {tr ? 'Onayla' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setRejectTarget({ id: item.id, type: 'advisor' })}
                        disabled={processing === item.id || String(processing).startsWith("report-")}
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-2 text-[11px] font-bold text-red-500 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                        {tr ? 'Reddet' : 'Reject'}
                      </button>
                    </div>}
                  </div>
                </div>
              ); })}
            </div>
          )}

        </>
      )}

      <ConfirmDialog
        open={confirmBulk}
        language={tr ? 'tr' : 'en'}
        title={tr ? 'Yeni kayıtların tümü onaylansın mı?' : 'Approve all new entries?'}
        message={tr
          ? `${bulkEntries.length} kayıt (toplam ${num(bulkKg / 1000, tr, 3)} tCO₂e) onaylanır ve toplamlara eklenir. Mevcut bir değeri değiştiren kayıtlar ile anket cevapları bu işleme dahil değildir; onları tek tek inceleyin.`
          : `${bulkEntries.length} entries (${num(bulkKg / 1000, tr, 3)} tCO₂e in total) are approved and added to the totals. Changes to an existing value and questionnaire answers are not included; review those one by one.`}
        confirmText={tr ? 'Tümünü onayla' : 'Approve all'}
        cancelText={tr ? 'İptal' : 'Cancel'}
        onConfirm={handleApproveAllEntries}
        onCancel={() => setConfirmBulk(false)}
      />

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
              className="mt-3 w-full rounded-xl border border-[#072C0E]/10 bg-smoke px-3.5 py-2.5 text-xs text-[#072C0E] outline-none placeholder:text-[#072C0E]/30 focus:ring-4 focus:ring-[#2ABD41]/15"
              rows={3}
            />
            <div className="mt-4 flex gap-2">
              <button onClick={handleReject} className="flex-1 rounded-full btn-danger py-2.5 text-xs font-bold transition">{tr ? 'Reddet' : 'Reject'}</button>
              <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="flex-1 rounded-full btn-secondary py-2.5 text-xs font-bold transition">{tr ? 'İptal' : 'Cancel'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
