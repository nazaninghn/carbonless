'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';
import { Building2, AlertCircle, CheckCircle2, Plus } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

async function fetchCompanyDetail() {
  const res = await fetch(`${API}/companies/detail/`, { credentials: 'include' });
  if (res.ok) return { company: await res.json(), status: res.status };
  return { company: null, status: res.status };
}

export default function CompanySettings({ language }) {
  const [company, setCompany]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm]         = useState({});
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');

  const tr    = language === 'tr';
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { company: c } = await fetchCompanyDetail();
      setCompany(c);
      if (c) setForm(c);
    } catch {
      toast.error(tr ? 'Şirket bilgileri yüklenemedi' : 'Failed to load company info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  /* ─── CREATE ─── */
  const handleCreate = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.legal_entity_name?.trim()) {
      setError(tr ? 'Şirket adı zorunludur' : 'Company name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.createCompany({
        legal_entity_name: form.legal_entity_name?.trim(),
        tax_number: form.tax_number?.trim() || '',
        country_of_headquarters: form.country_of_headquarters?.trim() || '',
        nace_code: form.nace_code?.trim() || '',
      });
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
        setForm(data);
        setCreating(false);
        setSuccess(tr ? 'Şirket başarıyla oluşturuldu ✓' : 'Company created successfully ✓');
        toast.success(tr ? 'Şirket oluşturuldu ✓' : 'Company created ✓');
        // Reload so FacilitySettings also picks up the new membership
        setTimeout(() => window.location.reload(), 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.legal_entity_name?.[0] || data?.detail || data?.error
          || Object.values(data || {}).flat().filter(Boolean).join(' ')
          || (tr ? 'Şirket oluşturulamadı' : 'Failed to create company');
        setError(String(msg));
        toast.error(String(msg));
      }
    } catch {
      const msg = tr ? 'Bağlantı hatası' : 'Connection error';
      setError(msg); toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /* ─── SAVE EDIT ─── */
  const handleSave = async () => {
    setError(''); setSuccess('');
    if (!form.legal_entity_name?.trim()) {
      setError(tr ? 'Şirket adı zorunludur' : 'Company name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/companies/detail/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          legal_entity_name: form.legal_entity_name,
          tax_number: form.tax_number || '',
          country_of_headquarters: form.country_of_headquarters || '',
          nace_code: form.nace_code || '',
          main_activity_description: form.main_activity_description || '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
        setForm(data);
        setEditing(false);
        setSuccess(tr ? 'Kaydedildi ✓' : 'Saved ✓');
        toast.success(tr ? 'Şirket bilgileri güncellendi ✓' : 'Company info updated ✓');
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.legal_entity_name?.[0] || data?.detail || data?.error
          || Object.values(data || {}).flat().filter(Boolean).join(' ')
          || (tr ? 'Kaydedilemedi' : 'Failed to save');
        setError(String(msg));
        toast.error(String(msg));
      }
    } catch {
      const msg = tr ? 'Bağlantı hatası' : 'Connection error';
      setError(msg); toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const field = (key) => form[key] || '';
  const set   = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-[#302817]/55">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#95A847]/40 border-t-[#95A847]" />
        {tr ? 'Yükleniyor…' : 'Loading…'}
      </div>
    );
  }

  /* ─── No company — create flow ─── */
  if (!company) {
    if (!creating) {
      return (
        <div className="rounded-2xl border border-[#B4BE6A]/30 bg-[#F9EFE5]/60 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B4BE6A]/20">
            <Building2 className="h-6 w-6 text-[#95A847]" />
          </div>
          <p className="text-sm font-bold text-[#302817]">
            {tr ? 'Henüz şirket profili oluşturulmamış' : 'No company profile yet'}
          </p>
          <p className="mt-1 text-xs text-[#302817]/55">
            {tr
              ? 'Tesis eklemek ve emisyon takibi yapabilmek için önce şirketinizi oluşturun.'
              : 'Create your company to start adding facilities and tracking emissions.'}
          </p>
          <button
            onClick={() => { setCreating(true); setForm({}); setError(''); }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#302817] px-5 py-2.5 text-sm font-bold text-white hover:bg-black"
          >
            <Plus className="h-4 w-4" />
            {tr ? 'Şirket Oluştur' : 'Create Company'}
          </button>
        </div>
      );
    }

    /* Create form */
    return (
      <form onSubmit={handleCreate} className="space-y-4" noValidate>
        <p className="text-xs font-bold uppercase tracking-wide text-[#302817]/50">
          {tr ? 'Yeni Şirket Profili' : 'New Company Profile'}
        </p>

        <FormField label={`${tr ? 'Şirket Adı' : 'Company Name'} *`}>
          <input
            type="text"
            value={field('legal_entity_name')}
            onChange={set('legal_entity_name')}
            placeholder={tr ? 'Örn. Acme Teknoloji A.Ş.' : 'e.g. Acme Technologies Ltd.'}
            className="w-full rounded-xl border border-[#302817]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#95A847] focus:bg-white focus:outline-none"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={tr ? 'Vergi No' : 'Tax Number'}>
            <input type="text" value={field('tax_number')} onChange={set('tax_number')} className="w-full rounded-xl border border-[#302817]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#95A847] focus:bg-white focus:outline-none" />
          </FormField>
          <FormField label={tr ? 'Merkez Ülkesi' : 'Country of HQ'}>
            <input type="text" value={field('country_of_headquarters')} onChange={set('country_of_headquarters')}
              placeholder={tr ? 'Türkiye' : 'Turkey'} className="w-full rounded-xl border border-[#302817]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#95A847] focus:bg-white focus:outline-none" />
          </FormField>
          <FormField label="NACE">
            <input type="text" value={field('nace_code')} onChange={set('nace_code')}
              placeholder="e.g. C29.10" className="w-full rounded-xl border border-[#302817]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#95A847] focus:bg-white focus:outline-none" />
          </FormField>
        </div>

        {error && <ErrorBox msg={error} />}
        {success && <SuccessBox msg={success} />}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#302817] px-5 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
          >
            {saving
              ? <><Spinner />{tr ? 'Oluşturuluyor…' : 'Creating…'}</>
              : (tr ? 'Şirket Oluştur' : 'Create Company')}
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setError(''); }}
            disabled={saving}
            className="rounded-xl border border-[#302817]/15 px-4 py-2.5 text-sm text-[#302817]/70 hover:bg-[#F8F8F8] disabled:opacity-60"
          >
            {tr ? 'İptal' : 'Cancel'}
          </button>
        </div>
      </form>
    );
  }

  /* ─── View mode ─── */
  if (!editing) {
    return (
      <div className="space-y-4">
        {success && <SuccessBox msg={success} />}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            { label: tr ? 'Şirket Adı' : 'Company Name', val: company.legal_entity_name },
            { label: tr ? 'Vergi No' : 'Tax Number',      val: company.tax_number },
            { label: tr ? 'Ülke' : 'Country',             val: company.country_of_headquarters },
            { label: 'NACE',                               val: company.nace_code },
          ].map((f, i) => (
            <div key={i} className="rounded-xl bg-[#F8F8F8] p-3">
              <p className="text-xs text-[#302817]/50">{f.label}</p>
              <p className="mt-0.5 text-sm font-medium text-[#302817]">{f.val || '—'}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setEditing(true); setError(''); setSuccess(''); }}
          className="rounded-xl border border-[#95A847] px-4 py-2 text-sm font-medium text-[#95A847] hover:bg-[#95A847]/8 transition"
        >
          {tr ? 'Düzenle' : 'Edit'}
        </button>
      </div>
    );
  }

  /* ─── Edit mode ─── */
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={`${tr ? 'Şirket Adı' : 'Company Name'} *`} full>
          <input type="text" value={field('legal_entity_name')} onChange={set('legal_entity_name')} className="w-full rounded-xl border border-[#302817]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#95A847] focus:bg-white focus:outline-none" />
        </FormField>
        <FormField label={tr ? 'Vergi No' : 'Tax Number'}>
          <input type="text" value={field('tax_number')} onChange={set('tax_number')} className="w-full rounded-xl border border-[#302817]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#95A847] focus:bg-white focus:outline-none" />
        </FormField>
        <FormField label={tr ? 'Merkez Ülkesi' : 'Country of HQ'}>
          <input type="text" value={field('country_of_headquarters')} onChange={set('country_of_headquarters')} className="w-full rounded-xl border border-[#302817]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#95A847] focus:bg-white focus:outline-none" />
        </FormField>
        <FormField label="NACE">
          <input type="text" value={field('nace_code')} onChange={set('nace_code')} className="w-full rounded-xl border border-[#302817]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#95A847] focus:bg-white focus:outline-none" />
        </FormField>
      </div>

      {error   && <ErrorBox msg={error} />}
      {success && <SuccessBox msg={success} />}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[#302817] px-5 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
        >
          {saving
            ? <><Spinner />{tr ? 'Kaydediliyor…' : 'Saving…'}</>
            : (tr ? 'Kaydet' : 'Save')}
        </button>
        <button
          onClick={() => { setEditing(false); setForm(company); setError(''); setSuccess(''); }}
          disabled={saving}
          className="rounded-xl border border-[#302817]/15 px-4 py-2.5 text-sm text-[#302817]/70 hover:bg-[#F8F8F8] disabled:opacity-60"
        >
          {tr ? 'İptal' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function FormField({ label, children, full = false }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1 block text-xs font-medium text-[#302817]/60">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
      <p className="text-xs text-red-700">{msg}</p>
    </div>
  );
}

function SuccessBox({ msg }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
      <p className="text-xs text-green-700">{msg}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}
