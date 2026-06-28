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

// ── Preview data bridge ────────────────────────────────────────────────────────
// When the user has entered data via the chatbot (workspace preview mode) but has
// no real backend report yet, we compute scope totals from localStorage so the
// main dashboard reflects chatbot-entered data instead of showing blank.
const _WS_EF = {
  natural_gas: { 'm³':2.02, m3:2.02, kWh:0.183, GJ:50.77, MCF:57.17 },
  diesel:      { litre:2.54, GJ:68.08 },
  lpg:         { litre:1.51, kg:2.94, GJ:59.65 },
  fuel_oil:    { litre:2.52, kg:2.96, GJ:74.07 },
  coal:        { kg:2.42, tonne:2420, GJ:88.34 },
};

function _computeLocalSummary(v) {
  const efS1 = _WS_EF[v['rf.3a.fuel_type']]?.[v['rf.3a.unit']];
  const s1Kg = efS1 ? (parseFloat(v['rf.3a.consumption']) || 0) * efS1 : 0;
  const kWh  = parseFloat(v['rf.4a.consumption_kwh']);
  const ef2  = parseFloat(v['rf.4a.emission_factor']);
  const s2Kg = !isNaN(kWh) && !isNaN(ef2) ? kWh * ef2 : 0;
  const k4Kg = parseFloat(v['rf.k4.total_emission_kgco2e']) || 0;
  const k5Kg = parseFloat(v['rf.k5.total_emission_kgco2e']) || 0;
  const s3Kg = k4Kg + k5Kg;
  const safe = x => (isNaN(x) ? 0 : x);
  const totalKg = safe(s1Kg) + safe(s2Kg) + safe(s3Kg);
  if (totalKg <= 0) return null;
  return {
    total_tonne:   totalKg / 1000,
    scope1_tonne:  safe(s1Kg) / 1000,
    scope2_tonne:  safe(s2Kg) / 1000,
    scope3_tonne:  safe(s3Kg) / 1000,
    monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total_kg: 0 })),
    _isLocalPreview: true,
  };
}

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
            ? 'Chatbot\'ta girdiğiniz veriler — sunucuya henüz kaydedilmedi.'
            : 'Data you entered in the chatbot — not yet saved to the server.'}
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
  const { t, language } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
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
    if (summary) { setLocalSummary(null); return; }
    try {
      const raw = localStorage.getItem('ciq_preview_fields');
      if (!raw) return;
      setLocalSummary(_computeLocalSummary(JSON.parse(raw)));
    } catch {}
  }, [loading, summary]);
  const effectiveSummary = summary || localSummary;
  const isPreviewMode = !summary && !!localSummary;

  // Add Entry form (showAddForm shared with DashboardOverview)
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('turkey');

  // Fix #46: lazy-mount CarbonAIPage so navigating away never destroys its state.
  // Once the user visits ai_carbon the first time, aiCarbonMounted stays true and
  // visibility is controlled via CSS hidden — identical to the inner-tab fix (#44).
  // AI overlay state — starts visible (AI-first UX) but dashboard is the "base" tab
  const [aiCarbonMounted, setAiCarbonMounted] = useState(true);
  const [aiCarbonVisible, setAiCarbonVisible] = useState(true);
  useEffect(() => {
    if (activeTab === 'ai_carbon') {
      setAiCarbonMounted(true);
      setAiCarbonVisible(true);
    } else {
      // Any non-AI tab hides the overlay
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
        />

        <main className={`w-full min-w-0 max-w-full flex-1 overflow-x-hidden ${
          activeTab === 'ai_carbon' ? 'p-2 pb-20 sm:p-2 sm:pb-20 lg:p-3 lg:pb-3' : 'p-3 pb-24 sm:p-4 sm:pb-24 lg:p-5 lg:pb-5'
        }`}>
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

      {/* ===== AI CARBON — renders as fullscreen overlay or minimized bubble ===== */}
      {/* Rendered OUTSIDE main content flow so it never affects dashboard layout */}
      {aiCarbonMounted && (
        <ErrorBoundary language={language}>
          <CarbonAIPage
            language={language}
            isVisible={aiCarbonVisible}
            summary={effectiveSummary}
            entries={entries}
            targets={targets}
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
