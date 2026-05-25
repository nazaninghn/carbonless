'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';
import { Plus, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';

export default function FacilitySettings({ language }) {
  const [facilities, setFacilities]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [noCompany, setNoCompany]     = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [successMsg, setSuccessMsg]   = useState('');
  const [name, setName]               = useState('');
  const [city, setCity]               = useState('');
  const [country, setCountry]         = useState('');
  const [facilityType, setFacilityType] = useState('');

  const tr    = language === 'tr';
  const toast = useToast();

  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFacilities();
      if (res.ok) {
        const data = await res.json();
        setFacilities(Array.isArray(data) ? data : data.results || []);
        setNoCompany(false);
      } else if (res.status === 403) {
        // User is not a member of any company yet
        setNoCompany(true);
        setFacilities([]);
      } else {
        toast.error(tr ? 'Tesisler yüklenemedi' : 'Failed to load facilities');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setLoading(false);
    }
  }, [tr, toast]);

  useEffect(() => { fetchFacilities(); }, [fetchFacilities]);

  const resetForm = useCallback(() => {
    setName(''); setCity(''); setCountry(''); setFacilityType('');
    setFormError(''); setSuccessMsg('');
  }, []);

  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    // Fix 28C: prevent double-submit before React flushes the disabled state
    if (saving) return;
    setFormError('');
    setSuccessMsg('');

    // Manual validation — no browser native popup
    if (!name.trim()) {
      setFormError(tr ? 'Tesis adı zorunludur' : 'Facility name is required');
      return;
    }

    setSaving(true);

    try {
      const res = await api.createFacility({
        name,
        city: city || undefined,
        country: country || undefined,
        facility_type: facilityType || undefined,
      });

      if (res.ok) {
        resetForm();
        setShowForm(false);
        await fetchFacilities();
        setSuccessMsg(tr ? 'Tesis başarıyla eklendi' : 'Facility added successfully');
        toast.success(tr ? 'Tesis başarıyla eklendi ✓' : 'Facility added successfully ✓');
      } else if (res.status === 403) {
        setNoCompany(true);
        setShowForm(false);
        const msg = tr
          ? 'Önce şirket profilinizi oluşturmanız gerekiyor.'
          : 'You need to set up your company profile first.';
        setFormError(msg);
        toast.error(msg);
      } else {
        let msg = tr ? 'Tesis eklenemedi' : 'Failed to add facility';
        try {
          const data = await res.json();
          const serverMsg =
            data?.name?.[0] || data?.detail || data?.error ||
            Object.values(data || {}).flat().filter(Boolean).join(' ');
          if (serverMsg) msg = String(serverMsg);
        } catch { /* ignore json parse error */ }
        setFormError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = tr
        ? 'Bağlantı hatası — lütfen tekrar deneyin'
        : 'Connection error — please try again';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [name, city, country, facilityType, saving, tr, toast, fetchFacilities, resetForm]); // saving added

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-[#302817]/55">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#95A847]/40 border-t-[#95A847]" />
        {tr ? 'Yükleniyor…' : 'Loading…'}
      </div>
    );
  }

  /* ─── No-company banner ─── */
  if (noCompany) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
          <Building2 className="h-6 w-6 text-amber-600" />
        </div>
        <p className="text-sm font-bold text-amber-800">
          {tr ? 'Önce şirket profilinizi oluşturun' : 'Set up your company profile first'}
        </p>
        <p className="mt-1 text-xs text-amber-700/80">
          {tr
            ? 'Tesis ekleyebilmek için Şirket sekmesinden şirket bilgilerinizi kaydetmeniz gerekiyor.'
            : 'To add facilities, please save your company information under the Company tab first.'}
        </p>
        <button
          onClick={fetchFacilities}
          className="mt-4 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50"
        >
          {tr ? 'Tekrar Dene' : 'Try Again'}
        </button>
      </div>
    );
  }

  /* ─── Main UI ─── */
  return (
    <div className="space-y-3">
      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-[#95A847]/30 bg-[#95A847]/8 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#75863B]" />
          <p className="text-xs text-[#75863B]">{successMsg}</p>
        </div>
      )}

      {/* Facilities list */}
      {facilities.length > 0 ? (
        <div className="space-y-2">
          {facilities.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-[#F8F8F8] rounded-xl">
              <div>
                <p className="text-sm font-medium text-[#302817]">{f.name}</p>
                <p className="text-xs text-[#302817]/55">
                  {[f.facility_type, f.city, f.country].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                f.is_active
                  ? 'bg-[#95A847]/12 text-[#75863B]'
                  : 'bg-[#F0F0F0] text-[#302817]/50'
              }`}>
                {f.is_active
                  ? (tr ? 'Aktif' : 'Active')
                  : (tr ? 'Pasif' : 'Inactive')}
              </span>
            </div>
          ))}
        </div>
      ) : !showForm ? (
        <p className="text-sm text-[#302817]/55">
          {tr ? 'Henüz tesis eklenmedi.' : 'No facilities added yet.'}
        </p>
      ) : null}

      {/* Form */}
      {showForm ? (
        <form onSubmit={handleAdd} noValidate className="space-y-3 rounded-2xl border border-[#302817]/10 bg-[#F8F8F8] p-4">
          <p className="text-xs font-bold text-[#302817]/60 uppercase tracking-wide">
            {tr ? 'Yeni Tesis' : 'New Facility'}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[#302817]/60">
                {tr ? 'Tesis Adı' : 'Facility Name'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={tr ? 'Örn. İstanbul Merkez Ofis' : 'e.g. Istanbul Head Office'}
                className="w-full rounded-xl border border-[#302817]/15 bg-white px-3 py-2.5 text-sm focus:border-[#95A847] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#302817]/60">
                {tr ? 'Tür' : 'Type'}
              </label>
              <select
                value={facilityType}
                onChange={e => setFacilityType(e.target.value)}
                className="w-full rounded-xl border border-[#302817]/15 bg-white px-3 py-2.5 text-sm focus:border-[#95A847] focus:outline-none"
              >
                <option value="">{tr ? 'Seçiniz' : 'Select type'}</option>
                <option value="Office">{tr ? 'Ofis' : 'Office'}</option>
                <option value="Factory">{tr ? 'Fabrika' : 'Factory'}</option>
                <option value="Warehouse">{tr ? 'Depo' : 'Warehouse'}</option>
                <option value="Store">{tr ? 'Mağaza' : 'Store'}</option>
                <option value="Other">{tr ? 'Diğer' : 'Other'}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#302817]/60">
                {tr ? 'Şehir' : 'City'}
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder={tr ? 'İstanbul' : 'Istanbul'}
                className="w-full rounded-xl border border-[#302817]/15 bg-white px-3 py-2.5 text-sm focus:border-[#95A847] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#302817]/60">
                {tr ? 'Ülke' : 'Country'}
              </label>
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder={tr ? 'Türkiye' : 'Turkey'}
                className="w-full rounded-xl border border-[#302817]/15 bg-white px-3 py-2.5 text-sm focus:border-[#95A847] focus:outline-none"
              />
            </div>
          </div>

          {/* Error message */}
          {formError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-xs text-red-700">{formError}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[#302817] px-5 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {tr ? 'Kaydediliyor…' : 'Saving…'}
                </>
              ) : (
                <>{tr ? 'Tesis Ekle' : 'Add Facility'}</>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              disabled={saving}
              className="rounded-xl border border-[#302817]/15 px-4 py-2.5 text-sm text-[#302817]/70 hover:bg-white disabled:opacity-60"
            >
              {tr ? 'İptal' : 'Cancel'}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-xl border border-[#95A847] px-4 py-2.5 text-sm font-medium text-[#95A847] hover:bg-[#95A847]/8 transition"
        >
          <Plus className="h-4 w-4" />
          {tr ? 'Tesis Ekle' : 'Add Facility'}
        </button>
      )}
    </div>
  );
}
