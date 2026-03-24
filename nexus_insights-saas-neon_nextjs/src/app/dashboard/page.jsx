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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, entriesRes, factorsRes, targetsRes, profileRes] = await Promise.all([
        api.getSummary(selectedYear),
        api.getEntries(`year=${selectedYear}`),
        api.getFactors(),
        api.getTargets(),
        api.getProfile(),
      ]);
      if (summaryRes.ok) setSummary(await summaryRes.json());
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu className="w-6 h-6" /></button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{language === 'tr' ? 'Yıl:' : 'Year:'}</span>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option value={2026}>2026</option><option value={2025}>2025</option><option value={2024}>2024</option>
            </select>
            <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
              <option value="turkey">{language === 'tr' ? 'Türkiye' : 'Turkey'}</option>
              <option value="global">{language === 'tr' ? 'Global' : 'Global'}</option>
            </select>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>

          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
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
                <div className="text-5xl font-bold text-gray-900 mb-2">{summary?.total_tonne?.toFixed(2) || '0.00'}</div>
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
                <button onClick={() => setShowAddForm(true)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />{language === 'tr' ? 'Yeni Kayıt' : 'New Entry'}
                </button>
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
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
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div className="py-8">
                    <div className="text-5xl font-bold text-gray-900 mb-2">{entries.length}</div>
                    <p className="text-sm text-gray-600">{language === 'tr' ? 'Toplam Kayıt' : 'Total Entries'}</p>
                  </div>
                  <div className="py-8 border-x border-gray-200">
                    <div className="text-5xl font-bold text-gray-900 mb-2">{summary?.total_tonne?.toFixed(1) || '0'}</div>
                    <p className="text-sm text-gray-600">{language === 'tr' ? 'Toplam tCO2e' : 'Total tCO2e'}</p>
                  </div>
                  <div className="py-8">
                    <div className="text-5xl font-bold text-gray-900 mb-2">{targets.length}</div>
                    <p className="text-sm text-gray-600">{language === 'tr' ? 'Aktif Hedef' : 'Active Targets'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{language === 'tr' ? 'PDF Rapor (Yakında)' : 'PDF Report (Coming Soon)'}</h3>
                <p className="text-gray-600">{language === 'tr' ? 'ISO 14064-1 uyumlu PDF rapor oluşturma özelliği yakında eklenecek.' : 'ISO 14064-1 compliant PDF report generation coming soon.'}</p>
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
      <Chatbot language={language} />
    </div>
  );
}
