'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';

export default function NotificationPreferences({ language, user }) {
  const [approvals, setApprovals] = useState(user?.notify_approvals ?? true);
  const [saving, setSaving] = useState(false);

  // Sync checkboxes when the parent delivers the user profile asynchronously
  // (the initial useState snapshot may be undefined if user hasn't loaded yet).
  useEffect(() => {
    setApprovals(user?.notify_approvals ?? true);
  }, [user]);

  const tr    = language === 'tr';
  const toast = useToast();

  const handleSave = useCallback(async () => {
    // Fix 26C: prevent double-invoke on rapid click before state updates
    if (saving) return;
    setSaving(true);
    try {
      const res = await api.updateProfile({ notify_approvals: approvals });
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
  }, [approvals, saving, tr, toast]);

  return (
    <div className="space-y-3 max-w-md">
      {/* The only switch the backend honours (emissions/notifications.py).
          A "system notifications" switch used to sit here too; it was saved
          but nothing ever read it, so turning it off changed nothing. */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={approvals} onChange={e => setApprovals(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#2ABD41] rounded" />
        <span>
          <span className="block text-sm text-[#072C0E]">{tr ? 'Kayıt onay bildirimleri' : 'Entry approval notifications'}</span>
          <span className="block text-xs text-[#072C0E]/50">
            {tr
              ? 'Onayınızı bekleyen yeni kayıtlar ile kayıtlarınızın onaylanması veya reddedilmesi. Kapalıyken bu bildirimler gelmez.'
              : 'New entries waiting for your approval, and your own entries being approved or rejected. When off, these notifications are not sent.'}
          </span>
        </span>
      </label>
      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-[#175022] text-white rounded-xl text-sm hover:bg-[#175022] disabled:opacity-60"
      >
        {saving ? (tr ? 'Kaydediliyor…' : 'Saving…') : (tr ? 'Kaydet' : 'Save')}
      </button>
    </div>
  );
}
