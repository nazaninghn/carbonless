'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import OnboardingTour from '@/components/OnboardingTour';
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
import { computeLocalSummaryFromFields } from '@/lib/carboniq/emission-factors';

function PreviewBanner({ tr }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="text-base shrink-0">👁</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-amber-800">
          {tr ? 'Önizleme verisi gösteriliyor' : 'Showing chatbot preview data'}
        </p>
        <p className="text-[10.5px] text-amber-600/80 mt-0.5">
          {tr
            ? 'Chatbot\'ta girdiğiniz veriler  -  sunucuya henüz kaydedilmedi.'
            : 'Data you entered in the chatbot  -  not yet saved to the server.'}
        </p>
      </div>
      <a
        href="/dashboard/workspace"
        className="shrink-0 rounded-lg bg-[#302817] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#527A1A] transition whitespace-nowrap"
      >
        {tr ? 'Çalışma Alanı →' : 'Workspace →'}
      </a>
    </div>
  );
}

export default function DashboardPage() {
  const { t, language, changeLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [startupResolved, setStartupResolved] = useState(false);

  // Check startup mode from select page (client-only, after hydration)
  useEffect(() => {
    try {
      const mode = localStorage.getItem('carbonless_startup_mode');
      if (mode === 'ai') {
        setActiveTab('ai_carbon');
        localStorage.setItem('carbonless_active_tab', 'ai_carbon');
      } else if (mode === 'dashboard') {
        // Explicit choice on the select page always wins over a stale saved tab
        // (e.g. the user was last on the AI tab in a previous session).
        setActiveTab('dashboard');
        localStorage.setItem('carbonless_active_tab', 'dashboard');
      } else {
        const savedTab = localStorage.getItem('carbonless_active_tab');
        if (savedTab) setActiveTab(savedTab);
      }
      if (mode) localStorage.removeItem('carbonless_startup_mode');
    } catch {}
    setStartupResolved(true);
  }, []);

  // Remember the active tab so a page refresh stays where the user was
  useEffect(() => {
    if (!startupResolved) return;
    try { localStorage.setItem('carbonless_active_tab', activeTab); } catch {}
  }, [activeTab, startupResolved]);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  // Data from hook
  const {
    user, summary, entries, factors, targets, customRequests,
    questionnaireProfile, unreadCount, facilityList, loading,
    setUnreadCount, fetchData,
  } = useDashboardData(selectedYear);

  // loading = true only on first render; subsequent fetches use `refreshing`
  // so the page never flashes/flickers on refresh

  // Sync chatbot preview data → dashboard when no real backend data exists
  const [localSummary, setLocalSummary] = useState(null);
  useEffect(() => {
    if (loading) return;
    if (summary) {
      // Real backend data has arrived — the local preview is no longer needed
      // and would otherwise linger and show stale numbers on a future visit.
      setLocalSummary(null);
      try { localStorage.removeItem('ciq_preview_fields'); } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem('ciq_preview_fields');
      if (!raw) return;
      setLocalSummary(computeLocalSummaryFromFields(JSON.parse(raw)));
    } catch {}
  }, [loading, summary]);
  const effectiveSummary = summary || localSummary;
  const isPreviewMode = !summary && !!localSummary;

  // Add Entry form (showAddForm shared with DashboardOverview)
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('turkey');

  // Fix #46: lazy-mount CarbonAIPage so navigating away never destroys its state.
  // Once the user visits ai_carbon the first time, aiCarbonMounted stays true and
  // visibility is controlled via CSS hidden  -  identical to the inner-tab fix (#44).
  // AI overlay state  -  only shows when explicitly activated from header or select page
  const [aiCarbonMounted, setAiCarbonMounted] = useState(false);
  const [aiCarbonVisible, setAiCarbonVisible] = useState(false);
  useEffect(() => {
    if (activeTab === 'ai_carbon') {
      setAiCarbonMounted(true);
      setAiCarbonVisible(true);
    } else {
      setAiCarbonVisible(false);
    }
  }, [activeTab]);

  // Listen for close/open events from CarbonAIPage overlay buttons
  useEffect(() => {
    function handleClose() {
      setAiCarbonVisible(false);
      setActiveTab('dashboard');
    }
    function handleOpen() {
      setAiCarbonVisible(true);
      setActiveTab('ai_carbon');
    }
    window.addEventListener('carboniq-close', handleClose);
    window.addEventListener('carboniq-open', handleOpen);
    return () => {
      window.removeEventListener('carboniq-close', handleClose);
      window.removeEventListener('carboniq-open', handleOpen);
    };
  }, []);

  const handleLogout = useCallback(() => {
    api.logout();
  }, []);

  // Don't render anything until startup mode is resolved (prevents flash)
  if (!startupResolved) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-[#53A67F] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <ToastProvider>
    <div className="dashboard-android-fix min-h-screen bg-[#fafaf8] text-[#1a1a1a] flex font-inter">
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
          onLanguageChange={changeLanguage}
        />

        <main className={`w-full min-w-0 max-w-full flex-1 overflow-x-hidden ${
          activeTab === 'ai_carbon' ? 'p-2 pb-20 sm:p-2 sm:pb-20 lg:p-3 lg:pb-3' : 'p-3 pb-24 sm:p-4 sm:pb-24 lg:p-5 lg:pb-5'
        }`}>
          {/* Slim top bar  -  only on very first load, no layout shift */}
          {loading && (
            <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] overflow-hidden bg-[#95A847]/15">
              <div className="h-full animate-[shimmer_1s_ease-in-out_infinite] bg-[#95A847] rounded-full" style={{ width: '40%' }} />
            </div>
          )}
          <div className="mx-auto w-full min-w-0 max-w-[1380px] overflow-x-hidden">

          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <ErrorBoundary language={language}>
              {loading ? (
                <div className="flex min-h-[50vh] items-center justify-center">
                  <div className="h-6 w-6 rounded-full border-2 border-[#53A67F] border-t-transparent animate-spin" />
                </div>
              ) : (
                <>
                  {isPreviewMode && <PreviewBanner tr={language === 'tr'} />}
                  <DashboardOverview
                    language={language}
                    selectedYear={selectedYear}
                    summary={effectiveSummary}
                    entries={entries}
                    targets={targets}
                    facilityList={facilityList}
                    questionnaireProfile={questionnaireProfile}
                    setActiveTab={setActiveTab}
                    setShowAddForm={setShowAddForm}
                  />
                </>
              )}
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
                summary={effectiveSummary}
                fetchData={fetchData}
              />
            </ErrorBoundary>
          )}

          {/* ===== REPORTING TAB ===== */}
          {activeTab === 'reporting' && (
            <ErrorBoundary language={language}>
              <ReportingTab language={language} selectedYear={selectedYear} summary={effectiveSummary} entries={entries} targets={targets} questionnaireProfile={questionnaireProfile} />
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
                summary={effectiveSummary}
                questionnaireProfile={questionnaireProfile}
              />
            </ErrorBoundary>
          )}

          </div>
        </main>
      </div>

      {/* ===== AI CARBON  -  renders as fullscreen overlay or minimized bubble ===== */}
      {/* Rendered OUTSIDE main content flow so it never affects dashboard layout */}
      {aiCarbonMounted && aiCarbonVisible && (
        <ErrorBoundary language={language}>
          <CarbonAIPage
            language={language}
            isVisible={true}
            summary={effectiveSummary}
            entries={entries}
            targets={targets}
            fetchData={fetchData}
          />
        </ErrorBoundary>
      )}

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
