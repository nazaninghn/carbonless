'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';

export default function CompanySettings({ language }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
        const res = await fetch(`${API}/companies/detail/`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setCompany(data);
          setForm(data);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchCompany();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const res = await fetch(`${API}/companies/detail/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          legal_entity_name: form.legal_entity_name,
          tax_number: form.tax_number,
          country_of_headquarters: form.country_of_headquarters,
          nace_code: form.nace_code,
          main_activity_description: form.main_activity_description,
        }),
      });
      if (res.ok) { setCompany(await res.json()); setEditing(false); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;
  if (!company) return <p className="text-sm text-gray-500">{language === 'tr' ? 'Şirket bilgisi bulunamadı' : 'No company info found'}</p>;

  if (!editing) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: language === 'tr' ? 'Şirket Adı' : 'Company Name', val: company.legal_entity_name },
            { label: language === 'tr' ? 'Vergi No' : 'Tax Number', val: company.tax_number },
            { label: language === 'tr' ? 'Ülke' : 'Country', val: company.country_of_headquarters },
            { label: 'NACE', val: company.nace_code },
          ].map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{f.label}</p>
              <p className="text-sm font-medium text-gray-900">{f.val || '-'}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setEditing(true)} className="mt-4 px-4 py-2 text-sm text-primary border border-primary rounded-lg hover:bg-primary/10">
          {language === 'tr' ? 'Düzenle' : 'Edit'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {[
        { key: 'legal_entity_name', label: language === 'tr' ? 'Şirket Adı' : 'Company Name' },
        { key: 'tax_number', label: language === 'tr' ? 'Vergi No' : 'Tax Number' },
        { key: 'country_of_headquarters', label: language === 'tr' ? 'Ülke' : 'Country' },
        { key: 'nace_code', label: 'NACE' },
      ].map(f => (
        <div key={f.key}>
          <label className="block text-xs text-gray-600 mb-1">{f.label}</label>
          <input type="text" value={form[f.key] || ''} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-secondary disabled:opacity-60">
          {saving ? '...' : (language === 'tr' ? 'Kaydet' : 'Save')}
        </button>
        <button onClick={() => { setEditing(false); setForm(company); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          {language === 'tr' ? 'İptal' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
