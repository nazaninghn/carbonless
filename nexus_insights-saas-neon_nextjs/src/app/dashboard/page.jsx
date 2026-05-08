'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { api } from '@/lib/utils/api';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { X, Target, Plus } from 'lucide-react';
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
import EmissionsTab from '@/components/dashboard/EmissionsTab';

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

  // Add Entry form (showAddForm shared with DashboardOverview)
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('turkey');

  // Add Target form
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetTitle, setTargetTitle] = useState('');
  const [targetBaseYear, setTargetBaseYear] = useState(2025);
  const [targetYear, setTargetYear] = useState(2030);
  const [targetBaseEmissions, setTargetBaseEmissions] = useState('');
  const [targetReductionPercent, setTargetReductionPercent] = useState('');

  const handleLogout = async () => {
    // Remove beforeunload block so redirect works
    window.onbeforeunload = null;
    const { auth } = await import('@/lib/auth');
    auth.logout();
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
            <EmissionsTab
              language={language}
              selectedYear={selectedYear}
              selectedCountry={selectedCountry}
              entries={entries}
              factors={factors}
              facilityList={facilityList}
              customRequests={customRequests}
              questionnaireProfile={questionnaireProfile}
              showAddForm={showAddForm}
              setShowAddForm={setShowAddForm}
              setActiveTab={setActiveTab}
              fetchData={fetchData}
            />
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


