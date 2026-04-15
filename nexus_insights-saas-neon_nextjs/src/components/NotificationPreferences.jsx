'use client';
import { useState } from 'react';
import { api } from '@/lib/utils/api';

export default function NotificationPreferences({ language, user }) {
  const [approvals, setApprovals] = useState(user?.notify_approvals ?? true);
  const [system, setSystem] = useState(user?.notify_system ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await api.updateProfile({ notify_approvals: approvals, notify_system: system });
    setSaving(false);
  };

  return (
    <div className="space-y-3 max-w-md">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={approvals} onChange={e => setApprovals(e.target.checked)} className="w-4 h-4 text-primary rounded" />
        <span className="text-sm text-gray-700">{language === 'tr' ? 'Onay bildirimleri' : 'Approval notifications'}</span>
      </label>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={system} onChange={e => setSystem(e.target.checked)} className="w-4 h-4 text-primary rounded" />
        <span className="text-sm text-gray-700">{language === 'tr' ? 'Sistem bildirimleri' : 'System notifications'}</span>
      </label>
      <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-secondary disabled:opacity-60">
        {saving ? '...' : (language === 'tr' ? 'Kaydet' : 'Save')}
      </button>
    </div>
  );
}
