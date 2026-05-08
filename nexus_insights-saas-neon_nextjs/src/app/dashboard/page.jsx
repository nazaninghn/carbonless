'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { api } from '@/lib/utils/api';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import {
  Leaf, TrendingDown, FileText, Settings,
  X, Target, Plus, Trash2, AlertCircle, Pencil
} from 'lucide-react';
import OnboardingTour from '@/components/OnboardingTour';
import CompanySettings from '@/components/CompanySettings';
import FacilitySettings from '@/components/FacilitySettings';
import PasswordChange from '@/components/PasswordChange';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import ReviewTab from '@/components/dashboard/ReviewTab';
import FacilityChart from '@/components/dashboard/FacilityChart';
import SettingsTab from '@/components/dashboard/SettingsTab';
import CarbonAIPage from '@/components/dashboard/CarbonAIPage';
import ReportingTab from '@/components/dashboard/ReportingTab';

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedYear, setSelectedYear] = useState(2026);

  // Data from hook
  const {
    user, summary, entries, factors, targets, customRequests,
    questionnaireProfile, unreadCount, facilityList, loading,
    setUnreadCount, fetchData,
  } = useDashboardData(selectedYear);

  // Add Entry form
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedScope, setSelectedScope] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('turkey');
  const [selectedFactor, setSelectedFactor] = useState('');
  const [entryMonth, setEntryMonth] = useState(new Date().getMonth() + 1);
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryFacility, setEntryFacility] = useState('');
  const [entryFile, setEntryFile] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add Target form
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetBaseYear, setTargetBaseYear] = useState(2025);
  const [targetYear, setTargetYear] = useState(2030);
  const [targetBaseEmissions, setTargetBaseEmissions] = useState('');
  const [targetReductionPercent, setTargetReductionPercent] = useState('');

  // Custom Emission Request form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customScope, setCustomScope] = useState('scope1');
  const [customCategory, setCustomCategory] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [customQuantity, setCustomQuantity] = useState('');
  const [customMonth, setCustomMonth] = useState(new Date().getMonth() + 1);
  const [customFacility, setCustomFacility] = useState('');
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [entrySearch, setEntrySearch] = useState('');
  const [entryFilterScope, setEntryFilterScope] = useState('');
  const [pdfLoading, setPdfLoading] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFacility, setEditFacility] = useState('');

  const handleLogout = async () => {
    // Remove beforeunload block so redirect works
    window.onbeforeunload = null;
    const { auth } = await import('@/lib/auth');
    auth.logout();
  };

  const filteredFactors = factors.filter(f => {
    let match = true;
    if (selectedScope) match = match && f.scope === selectedScope;
    if (selectedCategory) match = match && f.category === selectedCategory;
    // Country filter: show selected country factors + global fallback for missing categories
    if (selectedCountry && selectedCountry !== 'global') {
      // Get categories that have country-specific factors
      const countryCategories = new Set(
        factors.filter(ff => ff.country === selectedCountry && (!selectedScope || ff.scope === selectedScope))
          .map(ff => ff.category)
      );
      // Show country-specific if available, otherwise show global
      if (countryCategories.has(f.category)) {
        match = match && f.country === selectedCountry;
      } else {
        match = match && f.country === 'global';
      }
    } else if (selectedCountry) {
      match = match && f.country === selectedCountry;
    }
    // Filter by preferred source from questionnaire (S7) — only for global factors
    // Turkey factors always use national/ATOM KABLO sources regardless of preference
    if (selectedCountry !== 'turkey' && questionnaireProfile?.preferred_factor_source && questionnaireProfile.preferred_factor_source !== 'mixed' && questionnaireProfile.preferred_factor_source !== 'unsure') {
      const sourceMap = { national: ['turkey_grid', 'turkey_fleet', 'atom_kablo'], defra: ['defra_2024'], ipcc: ['ipcc_2006', 'ipcc_2019'] };
      const preferredSources = sourceMap[questionnaireProfile.preferred_factor_source];
      if (preferredSources) match = match && preferredSources.includes(f.source);
    }
    return match;
  });

  const categories = [...new Set(
    factors.filter(f => !selectedScope || f.scope === selectedScope)
      .filter(f => {
        if (!selectedCountry || selectedCountry === 'global') return !selectedCountry || f.country === selectedCountry;
        // For non-global country: show categories from that country + global fallback
        const countryCategories = new Set(
          factors.filter(ff => ff.country === selectedCountry && (!selectedScope || ff.scope === selectedScope))
            .map(ff => ff.category)
        );
        return countryCategories.has(f.category) ? f.country === selectedCountry : f.country === 'global';
      })
      .map(f => f.category)
  )];

  const categoryLabels = {
    stationary_combustion: language === 'tr' ? 'Sabit Yanma' : 'Stationary Combustion',
    mobile_combustion: language === 'tr' ? 'Mobil Yanma' : 'Mobile Combustion',
    fugitive_emissions: language === 'tr' ? 'Kaçak Emisyonlar' : 'Fugitive Emissions',
    process_emissions: language === 'tr' ? 'Proses Emisyonları' : 'Process Emissions',
    electricity: language === 'tr' ? 'Elektrik' : 'Electricity',
    steam_heat: language === 'tr' ? 'Buhar ve Isı' : 'Steam & Heat',
    purchased_goods: language === 'tr' ? 'Satın Alınan Mallar' : 'Purchased Goods',
    capital_goods: language === 'tr' ? 'Sermaye Malları' : 'Capital Goods',
    fuel_energy: language === 'tr' ? 'Yakıt ve Enerji' : 'Fuel & Energy',
    upstream_transport: language === 'tr' ? 'Yukarı Akış Taşıma' : 'Upstream Transport',
    waste: language === 'tr' ? 'Atık' : 'Waste',
    business_travel: language === 'tr' ? 'İş Seyahati' : 'Business Travel',
    employee_commuting: language === 'tr' ? 'Çalışan Ulaşımı' : 'Employee Commuting',
    upstream_leased: language === 'tr' ? 'Kiralık Varlıklar (Yukarı)' : 'Upstream Leased Assets',
    downstream_transport: language === 'tr' ? 'Aşağı Akış Taşıma' : 'Downstream Transport',
    processing_of_sold_products: language === 'tr' ? 'Satılan Ürünlerin İşlenmesi' : 'Processing of Sold Products',
    use_of_sold_products: language === 'tr' ? 'Satılan Ürünlerin Kullanımı' : 'Use of Sold Products',
    end_of_life: language === 'tr' ? 'Ömür Sonu' : 'End of Life',
    downstream_leased: language === 'tr' ? 'Kiralık Varlıklar (Aşağı)' : 'Downstream Leased Assets',
    franchises: language === 'tr' ? 'Franchise' : 'Franchises',
    investments: language === 'tr' ? 'Yatırımlar' : 'Investments',
    water: language === 'tr' ? 'Su' : 'Water',
    custom: language === 'tr' ? 'Özel' : 'Custom',
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      let res;
      if (entryFile) {
        // Use FormData for file upload
        const fd = new FormData();
        fd.append('emission_factor', parseInt(selectedFactor));
        fd.append('year', selectedYear);
        fd.append('month', parseInt(entryMonth));
        fd.append('quantity', entryQuantity);
        fd.append('description', entryDescription);
        if (entryFacility) fd.append('facility', entryFacility);
        fd.append('proof_document', entryFile);
        res = await api.createEntryWithFile(fd);
      } else {
        res = await api.createEntry({
          emission_factor: parseInt(selectedFactor),
          year: selectedYear,
          month: parseInt(entryMonth),
          quantity: entryQuantity,
          description: entryDescription,
          facility: entryFacility,
        });
      }
      if (res.ok) {
        setShowAddForm(false);
        setSelectedScope(''); setSelectedCategory(''); setSelectedFactor('');
        setEntryQuantity(''); setEntryDescription(''); setEntryFacility(''); setEntryFile(null);
        fetchData();
      } else {
        const data = await res.json();
        setFormError(JSON.stringify(data));
      }
    } catch { setFormError('Connection error'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteEntry = async (id) => {
    if (!confirm(language === 'tr' ? 'Bu kaydı silmek istediğinize emin misiniz?' : 'Delete this entry?')) return;
    await api.deleteEntry(id);
    fetchData();
  };

  const handleEditEntry = async (e) => {
    e.preventDefault();
    if (!editingEntry) return;
    const res = await api.updateEntry(editingEntry.id, {
      quantity: editQuantity,
      description: editDescription,
      facility: editFacility,
    });
    if (res.ok) {
      setEditingEntry(null);
      fetchData();
    }
  };

  const handleAddTarget = async (e) => {
    e.preventDefault();
    const res = await api.createTarget({
      title: targetTitle, base_year: targetBaseYear, target_year: targetYear,
      base_emissions_kg: parseFloat(targetBaseEmissions) * 1000,
      target_reduction_percent: targetReductionPercent,
    });
    if (res.ok) {
      setShowTargetForm(false);
      setTargetTitle(''); setTargetBaseEmissions(''); setTargetReductionPercent('');
      fetchData();
    }
  };

  const handleCustomRequest = async (e) => {
    e.preventDefault();
    setCustomSubmitting(true);
    const res = await api.createCustomRequest({
      scope: customScope,
      category_name: customCategory,
      source_name: customSource,
      description: customDescription,
      unit: customUnit,
      quantity: customQuantity,
      year: selectedYear,
      month: parseInt(customMonth),
      facility: customFacility,
    });
    if (res.ok) {
      setShowCustomForm(false);
      setCustomScope('scope1'); setCustomCategory(''); setCustomSource('');
      setCustomDescription(''); setCustomUnit(''); setCustomQuantity(''); setCustomFacility('');
      fetchData();
    }
    setCustomSubmitting(false);
  };

  const months = language === 'tr'
    ? ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const scopeLabel = (s) => s === 'scope1' ? 'Scope 1' : s === 'scope2' ? 'Scope 2' : 'Scope 3';

  const selectedFactorObj = factors.find(f => f.id === parseInt(selectedFactor));

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#302817] flex font-inter">
      {/* Sidebar */}
      <DashboardSidebar
        language={language}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={handleLogout}
      />

      {/* Main */}
      <div className="min-w-0 max-w-full flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <DashboardHeader
          language={language}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          selectedCountry={selectedCountry}
          setSelectedCountry={setSelectedCountry}
          unreadCount={unreadCount}
          setUnreadCount={setUnreadCount}
          setSidebarOpen={setSidebarOpen}
        />

        <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden p-3 sm:p-4 lg:p-5">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-[#95A847] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="mx-auto w-full min-w-0 max-w-[1380px] overflow-x-hidden">

          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <DashboardOverview
              language={language}
              selectedYear={selectedYear}
              summary={summary}
              entries={entries}
              targets={targets}
              facilityList={facilityList}
              questionnaireProfile={questionnaireProfile}
              setActiveTab={setActiveTab}
              setShowAddForm={setShowAddForm}
            />
          )}

          {/* ===== EMISSIONS TAB ===== */}
          {activeTab === 'emissions' && (
            <div className="space-y-4 text-[#302817]">
              {/* Header */}
              <div className="rounded-[1.5rem] border border-[#302817]/10 bg-gradient-to-br from-[#F9EFE5] via-white to-[#B4BE6A]/8 p-5 shadow-[0_6px_24px_rgba(48,40,23,0.05)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#95A847]">{language === 'tr' ? 'Emisyon çalışma alanı' : 'Emission workspace'}</p>
                    <h1 className="mt-1.5 text-xl font-bold tracking-[-0.03em] sm:text-2xl">{language === 'tr' ? 'Emisyon Yönetimi' : 'Emission Management'}</h1>
                    <p className="mt-1 text-sm text-[#302817]/55">{language === 'tr' ? 'Emisyon verilerinizi girin ve yönetin' : 'Enter and manage your emission data'}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowAddForm(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#302817] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black">
                      <Plus className="w-3.5 h-3.5" />{language === 'tr' ? 'Yeni Kayıt' : 'New Entry'}
                    </button>
                    <button onClick={() => setShowCustomForm(true)} className="inline-flex items-center gap-1.5 rounded-full border border-[#95A847]/40 bg-[#95A847]/10 px-4 py-2.5 text-xs font-bold text-[#75863B] transition hover:bg-[#95A847]/18">
                      <Plus className="w-3.5 h-3.5" />{language === 'tr' ? 'Özel Talep' : 'Custom'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mini KPIs */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-[#302817]/8 bg-white/80 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase text-[#302817]/40">{language === 'tr' ? 'Toplam Kayıt' : 'Total Entries'}</p>
                  <p className="mt-0.5 text-lg font-bold">{entries.length}</p>
                </div>
                <div className="rounded-xl border border-[#302817]/8 bg-white/80 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase text-[#302817]/40">Scope 1</p>
                  <p className="mt-0.5 text-lg font-bold">{entries.filter(e => e.scope === 'scope1').length}</p>
                </div>
                <div className="rounded-xl border border-[#302817]/8 bg-white/80 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase text-[#302817]/40">Scope 2</p>
                  <p className="mt-0.5 text-lg font-bold">{entries.filter(e => e.scope === 'scope2').length}</p>
                </div>
                <div className="rounded-xl border border-[#302817]/8 bg-white/80 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase text-[#302817]/40">Scope 3</p>
                  <p className="mt-0.5 text-lg font-bold">{entries.filter(e => e.scope === 'scope3').length}</p>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="flex flex-wrap gap-2">
                <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border border-[#302817]/10 bg-white px-3.5 py-2.5 shadow-sm">
                  <svg className="h-4 w-4 text-[#302817]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input
                    type="text"
                    value={entrySearch}
                    onChange={e => setEntrySearch(e.target.value)}
                    placeholder={language === 'tr' ? 'Kaynak ara...' : 'Search source...'}
                    className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-[#302817]/30"
                  />
                </div>
                <select value={entryFilterScope} onChange={e => setEntryFilterScope(e.target.value)} className="rounded-xl border border-[#302817]/10 bg-white px-3.5 py-2.5 text-xs font-bold text-[#302817] shadow-sm outline-none">
                  <option value="">{language === 'tr' ? 'Tüm Scopelar' : 'All Scopes'}</option>
                  <option value="scope1">Scope 1</option>
                  <option value="scope2">Scope 2</option>
                  <option value="scope3">Scope 3</option>
                </select>
              </div>

              {/* Add Entry Modal */}
              {showAddForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-md">
                  <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#302817]/8 bg-white/82 shadow-[0_20px_60px_rgba(48,40,23,0.12)] backdrop-blur-2xl">
                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between border-b border-[#302817]/8 px-6 py-4">
                      <div>
                        <h2 className="text-lg font-bold tracking-[-0.02em] text-[#302817]">{language === 'tr' ? 'Emisyon Verisi Ekle' : 'Add Emission Entry'}</h2>
                        <p className="mt-0.5 text-xs text-[#302817]/45">{language === 'tr' ? 'Aktivite verisi ve kanıt belgesi kaydedin' : 'Record activity data and supporting evidence'}</p>
                      </div>
                      <button onClick={() => setShowAddForm(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#302817]/40 transition hover:bg-[#302817]/5"><X className="w-4 h-4" /></button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                      <form id="add-entry-form" onSubmit={handleAddEntry} className="space-y-5">
                        {/* Section: Emission Info */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{language === 'tr' ? 'Emisyon bilgisi' : 'Emission info'}</p>

                          {/* Scope Segmented */}
                          <div>
                            <label className="mb-2 block text-xs font-bold text-[#302817]/60">Scope</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { val: 'scope1', label: 'Scope 1', sub: language === 'tr' ? 'Doğrudan' : 'Direct' },
                                { val: 'scope2', label: 'Scope 2', sub: language === 'tr' ? 'Enerji' : 'Energy' },
                                { val: 'scope3', label: 'Scope 3', sub: language === 'tr' ? 'Dolaylı' : 'Indirect' },
                              ].map(s => (
                                <button key={s.val} type="button" onClick={() => { setSelectedScope(s.val); setSelectedCategory(''); setSelectedFactor(''); }}
                                  className={`rounded-2xl border px-3 py-3 text-center transition ${selectedScope === s.val ? 'border-[#95A847]/50 bg-[#95A847]/12 ring-2 ring-[#95A847]/15' : 'border-[#302817]/10 bg-[#F9EFE5]/40 hover:border-[#95A847]/30'}`}>
                                  <p className="text-xs font-bold text-[#302817]">{s.label}</p>
                                  <p className="text-[10px] text-[#302817]/40">{s.sub}</p>
                                </button>
                              ))}
                            </div>
                          </div>

                          {selectedScope && (
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Kategori' : 'Category'}</label>
                              <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedFactor(''); }} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required>
                                <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                                {categories.map(c => <option key={c} value={c}>{categoryLabels[c] || c}</option>)}
                              </select>
                            </div>
                          )}

                          {selectedCategory && (
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Emisyon Kaynağı' : 'Emission Source'}</label>
                              <select value={selectedFactor} onChange={e => setSelectedFactor(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required>
                                <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                                {filteredFactors.map(f => (
                                  <option key={f.id} value={f.id}>{language === 'tr' && f.name_tr ? f.name_tr : f.name} ({f.factor_kg_co2e} kg CO₂e/{f.unit})</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {selectedFactorObj && (
                            <div className="rounded-2xl border border-[#95A847]/25 bg-[#95A847]/8 px-4 py-3">
                              <p className="text-xs font-bold text-[#75863B]">{language === 'tr' ? 'Seçilen Faktör:' : 'Selected Factor:'} {selectedFactorObj.factor_kg_co2e} kg CO₂e / {selectedFactorObj.unit}</p>
                              <p className="mt-1 text-[10px] text-[#75863B]/70">⚠️ {language === 'tr' ? `Miktarı ${selectedFactorObj.unit} cinsinden giriniz` : `Enter quantity in ${selectedFactorObj.unit}`}</p>
                            </div>
                          )}
                        </div>

                        {/* Section: Measurement */}
                        <div className="space-y-3 border-t border-[#302817]/8 pt-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{language === 'tr' ? 'Ölçüm' : 'Measurement'}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Ay' : 'Month'}</label>
                              <select value={entryMonth} onChange={e => setEntryMonth(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15">
                                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Miktar' : 'Quantity'} {selectedFactorObj ? `(${selectedFactorObj.unit})` : ''}</label>
                              <input type="number" step="any" min="0" value={entryQuantity} onChange={e => setEntryQuantity(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required />
                            </div>
                          </div>

                          {entryQuantity && selectedFactorObj && (
                            <div className="rounded-2xl border border-blue-200/60 bg-blue-50/60 px-4 py-3">
                              <p className="text-xs font-bold text-blue-700">
                                {language === 'tr' ? 'Tahmini:' : 'Estimated:'} {(parseFloat(entryQuantity) * parseFloat(selectedFactorObj.factor_kg_co2e)).toFixed(2)} kg CO₂e ({((parseFloat(entryQuantity) * parseFloat(selectedFactorObj.factor_kg_co2e)) / 1000).toFixed(4)} t)
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Section: Facility */}
                        <div className="space-y-3 border-t border-[#302817]/8 pt-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{language === 'tr' ? 'Tesis' : 'Facility'}</p>
                          {facilityList.length > 0 ? (
                            <select value={entryFacility} onChange={e => setEntryFacility(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15">
                              <option value="">{language === 'tr' ? 'Seçiniz (opsiyonel)' : 'Select (optional)'}</option>
                              {facilityList.map(f => <option key={f.id} value={f.id}>{f.name}{f.city ? ` – ${f.city}` : ''}</option>)}
                            </select>
                          ) : (
                            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/60 px-4 py-3">
                              <p className="text-xs text-amber-800">{language === 'tr' ? 'Henüz tesis eklenmemiş.' : 'No facilities added yet.'}</p>
                              <button type="button" onClick={() => { setShowAddForm(false); setActiveTab('settings'); }} className="mt-1 text-xs font-bold text-[#95A847] hover:underline">
                                {language === 'tr' ? '→ Ayarlar\'dan tesis ekleyin' : '→ Add facility from Settings'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Section: Additional */}
                        <div className="space-y-3 border-t border-[#302817]/8 pt-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{language === 'tr' ? 'Ek bilgiler' : 'Additional details'}</p>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Açıklama' : 'Description'}</label>
                            <textarea value={entryDescription} onChange={e => setEntryDescription(e.target.value)} className="w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 py-3 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15" rows={2} />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Kanıt Belgesi' : 'Proof Document'}</label>
                            <div className="rounded-2xl border-2 border-dashed border-[#95A847]/30 bg-gradient-to-b from-[#95A847]/5 to-transparent p-6 text-center transition hover:border-[#95A847]/50 hover:bg-[#95A847]/8">
                              {entryFile ? (
                                <div className="flex items-center justify-between rounded-xl bg-[#95A847]/10 px-4 py-2.5">
                                  <span className="text-xs font-bold text-[#75863B] truncate">📎 {entryFile.name}</span>
                                  <button type="button" onClick={() => setEntryFile(null)} className="text-red-400 text-xs font-bold hover:text-red-600">✕</button>
                                </div>
                              ) : (
                                <>
                                  <input type="file" id="proof-upload" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => setEntryFile(e.target.files[0] || null)} className="hidden" />
                                  <label htmlFor="proof-upload" className="cursor-pointer">
                                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#95A847]/15 text-[#95A847]">📄</div>
                                    <p className="text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Dosya bırakın veya göz atın' : 'Drop files here or browse'}</p>
                                    <p className="mt-1 text-[10px] text-[#302817]/35">{language === 'tr' ? 'Fatura, sayaç, ESG belgeleri' : 'Invoices, meter readings, ESG documents'}</p>
                                  </label>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {formError && <div className="rounded-2xl border border-red-200/60 bg-red-50/60 px-4 py-3 text-xs font-bold text-red-600 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{formError}</div>}
                      </form>
                    </div>

                    {/* Sticky Footer */}
                    <div className="flex shrink-0 items-center justify-between border-t border-[#302817]/8 bg-[#F8F8F8]/80 px-6 py-4 backdrop-blur-sm">
                      <button type="button" onClick={() => setShowAddForm(false)} className="rounded-full border border-[#302817]/10 bg-white px-5 py-2.5 text-xs font-bold text-[#302817] transition hover:bg-[#F8F8F8]">
                        {language === 'tr' ? 'İptal' : 'Cancel'}
                      </button>
                      <button type="submit" form="add-entry-form" disabled={submitting} className="rounded-full bg-[#302817] px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-60">
                        {submitting ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save Entry')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Request Modal */}
              {showCustomForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-md">
                  <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[#302817]/8 bg-white/82 shadow-[0_20px_60px_rgba(48,40,23,0.12)] backdrop-blur-2xl">
                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between border-b border-[#302817]/8 px-6 py-4">
                      <div>
                        <h2 className="text-lg font-bold tracking-[-0.02em] text-[#302817]">{language === 'tr' ? 'Özel Emisyon Talebi' : 'Custom Emission Request'}</h2>
                        <p className="mt-0.5 text-xs text-[#302817]/45">{language === 'tr' ? 'Listede olmayan kaynak? Bilgileri girin, admin onaylasın.' : 'Source not in the list? Enter details and admin will review.'}</p>
                      </div>
                      <button onClick={() => setShowCustomForm(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#302817]/40 transition hover:bg-[#302817]/5"><X className="w-4 h-4" /></button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                      <form id="custom-request-form" onSubmit={handleCustomRequest} className="space-y-5">
                        {/* Section: Scope */}
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{language === 'tr' ? 'Kapsam' : 'Scope'}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { val: 'scope1', label: 'Scope 1', sub: language === 'tr' ? 'Doğrudan' : 'Direct' },
                              { val: 'scope2', label: 'Scope 2', sub: language === 'tr' ? 'Enerji' : 'Energy' },
                              { val: 'scope3', label: 'Scope 3', sub: language === 'tr' ? 'Dolaylı' : 'Indirect' },
                            ].map(s => (
                              <button key={s.val} type="button" onClick={() => setCustomScope(s.val)}
                                className={`rounded-2xl border px-3 py-3 text-center transition ${customScope === s.val ? 'border-[#95A847]/50 bg-[#95A847]/12 ring-2 ring-[#95A847]/15' : 'border-[#302817]/10 bg-[#F9EFE5]/40 hover:border-[#95A847]/30'}`}>
                                <p className="text-xs font-bold text-[#302817]">{s.label}</p>
                                <p className="text-[10px] text-[#302817]/40">{s.sub}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Section: Source Details */}
                        <div className="space-y-3 border-t border-[#302817]/8 pt-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{language === 'tr' ? 'Kaynak bilgisi' : 'Source details'}</p>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Kategori Adı' : 'Category Name'} *</label>
                            <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder={language === 'tr' ? 'Örn: Jeneratör yakıtı' : 'e.g. Generator fuel'} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15 placeholder:text-[#302817]/30" required />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Emisyon Kaynağı' : 'Emission Source'} *</label>
                            <input type="text" value={customSource} onChange={e => setCustomSource(e.target.value)} placeholder={language === 'tr' ? 'Örn: Dizel jeneratör' : 'e.g. Diesel generator'} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15 placeholder:text-[#302817]/30" required />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Açıklama' : 'Description'} *</label>
                            <textarea value={customDescription} onChange={e => setCustomDescription(e.target.value)} placeholder={language === 'tr' ? 'Detaylı açıklama yazın...' : 'Write detailed description...'} className="w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 py-3 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15 placeholder:text-[#302817]/30" rows={3} required />
                          </div>
                        </div>

                        {/* Section: Measurement */}
                        <div className="space-y-3 border-t border-[#302817]/8 pt-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#95A847]">{language === 'tr' ? 'Ölçüm' : 'Measurement'}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Birim' : 'Unit'} *</label>
                              <input type="text" value={customUnit} onChange={e => setCustomUnit(e.target.value)} placeholder={language === 'tr' ? 'Örn: litre, kg, kWh' : 'e.g. liters, kg, kWh'} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15 placeholder:text-[#302817]/30" required />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Miktar' : 'Quantity'} *</label>
                              <input type="number" step="any" value={customQuantity} onChange={e => setCustomQuantity(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Ay' : 'Month'}</label>
                              <select value={customMonth} onChange={e => setCustomMonth(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15">
                                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Tesis' : 'Facility'}</label>
                              <input type="text" value={customFacility} onChange={e => setCustomFacility(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium text-[#302817] outline-none transition focus:ring-4 focus:ring-[#95A847]/15 placeholder:text-[#302817]/30" />
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>

                    {/* Sticky Footer */}
                    <div className="flex shrink-0 items-center justify-between border-t border-[#302817]/8 bg-[#F8F8F8]/80 px-6 py-4 backdrop-blur-sm">
                      <button type="button" onClick={() => setShowCustomForm(false)} className="rounded-full border border-[#302817]/10 bg-white px-5 py-2.5 text-xs font-bold text-[#302817] transition hover:bg-[#F8F8F8]">
                        {language === 'tr' ? 'İptal' : 'Cancel'}
                      </button>
                      <button type="submit" form="custom-request-form" disabled={customSubmitting} className="rounded-full bg-[#302817] px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black disabled:opacity-60">
                        {customSubmitting ? '...' : (language === 'tr' ? 'Talep Gönder' : 'Submit Request')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Requests List */}
              {customRequests.length > 0 && (
                <div className="bg-white/75 rounded-[1.5rem] border border-[#302817]/10 shadow-[0_6px_20px_rgba(48,40,23,0.045)] p-6">
                  <h3 className="font-semibold text-[#302817] mb-4">{language === 'tr' ? 'Özel Talepleriniz' : 'Your Custom Requests'}</h3>
                  <div className="space-y-3">
                    {customRequests.map(cr => (
                      <div key={cr.id} className="flex items-center justify-between p-3 bg-[#F8F8F8] rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-[#302817]">{cr.source_name}</p>
                          <p className="text-xs text-[#302817]/55">{cr.category_name} · {cr.quantity} {cr.unit}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${cr.status === 'approved' ? 'bg-green-100 text-green-700' : cr.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {cr.status === 'approved' ? (language === 'tr' ? 'Onaylandı' : 'Approved') : cr.status === 'rejected' ? (language === 'tr' ? 'Reddedildi' : 'Rejected') : (language === 'tr' ? 'Beklemede' : 'Pending')}
                          {cr.status === 'approved' && cr.calculated_co2e_kg && ` · ${(cr.calculated_co2e_kg / 1000).toFixed(4)} tCO2e`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Entries Table */}
              {entries.length === 0 ? (
                <div className="bg-white/75 rounded-[1.5rem] border border-[#302817]/10 shadow-[0_6px_20px_rgba(48,40,23,0.045)] p-12 text-center">
                  <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-[#302817] mb-2">{language === 'tr' ? 'Henüz veri yok' : 'No data yet'}</h3>
                  <p className="text-[#302817]/55 mb-4">{language === 'tr' ? 'Emisyon verisi ekleyerek başlayın' : 'Start by adding emission data'}</p>
                  <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-[#302817] text-white rounded-lg hover:bg-black transition-colors inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" />{language === 'tr' ? 'İlk Kaydı Ekle' : 'Add First Entry'}
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[1.5rem] border border-[#302817]/10 bg-white/80 shadow-[0_6px_20px_rgba(48,40,23,0.04)]">
                  <table className="w-full min-w-[760px] text-sm">
                      <thead className="border-b border-[#302817]/8">
                        <tr className="bg-[#F8F8F8]">
                          <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#302817]/40">{language === 'tr' ? 'Kaynak' : 'Source'}</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#302817]/40">Scope</th>
                          <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#302817]/40">{language === 'tr' ? 'Ay' : 'Month'}</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#302817]/40">{language === 'tr' ? 'Miktar' : 'Qty'}</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#302817]/40">kg CO₂e</th>
                          <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#302817]/40">tCO₂e</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#302817]/6">
                        {entries.filter(entry => {
                          const name = (language === 'tr' && entry.emission_factor_name_tr ? entry.emission_factor_name_tr : entry.emission_factor_name) || '';
                          const matchSearch = !entrySearch || name.toLowerCase().includes(entrySearch.toLowerCase());
                          const matchScope = !entryFilterScope || entry.scope === entryFilterScope;
                          return matchSearch && matchScope;
                        }).map(entry => (
                          <tr key={entry.id} className="transition-colors hover:bg-[#F9EFE5]/50">
                            <td className="px-4 py-3 text-sm font-semibold text-[#302817]">{language === 'tr' && entry.emission_factor_name_tr ? entry.emission_factor_name_tr : entry.emission_factor_name}</td>
                            <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${entry.scope === 'scope1' ? 'bg-[#302817]/10 text-[#302817]' : entry.scope === 'scope2' ? 'bg-[#95A847]/15 text-[#75863B]' : 'bg-[#B4BE6A]/18 text-[#75863B]'}`}>{scopeLabel(entry.scope)}</span></td>
                            <td className="px-4 py-3 text-xs text-[#302817]/55">{months[entry.month - 1]}</td>
                            <td className="px-4 py-3 text-right text-xs font-semibold text-[#302817]/70">{parseFloat(entry.quantity).toLocaleString()} <span className="text-[#302817]/35">{entry.unit}</span></td>
                            <td className="px-4 py-3 text-right text-sm font-bold text-[#302817]">{parseFloat(entry.calculated_co2e_kg).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right text-xs text-[#302817]/50">{(parseFloat(entry.calculated_co2e_kg) / 1000).toFixed(4)}</td>
                            <td className="px-4 py-3 text-right flex gap-1 justify-end">
                              <button onClick={() => { setEditingEntry(entry); setEditQuantity(entry.quantity); setEditDescription(entry.description || ''); setEditFacility(entry.facility || ''); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/35 transition hover:bg-[#95A847]/15 hover:text-[#95A847]"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteEntry(entry.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#302817]/35 transition hover:bg-red-50 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              )}
              {/* Edit Entry Modal */}
              {editingEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#302817]/30 p-4 backdrop-blur-sm">
                  <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[1.5rem] bg-white p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold">{language === 'tr' ? 'Kaydı Düzenle' : 'Edit Entry'}</h2>
                      <button onClick={() => setEditingEntry(null)}><X className="w-5 h-5" /></button>
                    </div>
                    <p className="text-sm text-[#302817]/55 mb-4">{language === 'tr' && editingEntry.emission_factor_name_tr ? editingEntry.emission_factor_name_tr : editingEntry.emission_factor_name}</p>
                    <form onSubmit={handleEditEntry} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#302817] mb-1">{language === 'tr' ? 'Miktar' : 'Quantity'} ({editingEntry.unit})</label>
                        <input type="number" step="any" value={editQuantity} onChange={e => setEditQuantity(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-lg" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#302817] mb-1">{language === 'tr' ? 'Tesis' : 'Facility'}</label>
                        <input type="text" value={editFacility} onChange={e => setEditFacility(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#302817] mb-1">{language === 'tr' ? 'Açıklama' : 'Description'}</label>
                        <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full px-3 py-2 border border-[#302817]/10 rounded-lg" rows={2} />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 py-2 bg-[#302817] text-white rounded-lg hover:bg-black">{language === 'tr' ? 'Kaydet' : 'Save'}</button>
                        <button type="button" onClick={() => setEditingEntry(null)} className="flex-1 py-2 border border-[#302817]/10 rounded-lg hover:bg-[#F8F8F8]">{language === 'tr' ? 'İptal' : 'Cancel'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== REVIEW TAB ===== */}
          {activeTab === 'review' && (
            <ReviewTab language={language} fetchData={fetchData} />
          )}

          {/* ===== REDUCTION TARGETS TAB ===== */}
          {activeTab === 'reduction' && (
            <div className="space-y-4 text-[#302817]">
              {/* Header */}
              <div className="rounded-[1.5rem] border border-[#302817]/10 bg-gradient-to-br from-[#F9EFE5] via-white to-[#B4BE6A]/8 p-5 shadow-[0_6px_24px_rgba(48,40,23,0.05)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#95A847]">{language === 'tr' ? 'Hedef yönetimi' : 'Target management'}</p>
                    <h1 className="mt-1.5 text-xl font-bold tracking-[-0.03em] sm:text-2xl">{language === 'tr' ? 'Azaltma Hedefleri' : 'Reduction Targets'}</h1>
                    <p className="mt-1 text-sm text-[#302817]/55">{language === 'tr' ? 'Karbon azaltma hedeflerinizi belirleyin ve takip edin' : 'Set and track your carbon reduction targets'}</p>
                  </div>
                  <button onClick={() => setShowTargetForm(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[#302817] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black">
                    <Plus className="w-3.5 h-3.5" />{language === 'tr' ? 'Hedef Ekle' : 'Add Target'}
                  </button>
                </div>
              </div>

              {/* Add Target Form */}
              {showTargetForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-md">
                  <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#302817]/8 bg-white/92 shadow-[0_20px_60px_rgba(48,40,23,0.12)] backdrop-blur-2xl">
                    <div className="flex shrink-0 items-center justify-between border-b border-[#302817]/8 px-6 py-4">
                      <div>
                        <h2 className="text-lg font-bold tracking-[-0.02em]">{language === 'tr' ? 'Yeni Hedef' : 'New Target'}</h2>
                        <p className="mt-0.5 text-xs text-[#302817]/45">{language === 'tr' ? 'Karbon azaltma hedefi belirleyin' : 'Set a carbon reduction target'}</p>
                      </div>
                      <button onClick={() => setShowTargetForm(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-[#302817]/40 transition hover:bg-[#302817]/5"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                      <form id="target-form" onSubmit={handleAddTarget} className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Başlık' : 'Title'}</label>
                          <input type="text" value={targetTitle} onChange={e => setTargetTitle(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Baz Yıl' : 'Base Year'}</label>
                            <input type="number" value={targetBaseYear} onChange={e => setTargetBaseYear(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Hedef Yıl' : 'Target Year'}</label>
                            <input type="number" value={targetYear} onChange={e => setTargetYear(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Baz Emisyon (tCO₂e)' : 'Base Emissions (tCO₂e)'}</label>
                            <input type="number" step="any" value={targetBaseEmissions} onChange={e => setTargetBaseEmissions(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold text-[#302817]/60">{language === 'tr' ? 'Azaltma (%)' : 'Reduction (%)'}</label>
                            <input type="number" step="any" value={targetReductionPercent} onChange={e => setTargetReductionPercent(e.target.value)} className="h-12 w-full rounded-2xl border border-[#302817]/10 bg-[#F9EFE5]/40 px-4 text-sm font-medium outline-none transition focus:ring-4 focus:ring-[#95A847]/15" required />
                          </div>
                        </div>
                      </form>
                    </div>
                    <div className="flex shrink-0 items-center justify-between border-t border-[#302817]/8 bg-[#F8F8F8]/80 px-6 py-4">
                      <button type="button" onClick={() => setShowTargetForm(false)} className="rounded-full border border-[#302817]/10 bg-white px-5 py-2.5 text-xs font-bold transition hover:bg-[#F8F8F8]">{language === 'tr' ? 'İptal' : 'Cancel'}</button>
                      <button type="submit" form="target-form" className="rounded-full bg-[#302817] px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#302817]/15 transition hover:-translate-y-0.5 hover:bg-black">{language === 'tr' ? 'Kaydet' : 'Save Target'}</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {targets.length === 0 && !showTargetForm && (
                <div className="flex min-h-44 flex-col items-center justify-center rounded-[1.5rem] border border-[#302817]/10 bg-white/80 p-8 text-center shadow-[0_6px_20px_rgba(48,40,23,0.04)]">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#95A847]/15 text-[#95A847]"><Target className="h-5 w-5" /></div>
                  <p className="text-sm font-bold">{language === 'tr' ? 'Henüz hedef yok' : 'No targets yet'}</p>
                  <p className="mt-1 text-xs text-[#302817]/50">{language === 'tr' ? 'Karbon azaltma hedefi belirleyin' : 'Set a carbon reduction target'}</p>
                </div>
              )}

              {/* Target Cards */}
              {targets.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {targets.map(tgt => {
                    const pct = tgt.target_reduction_percent || 0;
                    return (
                      <div key={tgt.id} className="group rounded-[1.5rem] border border-[#302817]/10 bg-white/80 p-5 shadow-[0_6px_20px_rgba(48,40,23,0.04)] transition hover:shadow-[0_8px_30px_rgba(48,40,23,0.08)]">
                        <div className="mb-3 flex items-start justify-between">
                          <h4 className="text-sm font-bold text-[#302817]">{tgt.title}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${tgt.status === 'on_track' ? 'bg-[#95A847]/15 text-[#75863B]' : tgt.status === 'succeeded' ? 'bg-[#95A847]/25 text-[#75863B]' : 'bg-red-50 text-red-500'}`}>
                            {tgt.status === 'on_track' ? (language === 'tr' ? 'Yolunda' : 'On Track') : tgt.status === 'succeeded' ? (language === 'tr' ? 'Başarılı' : 'Succeeded') : (language === 'tr' ? 'Geride' : 'Off Track')}
                          </span>
                        </div>
                        <div className="mb-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-[#F8F8F8] px-3 py-2">
                            <p className="text-[10px] font-bold text-[#302817]/35">{language === 'tr' ? 'Dönem' : 'Period'}</p>
                            <p className="text-xs font-bold">{tgt.base_year} → {tgt.target_year}</p>
                          </div>
                          <div className="rounded-xl bg-[#F8F8F8] px-3 py-2">
                            <p className="text-[10px] font-bold text-[#302817]/35">{language === 'tr' ? 'Baz' : 'Base'}</p>
                            <p className="text-xs font-bold">{(tgt.base_emissions_kg / 1000).toFixed(1)} t</p>
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#302817]/40">{language === 'tr' ? 'Hedef' : 'Target'}</span>
                            <span className="text-xs font-bold text-[#95A847]">-{pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#302817]/6">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#75863B] to-[#95A847] transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== REPORTING TAB ===== */}
          {activeTab === 'reporting' && (
            <ReportingTab language={language} selectedYear={selectedYear} summary={summary} entries={entries} targets={targets} questionnaireProfile={questionnaireProfile} />
          )}

          {/* ===== SETTINGS TAB ===== */}
          {activeTab === 'settings' && (
            <SettingsTab language={language} user={user} fetchData={fetchData} />
          )}

          {/* ===== AI CARBON TAB ===== */}
          {activeTab === 'ai_carbon' && (
            <CarbonAIPage language={language} />
          )}
            </div>
          )}
        </main>
      </div>

      {/* Onboarding Tour */}
      <OnboardingTour language={language} />
    </div>
  );
}

function MetricCard({ title, value, unit, subtitle }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#302817]-400">{title}</p>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tight text-[#302817]-950">{value}</span>
        <span className="mb-1 text-sm font-semibold text-[#302817]-400">{unit}</span>
      </div>
      <p className="mt-2 text-sm text-[#302817]-500">{subtitle}</p>
    </div>
  );
}


