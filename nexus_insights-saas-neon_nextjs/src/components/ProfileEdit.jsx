'use client';
import { useState } from 'react';
import { api } from '@/lib/utils/api';

export default function ProfileEdit({ language, user, onUpdate }) {
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await api.updateProfile({ first_name: firstName, last_name: lastName, phone, department });
    if (res.ok) {
      setMsg(language === 'tr' ? 'Kaydedildi' : 'Saved');
      if (onUpdate) onUpdate();
    }
    setSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-3 max-w-md">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">{language === 'tr' ? 'Ad' : 'First Name'}</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">{language === 'tr' ? 'Soyad' : 'Last Name'}</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">{language === 'tr' ? 'Telefon' : 'Phone'}</label>
        <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">{language === 'tr' ? 'Departman' : 'Department'}</label>
        <input type="text" value={department} onChange={e => setDepartment(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      </div>
      {msg && <p className="text-sm text-green-600">{msg}</p>}
      <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-secondary disabled:opacity-60">
        {saving ? '...' : (language === 'tr' ? 'Kaydet' : 'Save')}
      </button>
    </form>
  );
}
