'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import CommandPalette from '@/components/dashboard/CommandPalette';
import { ToastProvider } from '@/components/ToastProvider';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import ReviewTab from '@/components/dashboard/ReviewTab';
import SettingsTab from '@/components/dashboard/SettingsTab';
import Image from 'next/image';
import { InventoryAssistant } from '@/components/dashboard/CarbonAIPage';
import QuestionnairePageTab from '@/components/dashboard/QuestionnairePageTab';
import ReportingTab from '@/components/dashboard/ReportingTab';
import EmissionsTab from '@/components/dashboard/EmissionsTab';
import { getPermissions } from '@/lib/permissions';
import ReductionTargetsTab from '@/components/dashboard/ReductionTargetsTab';
import BenchmarkTab from '@/components/dashboard/BenchmarkTab';
import HowItWorksTab from '@/components/dashboard/HowItWorksTab';
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
        className="shrink-0 rounded-lg bg-[#072C0E] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1A7B2A] transition whitespace-nowrap"
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
  const perms = getPermissions(user);

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
  // Set by the command palette's "New reduction target"; the targets tab opens
  // its form and clears it.
  const [targetFormRequested, setTargetFormRequested] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('turkey');
  // Emission sources follow the company's headquarters: the Turkish factor
  // set for a company in Turkey, the global set (country grids, DEFRA travel
  // factors…) for one based elsewhere. `companyCountry` (ISO code) also puts
  // that country's own grid first in the electricity list.
  const [companyCountry, setCompanyCountry] = useState('');
  useEffect(() => {
    let cancelled = false;
    api.getCompanyDetail()
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        const code = String(data.country_of_headquarters || '').trim().toUpperCase();
        const turkish = !code || ['TR', 'TUR', 'TURKEY', 'TÜRKIYE', 'TÜRKİYE', 'TURKIYE'].includes(code);
        setCompanyCountry(code);
        setSelectedCountry(turkish ? 'turkey' : 'global');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // AI mode ('ai_carbon'): a full-screen view, without the dashboard's
  // sidebar, of the Carbon Inventory with the AI assistant docked beside it
  // (open on entry). Inside the dashboard, the Karbon Envanteri tab has the
  // same assistant as a drawer.
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrefill, setAssistantPrefill] = useState(null);
  useEffect(() => {
    // Beside the inventory on a wide screen; on a phone it would cover it,
    // so there it opens from the top bar's button.
    if (activeTab === 'ai_carbon') setAssistantOpen(typeof window !== 'undefined' && window.innerWidth >= 1024);
    else if (activeTab !== 'questionnaire') setAssistantOpen(false);
  }, [activeTab]);

  // Events from the inventory and its pages: open the assistant (with an
  // optional message start) or switch tab.
  useEffect(() => {
    function handleAssistant(e) {
      const text = e.detail?.prefill;
      if (text) setAssistantPrefill({ text, key: Date.now() });
      setActiveTab(prev => (prev === 'questionnaire' || prev === 'ai_carbon' ? prev : 'questionnaire'));
      setAssistantOpen(e.detail?.open !== false);
    }
    function handleNavigate(e) {
      const tab = e.detail?.tab;
      if (tab) setActiveTab(tab);
      // Open the reports on the inventory's own reporting year, not whatever
      // year the header happened to show.
      const year = Number(e.detail?.year);
      if (year) setSelectedYear(year);
    }
    window.addEventListener('carbonless:assistant', handleAssistant);
    window.addEventListener('carboniq-navigate', handleNavigate);
    return () => {
      window.removeEventListener('carbonless:assistant', handleAssistant);
      window.removeEventListener('carboniq-navigate', handleNavigate);
    };
  }, []);

  const handleLogout = useCallback(() => {
    api.logout();
  }, []);

  // Don't render anything until startup mode is resolved (prevents flash)
  if (!startupResolved) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-[#2ABD41] border-t-transparent animate-spin" />
      </div>
    );
  }

  // Every company membership was switched off by an admin: no workspace to
  // show, so say so instead of an empty dashboard whose buttons all fail.
  if (user?.access_revoked) {
    const tr = language === 'tr';
    return (
      <div className="min-h-screen bg-[#F1FCF2] flex items-center justify-center p-4 text-[#072C0E]">
        <div role="alert" className="w-full max-w-md rounded-3xl border border-[#072C0E]/10 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold">{tr ? 'Şirket erişiminiz kapatıldı' : 'Your company access was turned off'}</h1>
          <p className="mt-3 text-sm leading-6 text-[#072C0E]/60">
            {tr
              ? 'Şirketinizin yöneticisi hesabınızı ekipte devre dışı bıraktı; şu an verileri göremez veya giremezsiniz. Erişiminizin yeniden açılması için şirket sahibi ya da yöneticinizle iletişime geçin.'
              : "Your company's admin has deactivated your account in the team, so you can't see or enter data right now. Contact your company owner or admin to get access again."}
          </p>
          <p className="mt-2 text-xs text-[#072C0E]/45">{user.email}</p>
          <button onClick={handleLogout} className="mt-6 rounded-full bg-[#072C0E] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#175022]">
            {tr ? 'Çıkış yap' : 'Sign out'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider language={language}>
    <div className="dashboard-android-fix h-screen overflow-hidden bg-[#F1FCF2] text-[#072C0E] flex font-inter">
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
      <div className="min-w-0 max-w-full flex-1 flex flex-col min-h-0">
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

        <main className={`w-full min-w-0 max-w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${
          'p-3 pb-24 sm:p-4 sm:pb-24 lg:p-5 lg:pb-5'
        }`}>
          {/* Slim top bar  -  only on very first load, no layout shift */}
          {loading && (
            <div className="fixed top-0 left-0 right-0 z-[100] h-[2px] overflow-hidden bg-[#2ABD41]/15">
              <div className="h-full animate-[shimmer_1s_ease-in-out_infinite] bg-[#2ABD41] rounded-full" style={{ width: '40%' }} />
            </div>
          )}
          <div className="mx-auto w-full min-w-0 max-w-[1380px] h-full flex flex-col min-h-0 overflow-x-hidden">

          {/* ===== DASHBOARD TAB ===== */}
          {activeTab === 'dashboard' && (
            <ErrorBoundary language={language}>
              {loading ? (
                <div className="flex min-h-[50vh] items-center justify-center">
                  <div className="h-6 w-6 rounded-full border-2 border-[#2ABD41] border-t-transparent animate-spin" />
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
                    onYearChange={setSelectedYear}
                    canApprove={perms.canApprove}
                    canEdit={perms.canEdit}
                  />
                </>
              )}
            </ErrorBoundary>
          )}

          {/* ===== QUESTIONNAIRE TAB ===== */}
          {activeTab === 'questionnaire' && (
            <ErrorBoundary language={language}>
              <QuestionnairePageTab language={language} />
            </ErrorBoundary>
          )}

          {/* ===== EMISSIONS TAB ===== */}
          {activeTab === 'emissions' && (
            <ErrorBoundary language={language}>
              <EmissionsTab
                language={language}
                selectedYear={selectedYear}
                selectedCountry={selectedCountry}
                companyCountry={companyCountry}
                entries={entries}
                factors={factors}
                facilityList={facilityList}
                customRequests={customRequests}
                currentUsername={user?.username}
                canApprove={perms.canApprove}
                questionnaireProfile={questionnaireProfile}
                showAddForm={showAddForm}
                setShowAddForm={setShowAddForm}
                setActiveTab={setActiveTab}
                fetchData={fetchData}
                canEdit={perms.canEdit}
                yearsWithData={effectiveSummary?.years_with_data ?? []}
                onYearChange={setSelectedYear}
              />
            </ErrorBoundary>
          )}

          {/* ===== REVIEW TAB ===== */}
          {activeTab === 'review' && (
            <ErrorBoundary language={language}>
              <ReviewTab language={language} fetchData={fetchData} canApprove={perms.canApprove} />
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
                canEdit={perms.canApprove}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                formRequested={targetFormRequested}
                onFormRequestHandled={() => setTargetFormRequested(false)}
              />
            </ErrorBoundary>
          )}

          {/* ===== REPORTING TAB ===== */}
          {activeTab === 'reporting' && (
            <ErrorBoundary language={language}>
              <ReportingTab language={language} selectedYear={selectedYear} onYearChange={setSelectedYear} summary={effectiveSummary} entries={entries} targets={targets} questionnaireProfile={questionnaireProfile} />
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

          {/* ===== HOW IT WORKS TAB ===== */}
          {activeTab === 'how_it_works' && (
            <ErrorBoundary language={language}>
              <HowItWorksTab language={language} setActiveTab={setActiveTab} />
            </ErrorBoundary>
          )}

          </div>
        </main>
      </div>

      {/* ===== AI MODE  -  inventory + docked assistant, full screen ===== */}
      {activeTab === 'ai_carbon' && (
        <div className="fixed inset-0 z-[85] flex flex-col bg-[#F1FCF2]">
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[#DEFAE1] bg-white px-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Image src="/carbonless.png" alt="Carbonless" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="hidden text-[14px] font-bold text-[#175022] sm:inline">Carbonless AI</span>
            </div>
            <div className="flex items-center gap-0.5 rounded-full border border-[#DEFAE1] bg-[#F5F5F5] p-0.5 sm:p-1">
              <span className="rounded-full bg-[#2ABD41] px-3 py-1 text-[11px] font-semibold text-white sm:px-4 sm:py-1.5 sm:text-[12px]">
                {language === 'tr' ? 'AI Hesaplayıcı' : 'AI Analyzer'}
              </span>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="rounded-full px-3 py-1 text-[11px] font-semibold text-[#072C0E]/50 transition hover:bg-white/70 hover:text-[#072C0E] sm:px-4 sm:py-1.5 sm:text-[12px]"
              >
                {language === 'tr' ? 'Kontrol Paneli' : 'Dashboard'}
              </button>
            </div>
            <button
              onClick={() => setAssistantOpen(v => !v)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition sm:text-[12px] ${
                assistantOpen ? 'bg-[#DEFAE1] text-[#175022]' : 'bg-[#2ABD41] text-white hover:bg-[#1A7B2A]'
              }`}
            >
              <Image src="/chatbot.png" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
              <span className="hidden sm:inline">{language === 'tr' ? 'AI Asistan' : 'AI Assistant'}</span>
            </button>
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4 lg:p-5">
              <ErrorBoundary language={language}>
                <QuestionnairePageTab language={language} />
              </ErrorBoundary>
            </div>
            <ErrorBoundary language={language}>
              <InventoryAssistant
                docked
                open={assistantOpen}
                onClose={() => setAssistantOpen(false)}
                prefill={assistantPrefill}
                language={language}
                summary={effectiveSummary}
                entries={entries}
                targets={targets}
                fetchData={fetchData}
              />
            </ErrorBoundary>
          </div>
        </div>
      )}

      {/* ===== AI ASSISTANT  -  drawer on the dashboard's Karbon Envanteri tab ===== */}
      {activeTab !== 'ai_carbon' && (
        <ErrorBoundary language={language}>
          <InventoryAssistant
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
            prefill={assistantPrefill}
            language={language}
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
        onAddTarget={() => setTargetFormRequested(true)}
      />
    </div>
    </ToastProvider>
  );
}
