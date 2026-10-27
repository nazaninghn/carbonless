'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
import CarbonAILauncher from '@/components/dashboard/CarbonAILauncher';
import ReportingTab from '@/components/dashboard/ReportingTab';
import EmissionsTab from '@/components/dashboard/EmissionsTab';
import { getPermissions } from '@/lib/permissions';
import ReductionTargetsTab from '@/components/dashboard/ReductionTargetsTab';
import BenchmarkTab from '@/components/dashboard/BenchmarkTab';
import HowItWorksTab from '@/components/dashboard/HowItWorksTab';
import ErrorBoundary from '@/components/ErrorBoundary';
import { api } from '@/lib/utils/api';
import { computeLocalSummaryFromFields } from '@/lib/carboniq/emission-factors';
import { openChat, OPEN_CHAT_EVENT } from '@/lib/openChat';
import { rememberedYear, rememberYear, defaultReportingYear, isReportingYear, tokenUserId } from '@/lib/activeYear';

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
        className="shrink-0 rounded-lg btn-dark px-3 py-1.5 text-[11px] font-bold transition whitespace-nowrap"
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
  // The header's reporting year. Every change (the picker, an inventory being
  // filled, a deep link) is remembered per user; until the startup effect
  // below resolves it, the calendar year stands in.
  const [selectedYear, setSelectedYearState] = useState(() => new Date().getFullYear());
  const yearUserRef = useRef(null);
  const yearSettledRef = useRef(false);
  // The data below is loaded once the year is known: loading the calendar
  // year first and the real one after doubled every request of the page.
  const [yearReady, setYearReady] = useState(false);
  const setSelectedYear = useCallback((next) => {
    yearSettledRef.current = true;
    setYearReady(true);
    setSelectedYearState(prev => {
      const year = typeof next === 'function' ? next(prev) : next;
      if (typeof window !== 'undefined') rememberYear(yearUserRef.current, year, window.localStorage);
      return year;
    });
  }, []);

  // A link from an e-mail or notice ("/dashboard?tab=review",
  // "?tab=emissions&year=2025") opens that page, not whatever tab was open
  // last. The query is then dropped so a reload keeps the user's own choice.
  const DEEP_LINK_TABS = ['dashboard', 'questionnaire', 'emissions', 'review', 'reduction',
    'reporting', 'settings', 'benchmark', 'how_it_works', 'ai_carbon'];
  useEffect(() => {
    if (!startupResolved || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const year = Number(params.get('year'));
    if (!tab && !year) return;
    if (tab && DEEP_LINK_TABS.includes(tab)) setActiveTab(tab);
    if (params.get('chat')) openChat(params.get('chat'));
    // "?tab=settings&section=security": open that part of Settings.
    if (tab === 'settings' && params.get('section')) {
      try { sessionStorage.setItem('carbonless_settings_section', params.get('section')); } catch { /* opens on Profile */ }
    }
    if (year >= 1990 && year <= new Date().getFullYear()) setSelectedYear(year);
    window.history.replaceState(null, '', window.location.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupResolved]);

  // Data from hook
  const {
    user, summary, entries, factors, targets, customRequests,
    questionnaireProfile, unreadCount, facilityList, loading,
    setUnreadCount, fetchData,
  } = useDashboardData(yearReady ? selectedYear : null);
  const perms = getPermissions(user);

  // Open on the year the user worked on last, else on their most recently
  // updated inventory's year — not on the calendar year, which showed a 2025
  // inventory's user empty 2026 pages after every refresh. The user is read
  // from the stored session (not the profile request), so the year is known
  // before the page's data is loaded.
  useEffect(() => {
    const userId = tokenUserId(window.localStorage);
    yearUserRef.current = userId;
    const deepLink = Number(new URLSearchParams(window.location.search).get('year'));
    if (yearSettledRef.current || isReportingYear(deepLink)) { setYearReady(true); return; }
    const remembered = rememberedYear(userId, window.localStorage);
    if (remembered) { setSelectedYearState(remembered); setYearReady(true); return; }
    api.listReports()
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (yearSettledRef.current || !data) return;
        const year = defaultReportingYear(data.reports);
        if (isReportingYear(year)) setSelectedYearState(year);
      })
      .catch(() => {})
      .finally(() => setYearReady(true));
  }, []);

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
  const onInventoryPage = activeTab === 'questionnaire' || activeTab === 'ai_carbon';
  useEffect(() => {
    // Closed by default: the chat opens from the floating Carbon AI button (or
    // from a link/event that asks for it), so it never takes space from the
    // inventory on its own. Leaving the inventory pages closes it.
    if (activeTab !== 'questionnaire' && activeTab !== 'ai_carbon') setAssistantOpen(false);
  }, [activeTab]);
  // A link to one chat (the support team's answer) opens the assistant.
  useEffect(() => {
    const open = () => { setActiveTab('ai_carbon'); setTimeout(() => setAssistantOpen(true), 0); };
    window.addEventListener(OPEN_CHAT_EVENT, open);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, open);
  }, []);

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
    // Filling an inventory: the dashboard follows that inventory's year, so
    // each answer shows up in the totals as it is saved.
    function handleEmissionsUpdated(e) {
      const year = Number(e.detail?.year);
      if (e.detail?.source === 'inventory' && year >= 1990 && year <= new Date().getFullYear()) setSelectedYear(year);
    }
    window.addEventListener('carbonless:assistant', handleAssistant);
    window.addEventListener('carboniq-navigate', handleNavigate);
    window.addEventListener('carbonless:emissions-updated', handleEmissionsUpdated);
    // An inventory started or opened: its year becomes the dashboard's.
    function handleActiveInventory(e) {
      const year = Number(e.detail?.year);
      if (year >= 1990 && year <= new Date().getFullYear()) setSelectedYear(year);
    }
    window.addEventListener('carbonless:active-inventory', handleActiveInventory);
    return () => {
      window.removeEventListener('carbonless:active-inventory', handleActiveInventory);
      window.removeEventListener('carbonless:emissions-updated', handleEmissionsUpdated);
      window.removeEventListener('carbonless:assistant', handleAssistant);
      window.removeEventListener('carboniq-navigate', handleNavigate);
    };
  }, [setSelectedYear]);

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
          <button onClick={handleLogout} className="mt-6 rounded-full btn-dark px-6 py-2.5 text-sm font-bold">
            {tr ? 'Çıkış yap' : 'Sign out'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider language={language}>
    <div className="dashboard-android-fix h-screen overflow-hidden bg-[#F1FCF2] text-[#072C0E] flex font-inter">
      {/* First Tab stop: jump past the sidebar and header (17 stops) to the
          page content. Shown only while focused. */}
      <a href="#main-content"
        onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[300] focus:rounded-full focus:bg-[#072C0E] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white">
        {language === 'tr' ? 'İçeriğe geç' : 'Skip to content'}
      </a>
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

        <main id="main-content" tabIndex={-1} className={`w-full min-w-0 max-w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden outline-none ${
          `p-3 sm:p-4 lg:p-5 lg:pb-5 ${activeTab === 'questionnaire' ? 'pb-40 sm:pb-40' : 'pb-24 sm:pb-24'} ${
            // Wide screens: the open Carbon AI panel sits beside the inventory, not over its controls.
            activeTab === 'questionnaire' && assistantOpen ? 'xl:pr-[492px]' : ''} transition-[padding] duration-200 motion-reduce:transition-none`
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
                    member={user}
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
              <ReviewTab language={language} fetchData={fetchData} canApprove={perms.canApprove} canEdit={perms.canEdit} />
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
              <HowItWorksTab language={language} setActiveTab={setActiveTab} perms={perms} />
            </ErrorBoundary>
          )}

          </div>
        </main>
      </div>

      {/* ===== AI MODE  -  the inventory, full screen; Carbon AI is the floating button ===== */}
      {activeTab === 'ai_carbon' && (
        <div className="fixed inset-0 z-[85] flex flex-col bg-green-50">
          <div className="flex h-[68px] shrink-0 items-center justify-between gap-2 border-b border-white/70 bg-white/75 px-3 shadow-[0_1px_0_rgba(7,44,14,0.04)] backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <Image src="/carbonless.png" alt="Carbonless" width={36} height={36} className="h-9 w-9 object-contain" />
              <span className="hidden text-[15px] font-bold text-[#175022] sm:inline">Carbonless AI</span>
            </div>
            <div className="flex items-center gap-0.5 rounded-full border border-white/80 bg-smoke/80 p-1">
              <span className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-[#072C0E] shadow-sm sm:px-6 sm:text-[13px]">
                {language === 'tr' ? 'AI Hesaplayıcı' : 'AI Analyzer'}
              </span>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-[#072C0E]/50 transition hover:bg-white/80 hover:text-[#072C0E] sm:px-6 sm:text-[13px]"
              >
                {language === 'tr' ? 'Kontrol Paneli' : 'Dashboard'}
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {/* Language toggle — top-right, so you don't have to switch to the
                  Dashboard tab to change the language. Uses the shared context. */}
              <div className="flex items-center gap-0.5 rounded-full border border-white/80 bg-smoke/80 p-0.5">
                {['tr', 'en'].map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => changeLanguage(l)}
                    aria-pressed={language === l}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition sm:px-3 sm:py-1.5 ${
                      language === l ? 'bg-white text-[#175022] shadow-sm' : 'text-[#072C0E]/40 hover:text-[#072C0E]'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {user && (
                <div className="hidden items-center gap-2 sm:flex">
                  <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-[#072C0E]">
                    {(`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email || '?')
                      .split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                  </span>
                  <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-[#072C0E]/70 lg:inline">
                    {`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1">
            <div className={`flex min-w-0 flex-1 flex-col overflow-y-auto px-3 pb-[84px] pt-3 transition-[padding] duration-200 motion-reduce:transition-none sm:px-6 sm:pb-6 sm:pt-5 ${assistantOpen ? 'xl:pr-[492px]' : ''}`}>
              <ErrorBoundary language={language}>
                <QuestionnairePageTab language={language} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* ===== CARBON AI  -  one assistant: a floating panel on the inventory pages
          (opened from the round button), the side drawer everywhere else.
          Kept mounted while closed so the conversation is not lost. ===== */}
      <ErrorBoundary language={language}>
        <InventoryAssistant
          floating={onInventoryPage}
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
      {onInventoryPage && (
        <CarbonAILauncher
          open={assistantOpen}
          onToggle={() => setAssistantOpen(v => !v)}
          language={language}
          className={activeTab === 'ai_carbon' ? 'bottom-5' : 'bottom-20 lg:bottom-5'}
        />
      )}

      {/* Command Palette ⌘K */}
      <CommandPalette
        language={language}
        setActiveTab={setActiveTab}
        entries={entries}
        setShowAddForm={setShowAddForm}
        onAddTarget={() => setTargetFormRequested(true)}
        canEdit={perms.canEdit}
      />
    </div>
    </ToastProvider>
  );
}
