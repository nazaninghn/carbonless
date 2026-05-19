'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import OnboardingTour from '@/components/OnboardingTour';
import CompanySettings from '@/components/CompanySettings';
import FacilitySettings from '@/components/FacilitySettings';
import PasswordChange from '@/components/PasswordChange';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import CommandPalette from '@/components/dashboard/CommandPalette';
import { ToastProvider } from '@/components/ToastProvider';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import ReviewTab from '@/components/dashboard/ReviewTab';
import FacilityChart from '@/components/dashboard/FacilityChart';
import SettingsTab from '@/components/dashboard/SettingsTab';
import CarbonAIPage from '@/components/dashboard/CarbonAIPage';
import ReportingTab from '@/components/dashboard/ReportingTab';
import EmissionsTab from '@/components/dashboard/EmissionsTab';
import ReductionTargetsTab from '@/components/dashboard/ReductionTargetsTab';
import ErrorBoundary from '@/components/ErrorBoundary';

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

  // loading = true only on first render; subsequent fetches use `refreshing`
  // so the page never flashes/flickers on refresh

  // Add Entry form (showAddForm shared with DashboardOverview)
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('turkey');

  const handleLogout = async () => {
    const { api: apiModule } = await import('@/lib/utils/api');
    apiModule.logout();
  };

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
            <ErrorBoundary>
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
            <ErrorBoundary>
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
            <ErrorBoundary>
              <ReviewTab language={language} fetchData={fetchData} />
            </ErrorBoundary>
          )}

          {/* ===== REDUCTION TARGETS TAB ===== */}
          {activeTab === 'reduction' && (
            <ErrorBoundary>
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
            <ErrorBoundary>
              <ReportingTab language={language} selectedYear={selectedYear} summary={summary} entries={entries} targets={targets} questionnaireProfile={questionnaireProfile} />
            </ErrorBoundary>
          )}

          {/* ===== SETTINGS TAB ===== */}
          {activeTab === 'settings' && (
            <ErrorBoundary>
              <SettingsTab language={language} user={user} fetchData={fetchData} />
            </ErrorBoundary>
          )}

          {/* ===== AI CARBON TAB ===== */}
          {activeTab === 'ai_carbon' && (
            <ErrorBoundary>
              <CarbonAIPage language={language} />
            </ErrorBoundary>
          )}
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



