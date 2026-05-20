'use client';

import { useState, useMemo } from 'react';
import {
  AlertCircle, FileText, Leaf, Paperclip,
  Pencil, Plus, Search, Trash2, X,
} from 'lucide-react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SCOPE_META = {
  scope1: { label: 'Scope 1', bg: 'bg-[#302817]/10', text: 'text-[#302817]',   bar: '#302817' },
  scope2: { label: 'Scope 2', bg: 'bg-[#95A847]/15', text: 'text-[#75863B]',   bar: '#95A847' },
  scope3: { label: 'Scope 3', bg: 'bg-[#B4BE6A]/20', text: 'text-[#75863B]',   bar: '#B4BE6A' },
};

const STATUS_META = {
  submitted: { bg: 'bg-amber-100',     text: 'text-amber-700',  tr: 'Beklemede',  en: 'Pending'  },
  approved:  { bg: 'bg-[#95A847]/12',  text: 'text-[#75863B]', tr: 'Onaylı',     en: 'Approved' },
  draft:     { bg: 'bg-[#302817]/8',   text: 'text-[#302817]/50', tr: 'Taslak',  en: 'Draft'    },
};

function scopeLabel(s) { return SCOPE_META[s]?.label ?? s; }
function fmt(n, d = 2) { return parseFloat(n || 0).toLocaleString(undefined, { maximumFractionDigits: d }); }

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg','image/png','image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const MONTHS_TR = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CATEGORY_LABELS = {
  stationary_combustion:    { tr: 'Sabit Yanma',          en: 'Stationary Combustion' },
  mobile_combustion:        { tr: 'Mobil Yanma',           en: 'Mobile Combustion' },
  fugitive_emissions:       { tr: 'Kaçak Emisyon',         en: 'Fugitive Emissions' },
  process_emissions:        { tr: 'Proses',                en: 'Process Emissions' },
  electricity:              { tr: 'Elektrik',              en: 'Electricity' },
  steam_heat:               { tr: 'Buhar / Isı',           en: 'Steam & Heat' },
  purchased_goods:          { tr: 'Satın Alınan Mal',      en: 'Purchased Goods' },
  capital_goods:            { tr: 'Sermaye Malları',        en: 'Capital Goods' },
  fuel_energy:              { tr: 'Yakıt & Enerji',        en: 'Fuel & Energy' },
  upstream_transport:       { tr: 'Yukarı Akış Taşıma',    en: 'Upstream Transport' },
  waste:                    { tr: 'Atık',                  en: 'Waste' },
  business_travel:          { tr: 'İş Seyahati',           en: 'Business Travel' },
  employee_commuting:       { tr: 'Çalışan Ulaşımı',       en: 'Employee Commuting' },
  upstream_leased:          { tr: 'Kiral. Var. (Yukarı)',   en: 'Upstream Leased' },
  downstream_transport:     { tr: 'Aşağı Akış Taşıma',     en: 'Downstream Transport' },
  processing_of_sold_products:{ tr: 'Satılan Ürün İşleme', en: 'Processing Sold Products'},
  use_of_sold_products:     { tr: 'Satılan Ürün Kullanımı',en: 'Use of Sold Products' },
  end_of_life:              { tr: 'Ömür Sonu',             en: 'End of Life' },
  downstream_leased:        { tr: 'Kiral. Var. (Aşağı)',   en: 'Downstream Leased' },
  franchises:               { tr: 'Franchise',             en: 'Franchises' },
  investments:              { tr: 'Yatırımlar',            en: 'Investments' },
  water:                    { tr: 'Su',                    en: 'Water' },
  custom:                   { tr: 'Özel',                  en: 'Custom' },
};

// ─── Entry Card (mobile) ──────────────────────────────────────────────────────
function EntryCard({ entry, months, language, maxKg, onEdit, onDelete }) {
  const tr = language === 'tr';
  const sm = SCOPE_META[entry.scope] ?? SCOPE_META.scope1;
  const st = STATUS_META[entry.status] ?? STATUS_META.submitted;
  const kg = parseFloat(entry.calculated_co2e_kg) || 0;
  const barPct = maxKg > 0 ? (kg / maxKg) * 100 : 0;
  const name = (tr && entry.emission_factor_name_tr) ? entry.emission_factor_name_tr : entry.emission_factor_name;

  return (
    <div className="rounded-2xl border border-[#302817]/8 bg-white p-4 shadow-[0_2px_12px_rgba(48,40,23,0.04)]">
      {/* Top row */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-[#302817]">{name}</p>
          <p className="mt-0.5 text-[10px] text-[#302817]/40">
            {months[entry.month - 1]} · {tr ? 'Miktar' : 'Qty'}: {fmt(entry.quantity)} {entry.unit}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {entry.proof_document && (
            <span title={tr ? 'Kanıt var' : 'Has proof'}>
              <Paperclip className="h-3.5 w-3.5 text-[#95A847]" />
            </span>
          )}
          <button
            onClick={() => onEdit(entry)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/30 transition hover:bg-[#95A847]/10 hover:text-[#95A847]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/30 transition hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mini bar */}
      <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-[#302817]/5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(barPct, barPct > 0 ? 2 : 0)}%`, backgroundColor: sm.bar }}
        />
      </div>

      {/* Bottom row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${sm.bg} ${sm.text}`}>
          {sm.label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${st.bg} ${st.text}`}>
          {tr ? st.tr : st.en}
        </span>
        {entry.facility_name && (
          <span className="rounded-full bg-[#302817]/5 px-2 py-0.5 text-[9px] font-semibold text-[#302817]/50">
            {entry.facility_name}
          </span>
        )}
        <span className="ml-auto text-[12px] font-bold text-[#302817]">
          {fmt(kg)} <span className="text-[9px] font-semibold text-[#302817]/40">kg</span>
        </span>
        <span className="text-[11px] text-[#302817]/40">
          {(kg / 1000).toFixed(4)} t
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function EmissionsTab({
  language, selectedYear, selectedCountry,
  entries, factors, facilityList,
  customRequests = [],
  questionnaireProfile,
  showAddForm, setShowAddForm,
  setActiveTab,
  fetchData,
}) {
  const tr    = language === 'tr';
  const toast = useToast();

  // ── Local state ──────────────────────────────────────────────────────────
  const [search, setSearch]           = useState('');
  const [filterScope, setFilterScope] = useState('');
  const [filterMonth,    setFilterMonth]    = useState(0);   // 0 = all months
  const [filterFacility, setFilterFacility] = useState('');
  const [sortBy,         setSortBy]         = useState('month');

  // Add form
  const [selScope,    setSelScope]    = useState('');
  const [selCategory, setSelCategory] = useState('');
  const [selFactor,   setSelFactor]   = useState('');
  const [month,       setMonth]       = useState(new Date().getMonth() + 1);
  const [quantity,    setQuantity]    = useState('');
  const [desc,        setDesc]        = useState('');
  const [facility,    setFacility]    = useState('');
  const [file,        setFile]        = useState(null);
  const [formError,   setFormError]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  // Edit
  const [editing,     setEditing]     = useState(null);
  const [editQty,     setEditQty]     = useState('');
  const [editDesc,    setEditDesc]    = useState('');
  const [editFacility,setEditFacility]= useState('');
  const [editSaving,  setEditSaving]  = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null); // stores the entry id to delete

  // Custom request
  const [showCustom,   setShowCustom]  = useState(false);
  const [cScope,  setCScope]   = useState('scope1');
  const [cCat,    setCCat]     = useState('');
  const [cSrc,    setCSrc]     = useState('');
  const [cDesc,   setCDesc]    = useState('');
  const [cUnit,   setCUnit]    = useState('');
  const [cQty,    setCQty]     = useState('');
  const [cMonth,  setCMonth]   = useState(new Date().getMonth() + 1);
  const [cSaving, setCSaving]  = useState(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const months = tr ? MONTHS_TR : MONTHS_EN;
  const catLabel = k => CATEGORY_LABELS[k]?.[tr ? 'tr' : 'en'] ?? k;

  // Filtered factors (same logic as page.jsx, incl. questionnaire preferred source)
  const filteredFactors = useMemo(() => factors.filter(f => {
    let m = true;
    if (selScope)    m = m && f.scope === selScope;
    if (selCategory) m = m && f.category === selCategory;
    if (selectedCountry && selectedCountry !== 'global') {
      const ccCats = new Set(
        factors.filter(ff => ff.country === selectedCountry && (!selScope || ff.scope === selScope))
          .map(ff => ff.category)
      );
      m = m && (ccCats.has(f.category) ? f.country === selectedCountry : f.country === 'global');
    } else if (selectedCountry === 'global') {
      m = m && f.country === 'global';
    }
    // Preferred source from questionnaire (S7) — only for non-turkey global factors
    if (selectedCountry !== 'turkey' && questionnaireProfile?.preferred_factor_source
        && !['mixed','unsure'].includes(questionnaireProfile.preferred_factor_source)) {
      const srcMap = { national: ['turkey_grid','turkey_fleet','atom_kablo'], defra: ['defra_2024'], ipcc: ['ipcc_2006','ipcc_2019'] };
      const preferred = srcMap[questionnaireProfile.preferred_factor_source];
      if (preferred) m = m && preferred.includes(f.source);
    }
    return m;
  }), [factors, selScope, selCategory, selectedCountry, questionnaireProfile]);

  const categories = useMemo(() => [...new Set(
    factors.filter(f => !selScope || f.scope === selScope)
      .filter(f => {
        if (!selectedCountry || selectedCountry === 'global') return true;
        const ccCats = new Set(
          factors.filter(ff => ff.country === selectedCountry && (!selScope || ff.scope === selScope))
            .map(ff => ff.category)
        );
        return ccCats.has(f.category) ? f.country === selectedCountry : f.country === 'global';
      })
      .map(f => f.category)
  )], [factors, selScope, selectedCountry]);

  const selFactorObj = useMemo(
    () => factors.find(f => f.id === parseInt(selFactor)),
    [factors, selFactor],
  );

  // Filtered + sorted entries
  const filtered = useMemo(() => {
    const base = entries.filter(e => {
      const name = (tr && e.emission_factor_name_tr ? e.emission_factor_name_tr : e.emission_factor_name) || '';
      return (!search         || name.toLowerCase().includes(search.toLowerCase()))
          && (!filterScope    || e.scope === filterScope)
          && (!filterMonth    || parseInt(e.month) === filterMonth)
          && (!filterFacility || String(e.facility ?? '') === filterFacility);
    });
    return [...base].sort((a, b) => {
      if (sortBy === 'kg_desc') return (parseFloat(b.calculated_co2e_kg) || 0) - (parseFloat(a.calculated_co2e_kg) || 0);
      if (sortBy === 'kg_asc')  return (parseFloat(a.calculated_co2e_kg) || 0) - (parseFloat(b.calculated_co2e_kg) || 0);
      if (sortBy === 'name')    return (a.emission_factor_name || '').localeCompare(b.emission_factor_name || '');
      return parseInt(a.month) - parseInt(b.month); // default: month asc
    });
  }, [entries, search, filterScope, filterMonth, filterFacility, sortBy, tr]);

  const maxKg = useMemo(
    () => Math.max(...filtered.map(e => parseFloat(e.calculated_co2e_kg) || 0), 1),
    [filtered]
  );

  // Totals — memoized so the reduce only re-runs when `filtered` actually changes
  const totalKg = useMemo(
    () => filtered.reduce((a, e) => a + (parseFloat(e.calculated_co2e_kg) || 0), 0),
    [filtered],
  );

  // KPI counts — computed once per render, not via a function called 3× per render
  const countAll = entries.length;
  const [countS1, countS2, countS3] = useMemo(() => [
    entries.filter(e => e.scope === 'scope1').length,
    entries.filter(e => e.scope === 'scope2').length,
    entries.filter(e => e.scope === 'scope3').length,
  ], [entries]);

  // KPI kg totals — replaces the per-render IIFE in JSX (O(n) work on each render)
  const [s1kg, s2kg, s3kg, totKg] = useMemo(() => {
    const s1 = entries.filter(e => e.scope === 'scope1').reduce((a, e) => a + (parseFloat(e.calculated_co2e_kg) || 0), 0);
    const s2 = entries.filter(e => e.scope === 'scope2').reduce((a, e) => a + (parseFloat(e.calculated_co2e_kg) || 0), 0);
    const s3 = entries.filter(e => e.scope === 'scope3').reduce((a, e) => a + (parseFloat(e.calculated_co2e_kg) || 0), 0);
    return [s1, s2, s3, s1 + s2 + s3];
  }, [entries]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const resetAddForm = () => {
    setSelScope(''); setSelCategory(''); setSelFactor('');
    setQuantity(''); setDesc(''); setFacility(''); setFile(null); setFormError('');
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError('');

    // Client-side file validation
    if (file) {
      if (file.size > MAX_FILE_BYTES) {
        setFormError(tr ? 'Dosya 10 MB sınırını aşıyor.' : 'File exceeds the 10 MB limit.');
        return;
      }
      if (!ALLOWED_MIME.has(file.type)) {
        setFormError(tr ? 'Desteklenmeyen dosya türü.' : 'Unsupported file type.');
        return;
      }
    }

    setSubmitting(true);
    try {
      let res;
      if (file) {
        const fd = new FormData();
        fd.append('emission_factor', parseInt(selFactor));
        fd.append('year', selectedYear);
        fd.append('month', parseInt(month));
        fd.append('quantity', quantity);
        fd.append('description', desc);
        if (facility) fd.append('facility', facility);
        fd.append('proof_document', file);
        res = await api.createEntryWithFile(fd);
      } else {
        res = await api.createEntry({
          emission_factor: parseInt(selFactor), year: selectedYear,
          month: parseInt(month), quantity, description: desc, facility,
        });
      }
      if (res.ok) {
        setShowAddForm(false); resetAddForm(); fetchData();
        toast.success(tr ? 'Kayıt başarıyla eklendi ✓' : 'Entry added successfully ✓');
      } else {
        // Don't expose raw server response — show a user-friendly message
        setFormError(tr ? 'Kayıt eklenemedi. Lütfen alanları kontrol edin.' : 'Could not save entry. Please check your inputs.');
        toast.error(tr ? 'Kayıt eklenemedi' : 'Failed to add entry');
      }
    } catch {
      setFormError(tr ? 'Bağlantı hatası' : 'Connection error');
      toast.error(tr ? 'Bağlantı hatası oluştu' : 'Connection error');
    }
    finally { setSubmitting(false); }
  };

  const handleDelete = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirm;
    setDeleteConfirm(null);
    try {
      const res = await api.deleteEntry(id);
      if (res.ok || res.status === 204) {
        fetchData();
        toast.success(tr ? 'Kayıt silindi' : 'Entry deleted');
      } else {
        toast.error(tr ? 'Kayıt silinemedi' : 'Failed to delete entry');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    setEditSaving(true);
    try {
      const res = await api.updateEntry(editing.id, {
        quantity: editQty, description: editDesc, facility: editFacility,
      });
      if (res.ok) {
        setEditing(null); fetchData();
        toast.success(tr ? 'Kayıt güncellendi' : 'Entry updated');
      } else {
        toast.error(tr ? 'Güncelleme başarısız' : 'Update failed');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally { setEditSaving(false); }
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setEditQty(entry.quantity);
    setEditDesc(entry.description || '');
    setEditFacility(entry.facility || '');
  };

  const handleCustom = async (e) => {
    e.preventDefault();
    setCSaving(true);
    try {
      const res = await api.createCustomRequest({
        scope: cScope, category_name: cCat, source_name: cSrc,
        description: cDesc, unit: cUnit, quantity: cQty,
        year: selectedYear, month: parseInt(cMonth),
      });
      if (res.ok) {
        setShowCustom(false);
        setCCat(''); setCSrc(''); setCDesc(''); setCUnit(''); setCQty('');
        fetchData();
        toast.info(tr ? 'Özel talep gönderildi — inceleme bekleniyor' : 'Custom request submitted — pending review');
      } else {
        toast.error(tr ? 'Talep gönderilemedi' : 'Failed to submit request');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setCSaving(false);
    }
  };

  // ── Shared modal classes ─────────────────────────────────────────────────
  const OVERLAY = 'fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-md';
  const MODAL   = 'flex max-h-[90svh] w-full flex-col overflow-hidden rounded-3xl border border-[#302817]/8 bg-white/94 shadow-[0_20px_60px_rgba(48,40,23,0.14)] backdrop-blur-2xl';
  const FIELD   = 'h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15';
  const LABEL   = 'mb-1.5 block text-xs font-bold text-[#302817]/60';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 sm:space-y-4">

      {/* ── Hero header ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[1.5rem] border border-[#302817]/10 bg-[#FDFCF9] p-4 shadow-[0_6px_24px_rgba(48,40,23,0.05)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#95A847]">
              {tr ? 'Emisyon çalışma alanı' : 'Emission workspace'}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] sm:text-2xl">
              {tr ? 'Emisyon Yönetimi' : 'Emission Management'} · {selectedYear}
            </h1>
            <p className="mt-0.5 text-sm text-[#302817]/55">
              {tr ? 'Aktivite verilerinizi girin ve yönetin' : 'Record and manage your activity data'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition-colors hover:bg-black"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr ? 'Yeni Kayıt' : 'New Entry'}
            </button>
            <button
              onClick={() => setShowCustom(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#95A847]/40 bg-[#95A847]/10 px-4 py-2.5 text-xs font-bold text-[#75863B] transition hover:bg-[#95A847]/18"
            >
              <Plus className="h-3.5 w-3.5" />
              {tr ? 'Özel Talep' : 'Custom Request'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI mini cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: tr ? 'Toplam tCO₂e' : 'Total tCO₂e', value: (totKg/1000).toFixed(2), sub: `${countAll} ${tr?'kayıt':'entries'}`, color: null },
          { label: 'Scope 1', value: (s1kg/1000).toFixed(2), sub: `${countS1} ${tr?'kayıt':'entries'}`, color: '#302817' },
          { label: 'Scope 2', value: (s2kg/1000).toFixed(2), sub: `${countS2} ${tr?'kayıt':'entries'}`, color: '#95A847' },
          { label: 'Scope 3', value: (s3kg/1000).toFixed(2), sub: `${countS3} ${tr?'kayıt':'entries'}`, color: '#B4BE6A' },
        ].map(k => (
          <div key={k.label} className="relative overflow-hidden rounded-xl border border-[#302817]/7 bg-white px-3 py-2.5">
            {k.color && <div className="absolute left-3 right-3 top-0 h-[3px] rounded-b-full" style={{ backgroundColor: k.color }} />}
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#302817]/40 sm:text-[10px]">{k.label}</p>
            <p className="mt-1 text-[18px] font-bold leading-none text-[#302817] sm:text-xl">{k.value}</p>
            <p className="mt-0.5 text-[9px] font-semibold text-[#302817]/35">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Search + Scope filter ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-[#302817]/10 bg-white px-3.5 py-2.5 shadow-sm">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#302817]/30" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tr ? 'Kaynak ara…' : 'Search source…'}
            aria-label="Search emission sources"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#302817] outline-none placeholder:text-[#302817]/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#302817]/30 hover:text-[#302817]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Scope pills */}
        <div className="flex gap-1.5">
          {[
            { val: '', label: tr ? 'Tümü' : 'All', count: countAll },
            { val: 'scope1', label: 'S1', count: countS1 },
            { val: 'scope2', label: 'S2', count: countS2 },
            { val: 'scope3', label: 'S3', count: countS3 },
          ].map(p => (
            <button
              key={p.val}
              onClick={() => setFilterScope(p.val)}
              className={`rounded-full px-3 py-2 text-[11px] font-bold transition ${
                filterScope === p.val
                  ? 'bg-[#302817] text-white'
                  : 'border border-[#302817]/10 bg-white text-[#302817]/60 hover:bg-[#302817]/5'
              }`}
            >
              {p.label} <span className="opacity-60">{p.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Month filter + Facility + Sort ────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Month pills (only months that actually have data) */}
        <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterMonth(0)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              filterMonth === 0
                ? 'bg-[#302817] text-white'
                : 'border border-[#302817]/10 bg-white text-[#302817]/60 hover:bg-[#302817]/5'
            }`}
          >
            {tr ? 'Tüm Aylar' : 'All Months'}
          </button>
          {months.map((m, i) => {
            const mo = i + 1;
            const count = entries.filter(e => parseInt(e.month) === mo).length;
            if (count === 0) return null;
            return (
              <button
                key={mo}
                onClick={() => setFilterMonth(filterMonth === mo ? 0 : mo)}
                className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-bold transition ${
                  filterMonth === mo
                    ? 'bg-[#302817] text-white'
                    : 'border border-[#302817]/10 bg-white text-[#302817]/60 hover:bg-[#302817]/5'
                }`}
              >
                {m}
                <span className="ml-0.5 text-[9px] opacity-50">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Facility filter (only when multiple facilities exist) */}
        {facilityList.length > 1 && (
          <select
            value={filterFacility}
            onChange={e => setFilterFacility(e.target.value)}
            className="shrink-0 rounded-xl border border-[#302817]/10 bg-white px-3 py-2 text-[11px] font-bold text-[#302817] shadow-sm outline-none transition hover:bg-[#F9EFE5]/60"
          >
            <option value="">{tr ? 'Tüm Tesisler' : 'All Facilities'}</option>
            {facilityList.map(f => (
              <option key={f.id} value={String(f.id)}>{f.name}</option>
            ))}
          </select>
        )}

        {/* Sort */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="shrink-0 rounded-xl border border-[#302817]/10 bg-white px-3 py-2 text-[11px] font-bold text-[#302817] shadow-sm outline-none transition hover:bg-[#F9EFE5]/60"
        >
          <option value="month">{tr ? 'Ay ↑' : 'Month ↑'}</option>
          <option value="kg_desc">{tr ? 'CO₂e ↓' : 'CO₂e ↓'}</option>
          <option value="kg_asc">{tr ? 'CO₂e ↑' : 'CO₂e ↑'}</option>
          <option value="name">{tr ? 'İsme göre' : 'By name'}</option>
        </select>
      </div>

      {/* ── Active filter summary chip ────────────────────────────────── */}
      {(filterMonth !== 0 || filterFacility || search || filterScope) && (
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#302817]/40 font-semibold">
            {tr ? 'Filtre aktif:' : 'Filtered:'}{' '}
            <strong className="text-[#302817]">{filtered.length}</strong>
            {' / '}{entries.length}{' '}{tr ? 'kayıt' : 'entries'}
          </span>
          <button
            onClick={() => { setSearch(''); setFilterScope(''); setFilterMonth(0); setFilterFacility(''); }}
            className="inline-flex items-center gap-1 rounded-full border border-[#302817]/10 bg-white px-2.5 py-1 font-bold text-[#302817]/50 transition hover:border-red-200 hover:text-red-500"
          >
            <X className="h-3 w-3" />
            {tr ? 'Temizle' : 'Clear'}
          </button>
        </div>
      )}

      {/* ── Custom Requests list ──────────────────────────────────────── */}
      {customRequests.length > 0 && (
        <div className="rounded-[1.5rem] border border-[#302817]/8 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">
            {tr ? 'Özel Talepler' : 'Custom Requests'}
          </p>
          <div className="space-y-2">
            {customRequests.map(cr => (
              <div key={cr.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#302817]/6 bg-[#F8F8F8]/60 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[#302817]">{cr.source_name}</p>
                  <p className="text-[10px] text-[#302817]/45">{cr.category_name} · {cr.quantity} {cr.unit}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  cr.status === 'approved' ? 'bg-[#95A847]/12 text-[#75863B]' :
                  cr.status === 'rejected' ? 'bg-red-50 text-red-500' :
                  'bg-amber-50 text-amber-600'
                }`}>
                  {cr.status === 'approved' ? (tr ? 'Onaylandı' : 'Approved') :
                   cr.status === 'rejected' ? (tr ? 'Reddedildi' : 'Rejected') :
                   (tr ? 'Beklemede' : 'Pending')}
                  {cr.status === 'approved' && cr.calculated_co2e_kg
                    ? ` · ${(cr.calculated_co2e_kg / 1000).toFixed(4)} t` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[1.5rem] border border-[#302817]/8 bg-white p-12 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#95A847]/10 text-[#95A847]">
            <Leaf className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-bold text-[#302817]">{tr ? 'Henüz veri yok' : 'No emission data yet'}</p>
            <p className="mt-1 text-sm text-[#302817]/50">
              {tr ? 'Fatura, sayaç okuma veya ESG raporunuzdan veri ekleyin.' : 'Add data from invoices, meter readings or your ESG report.'}
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#302817] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:bg-black"
          >
            <Plus className="h-3.5 w-3.5" />
            {tr ? 'İlk Kaydı Ekle' : 'Add First Entry'}
          </button>
        </div>
      )}

      {/* ── DESKTOP TABLE (md+) ───────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="hidden overflow-hidden rounded-[1.5rem] border border-[#302817]/8 bg-white shadow-[0_4px_20px_rgba(48,40,23,0.04)] md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-[#302817]/6 bg-[#F8F8F8]/80">
                <tr>
                  {[
                    tr ? 'Kaynak' : 'Source',
                    'Scope',
                    tr ? 'Ay' : 'Month',
                    tr ? 'Miktar' : 'Qty',
                    'kg CO₂e',
                    'tCO₂e',
                    tr ? 'CO₂e payı' : 'CO₂e share',
                    'actions',
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#302817]/35 ${
                        i >= 3 && i <= 6 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#302817]/5">
                {filtered.map(entry => {
                  const sm = SCOPE_META[entry.scope] ?? SCOPE_META.scope1;
                  const st = STATUS_META[entry.status] ?? STATUS_META.submitted;
                  const kg = parseFloat(entry.calculated_co2e_kg) || 0;
                  const barPct = maxKg > 0 ? (kg / maxKg) * 100 : 0;
                  const name = (tr && entry.emission_factor_name_tr) ? entry.emission_factor_name_tr : entry.emission_factor_name;
                  return (
                    <tr key={entry.id} className="group/row transition-colors hover:bg-[#F9EFE5]/40">
                      {/* Source */}
                      <td className="max-w-[220px] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-semibold text-[#302817]">{name}</span>
                          {entry.proof_document && (
                            <Paperclip className="h-3 w-3 shrink-0 text-[#95A847]" title={tr ? 'Kanıt var' : 'Has proof'} />
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${st.bg} ${st.text}`}>
                            {tr ? st.tr : st.en}
                          </span>
                          {entry.facility_name && (
                            <span className="text-[9px] text-[#302817]/35">{entry.facility_name}</span>
                          )}
                        </div>
                      </td>
                      {/* Scope */}
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${sm.bg} ${sm.text}`}>
                          {sm.label}
                        </span>
                      </td>
                      {/* Month */}
                      <td className="px-4 py-3 text-xs text-[#302817]/50">{months[entry.month - 1]}</td>
                      {/* Quantity */}
                      <td className="px-4 py-3 text-right text-xs font-semibold text-[#302817]/70">
                        {fmt(entry.quantity)} <span className="text-[#302817]/30">{entry.unit}</span>
                      </td>
                      {/* kg CO₂e */}
                      <td className="px-4 py-3 text-right text-[13px] font-bold text-[#302817]">
                        {fmt(kg)}
                      </td>
                      {/* tCO₂e */}
                      <td className="px-4 py-3 text-right text-xs text-[#302817]/40">
                        {(kg / 1000).toFixed(4)}
                      </td>
                      {/* Bar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#302817]/5">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${Math.max(barPct, barPct > 0 ? 2 : 0)}%`, backgroundColor: sm.bar }}
                            />
                          </div>
                          <span className="w-8 text-right text-[9px] font-bold text-[#302817]/30">
                            {barPct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1 opacity-0 transition group-hover/row:opacity-100">
                          <button
                            onClick={() => openEdit(entry)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/35 transition hover:bg-[#95A847]/12 hover:text-[#95A847]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/35 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot className="border-t-2 border-[#302817]/8 bg-[#F8F8F8]/60">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-[#302817]/50">
                    {filtered.length} {tr ? 'kayıt' : 'entries'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-[#302817]">
                    {fmt(totalKg)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-[#302817]/60">
                    {(totalKg / 1000).toFixed(3)} t
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── MOBILE CARDS (< md) ───────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="space-y-2 md:hidden">
          {filtered.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              months={months}
              language={language}
              maxKg={maxKg}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
          {/* Mobile totals */}
          <div className="flex items-center justify-between rounded-xl border border-[#302817]/8 bg-white px-4 py-3">
            <span className="text-xs font-bold text-[#302817]/40">
              {filtered.length} {tr ? 'kayıt' : 'entries'} · {tr ? 'Toplam' : 'Total'}
            </span>
            <span className="text-sm font-bold text-[#302817]">
              {fmt(totalKg)} kg · {(totalKg / 1000).toFixed(3)} t
            </span>
          </div>
        </div>
      )}

      {/* ── No results (filtered) ─────────────────────────────────────── */}
      {entries.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[#302817]/6 bg-white/60 py-10 text-center">
          <p className="text-sm font-bold text-[#302817]/40">{tr ? 'Sonuç bulunamadı' : 'No results found'}</p>
          <button onClick={() => { setSearch(''); setFilterScope(''); setFilterMonth(0); setFilterFacility(''); }} className="text-xs font-bold text-[#95A847] hover:underline">
            {tr ? 'Filtreyi temizle' : 'Clear filters'}
          </button>
        </div>
      )}

      {/* ═══════════════════ ADD ENTRY MODAL ═════════════════════════════ */}
      {showAddForm && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-3xl`}>
            <div className="flex shrink-0 items-center justify-between border-b border-[#302817]/8 px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <h2 className="text-lg font-bold tracking-[-0.02em]">{tr ? 'Emisyon Verisi Ekle' : 'Add Emission Entry'}</h2>
                <p className="mt-0.5 text-xs text-[#302817]/45">{tr ? 'Aktivite verisi ve kanıt belgesi kaydedin' : 'Record activity data and supporting evidence'}</p>
              </div>
              <button onClick={() => { setShowAddForm(false); resetAddForm(); }} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#302817]/40 hover:bg-[#302817]/5"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <form id="add-entry-form" onSubmit={handleAdd} className="space-y-5">
                {/* Scope */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{tr ? 'Emisyon bilgisi' : 'Emission info'}</p>
                  <div>
                    <label className={LABEL}>Scope</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'scope1', label: 'Scope 1', sub: tr ? 'Doğrudan' : 'Direct' },
                        { val: 'scope2', label: 'Scope 2', sub: tr ? 'Enerji' : 'Energy' },
                        { val: 'scope3', label: 'Scope 3', sub: tr ? 'Dolaylı' : 'Indirect' },
                      ].map(s => (
                        <button key={s.val} type="button"
                          onClick={() => { setSelScope(s.val); setSelCategory(''); setSelFactor(''); }}
                          className={`rounded-2xl border px-3 py-3 text-center transition ${selScope === s.val ? 'border-[#95A847]/50 bg-[#95A847]/10 ring-2 ring-[#95A847]/15' : 'border-[#302817]/10 bg-[#F9EFE5]/40 hover:border-[#95A847]/30'}`}
                        >
                          <p className="text-xs font-bold">{s.label}</p>
                          <p className="text-[10px] text-[#302817]/40">{s.sub}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selScope && (
                    <div>
                      <label className={LABEL}>{tr ? 'Kategori' : 'Category'}</label>
                      <select value={selCategory} onChange={e => { setSelCategory(e.target.value); setSelFactor(''); }} className={FIELD} required>
                        <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                        {categories.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
                      </select>
                    </div>
                  )}

                  {selCategory && (
                    <div>
                      <label className={LABEL}>{tr ? 'Emisyon Kaynağı' : 'Emission Source'}</label>
                      <select value={selFactor} onChange={e => setSelFactor(e.target.value)} className={FIELD} required>
                        <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                        {filteredFactors.map(f => (
                          <option key={f.id} value={f.id}>
                            {tr && f.name_tr ? f.name_tr : f.name} ({f.factor_kg_co2e} kg CO₂e/{f.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selFactorObj && (
                    <div className="rounded-2xl border border-[#95A847]/25 bg-[#95A847]/8 px-4 py-3">
                      <p className="text-xs font-bold text-[#75863B]">{tr ? 'Faktör:' : 'Factor:'} {selFactorObj.factor_kg_co2e} kg CO₂e / {selFactorObj.unit}</p>
                      <p className="mt-0.5 text-[10px] text-[#75863B]/70">⚠️ {tr ? `Miktarı ${selFactorObj.unit} cinsinden girin` : `Enter quantity in ${selFactorObj.unit}`}</p>
                    </div>
                  )}
                </div>

                {/* Measurement */}
                <div className="space-y-3 border-t border-[#302817]/8 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{tr ? 'Ölçüm' : 'Measurement'}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>{tr ? 'Ay' : 'Month'}</label>
                      <select value={month} onChange={e => setMonth(e.target.value)} className={FIELD}>
                        {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>{tr ? 'Miktar' : 'Quantity'}{selFactorObj ? ` (${selFactorObj.unit})` : ''}</label>
                      <input type="number" step="any" min="0" value={quantity} onChange={e => setQuantity(e.target.value)} className={FIELD} required />
                    </div>
                  </div>
                  {quantity && selFactorObj && (
                    <div className="rounded-2xl border border-blue-200/60 bg-blue-50/60 px-4 py-3">
                      <p className="text-xs font-bold text-blue-700">
                        {tr ? 'Tahmini:' : 'Estimated:'}{' '}
                        {(parseFloat(quantity) * parseFloat(selFactorObj.factor_kg_co2e)).toFixed(2)} kg CO₂e
                        {' '}({((parseFloat(quantity) * parseFloat(selFactorObj.factor_kg_co2e)) / 1000).toFixed(4)} t)
                      </p>
                    </div>
                  )}
                </div>

                {/* Facility */}
                <div className="space-y-3 border-t border-[#302817]/8 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{tr ? 'Tesis' : 'Facility'}</p>
                  {facilityList.length > 0 ? (
                    <select value={facility} onChange={e => setFacility(e.target.value)} className={FIELD}>
                      <option value="">{tr ? 'Seçiniz (opsiyonel)' : 'Select (optional)'}</option>
                      {facilityList.map(f => <option key={f.id} value={f.id}>{f.name}{f.city ? ` – ${f.city}` : ''}</option>)}
                    </select>
                  ) : (
                    <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-3">
                      <p className="text-xs text-amber-800">{tr ? 'Henüz tesis eklenmemiş.' : 'No facilities added yet.'}</p>
                      {setActiveTab && (
                        <button type="button" onClick={() => { setShowAddForm(false); setActiveTab('settings'); }} className="mt-1 text-xs font-bold text-[#95A847] hover:underline">
                          {tr ? '→ Ayarlar\'dan tesis ekleyin' : '→ Add facility from Settings'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Additional */}
                <div className="space-y-3 border-t border-[#302817]/8 pt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{tr ? 'Ek bilgiler' : 'Additional details'}</p>
                  <div>
                    <label className={LABEL}>{tr ? 'Açıklama' : 'Description'}</label>
                    <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 py-3 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15" rows={2} />
                  </div>
                  {/* File upload */}
                  <div>
                    <label className={LABEL}>{tr ? 'Kanıt Belgesi' : 'Proof Document'}</label>
                    <div className="rounded-2xl border-2 border-dashed border-[#95A847]/30 bg-[#95A847]/4 p-5 text-center transition hover:border-[#95A847]/50 hover:bg-[#95A847]/7">
                      {file ? (
                        <div className="flex items-center justify-between rounded-xl bg-[#95A847]/10 px-4 py-2.5">
                          <span className="flex items-center gap-2 truncate text-xs font-bold text-[#75863B]">
                            <FileText className="h-3.5 w-3.5 shrink-0" />{file.name}
                          </span>
                          <button type="button" onClick={() => setFile(null)} className="shrink-0 text-xs font-bold text-red-400 hover:text-red-600">✕</button>
                        </div>
                      ) : (
                        <>
                          <input type="file" id="proof-upload" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setFile(e.target.files[0] || null)} className="hidden" />
                          <label htmlFor="proof-upload" className="cursor-pointer">
                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#95A847]/15 text-[#95A847]">
                              <Paperclip className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-bold text-[#302817]/60">{tr ? 'Dosya bırakın veya göz atın' : 'Drop file or browse'}</p>
                            <p className="mt-1 text-[10px] text-[#302817]/35">{tr ? 'Fatura, sayaç, ESG belgesi · max 10MB' : 'Invoice, meter reading, ESG doc · max 10MB'}</p>
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200/60 bg-red-50/60 px-4 py-3 text-xs font-bold text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />{formError}
                  </div>
                )}
              </form>
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-[#302817]/8 bg-[#F8F8F8]/80 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
              <button type="button" onClick={() => { setShowAddForm(false); resetAddForm(); }} className="rounded-full border border-[#302817]/10 bg-white px-5 py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8]">
                {tr ? 'İptal' : 'Cancel'}
              </button>
              <button type="submit" form="add-entry-form" disabled={submitting} className="rounded-full bg-[#302817] px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition-colors hover:bg-black disabled:opacity-60">
                {submitting ? (tr ? 'Kaydediliyor…' : 'Saving…') : (tr ? 'Kaydet' : 'Save Entry')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ EDIT MODAL ══════════════════════════════════ */}
      {editing && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-md`}>
            <div className="flex shrink-0 items-center justify-between border-b border-[#302817]/8 px-4 py-3 sm:px-6 sm:py-4">
              <h2 className="text-base font-bold">{tr ? 'Kaydı Düzenle' : 'Edit Entry'}</h2>
              <button onClick={() => setEditing(null)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#302817]/40 hover:bg-[#302817]/5"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <p className="mb-4 text-sm font-semibold text-[#302817]/60">
                {tr && editing.emission_factor_name_tr ? editing.emission_factor_name_tr : editing.emission_factor_name}
              </p>
              <form id="edit-form" onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className={LABEL}>{tr ? 'Miktar' : 'Quantity'} ({editing.unit})</label>
                  <input type="number" step="any" value={editQty} onChange={e => setEditQty(e.target.value)} className={FIELD} required />
                </div>
                <div>
                  <label className={LABEL}>{tr ? 'Tesis' : 'Facility'}</label>
                  {facilityList.length > 0 ? (
                    <select value={editFacility} onChange={e => setEditFacility(e.target.value)} className={FIELD}>
                      <option value="">{tr ? 'Seçiniz' : 'Select'}</option>
                      {facilityList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={editFacility} onChange={e => setEditFacility(e.target.value)} className={FIELD} />
                  )}
                </div>
                <div>
                  <label className={LABEL}>{tr ? 'Açıklama' : 'Description'}</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 py-3 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15" rows={2} />
                </div>
              </form>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-[#302817]/8 px-4 py-3 sm:px-6 sm:py-4">
              <button type="button" onClick={() => setEditing(null)} disabled={editSaving} className="flex-1 rounded-full border border-[#302817]/10 bg-white py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8] disabled:opacity-60">{tr ? 'İptal' : 'Cancel'}</button>
              <button type="submit" form="edit-form" disabled={editSaving} className="flex-1 rounded-full bg-[#302817] py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/12 transition hover:bg-black disabled:opacity-60">{editSaving ? '…' : (tr ? 'Kaydet' : 'Save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ DELETE CONFIRM DIALOG ═══════════════════════ */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        type="danger"
        title={tr ? 'Kaydı Sil' : 'Delete Entry'}
        message={tr ? 'Bu kaydı silmek istediğinize emin misiniz?' : 'Delete this entry?'}
        confirmText={tr ? 'Sil' : 'Delete'}
        cancelText={tr ? 'İptal' : 'Cancel'}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* ═══════════════════ CUSTOM REQUEST MODAL ════════════════════════ */}
      {showCustom && (
        <div className={OVERLAY}>
          <div className={`${MODAL} max-w-2xl`}>
            <div className="flex shrink-0 items-center justify-between border-b border-[#302817]/8 px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <h2 className="text-base font-bold">{tr ? 'Özel Emisyon Talebi' : 'Custom Emission Request'}</h2>
                <p className="mt-0.5 text-xs text-[#302817]/45">{tr ? 'Listede olmayan kaynak? Admin onaylayacak.' : "Source not in the list? Admin will review."}</p>
              </div>
              <button onClick={() => setShowCustom(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#302817]/40 hover:bg-[#302817]/5"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <form id="custom-form" onSubmit={handleCustom} className="space-y-4">
                <div>
                  <label className={LABEL}>Scope</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['scope1','scope2','scope3'].map((s, i) => (
                      <button key={s} type="button" onClick={() => setCScope(s)}
                        className={`rounded-2xl border px-3 py-2.5 text-center transition ${cScope === s ? 'border-[#95A847]/50 bg-[#95A847]/10 ring-2 ring-[#95A847]/15' : 'border-[#302817]/10 bg-[#F9EFE5]/40 hover:border-[#95A847]/30'}`}
                      >
                        <p className="text-xs font-bold">Scope {i + 1}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={LABEL}>{tr ? 'Kategori Adı' : 'Category Name'} *</label>
                  <input type="text" value={cCat} onChange={e => setCCat(e.target.value)} placeholder={tr ? 'Örn: Jeneratör yakıtı' : 'e.g. Generator fuel'} className={FIELD} required />
                </div>
                <div>
                  <label className={LABEL}>{tr ? 'Emisyon Kaynağı' : 'Emission Source'} *</label>
                  <input type="text" value={cSrc} onChange={e => setCSrc(e.target.value)} placeholder={tr ? 'Örn: Dizel jeneratör' : 'e.g. Diesel generator'} className={FIELD} required />
                </div>
                <div>
                  <label className={LABEL}>{tr ? 'Açıklama' : 'Description'} *</label>
                  <textarea value={cDesc} onChange={e => setCDesc(e.target.value)} className="w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 py-3 text-sm font-medium outline-none transition focus:ring-4 focus:ring-[#95A847]/15" rows={3} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>{tr ? 'Birim' : 'Unit'} *</label>
                    <input type="text" value={cUnit} onChange={e => setCUnit(e.target.value)} placeholder="litre, kg, kWh…" className={FIELD} required />
                  </div>
                  <div>
                    <label className={LABEL}>{tr ? 'Miktar' : 'Quantity'} *</label>
                    <input type="number" step="any" value={cQty} onChange={e => setCQty(e.target.value)} className={FIELD} required />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>{tr ? 'Ay' : 'Month'}</label>
                  <select value={cMonth} onChange={e => setCMonth(e.target.value)} className={FIELD}>
                    {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </form>
            </div>
            <div className="flex shrink-0 items-center justify-between border-t border-[#302817]/8 bg-[#F8F8F8]/80 px-4 py-3 sm:px-6 sm:py-4">
              <button type="button" onClick={() => setShowCustom(false)} className="rounded-full border border-[#302817]/10 bg-white px-5 py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8]">{tr ? 'İptal' : 'Cancel'}</button>
              <button type="submit" form="custom-form" disabled={cSaving} className="rounded-full bg-[#302817] px-6 py-2.5 text-xs font-bold text-white shadow-lg transition-colors hover:bg-black disabled:opacity-60">
                {cSaving ? '…' : (tr ? 'Talep Gönder' : 'Submit Request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
