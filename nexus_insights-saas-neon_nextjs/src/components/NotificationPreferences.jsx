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
      {/* The only switch the backend honours (emissions/notifications.py) —
          e-mail only; the in-app notices always arrive.
          A "system notifications" switch used to sit here too; it was saved
          but nothing ever read it, so turning it off changed nothing. */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={approvals} onChange={e => setApprovals(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#2ABD41] rounded" />
        <span>
          <span className="block text-sm text-[#072C0E]">{tr ? 'Kayıt onay e-postaları' : 'Entry approval e-mails'}</span>
          <span className="block text-xs text-[#072C0E]/50">
            {tr
              ? 'Onayınızı bekleyen kayıtlar (günde en fazla bir e-posta) ve reddedilen kayıtlarınız (hemen) için e-posta. Kapalıyken e-posta gelmez; uygulama içi bildirimler (zil simgesi) her zaman gelir.'
              : 'E-mails about entries waiting for your approval (at most one a day) and your rejected entries (right away). When off, no e-mails are sent; in-app notifications (the bell) always arrive.'}
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
