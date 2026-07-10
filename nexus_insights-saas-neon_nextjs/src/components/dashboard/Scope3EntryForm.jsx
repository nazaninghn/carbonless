'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';
import { Leaf, ChevronDown, RotateCcw, Send } from 'lucide-react';
import { MONTHS_TR, MONTHS_EN } from '@/lib/constants/emissions';

/**
 * Scope3EntryForm – cascading form for all 15 Scope 3 categories + water.
 *
 * Behaviour:
 *  1. On mount → GET /api/emissions/scope3-categories/
 *  2. Category dropdown → Sub-type dropdown → Quantity input (dynamic unit label)
 *  3. Year / Month selectors (default to current)
 *  4. On submit → POST /api/emissions/entries/ with activity_type, quantity, unit
 *  5. Bilingual labels (EN/TR) from the category registry
 */
export default function Scope3EntryForm({ language, fetchData }) {
  const tr = language === 'tr';
  const toast = useToast();

  // ── State ───────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubtype, setSelectedSubtype] = useState('');
  const [quantity, setQuantity] = useState('');
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch categories on mount ───────────────────────────────────────────────
  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true);
    setFetchError(false);
    try {
      const res = await api.getScope3Categories();
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories ?? []);
      } else {
        setFetchError(true);
        toast.error(tr ? 'Kategoriler yüklenemedi' : 'Failed to load categories');
      }
    } catch {
      setFetchError(true);
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setLoadingCategories(false);
    }
  }, [tr, toast]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const currentCategory = useMemo(
    () => categories.find(c => c.key === selectedCategory) ?? null,
    [categories, selectedCategory]
  );

  const subtypes = useMemo(
    () => currentCategory?.subtypes ?? [],
    [currentCategory]
  );

  const currentSubtype = useMemo(
    () => subtypes.find(s => s.key === selectedSubtype) ?? null,
    [subtypes, selectedSubtype]
  );

  const unitLabel = currentSubtype?.unit ?? '';

  // Reset sub-type when category changes
  useEffect(() => {
    setSelectedSubtype('');
    setQuantity('');
  }, [selectedCategory]);

  // Reset quantity when sub-type changes
  useEffect(() => {
    setQuantity('');
  }, [selectedSubtype]);

  // ── Months ──────────────────────────────────────────────────────────────────
  const months = tr ? MONTHS_TR : MONTHS_EN;
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - i);
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    if (!selectedCategory || !selectedSubtype || !quantity) {
      toast.warning(tr ? 'Lütfen tüm alanları doldurun' : 'Please fill in all fields');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.warning(tr ? 'Miktar sıfırdan büyük olmalı' : 'Quantity must be greater than zero');
      return;
    }

    // Compose activity_type: for franchises it's just "franchises", otherwise "category_subtype"
    const activityType = selectedCategory === 'franchises'
      ? 'franchises'
      : `${selectedCategory}_${selectedSubtype}`;

    setSubmitting(true);
    try {
      const res = await api.createEntry({
        activity_type: activityType,
        quantity: qty,
        unit: unitLabel,
        year,
        month,
        scope: 'scope3',
        category: selectedCategory,
      });

      if (res.ok) {
        toast.success(tr ? 'Emisyon kaydı oluşturuldu ✓' : 'Emission entry created ✓');
        // Reset form
        setSelectedCategory('');
        setSelectedSubtype('');
        setQuantity('');
        // Refresh parent data
        if (fetchData) fetchData();
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || errData.error || (tr ? 'Kayıt oluşturulamadı' : 'Failed to create entry');
        toast.error(msg);
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası — tekrar deneyin' : 'Connection error — please retry');
    } finally {
      setSubmitting(false);
    }
  }, [selectedCategory, selectedSubtype, quantity, unitLabel, year, month, tr, toast, fetchData]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 text-[#072C0E]">
      {/* Header */}
      <div className="rounded-[1.25rem] border border-[#072C0E]/10 bg-gradient-to-br from-[#DEFAE1] via-white to-[#8BEA99]/8 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#2ABD41]">
              {tr ? 'Kapsam 3 Girişi' : 'Scope 3 Entry'}
            </p>
            <h1 className="mt-1 text-lg font-bold tracking-[-0.03em]">
              {tr ? 'Scope 3 Emisyon Kaydı' : 'Scope 3 Emission Entry'}
            </h1>
            <p className="mt-0.5 text-xs text-[#072C0E]/50">
              {tr
                ? '15 GHG Protokolü kategorisinden emisyon kaydedin'
                : 'Log emissions across all 15 GHG Protocol categories'}
            </p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2ABD41]/12 text-[#2ABD41]">
            <Leaf className="h-4.5 w-4.5" />
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="rounded-[1.25rem] border border-[#072C0E]/10 bg-white p-5 shadow-sm">
        {loadingCategories ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#2ABD41] border-t-transparent" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-bold text-red-500">
              {tr ? 'Kategoriler yüklenemedi' : 'Failed to load categories'}
            </p>
            <button
              onClick={fetchCategories}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#2ABD41]/12 px-4 py-2 text-xs font-bold text-[#175022] transition hover:bg-[#2ABD41]/22"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {tr ? 'Tekrar Dene' : 'Retry'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Selector */}
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#072C0E]/60">
                {tr ? 'Kategori' : 'Category'}
              </label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#072C0E]/10 bg-[#F8F8F8] px-3.5 py-2.5 pr-10 text-sm text-[#072C0E] outline-none transition focus:border-[#2ABD41]/40 focus:ring-4 focus:ring-[#2ABD41]/10"
                >
                  <option value="">
                    {tr ? '— Kategori seçin —' : '— Select category —'}
                  </option>
                  {categories.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.ghg_number ? `${cat.ghg_number}. ` : ''}
                      {tr ? cat.name_tr : cat.name_en}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#072C0E]/30" />
              </div>
            </div>

            {/* Sub-type Selector */}
            {selectedCategory && subtypes.length > 0 && (
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#072C0E]/60">
                  {tr ? 'Alt Tip' : 'Sub-type'}
                </label>
                <div className="relative">
                  <select
                    value={selectedSubtype}
                    onChange={(e) => setSelectedSubtype(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-[#072C0E]/10 bg-[#F8F8F8] px-3.5 py-2.5 pr-10 text-sm text-[#072C0E] outline-none transition focus:border-[#2ABD41]/40 focus:ring-4 focus:ring-[#2ABD41]/10"
                  >
                    <option value="">
                      {tr ? '— Alt tip seçin —' : '— Select sub-type —'}
                    </option>
                    {subtypes.map((st) => (
                      <option key={st.key} value={st.key}>
                        {tr ? st.name_tr : st.name_en} ({st.unit})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#072C0E]/30" />
                </div>
              </div>
            )}

            {/* Quantity Input + Unit Label */}
            {selectedSubtype && (
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#072C0E]/60">
                  {tr ? 'Miktar' : 'Quantity'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={tr ? 'Miktar girin...' : 'Enter quantity...'}
                    className="w-full rounded-xl border border-[#072C0E]/10 bg-[#F8F8F8] px-3.5 py-2.5 pr-16 text-sm text-[#072C0E] outline-none transition placeholder:text-[#072C0E]/30 focus:border-[#2ABD41]/40 focus:ring-4 focus:ring-[#2ABD41]/10"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md bg-[#2ABD41]/12 px-2 py-0.5 text-[10px] font-bold text-[#175022]">
                    {unitLabel}
                  </span>
                </div>
              </div>
            )}

            {/* Year & Month */}
            {selectedSubtype && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#072C0E]/60">
                    {tr ? 'Yıl' : 'Year'}
                  </label>
                  <div className="relative">
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full appearance-none rounded-xl border border-[#072C0E]/10 bg-[#F8F8F8] px-3.5 py-2.5 pr-10 text-sm text-[#072C0E] outline-none transition focus:border-[#2ABD41]/40 focus:ring-4 focus:ring-[#2ABD41]/10"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#072C0E]/30" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[#072C0E]/60">
                    {tr ? 'Ay' : 'Month'}
                  </label>
                  <div className="relative">
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="w-full appearance-none rounded-xl border border-[#072C0E]/10 bg-[#F8F8F8] px-3.5 py-2.5 pr-10 text-sm text-[#072C0E] outline-none transition focus:border-[#2ABD41]/40 focus:ring-4 focus:ring-[#2ABD41]/10"
                    >
                      {months.map((label, i) => (
                        <option key={i + 1} value={i + 1}>{label}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#072C0E]/30" />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            {selectedSubtype && (
              <button
                type="submit"
                disabled={submitting || !quantity}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#072C0E] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1A7B2A] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submitting
                  ? (tr ? 'Kaydediliyor...' : 'Submitting...')
                  : (tr ? 'Emisyon Kaydı Oluştur' : 'Create Emission Entry')}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
