'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import OnboardingTour from '@/components/OnboardingTour';
import ModeSelectionModal from '@/components/ModeSelectionModal';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import CommandPalette from '@/components/dashboard/CommandPalette';
import { ToastProvider } from '@/components/ToastProvider';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import ReviewTab from '@/components/dashboard/ReviewTab';
import SettingsTab from '@/components/dashboard/SettingsTab';
import CarbonAIPage from '@/components/dashboard/CarbonAIPage';
import ReportingTab from '@/components/dashboard/ReportingTab';
import EmissionsTab from '@/components/dashboard/EmissionsTab';
import ReductionTargetsTab from '@/components/dashboard/ReductionTargetsTab';
import BenchmarkTab from '@/components/dashboard/BenchmarkTab';
import ErrorBoundary from '@/components/ErrorBoundary';
import { api } from '@/lib/utils/api';

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modeSelected, setModeSelected] = useState(false);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Data from hook
  const {
    user, summary, entries, factors, targets, customRequests,
    questionnaireProfile, unreadCount, facilityList, loading,
    setUnreadCount, fetchData,
  } = useDashboardData(selectedYear);

  // loading = true only on first render; subsequent fetches use `refreshing`
  // so the page never flashes/flickers on refresh

  // Add Entry form (showAddForm shared with DashboardOverview)
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('turkey');

  // Fix #46: lazy-mount CarbonAIPage so navigating away never destroys its state.
  // Once the user visits ai_carbon the first time, aiCarbonMounted stays true and
  // visibility is controlled via CSS hidden — identical to the inner-tab fix (#44).
  const [aiCarbonMounted, setAiCarbonMounted] = useState(false);
  useEffect(() => {
    if (activeTab === 'ai_carbon') setAiCarbonMounted(true);
  }, [activeTab]);

  const handleLogout = useCallback(() => {
    api.logout();
  }, []);

  const handleModeSelect = useCallback((mode) => {
    if (mode === 'guided') {
      try { localStorage.setItem('carbonless_tour_seen', 'true'); } catch {}
      window.location.href = '/dashboard/workspace';
    } else {
      setModeSelected(true);
    }
  }, []);

  // Show mode selection full-screen before rendering anything else
  if (!modeSelected) {
    return <ModeSelectionModal language={language} onComplete={handleModeSelect} />;
  }

  return (
    <ToastProvider>
    <div className="dashboard-android-fix min-h-screen bg-white text-[#302817] flex font-inter">
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
      <div className="min-w-0 max-w-full flex-1 flex flex-col min-h-screen">
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

        <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden p-3 pb-24 sm:p-4 sm:pb-24 lg:p-5 lg:pb-5">
          {/* Slim top bar — only on very first load, no layout shift */}
          {loading && (
            <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] overflow-hidden bg-[#95A847]/15">
              <div className="h-full animate-[shimmer_1s_ease-in-out_infinite] bg-[#95A847] rounded-full" style={{ width: '40%' }} />
            </div>
          )}
          <div className="mx-auto w-full min-w-0 max-w-[1380px] overflow-x-hidden">

          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <ErrorBoundary language={language}>
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
            </ErrorBoundary>
          )}

          {/* ===== EMISSIONS TAB ===== */}
          {activeTab === 'emissions' && (
            <ErrorBoundary language={language}>
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
            </ErrorBoundary>
          )}

          {/* ===== REVIEW TAB ===== */}
          {activeTab === 'review' && (
            <ErrorBoundary language={language}>
              <ReviewTab language={language} fetchData={fetchData} />
            </ErrorBoundary>
          )}

          {/* ===== REDUCTION TARGETS TAB ===== */}
          {activeTab === 'reduction' && (
            <ErrorBoundary language={language}>
              <ReductionTargetsTab
                language={language}
                targets={targets}
                summary={summary}
                fetchData={fetchData}
              />
            </ErrorBoundary>
          )}

          {/* ===== REPORTING TAB ===== */}
          {activeTab === 'reporting' && (
            <ErrorBoundary language={language}>
              <ReportingTab language={language} selectedYear={selectedYear} summary={summary} entries={entries} targets={targets} questionnaireProfile={questionnaireProfile} />
            </ErrorBoundary>
          )}

          {/* ===== SETTINGS TAB ===== */}
          {activeTab === 'settings' && (
            <ErrorBoundary language={language}>
              <SettingsTab language={language} user={user} fetchData={fetchData} />
            </ErrorBoundary>
          )}

          {/* ===== BENCHMARK TAB ===== */}
          {activeTab === 'benchmark' && (
            <ErrorBoundary language={language}>
              <BenchmarkTab
                language={language}
                summary={summary}
                questionnaireProfile={questionnaireProfile}
              />
            </ErrorBoundary>
          )}

          {/* ===== AI CARBON TAB ===== */}
          {/* Fix #46: always-mounted once visited; CSS hidden keeps questionnaire
              state alive across outer dashboard tab switches. */}
          <div className={activeTab !== 'ai_carbon' ? 'hidden' : ''}>
            {aiCarbonMounted && (
              <ErrorBoundary language={language}>
                <CarbonAIPage
                  language={language}
                  isVisible={activeTab === 'ai_carbon'}
                  summary={summary}
                  entries={entries}
                  targets={targets}
                />
              </ErrorBoundary>
            )}
          </div>
          </div>
        </main>
      </div>

      {/* Command Palette ⌘K */}
      <CommandPalette
        language={language}
        setActiveTab={setActiveTab}
        entries={entries}
        setShowAddForm={setShowAddForm}
      />

      {/* Onboarding Tour */}
      <OnboardingTour language={language} />
    </div>
    </ToastProvider>
  );
}
