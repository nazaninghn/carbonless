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
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import ReviewTab from '@/components/dashboard/ReviewTab';
import FacilityChart from '@/components/dashboard/FacilityChart';
import SettingsTab from '@/components/dashboard/SettingsTab';
import CarbonAIPage from '@/components/dashboard/CarbonAIPage';
import ReportingTab from '@/components/dashboard/ReportingTab';
import EmissionsTab from '@/components/dashboard/EmissionsTab';
import ReductionTargetsTab from '@/components/dashboard/ReductionTargetsTab';

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

  const handleLogout = async () => {
    // Remove beforeunload block so redirect works
    window.onbeforeunload = null;
    const { auth } = await import('@/lib/auth');
    auth.logout();
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
            <ReductionTargetsTab
              language={language}
              targets={targets}
              summary={summary}
              fetchData={fetchData}
            />
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



