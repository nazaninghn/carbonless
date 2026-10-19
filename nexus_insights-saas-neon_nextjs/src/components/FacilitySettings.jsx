'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';
import { Plus, AlertCircle, Building2, Pencil, Trash2 } from 'lucide-react';
import CountryPicker from '@/components/CountryPicker';
import { COUNTRIES } from '@/lib/data/countries';

// The country was a free-text box: facilities ended up as "TR", "Türkiye",
// "Almanya"… side by side. It is now picked from the list and stored as the
// code; an older free-text value is matched to its code when edited.
const countryCode = (v) => {
  const t = (v || '').trim();
  if (!t) return '';
  const low = t.toLocaleLowerCase('tr-TR');
  const c = COUNTRIES.find(x => x.code.toLowerCase() === low || x.tr.toLocaleLowerCase('tr-TR') === low || x.en.toLowerCase() === low);
  return c ? c.code : t;
};
const countryName = (v, tr) => {
  const c = COUNTRIES.find(x => x.code === countryCode(v));
  return c ? c[tr ? 'tr' : 'en'] : v;
};

// Turkey: the official electricity factor depends on the grid connection.
const TURKEY = new Set(['TR', 'TUR']);
const CONNECTION_LABELS = {
  transmission: { tr: 'İletim bağlantısı', en: 'Transmission connection' },
  distribution: { tr: 'Dağıtım bağlantısı', en: 'Distribution connection' },
};

// Stored values are English; the list shows them in the UI language.
const TYPE_LABELS = {
  Office: { tr: 'Ofis', en: 'Office' },
  Factory: { tr: 'Fabrika', en: 'Factory' },
  Warehouse: { tr: 'Depo', en: 'Warehouse' },
  Store: { tr: 'Mağaza', en: 'Store' },
  Other: { tr: 'Diğer', en: 'Other' },
};

export default function FacilitySettings({ language, readOnly = false, onChange }) {
  const [facilities, setFacilities]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [noCompany, setNoCompany]     = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [name, setName]               = useState('');
  const [city, setCity]               = useState('');
  const [country, setCountry]         = useState('');
  const [facilityType, setFacilityType] = useState('');
  const [gridConnection, setGridConnection] = useState('');
  const [editingId, setEditingId]     = useState(null);   // null = adding a new facility
  const [confirmDelete, setConfirmDelete] = useState(null); // facility awaiting delete confirmation
  const [deleting, setDeleting]       = useState(false);
  const [deciding, setDeciding]       = useState(null);   // facility id whose proposed connection is being decided
  const formRef = useRef(null);
  const nameRef = useRef(null);
  // The form opens under the list: on a phone it started below the screen,
  // so a tap on ✎ seemed to do nothing. Bring it into view, name field first.
  useEffect(() => {
    if (!showForm) return;
    formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    nameRef.current?.focus({ preventScroll: true });
  }, [showForm, editingId]);

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
    setName(''); setCity(''); setCountry(''); setFacilityType(''); setGridConnection('');
    setFormError(''); setEditingId(null);
  }, []);

  const startEdit = useCallback((f) => {
    setName(f.name || ''); setCity(f.city || ''); setCountry(countryCode(f.country));
    setFacilityType(f.facility_type || '');
    setGridConnection(f.grid_connection || '');
    setFormError(''); setConfirmDelete(null);
    setEditingId(f.id); setShowForm(true);
  }, []);

  // A grid connection a data-entry member gave in Q24 waits here for an
  // approver: accepting applies it (the inventories are recalculated).
  const decideConnection = useCallback(async (f, decision) => {
    if (deciding) return;
    setDeciding(f.id);
    try {
      const res = await api.decideFacilityConnection(f.id, decision);
      if (res.ok) {
        await fetchFacilities();
        onChange?.();
        toast.success(decision === 'approve'
          ? (tr ? 'Bağlantı onaylandı; envanter yeniden hesaplandı' : 'Connection approved; the inventory was recalculated')
          : (tr ? 'Bağlantı önerisi reddedildi' : 'Connection proposal declined'));
      } else {
        toast.error(tr ? 'İşlem yapılamadı' : 'Could not complete the action');
        await fetchFacilities();
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setDeciding(null);
    }
  }, [deciding, fetchFacilities, onChange, toast, tr]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await api.deleteFacility(confirmDelete.id);
      if (res.ok || res.status === 204) {
        setConfirmDelete(null);
        await fetchFacilities();
        onChange?.();
        toast.success(tr ? 'Tesis silindi' : 'Facility deleted');
      } else {
        toast.error(tr ? 'Tesis silinemedi' : 'Failed to delete facility');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, deleting, fetchFacilities, onChange, toast, tr]);

  const handleAdd = useCallback(async (e) => {
    e.preventDefault();
    // Fix 28C: prevent double-submit before React flushes the disabled state
    if (saving) return;
    setFormError('');

    // Manual validation — no browser native popup
    if (!name.trim()) {
      setFormError(tr ? 'Tesis adı zorunludur' : 'Facility name is required');
      return;
    }
    // Same rule as the server: one name per facility, or they can't be told apart.
    const lower = (v) => (v || '').trim().toLocaleLowerCase(tr ? 'tr-TR' : 'en-US');
    if (facilities.some(f => f.id !== editingId && lower(f.name) === lower(name))) {
      setFormError(tr
        ? `"${name.trim()}" adında bir tesis zaten var. Farklı bir ad girin.`
        : `A facility named "${name.trim()}" already exists. Choose a different name.`);
      return;
    }

    setSaving(true);

    try {
      const inTurkey = TURKEY.has(countryCode(country).toUpperCase());
      const payload = {
        name,
        city: city || undefined,
        country: country || undefined,
        facility_type: facilityType || undefined,
        grid_connection: inTurkey ? gridConnection : '',
      };
      const wasEditing = editingId !== null;
      // Editing sends blanks as '' so a cleared field is actually cleared.
      const res = wasEditing
        ? await api.updateFacility(editingId, { name, city, country, facility_type: facilityType, grid_connection: inTurkey ? gridConnection : '' })
        : await api.createFacility(payload);

      if (res.ok) {
        resetForm();
        setShowForm(false);
        await fetchFacilities();
        onChange?.();
        const done = wasEditing
          ? (tr ? 'Tesis güncellendi' : 'Facility updated')
          : (tr ? 'Tesis başarıyla eklendi' : 'Facility added successfully');
        toast.success(`${done} ✓`);
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
  }, [name, city, country, facilityType, gridConnection, saving, editingId, facilities, onChange, tr, toast, fetchFacilities, resetForm]); // saving added

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-[#072C0E]/55">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#2ABD41]/40 border-t-[#2ABD41]" />
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
      {/* Facilities list */}
      {facilities.length > 0 ? (
        <div className="space-y-2">
          {facilities.map(f => (
            <div key={f.id} className="rounded-xl bg-[#F8F8F8] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#072C0E]">{f.name}</p>
                  <p className="text-xs text-[#072C0E]/55">
                    {[TYPE_LABELS[f.facility_type]?.[tr ? 'tr' : 'en'] || f.facility_type, f.city, countryName(f.country, tr),
                      CONNECTION_LABELS[f.grid_connection]?.[tr ? 'tr' : 'en']].filter(Boolean).join(' · ')}
                  </p>
                  {TURKEY.has(countryCode(f.country).toUpperCase()) && !f.grid_connection && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-700">
                      {tr
                        ? 'Şebeke bağlantı türü seçilmedi — bu tesisin elektriği hesaplanmıyor (tamamlanmayı bekliyor).'
                        : 'Grid connection not chosen — this facility\'s electricity is not calculated (pending).'}
                    </p>
                  )}
                  {f.proposed_grid_connection && (
                    <div className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                      <p className="font-semibold">
                        {(() => {
                          const p = f.proposed_grid_connection;
                          const label = p.connection
                            ? CONNECTION_LABELS[p.connection]?.[tr ? 'tr' : 'en']
                            : (tr ? 'Bilmiyorum (bağlantı türü teyit edilecek)' : 'I don\'t know (connection to be confirmed)');
                          return tr
                            ? `${p.year} envanteri Soru 24'te önerilen: ${label} — onayınızı bekliyor.`
                            : `Proposed in Question 24 of the ${p.year} inventory: ${label} — awaiting your approval.`;
                        })()}
                      </p>
                      {!readOnly && (
                        <div className="mt-1.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => decideConnection(f, 'approve')}
                            disabled={deciding === f.id}
                            className="rounded-full bg-[#2ABD41] px-3 py-1 text-[10px] font-bold text-white transition hover:bg-[#1A7B2A] disabled:opacity-50"
                          >
                            {tr ? 'Onayla' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => decideConnection(f, 'reject')}
                            disabled={deciding === f.id}
                            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[10px] font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                          >
                            {tr ? 'Reddet' : 'Decline'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${
                    f.is_active
                      ? 'bg-[#2ABD41]/12 text-[#175022]'
                      : 'bg-[#F0F0F0] text-[#072C0E]/50'
                  }`}>
                    {f.is_active
                      ? (tr ? 'Aktif' : 'Active')
                      : (tr ? 'Pasif' : 'Inactive')}
                  </span>
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(f)}
                        aria-label={tr ? `${f.name} tesisini düzenle` : `Edit ${f.name}`}
                        title={tr ? 'Düzenle' : 'Edit'}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#072C0E]/40 transition hover:bg-[#2ABD41]/10 hover:text-[#2ABD41]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirmDelete(f); setShowForm(false); }}
                        aria-label={tr ? `${f.name} tesisini sil` : `Delete ${f.name}`}
                        title={tr ? 'Sil' : 'Delete'}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#072C0E]/40 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {confirmDelete?.id === f.id && (
                <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                  <p className="font-bold">{tr ? `"${f.name}" silinsin mi?` : `Delete "${f.name}"?`}</p>
                  <p className="mt-0.5">
                    {f.entry_count > 0
                      ? (tr
                        ? `Bu tesise bağlı ${f.entry_count} kayıt var. Kayıtlar silinmez, yalnızca tesis bilgileri boşalır.`
                        : `${f.entry_count} entries are linked to it. They are kept; only their facility is cleared.`)
                      : (tr ? 'Bu tesise bağlı kayıt yok.' : 'No entries are linked to it.')}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-red-500 px-3 py-1.5 font-bold text-white hover:bg-red-600 disabled:opacity-60"
                    >
                      {deleting ? (tr ? 'Siliniyor…' : 'Deleting…') : (tr ? 'Sil' : 'Delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      disabled={deleting}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-bold text-red-600 hover:bg-red-50"
                    >
                      {tr ? 'Vazgeç' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !showForm ? (
        <p className="text-sm text-[#072C0E]/55">
          {tr ? 'Henüz tesis eklenmedi.' : 'No facilities added yet.'}
        </p>
      ) : null}

      {/* Form */}
      {showForm ? (
        <form ref={formRef} onSubmit={handleAdd} noValidate className="scroll-mt-4 space-y-3 rounded-2xl border border-[#072C0E]/10 bg-[#F8F8F8] p-4">
          <p className="text-xs font-bold text-[#072C0E]/60 uppercase tracking-wide">
            {editingId !== null ? (tr ? 'Tesisi Düzenle' : 'Edit Facility') : (tr ? 'Yeni Tesis' : 'New Facility')}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="facility-name" className="mb-1 block text-xs font-medium text-[#072C0E]/60">
                {tr ? 'Tesis Adı' : 'Facility Name'} <span className="text-red-500">*</span>
              </label>
              <input
                id="facility-name"
                ref={nameRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={tr ? 'Örn. İstanbul Merkez Ofis' : 'e.g. Istanbul Head Office'}
                className="w-full rounded-xl border border-[#072C0E]/15 bg-white px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="facility-type" className="mb-1 block text-xs font-medium text-[#072C0E]/60">
                {tr ? 'Tür' : 'Type'}
              </label>
              <select
                id="facility-type"
                value={facilityType}
                onChange={e => setFacilityType(e.target.value)}
                className="w-full rounded-xl border border-[#072C0E]/15 bg-white px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:outline-none"
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
              <label htmlFor="facility-city" className="mb-1 block text-xs font-medium text-[#072C0E]/60">
                {tr ? 'Şehir' : 'City'}
              </label>
              <input
                id="facility-city"
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder={tr ? 'İstanbul' : 'Istanbul'}
                className="w-full rounded-xl border border-[#072C0E]/15 bg-white px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:outline-none"
              />
            </div>
            <div>
              <p className="mb-1 block text-xs font-medium text-[#072C0E]/60">
                {tr ? 'Ülke' : 'Country'}
              </p>
              <CountryPicker value={country} onChange={setCountry} language={language} placeholder={tr ? 'Ülke ara...' : 'Search country...'} />
            </div>
            {TURKEY.has(countryCode(country).toUpperCase()) && (
              <div className="sm:col-span-2">
                <label htmlFor="facility-grid-connection" className="mb-1 block text-xs font-medium text-[#072C0E]/60">
                  {tr ? 'Elektrik şebeke bağlantısı' : 'Electricity grid connection'}
                </label>
                <select
                  id="facility-grid-connection"
                  value={gridConnection}
                  onChange={e => setGridConnection(e.target.value)}
                  className="w-full rounded-xl border border-[#072C0E]/15 bg-white px-3 py-2.5 text-sm focus:border-[#2ABD41] focus:outline-none"
                >
                  <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                  <option value="distribution">{tr ? 'Dağıtım şebekesi (çoğu tesis — OG/AG aboneliği)' : 'Distribution grid (most sites — MV/LV supply)'}</option>
                  <option value="transmission">{tr ? 'İletim şebekesi (doğrudan TEİAŞ / YG bağlantısı)' : 'Transmission grid (direct TEİAŞ / HV connection)'}</option>
                </select>
                <p className="mt-1 text-[11px] text-[#072C0E]/50">
                  {tr
                    ? 'Resmi Türkiye elektrik faktörü bağlantıya göre değişir (ETKB, 2023 veri yılı: iletim 0,436 · dağıtım 0,469 kg CO₂e/kWh). Seçilmezse tesisin elektriği hesaplanmaz. Bağlantı türü fatura veya sözleşmede açıkça belirtilmemişse boş bırakın ve elektrik şirketinden ya da tesis sorumlusundan teyit alın.'
                    : 'The official Turkish electricity factor depends on the connection (ETKB, data year 2023: transmission 0.436 · distribution 0.469 kg CO₂e/kWh). Without it the facility\'s electricity is not calculated. If the connection type is not clearly stated on the bill or contract, leave it empty and confirm it with the electricity company or the person responsible for the facility.'}
                </p>
              </div>
            )}
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
              className="flex items-center gap-2 rounded-xl bg-[#072C0E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#175022] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {tr ? 'Kaydediliyor…' : 'Saving…'}
                </>
              ) : (
                <>{editingId !== null ? (tr ? 'Kaydet' : 'Save') : (tr ? 'Tesis Ekle' : 'Add Facility')}</>
              )}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              disabled={saving}
              className="rounded-xl border border-[#072C0E]/15 px-4 py-2.5 text-sm text-[#072C0E]/70 hover:bg-white disabled:opacity-60"
            >
              {tr ? 'İptal' : 'Cancel'}
            </button>
          </div>
        </form>
      ) : !readOnly && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 rounded-xl border border-[#2ABD41] px-4 py-2.5 text-sm font-medium text-[#2ABD41] hover:bg-[#2ABD41]/8 transition"
        >
          <Plus className="h-4 w-4" />
          {tr ? 'Tesis Ekle' : 'Add Facility'}
        </button>
      )}
    </div>
  );
}
