'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { api } from '@/lib/utils/api';
import {
  LayoutDashboard, Leaf, TrendingDown, FileText, Settings, LogOut,
  Menu, X, BarChart3, Target, Plus, Trash2, AlertCircle
} from 'lucide-react';
import NextLink from 'next/link';
import Chatbot from '@/components/Chatbot';

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState([]);
  const [factors, setFactors] = useState([]);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questionnaireProfile, setQuestionnaireProfile] = useState(null);

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
  const [customRequests, setCustomRequests] = useState([]);
  const [customSubmitting, setCustomSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, entriesRes, factorsRes, targetsRes, profileRes, customRes] = await Promise.all([
        api.getSummary(selectedYear),
        api.getEntries(`year=${selectedYear}`),
        api.getFactors(),
        api.getTargets(),
        api.getProfile(),
        api.getCustomRequests(),
      ]);
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
        // Extract questionnaire profile from summary
        if (data.questionnaire_profile) {
          setQuestionnaireProfile(data.questionnaire_profile);
        }
      }
      if (entriesRes.ok) {
        const data = await entriesRes.json();
        setEntries(Array.isArray(data) ? data : data.results || []);
      }
      if (factorsRes.ok) {
        const data = await factorsRes.json();
        setFactors(Array.isArray(data) ? data : data.results || []);
      }
      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(Array.isArray(data) ? data : data.results || []);
      }
      if (profileRes.ok) setUser(await profileRes.json());
      if (customRes.ok) {
        const data = await customRes.json();
        setCustomRequests(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { window.location.href = '/login'; return; }
    fetchData();
  }, [fetchData]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  };

  const filteredFactors = factors.filter(f => {
    let match = true;
    if (selectedScope) match = match && f.scope === selectedScope;
    if (selectedCategory) match = match && f.category === selectedCategory;
    if (selectedCountry) match = match && f.country === selectedCountry;
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
      .filter(f => !selectedCountry || f.country === selectedCountry)
      .map(f => f.category)
  )];

  const categoryLabels = {
    stationary_combustion: language === 'tr' ? 'Sabit Yanma' : 'Stationary Combustion',
    mobile_combustion: language === 'tr' ? 'Mobil Yanma' : 'Mobile Combustion',
    fugitive_emissions: language === 'tr' ? 'Kaçak Emisyonlar' : 'Fugitive Emissions',
    electricity: language === 'tr' ? 'Elektrik' : 'Electricity',
    steam_heat: language === 'tr' ? 'Buhar ve Isı' : 'Steam & Heat',
    purchased_goods: language === 'tr' ? 'Satın Alınan Mallar' : 'Purchased Goods',
    capital_goods: language === 'tr' ? 'Sermaye Malları' : 'Capital Goods',
    fuel_energy: language === 'tr' ? 'Yakıt ve Enerji' : 'Fuel & Energy',
    upstream_transport: language === 'tr' ? 'Yukarı Akış Taşıma' : 'Upstream Transport',
    waste: language === 'tr' ? 'Atık' : 'Waste',
    business_travel: language === 'tr' ? 'İş Seyahati' : 'Business Travel',
    employee_commuting: language === 'tr' ? 'Çalışan Ulaşımı' : 'Employee Commuting',
    upstream_leased: language === 'tr' ? 'Kiralık Varlıklar' : 'Upstream Leased',
    downstream_transport: language === 'tr' ? 'Aşağı Akış Taşıma' : 'Downstream Transport',
    end_of_life: language === 'tr' ? 'Ömür Sonu' : 'End of Life',
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
      const res = await api.createEntry({
        emission_factor: parseInt(selectedFactor),
        year: selectedYear,
        month: parseInt(entryMonth),
        quantity: entryQuantity,
        description: entryDescription,
        facility: entryFacility,
      });
      if (res.ok) {
        setShowAddForm(false);
        setSelectedScope(''); setSelectedCategory(''); setSelectedFactor('');
        setEntryQuantity(''); setEntryDescription(''); setEntryFacility('');
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

  const sidebarItems = [
    { key: 'dashboard', icon: LayoutDashboard, label: language === 'tr' ? 'Kontrol Paneli' : 'Dashboard' },
    { key: 'emissions', icon: Leaf, label: language === 'tr' ? 'Emisyon Yönetimi' : 'Emission Management' },
    { key: 'reduction', icon: TrendingDown, label: language === 'tr' ? 'Azaltma Hedefleri' : 'Reduction Targets' },
    { key: 'reporting', icon: FileText, label: language === 'tr' ? 'Raporlama' : 'Reporting' },
    { key: 'settings', icon: Settings, label: language === 'tr' ? 'Ayarlar' : 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
            <NextLink href="/" className="flex items-center gap-2">
              <img src="/carbonless.png" alt="Carbonless" className="h-8 w-auto" />
              <span className="font-bold text-lg gradient-text">Carbonless</span>
            </NextLink>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X className="w-5 h-5" /></button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {sidebarItems.map(item => (
              <button key={item.key} onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === item.key ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50'}`}>
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-semibold">
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-500">{user?.email || ''}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
              <span>{language === 'tr' ? 'Çıkış Yap' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-auto min-h-[4rem] bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 py-2 flex-wrap gap-2">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu className="w-6 h-6" /></button>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="text-sm text-gray-600">{language === 'tr' ? 'Yıl:' : 'Year:'}</span>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option value={2026}>2026</option><option value={2025}>2025</option><option value={2024}>2024</option>
            </select>
            <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option value="turkey">{language === 'tr' ? 'Türkiye' : 'Turkey'}</option>
              <option value="global">{language === 'tr' ? 'Global' : 'Global'}</option>
            </select>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>

          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Questionnaire Status Banner */}
              {questionnaireProfile && !questionnaireProfile.is_complete && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">{language === 'tr' ? 'Karbon envanteri prsşnamesini tamamlayın' : 'Complete the carbon inventory questionnaire'}</p>
                    <p className="text-xs text-amber-700">{language === 'tr' ? 'Sağ alttaki chatbot ile prsşnameyi tamamlayarak raporlama yapılandırmanızı belirleyin.' : 'Use the chatbot (bottom right) to configure your reporting setup.'}</p>
                  </div>
                </div>
              )}
              {questionnaireProfile?.is_complete && questionnaireProfile?.preferred_factor_source && questionnaireProfile.preferred_factor_source !== 'mixed' && questionnaireProfile.preferred_factor_source !== 'unsure' && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Leaf className="w-4 h-4 text-green-600" />
                  </div>
                  <p className="text-xs text-green-800">
                    {language === 'tr' ? `Emisyon faktörleri tercihinize göre filtreleniyor: ` : `Emission factors filtered by your preference: `}
                    <span className="font-semibold">{{ national: language === 'tr' ? 'Ulusal Kaynaklar' : 'National Sources', defra: 'DEFRA', ipcc: 'IPCC' }[questionnaireProfile.preferred_factor_source]}</span>
                  </p>
                </div>
              )}

              <div>
                <h1 className="text-2xl font-bold text-gray-900">{language === 'tr' ? 'Emisyon Profili' : 'Emission Profile'}</h1>
                <p className="text-gray-600 mt-1">{language === 'tr' ? 'Şirketinizin karbon emisyon verilerine genel bakış' : 'Overview of your company carbon emission data'}</p>
              </div>

              {/* Total */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-gray-600">{language === 'tr' ? 'TOPLAM EMİSYONLAR (tCO2e)' : 'TOTAL EMISSIONS (tCO2e)'}</h2>
                  <button onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }} className="text-sm text-primary hover:text-secondary">
                    {language === 'tr' ? 'Veri Ekle' : 'Add Data'}
                  </button>
                </div>
                <div className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2">{summary?.total_tonne?.toFixed(2) || '0.00'}</div>
                <p className="text-sm text-gray-500">{language === 'tr' ? `${selectedYear} yılı toplam şirket emisyonları` : `Total company emissions for ${selectedYear}`}</p>
              </div>

              {/* Scope Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'SCOPE 1', val: summary?.scope1_tonne, sub: language === 'tr' ? 'Doğrudan emisyonlar' : 'Direct emissions' },
                  { label: 'SCOPE 2', val: summary?.scope2_tonne, sub: language === 'tr' ? 'Enerji dolaylı emisyonlar' : 'Energy indirect emissions' },
                  { label: 'SCOPE 3', val: summary?.scope3_tonne, sub: language === 'tr' ? 'Diğer dolaylı emisyonlar' : 'Other indirect emissions' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="text-sm font-medium text-gray-600 mb-2">{s.label} (tCO2e)</div>
                    <div className="text-3xl font-bold text-gray-900 mb-1">{(s.val || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Category Breakdown */}
              {/* Scope Visual Bars */}
              {summary && summary.total_tonne > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'KAPSAM DAĞILIMI' : 'SCOPE DISTRIBUTION'}</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Scope 1', val: summary.scope1_tonne, color: 'bg-red-500' },
                      { label: 'Scope 2', val: summary.scope2_tonne, color: 'bg-yellow-500' },
                      { label: 'Scope 3', val: summary.scope3_tonne, color: 'bg-blue-500' },
                    ].map(s => {
                      const pct = summary.total_tonne > 0 ? (s.val / summary.total_tonne * 100) : 0;
                      return (
                        <div key={s.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{s.label}</span>
                            <span className="text-sm text-gray-600">{s.val.toFixed(2)} tCO2e ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div className={`h-3 rounded-full ${s.color} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly Trend */}
              {summary?.monthly && summary.monthly.some(m => m.total_kg > 0) && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'AYLIK TREND' : 'MONTHLY TREND'}</h3>
                  <div className="flex items-end gap-1 h-40">
                    {summary.monthly.map((m, i) => {
                      const maxKg = Math.max(...summary.monthly.map(x => x.total_kg), 1);
                      const pct = (m.total_kg / maxKg) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-500">{m.total_kg > 0 ? (m.total_kg / 1000).toFixed(2) : ''}</span>
                          <div className="w-full bg-gray-100 rounded-t flex-1 relative" style={{ minHeight: '4px' }}>
                            <div className="absolute bottom-0 left-0 right-0 bg-primary/70 rounded-t transition-all duration-500" style={{ height: `${Math.max(pct, m.total_kg > 0 ? 5 : 0)}%` }}></div>
                          </div>
                          <span className="text-xs text-gray-400">{months[i]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category Breakdown */}
              {summary?.by_category?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'KATEGORİ DAĞILIMI' : 'CATEGORY BREAKDOWN'}</h3>
                  <div className="space-y-3">
                    {summary.by_category.map(c => (
                      <div key={c.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{categoryLabels[c.category] || c.category}</span>
                        <span className="text-sm font-semibold">{(c.total_kg / 1000).toFixed(2)} tCO2e</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-xl border border-primary/20 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center flex-shrink-0">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">{language === 'tr' ? 'Genel İlerleme' : 'Overall Progress'}</h3>
                    <p className="text-sm text-gray-600 mb-4">{language === 'tr' ? 'Karbon azaltma hedeflerinize ulaşmak için veri girişi yapın.' : 'Enter emission data to track your carbon reduction goals.'}</p>
                    <button onClick={() => { setActiveTab('emissions'); setShowAddForm(true); }} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2">
                      <Plus className="w-4 h-4" />{language === 'tr' ? 'Veri Ekle' : 'Add Data'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== EMISSIONS TAB ===== */}
          {activeTab === 'emissions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{language === 'tr' ? 'Emisyon Yönetimi' : 'Emission Management'}</h1>
                  <p className="text-gray-600 mt-1">{language === 'tr' ? 'Emisyon verilerinizi girin ve yönetin' : 'Enter and manage your emission data'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2">
                    <Plus className="w-4 h-4" />{language === 'tr' ? 'Yeni Kayıt' : 'New Entry'}
                  </button>
                  <button onClick={() => setShowCustomForm(true)} className="px-4 py-2 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-2">
                    <Plus className="w-4 h-4" />{language === 'tr' ? 'Özel Talep' : 'Custom Request'}
                  </button>
                </div>
              </div>

              {/* Add Entry Modal */}
              {showAddForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold">{language === 'tr' ? 'Emisyon Verisi Ekle' : 'Add Emission Data'}</h2>
                      <button onClick={() => setShowAddForm(false)}><X className="w-5 h-5" /></button>
                    </div>
                    <form onSubmit={handleAddEntry} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                        <select value={selectedScope} onChange={e => { setSelectedScope(e.target.value); setSelectedCategory(''); setSelectedFactor(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                          <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                          <option value="scope1">Scope 1 – {language === 'tr' ? 'Doğrudan' : 'Direct'}</option>
                          <option value="scope2">Scope 2 – {language === 'tr' ? 'Enerji' : 'Energy'}</option>
                          <option value="scope3">Scope 3 – {language === 'tr' ? 'Dolaylı' : 'Indirect'}</option>
                        </select>
                      </div>
                      {selectedScope && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Kategori' : 'Category'}</label>
                          <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setSelectedFactor(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                            <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                            {categories.map(c => <option key={c} value={c}>{categoryLabels[c] || c}</option>)}
                          </select>
                        </div>
                      )}

                      {selectedCategory && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Emisyon Kaynağı' : 'Emission Source'}</label>
                          <select value={selectedFactor} onChange={e => setSelectedFactor(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                            <option value="">{language === 'tr' ? 'Seçiniz' : 'Select'}</option>
                            {filteredFactors.map(f => (
                              <option key={f.id} value={f.id}>{language === 'tr' && f.name_tr ? f.name_tr : f.name} ({f.factor_kg_co2e} kg CO2e/{f.unit})</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {selectedFactorObj && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                          <p className="font-medium text-green-800">{language === 'tr' ? 'Seçilen ضریب:' : 'Selected Factor:'} {selectedFactorObj.factor_kg_co2e} kg CO2e / {selectedFactorObj.unit}</p>
                          {selectedFactorObj.reference && <p className="text-green-600 mt-1">{selectedFactorObj.reference}</p>}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Ay' : 'Month'}</label>
                          <select value={entryMonth} onChange={e => setEntryMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Miktar' : 'Quantity'} {selectedFactorObj ? `(${selectedFactorObj.unit})` : ''}</label>
                          <input type="number" step="any" value={entryQuantity} onChange={e => setEntryQuantity(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                        </div>
                      </div>

                      {entryQuantity && selectedFactorObj && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                          <p className="font-medium text-blue-800">
                            {language === 'tr' ? 'Tahmini Emisyon:' : 'Estimated Emission:'}{' '}
                            {(parseFloat(entryQuantity) * parseFloat(selectedFactorObj.factor_kg_co2e)).toFixed(2)} kg CO2e
                            {' '}({((parseFloat(entryQuantity) * parseFloat(selectedFactorObj.factor_kg_co2e)) / 1000).toFixed(4)} tCO2e)
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Tesis' : 'Facility'}</label>
                        <input type="text" value={entryFacility} onChange={e => setEntryFacility(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Açıklama' : 'Description'}</label>
                        <textarea value={entryDescription} onChange={e => setEntryDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} />
                      </div>
                      {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{formError}</div>}
                      <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-60">
                        {submitting ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : (language === 'tr' ? 'Kaydet' : 'Save')}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Custom Request Modal */}
              {showCustomForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold">{language === 'tr' ? 'Özel Emisyon Talebi' : 'Custom Emission Request'}</h2>
                      <button onClick={() => setShowCustomForm(false)}><X className="w-5 h-5" /></button>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{language === 'tr' ? 'Listede olmayan bir emisyon kaynağı mı var? Bilgileri girin, admin inceleyip onaylasın.' : 'Emission source not in the list? Enter details and admin will review.'}</p>
                    <form onSubmit={handleCustomRequest} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                        <select value={customScope} onChange={e => setCustomScope(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                          <option value="scope1">Scope 1 – {language === 'tr' ? 'Doğrudan' : 'Direct'}</option>
                          <option value="scope2">Scope 2 – {language === 'tr' ? 'Enerji' : 'Energy'}</option>
                          <option value="scope3">Scope 3 – {language === 'tr' ? 'Dolaylı' : 'Indirect'}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Kategori Adı' : 'Category Name'} *</label>
                        <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder={language === 'tr' ? 'Örn: Jeneratör yakıtı' : 'e.g. Generator fuel'} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Emisyon Kaynağı' : 'Emission Source'} *</label>
                        <input type="text" value={customSource} onChange={e => setCustomSource(e.target.value)} placeholder={language === 'tr' ? 'Örn: Dizel jeneratör' : 'e.g. Diesel generator'} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Açıklama' : 'Description'} *</label>
                        <textarea value={customDescription} onChange={e => setCustomDescription(e.target.value)} placeholder={language === 'tr' ? 'Detaylı açıklama yazın...' : 'Write detailed description...'} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={3} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Birim' : 'Unit'} *</label>
                          <input type="text" value={customUnit} onChange={e => setCustomUnit(e.target.value)} placeholder={language === 'tr' ? 'Örn: litre, kg, kWh' : 'e.g. liters, kg, kWh'} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Miktar' : 'Quantity'} *</label>
                          <input type="number" step="any" value={customQuantity} onChange={e => setCustomQuantity(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Ay' : 'Month'}</label>
                          <select value={customMonth} onChange={e => setCustomMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Tesis' : 'Facility'}</label>
                          <input type="text" value={customFacility} onChange={e => setCustomFacility(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                        </div>
                      </div>
                      <button type="submit" disabled={customSubmitting} className="w-full py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors disabled:opacity-60">
                        {customSubmitting ? '...' : (language === 'tr' ? 'Talep Gönder' : 'Submit Request')}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Custom Requests List */}
              {customRequests.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'Özel Talepleriniz' : 'Your Custom Requests'}</h3>
                  <div className="space-y-3">
                    {customRequests.map(cr => (
                      <div key={cr.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{cr.source_name}</p>
                          <p className="text-xs text-gray-500">{cr.category_name} · {cr.quantity} {cr.unit}</p>
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
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Leaf className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{language === 'tr' ? 'Henüz veri yok' : 'No data yet'}</h3>
                  <p className="text-gray-600 mb-4">{language === 'tr' ? 'Emisyon verisi ekleyerek başlayın' : 'Start by adding emission data'}</p>
                  <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors inline-flex items-center gap-2">
                    <Plus className="w-4 h-4" />{language === 'tr' ? 'İlk Kaydı Ekle' : 'Add First Entry'}
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto -mx-0">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">{language === 'tr' ? 'Kaynak' : 'Source'}</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">Scope</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-600">{language === 'tr' ? 'Ay' : 'Month'}</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">{language === 'tr' ? 'Miktar' : 'Qty'}</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">kg CO2e</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-600">tCO2e</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {entries.map(entry => (
                          <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{language === 'tr' && entry.emission_factor_name_tr ? entry.emission_factor_name_tr : entry.emission_factor_name}</td>
                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${entry.scope === 'scope1' ? 'bg-red-100 text-red-700' : entry.scope === 'scope2' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{scopeLabel(entry.scope)}</span></td>
                            <td className="px-4 py-3">{months[entry.month - 1]}</td>
                            <td className="px-4 py-3 text-right">{parseFloat(entry.quantity).toLocaleString()} {entry.unit}</td>
                            <td className="px-4 py-3 text-right font-medium">{parseFloat(entry.calculated_co2e_kg).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                            <td className="px-4 py-3 text-right">{(parseFloat(entry.calculated_co2e_kg) / 1000).toFixed(4)}</td>
                            <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteEntry(entry.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== REDUCTION TARGETS TAB ===== */}
          {activeTab === 'reduction' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{language === 'tr' ? 'Azaltma Hedefleri' : 'Reduction Targets'}</h1>
                  <p className="text-gray-600 mt-1">{language === 'tr' ? 'Karbon azaltma hedeflerinizi belirleyin' : 'Set your carbon reduction targets'}</p>
                </div>
                <button onClick={() => setShowTargetForm(true)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />{language === 'tr' ? 'Hedef Ekle' : 'Add Target'}
                </button>
              </div>

              {showTargetForm && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold mb-4">{language === 'tr' ? 'Yeni Hedef' : 'New Target'}</h3>
                  <form onSubmit={handleAddTarget} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Başlık' : 'Title'}</label>
                      <input type="text" value={targetTitle} onChange={e => setTargetTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Baz Yıl' : 'Base Year'}</label>
                      <input type="number" value={targetBaseYear} onChange={e => setTargetBaseYear(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Hedef Yıl' : 'Target Year'}</label>
                      <input type="number" value={targetYear} onChange={e => setTargetYear(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Baz Emisyon (tCO2e)' : 'Base Emissions (tCO2e)'}</label>
                      <input type="number" step="any" value={targetBaseEmissions} onChange={e => setTargetBaseEmissions(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'tr' ? 'Azaltma Hedefi (%)' : 'Reduction Target (%)'}</label>
                      <input type="number" step="any" value={targetReductionPercent} onChange={e => setTargetReductionPercent(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                    </div>
                    <div className="md:col-span-2 flex gap-3">
                      <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-secondary">{language === 'tr' ? 'Kaydet' : 'Save'}</button>
                      <button type="button" onClick={() => setShowTargetForm(false)} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">{language === 'tr' ? 'İptal' : 'Cancel'}</button>
                    </div>
                  </form>
                </div>
              )}

              {targets.length === 0 && !showTargetForm ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{language === 'tr' ? 'Henüz hedef yok' : 'No targets yet'}</h3>
                  <p className="text-gray-600">{language === 'tr' ? 'Karbon azaltma hedefi belirleyin' : 'Set a carbon reduction target'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {targets.map(tgt => (
                    <div key={tgt.id} className="bg-white rounded-xl border border-gray-200 p-6">
                      <h4 className="font-semibold text-gray-900 mb-2">{tgt.title}</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500">{language === 'tr' ? 'Baz Yıl:' : 'Base:'}</span> {tgt.base_year}</div>
                        <div><span className="text-gray-500">{language === 'tr' ? 'Hedef:' : 'Target:'}</span> {tgt.target_year}</div>
                        <div><span className="text-gray-500">{language === 'tr' ? 'Baz Emisyon:' : 'Base:'}</span> {(tgt.base_emissions_kg / 1000).toFixed(1)} t</div>
                        <div><span className="text-gray-500">{language === 'tr' ? 'Azaltma:' : 'Reduction:'}</span> {tgt.target_reduction_percent}%</div>
                      </div>
                      <div className="mt-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${tgt.status === 'on_track' ? 'bg-green-100 text-green-700' : tgt.status === 'succeeded' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {tgt.status === 'on_track' ? (language === 'tr' ? 'Yolunda' : 'On Track') : tgt.status === 'succeeded' ? (language === 'tr' ? 'Başarılı' : 'Succeeded') : (language === 'tr' ? 'Geride' : 'Off Track')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== REPORTING TAB ===== */}
          {activeTab === 'reporting' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{language === 'tr' ? 'Raporlama' : 'Reporting'}</h1>
                <p className="text-gray-600 mt-1">{language === 'tr' ? 'ISO 14064-1 uyumlu raporlar' : 'ISO 14064-1 compliant reports'}</p>
              </div>

              {/* Summary Stats */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="py-8">
                    <div className="text-5xl font-bold text-gray-900 mb-2">{entries.length}</div>
                    <p className="text-sm text-gray-600">{language === 'tr' ? 'Toplam Kayıt' : 'Total Entries'}</p>
                  </div>
                  <div className="py-8 md:border-x border-gray-200">
                    <div className="text-5xl font-bold text-gray-900 mb-2">{summary?.total_tonne?.toFixed(1) || '0'}</div>
                    <p className="text-sm text-gray-600">{language === 'tr' ? 'Toplam tCO2e' : 'Total tCO2e'}</p>
                  </div>
                  <div className="py-8">
                    <div className="text-5xl font-bold text-gray-900 mb-2">{targets.length}</div>
                    <p className="text-sm text-gray-600">{language === 'tr' ? 'Aktif Hedef' : 'Active Targets'}</p>
                  </div>
                </div>
              </div>

              {/* Questionnaire Profile - Inventory Configuration */}
              {questionnaireProfile?.is_complete && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    {language === 'tr' ? 'Envanter Yapılandırması' : 'Inventory Configuration'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Reporting Period */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'Raporlama Dönemi' : 'Reporting Period'}</p>
                      <p className="text-sm font-medium text-gray-900">
                        {questionnaireProfile.period_type === 'calendar_year' && `${language === 'tr' ? 'Takvim Yılı' : 'Calendar Year'}: ${questionnaireProfile.period_year || ''}`}
                        {questionnaireProfile.period_type === 'fiscal_year' && (language === 'tr' ? 'Mali Yıl' : 'Fiscal Year')}
                        {questionnaireProfile.period_type === 'custom' && (language === 'tr' ? 'Özel Dönem' : 'Custom Period')}
                      </p>
                    </div>
                    {/* Base Year */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'Baz Yıl' : 'Base Year'}</p>
                      <p className="text-sm font-medium text-gray-900">
                        {questionnaireProfile.has_base_year ? questionnaireProfile.base_year : (language === 'tr' ? 'Belirlenmedi' : 'Not set')}
                      </p>
                    </div>
                    {/* Factor Source */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'Emisyon Faktör Kaynağı' : 'Emission Factor Source'}</p>
                      <p className="text-sm font-medium text-gray-900">
                        {{ national: language === 'tr' ? 'Ulusal Kaynaklar' : 'National Sources', defra: 'DEFRA', ipcc: 'IPCC', mixed: language === 'tr' ? 'Karışık' : 'Mixed', unsure: language === 'tr' ? 'Belirsiz' : 'Unsure' }[questionnaireProfile.preferred_factor_source] || questionnaireProfile.preferred_factor_source}
                      </p>
                    </div>
                    {/* Purpose */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'Amaç' : 'Purpose'}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(questionnaireProfile.purposes || []).map(p => (
                          <span key={p} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                            {{ iso_14064_verification: 'ISO 14064-1', internal_reporting: language === 'tr' ? 'İç Raporlama' : 'Internal', group_reporting: language === 'tr' ? 'Grup' : 'Group', financing: language === 'tr' ? 'Finansman' : 'Financing', export_pressure: language === 'tr' ? 'İhracat' : 'Export', other: language === 'tr' ? 'Diğer' : 'Other' }[p] || p}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* Verification */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? '3. Taraf Doğrulama' : '3rd Party Verification'}</p>
                      <p className="text-sm font-medium text-gray-900">
                        {questionnaireProfile.verification_planned ? `✅ ${language === 'tr' ? 'Planlandı' : 'Planned'}${questionnaireProfile.verification_date ? ` (${questionnaireProfile.verification_date})` : ''}` : questionnaireProfile.verification_within_12m ? `📅 ${language === 'tr' ? '12 ay içinde' : 'Within 12 months'}` : `❌ ${language === 'tr' ? 'Plan yok' : 'No plan'}`}
                      </p>
                    </div>
                    {/* Report Language */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'Rapor Dili' : 'Report Language'}</p>
                      <p className="text-sm font-medium text-gray-900">
                        {{ tr: language === 'tr' ? 'Türkçe' : 'Turkish', en: language === 'tr' ? 'İngilizce' : 'English', bilingual: language === 'tr' ? 'Çift Dilli' : 'Bilingual' }[questionnaireProfile.report_language] || questionnaireProfile.report_language}
                      </p>
                    </div>
                  </div>

                  {/* Warnings */}
                  {questionnaireProfile.warnings?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium text-amber-700">{language === 'tr' ? 'Uyarılar' : 'Warnings'}</p>
                      {questionnaireProfile.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-800">{language === 'tr' ? w.text_tr : w.text_en}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!questionnaireProfile?.is_complete && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-900 mb-1">{language === 'tr' ? 'Prsşname Tamamlanmadı' : 'Questionnaire Not Complete'}</h3>
                    <p className="text-sm text-amber-700">{language === 'tr' ? 'Envanter yapılandırması için lütfen sağ alttaki chatbot ile prsşnameyi tamamlayın.' : 'Please complete the questionnaire via the chatbot (bottom right) to configure your inventory.'}</p>
                  </div>
                </div>
              )}

              {/* Scope Breakdown for Report */}
              {entries.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'Kapsam Dağılımı (Rapor Özeti)' : 'Scope Breakdown (Report Summary)'}</h3>
                  <div className="space-y-4">
                    {['scope1', 'scope2', 'scope3'].map(scope => {
                      const scopeTotal = scope === 'scope1' ? summary?.scope1_tonne : scope === 'scope2' ? summary?.scope2_tonne : summary?.scope3_tonne;
                      const pct = summary?.total_tonne > 0 ? ((scopeTotal || 0) / summary.total_tonne * 100) : 0;
                      return (
                        <div key={scope}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{scope === 'scope1' ? 'Scope 1' : scope === 'scope2' ? 'Scope 2' : 'Scope 3'}</span>
                            <span className="text-sm text-gray-600">{(scopeTotal || 0).toFixed(2)} tCO2e ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className={`h-2.5 rounded-full ${scope === 'scope1' ? 'bg-red-500' : scope === 'scope2' ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <FileText className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{language === 'tr' ? 'ISO 14064-1 PDF Rapor' : 'ISO 14064-1 PDF Report'}</h3>
                <p className="text-gray-600 mb-6">{language === 'tr' ? 'Scope dağılımı, kategori detayları, metodoloji ve referanslar dahil profesyonel rapor.' : 'Professional report with scope breakdown, category details, methodology and references.'}</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      const token = localStorage.getItem('access_token');
                      fetch(api.getReportUrl(selectedYear, 'tr'), { headers: { Authorization: `Bearer ${token}` } })
                        .then(r => r.blob())
                        .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `carbonless_rapor_${selectedYear}_tr.pdf`; a.click(); });
                    }}
                    className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> Türkçe PDF
                  </button>
                  <button
                    onClick={() => {
                      const token = localStorage.getItem('access_token');
                      fetch(api.getReportUrl(selectedYear, 'en'), { headers: { Authorization: `Bearer ${token}` } })
                        .then(r => r.blob())
                        .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `carbonless_report_${selectedYear}_en.pdf`; a.click(); });
                    }}
                    className="px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> English PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===== SETTINGS TAB ===== */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{language === 'tr' ? 'Ayarlar (Yakında)' : 'Settings (Coming Soon)'}</h3>
              <p className="text-gray-600">{language === 'tr' ? 'Hesap ve şirket ayarları yakında eklenecek.' : 'Account and company settings coming soon.'}</p>
            </div>
          )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />}

      {/* Questionnaire Chatbot */}
      <Chatbot language={language} onComplete={fetchData} />
    </div>
  );
}
