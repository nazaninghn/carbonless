'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';

export default function NotificationPreferences({ language, user }) {
  const [approvals, setApprovals] = useState(user?.notify_approvals ?? true);
  const [system, setSystem] = useState(user?.notify_system ?? true);
  const [saving, setSaving] = useState(false);

  // Sync checkboxes when the parent delivers the user profile asynchronously
  // (the initial useState snapshot may be undefined if user hasn't loaded yet).
  useEffect(() => {
    setApprovals(user?.notify_approvals ?? true);
    setSystem(user?.notify_system ?? true);
  }, [user]);

  const tr    = language === 'tr';
  const toast = useToast();

  const handleSave = useCallback(async () => {
    // Fix 26C: prevent double-invoke on rapid click before state updates
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.updateProfile({ notify_approvals: approvals, notify_system: system });
      if (res.ok) {
        toast.success(tr ? 'Bildirim tercihleri kaydedildi ✓' : 'Notification preferences saved ✓');
      } else {
        toast.error(tr ? 'Kaydedilemedi' : 'Failed to save');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setSaving(false);
    }
  }, [approvals, system, saving, tr, toast]);

  return (
    <div className="space-y-3 max-w-md">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={approvals} onChange={e => setApprovals(e.target.checked)} className="w-4 h-4 accent-[#51B291] rounded" />
        <span className="text-sm text-[#302817]">{tr ? 'Onay bildirimleri' : 'Approval notifications'}</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={system} onChange={e => setSystem(e.target.checked)} className="w-4 h-4 accent-[#51B291] rounded" />
        <span className="text-sm text-[#302817]">{tr ? 'Sistem bildirimleri' : 'System notifications'}</span>
      </label>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[#244959] text-white rounded-xl text-sm hover:bg-[#1a3a2e] disabled:opacity-60"
      >
        {saving ? (tr ? 'Kaydediliyor…' : 'Saving…') : (tr ? 'Kaydet' : 'Save')}
      </button>
    </div>
  );
}
