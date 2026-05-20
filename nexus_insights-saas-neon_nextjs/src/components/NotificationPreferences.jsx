'use client';
import { useState, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';

export default function NotificationPreferences({ language, user }) {
  const [approvals, setApprovals] = useState(user?.notify_approvals ?? true);
  const [system, setSystem] = useState(user?.notify_system ?? true);
  const [saving, setSaving] = useState(false);

  const tr    = language === 'tr';
  const toast = useToast();

  const handleSave = useCallback(async () => {
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
  }, [approvals, system, tr, toast]);

  return (
    <div className="space-y-3 max-w-md">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={approvals} onChange={e => setApprovals(e.target.checked)} className="w-4 h-4 text-[#95A847] rounded" />
        <span className="text-sm text-[#302817]">{tr ? 'Onay bildirimleri' : 'Approval notifications'}</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={system} onChange={e => setSystem(e.target.checked)} className="w-4 h-4 text-[#95A847] rounded" />
        <span className="text-sm text-[#302817]">{tr ? 'Sistem bildirimleri' : 'System notifications'}</span>
      </label>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[#302817] text-white rounded-xl text-sm hover:bg-black disabled:opacity-60"
      >
        {saving ? (tr ? 'Kaydediliyor…' : 'Saving…') : (tr ? 'Kaydet' : 'Save')}
      </button>
    </div>
  );
}
