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

  const tr = language === 'tr';

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    const res = await api.updateProfile({
      first_name: firstName,
      last_name: lastName,
      phone,
      department,
    });

    if (res.ok) {
      setMsg(tr ? 'Kaydedildi' : 'Saved');
      if (onUpdate) onUpdate();
    }

    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSave}
      className="w-full max-w-full min-w-0 overflow-hidden"
    >
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={tr ? 'Ad' : 'First Name'} value={firstName} onChange={setFirstName} />
        <Field label={tr ? 'Soyad' : 'Last Name'} value={lastName} onChange={setLastName} />
      </div>

      <div className="mt-3 grid w-full min-w-0 grid-cols-1 gap-3">
        <Field label={tr ? 'Telefon' : 'Phone'} value={phone} onChange={setPhone} />
        <Field label={tr ? 'Departman' : 'Department'} value={department} onChange={setDepartment} />
      </div>

      <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {msg ? (
          <p className="rounded-full bg-[#B4BE6A]/15 px-3 py-2 text-xs font-bold text-[#75863B]">
            {msg}
          </p>
        ) : (
          <span />
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-[#302817] px-5 py-3 text-sm font-bold text-[#F9EFE5] shadow-lg shadow-[#302817]/10 transition hover:bg-black disabled:opacity-60 sm:w-auto"
        >
          {saving ? '...' : tr ? 'Kaydet' : 'Save'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="block w-full min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-[#302817]/55">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block h-11 w-full min-w-0 max-w-full rounded-2xl border border-[#302817]/10 bg-[#F8F8F8] px-4 text-sm font-semibold text-[#302817] outline-none transition placeholder:text-[#302817]/30 focus:border-[#95A847] focus:bg-white focus:ring-4 focus:ring-[#95A847]/15"
      />
    </label>
  );
}
