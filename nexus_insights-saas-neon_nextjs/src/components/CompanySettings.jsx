'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';
import { Building2, AlertCircle, CheckCircle2, Plus } from 'lucide-react';

// fetchCompanyDetail now uses api.getCompanyDetail() so it automatically carries
// the Bearer token + 401 auto-refresh, matching every other API call in the app.

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCompanyDetail();
      const c = res.ok ? await res.json() : null;
      setCompany(c);
      if (c) {
        setForm(c);
        // Company now exists — clear any pending data from registration
        try { sessionStorage.removeItem('pendingCompany'); } catch {}
      } else {
        // No company yet — check if registration saved a pending payload
        try {
          const raw = sessionStorage.getItem('pendingCompany');
          if (raw) {
            const pending = JSON.parse(raw);
            // Pre-fill the create form with data from registration
            setForm({
              legal_entity_name: pending.legal_entity_name || '',
              tax_number: pending.tax_number || '',
              country_of_headquarters: pending.country_of_headquarters || '',
              nace_code: pending.nace_code || '',
              main_activity_description: pending.main_activity_description || '',
            });
            setCreating(true); // Open the form immediately
          }
        } catch {}
      }
    } catch {
      toast.error(tr ? 'Şirket bilgileri yüklenemedi' : 'Failed to load company info');
    } finally {
      setLoading(false);
    }
  }, [tr, toast]);

  useEffect(() => { load(); }, [load]);

  /* ─── CREATE ─── */
  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    // Fix 28B: prevent double-submit before React flushes the disabled state
    if (saving) return;
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
        try { sessionStorage.removeItem('pendingCompany'); } catch {}
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
  }, [form, saving, tr, toast]); // saving added — read inside guard

  /* ─── SAVE EDIT ─── */
  const handleSave = useCallback(async () => {
    // Fix 28B: prevent double-submit before React flushes the disabled state
    if (saving) return;
    setError(''); setSuccess('');
    if (!form.legal_entity_name?.trim()) {
      setError(tr ? 'Şirket adı zorunludur' : 'Company name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateCompany({
        legal_entity_name: form.legal_entity_name,
        tax_number: form.tax_number || '',
        country_of_headquarters: form.country_of_headquarters || '',
        nace_code: form.nace_code || '',
        main_activity_description: form.main_activity_description || '',
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
  }, [form, saving, tr, toast]); // saving added — read inside guard

  const field = (key) => form[key] || '';
  const set   = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }));

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-[#072C0E]/55">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#2ABD41]/40 border-t-[#2ABD41]" />
        {tr ? 'Yükleniyor…' : 'Loading…'}
      </div>
    );
  }

  /* ─── No company — create flow ─── */
  if (!company) {
    if (!creating) {
      return (
        <div className="rounded-2xl border border-[#8BEA99]/30 bg-[#DEFAE1]/60 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8BEA99]/20">
            <Building2 className="h-6 w-6 text-[#2ABD41]" />
          </div>
          <p className="text-sm font-bold text-[#072C0E]">
            {tr ? 'Henüz şirket profili oluşturulmamış' : 'No company profile yet'}
          </p>
          <p className="mt-1 text-xs text-[#072C0E]/55">
            {tr
              ? 'Tesis eklemek ve emisyon takibi yapabilmek için önce şirketinizi oluşturun.'
              : 'Create your company to start adding facilities and tracking emissions.'}
          </p>
          <button
            onClick={() => { setCreating(true); setForm({}); setError(''); }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#072C0E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#175022]"
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
        <p className="text-xs font-bold uppercase tracking-wide text-[#072C0E]/50">
          {tr ? 'Yeni Şirket Profili' : 'New Company Profile'}
        </p>

        <FormField label={`${tr ? 'Şirket Adı' : 'Company Name'} *`}>
          <input
            type="text"
            value={field('legal_entity_name')}
            onChange={set('legal_entity_name')}
            placeholder={tr ? 'Örn. Acme Teknoloji A.Ş.' : 'e.g. Acme Technologies Ltd.'}
            className="w-full rounded-xl border border-[#072C0E]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:bg-white focus:outline-none"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={tr ? 'Vergi No' : 'Tax Number'}>
            <input type="text" value={field('tax_number')} onChange={set('tax_number')} className="w-full rounded-xl border border-[#072C0E]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:bg-white focus:outline-none" />
          </FormField>
          <FormField label={tr ? 'Merkez Ülkesi' : 'Country of HQ'}>
            <input type="text" value={field('country_of_headquarters')} onChange={set('country_of_headquarters')}
              placeholder={tr ? 'Türkiye' : 'Turkey'} className="w-full rounded-xl border border-[#072C0E]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:bg-white focus:outline-none" />
          </FormField>
          <FormField label="NACE">
            <input type="text" value={field('nace_code')} onChange={set('nace_code')}
              placeholder="e.g. C29.10" className="w-full rounded-xl border border-[#072C0E]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:bg-white focus:outline-none" />
          </FormField>
        </div>

        {error && <ErrorBox msg={error} />}
        {success && <SuccessBox msg={success} />}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#072C0E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#175022] disabled:opacity-60"
          >
            {saving
              ? <><Spinner />{tr ? 'Oluşturuluyor…' : 'Creating…'}</>
              : (tr ? 'Şirket Oluştur' : 'Create Company')}
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setError(''); }}
            disabled={saving}
            className="rounded-xl border border-[#072C0E]/15 px-4 py-2.5 text-sm text-[#072C0E]/70 hover:bg-[#F8F8F8] disabled:opacity-60"
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
            { key: 'name',    label: tr ? 'Şirket Adı' : 'Company Name', val: company.legal_entity_name },
            { key: 'tax',     label: tr ? 'Vergi No' : 'Tax Number',      val: company.tax_number },
            { key: 'country', label: tr ? 'Ülke' : 'Country',             val: company.country_of_headquarters },
            { key: 'nace',    label: 'NACE',                               val: company.nace_code },
          ].map((f) => (
            <div key={f.key} className="rounded-xl bg-[#F8F8F8] p-3">
              <p className="text-xs text-[#072C0E]/50">{f.label}</p>
              <p className="mt-0.5 text-sm font-medium text-[#072C0E]">{f.val || '—'}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => { setEditing(true); setError(''); setSuccess(''); }}
          className="rounded-xl border border-[#2ABD41] px-4 py-2 text-sm font-medium text-[#2ABD41] hover:bg-[#2ABD41]/8 transition"
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
          <input type="text" value={field('legal_entity_name')} onChange={set('legal_entity_name')} className="w-full rounded-xl border border-[#072C0E]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:bg-white focus:outline-none" />
        </FormField>
        <FormField label={tr ? 'Vergi No' : 'Tax Number'}>
          <input type="text" value={field('tax_number')} onChange={set('tax_number')} className="w-full rounded-xl border border-[#072C0E]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:bg-white focus:outline-none" />
        </FormField>
        <FormField label={tr ? 'Merkez Ülkesi' : 'Country of HQ'}>
          <input type="text" value={field('country_of_headquarters')} onChange={set('country_of_headquarters')} className="w-full rounded-xl border border-[#072C0E]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:bg-white focus:outline-none" />
        </FormField>
        <FormField label="NACE">
          <input type="text" value={field('nace_code')} onChange={set('nace_code')} className="w-full rounded-xl border border-[#072C0E]/15 bg-[#F8F8F8] px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:bg-white focus:outline-none" />
        </FormField>
      </div>

      {error   && <ErrorBox msg={error} />}
      {success && <SuccessBox msg={success} />}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[#072C0E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#175022] disabled:opacity-60"
        >
          {saving
            ? <><Spinner />{tr ? 'Kaydediliyor…' : 'Saving…'}</>
            : (tr ? 'Kaydet' : 'Save')}
        </button>
        <button
          onClick={() => { setEditing(false); setForm(company); setError(''); setSuccess(''); }}
          disabled={saving}
          className="rounded-xl border border-[#072C0E]/15 px-4 py-2.5 text-sm text-[#072C0E]/70 hover:bg-[#F8F8F8] disabled:opacity-60"
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
      <label className="mb-1 block text-xs font-medium text-[#072C0E]/60">{label}</label>
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
