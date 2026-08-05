'use client';
import { useState, useCallback } from 'react';
import {
  LayoutDashboard, Leaf, TrendingDown, FileText, Settings, LogOut, X,
  ClipboardCheck, ClipboardList, Bot, ChevronRight, MoreHorizontal, BarChart2, Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';

// -- Nav items -----------------------------------------------------------------
const NAV_ITEMS = [
  { key: 'dashboard',      icon: LayoutDashboard, tr: 'Kontrol Paneli',    en: 'Dashboard',       trS: 'Panel',    enS: 'Home',      section: 'main' },
  { key: 'questionnaire',  icon: ClipboardList,   tr: 'Karbon Envanteri',  en: 'Carbon Inventory', trS: 'Envanter', enS: 'Inventory', section: 'main' },
  { key: 'ai_carbon',      icon: Bot,             tr: 'AI Sohbet',         en: 'AI Chat',         trS: 'AI',       enS: 'AI',        section: 'main' },
  { key: 'emissions',      icon: Leaf,            tr: 'Emisyon Yönetimi',  en: 'Emissions',       trS: 'Emisyon',  enS: 'Emissions', section: 'data' },
  { key: 'reduction',      icon: TrendingDown,    tr: 'Azaltma Hedefleri', en: 'Targets',         trS: 'Hedefler', enS: 'Targets',   section: 'data' },
  { key: 'reporting',      icon: FileText,        tr: 'Raporlama',         en: 'Reports',         trS: 'Rapor',    enS: 'Reports',   section: 'data' },
  { key: 'benchmark',      icon: BarChart2,       tr: 'Benchmark',         en: 'Benchmark',       trS: 'Kiyas',    enS: 'Benchmark', section: 'data' },
  { key: 'review',         icon: ClipboardCheck,  tr: 'Onay Bekleyenler',  en: 'Review',          trS: 'Onay',     enS: 'Review',    section: 'manage' },
  { key: 'settings',       icon: Settings,        tr: 'Ayarlar',           en: 'Settings',        trS: 'Ayarlar',  enS: 'Settings',  section: 'manage' },
];

// Bottom nav shows the most-used tabs
const BOTTOM_NAV_KEYS = ['dashboard', 'questionnaire', 'emissions', 'reporting', 'ai_carbon'];
const BOTTOM_ITEMS = NAV_ITEMS.filter(i => BOTTOM_NAV_KEYS.includes(i.key));

export default function DashboardSidebar({
  language, activeTab, setActiveTab, user, sidebarOpen, setSidebarOpen, onLogout,
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const tr = language === 'tr';

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  const navigate     = useCallback((key) => { setActiveTab(key); closeSidebar(); }, [setActiveTab, closeSidebar]);

  const mainItems   = NAV_ITEMS.filter(i => i.section === 'main');
  const dataItems   = NAV_ITEMS.filter(i => i.section === 'data');
  const manageItems = NAV_ITEMS.filter(i => i.section === 'manage');

  function renderNavItem(item) {
    const Icon = item.icon;
    const isActive = activeTab === item.key;
    const isAI = item.key === 'ai_carbon';
    const isQuestionnaire = item.key === 'questionnaire';

    return (
      <button
        key={item.key}
        onClick={() => navigate(item.key)}
        aria-current={isActive ? 'page' : undefined}
        className={`
          group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200
          ${isActive
            ? isAI
              ? 'bg-[#2ABD41] text-white shadow-md shadow-[#2ABD41]/20'
              : isQuestionnaire
                ? 'bg-[#175022] text-white shadow-md shadow-[#175022]/20'
                : 'bg-[#072C0E] text-white shadow-md shadow-black/10'
            : 'text-[#072C0E]/60 hover:bg-[#F1FCF2] hover:text-[#072C0E]'}
        `}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          isActive
            ? isAI ? 'bg-white/20' : 'bg-white/10'
            : isAI ? 'bg-[#2ABD41]/10' : isQuestionnaire ? 'bg-[#175022]/10' : 'bg-[#072C0E]/5'
        }`}>
          <Icon className={`h-[16px] w-[16px] ${
            isActive ? 'text-white' : isAI ? 'text-[#2ABD41]' : isQuestionnaire ? 'text-[#175022]' : 'text-[#072C0E]/50'
          }`} />
        </div>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {tr ? item.tr : item.en}
        </span>
        {isAI && !isActive && (
          <span className="rounded-full bg-[#2ABD41]/10 px-2 py-0.5 text-[9px] font-bold text-[#2ABD41]">
            AI
          </span>
        )}
        {isQuestionnaire && !isActive && (
          <span className="rounded-full bg-[#175022]/8 px-2 py-0.5 text-[9px] font-bold text-[#175022]/70">
            ISO
          </span>
        )}
        {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
      </button>
    );
  }

  return (
    <>
      {/* ------------------- DESKTOP SIDEBAR ---------------------------- */}
      <aside
        aria-label={tr ? 'Ana gezinme' : 'Main navigation'}
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] bg-white
          border-r border-[#DEFAE1] transition-transform duration-300
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0 shadow-[0_8px_40px_rgba(0,0,0,0.08)]' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">

          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-[#DEFAE1] px-4">
            <button
              onClick={() => navigate('dashboard')}
              className="flex min-w-0 items-center gap-2.5"
            >
              <Image src="/carbonless.png" alt="Carbonless" width={36} height={36} className="h-9 w-9 object-contain" />
              <span className="truncate text-[15px] font-bold tracking-tight text-[#072C0E]">
                Carbonless
              </span>
            </button>
            <button
              onClick={closeSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#072C0E]/40 hover:bg-[#F1FCF2] lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {/* Dashboard section */}
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#072C0E]/30">
                {tr ? 'Kontrol Paneli' : 'Dashboard'}
              </p>
              {mainItems.filter(i => i.key !== 'ai_carbon').map(renderNavItem)}
            </div>

            {/* Data section */}
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#072C0E]/30">
                {tr ? 'Veri ve Raporlar' : 'Data & Reports'}
              </p>
              {dataItems.map(renderNavItem)}
            </div>

            {/* Management section */}
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#072C0E]/30">
                {tr ? 'Yönetim' : 'Management'}
              </p>
              {manageItems.map(renderNavItem)}
            </div>
          </nav>

          {/* Quick mode switch card */}
          {/* User footer */}
          <div className="border-t border-[#DEFAE1] p-3">
            <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-[#F1FCF2] px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#072C0E] text-[12px] font-bold text-white">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-[#072C0E]">
                  {user?.username || 'User'}
                </p>
                <p className="truncate text-[11px] text-[#072C0E]/40">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500/70 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              {tr ? 'Çikis' : 'Logout'}
            </button>
          </div>
        </div>
      </aside>

      {/* Sidebar backdrop (mobile only) */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ------------------- MOBILE BOTTOM NAV -------------------------- */}
      <nav
        aria-label="Mobile navigation"
        className="
          fixed bottom-0 left-0 right-0 z-40
          border-t border-[#DEFAE1]
          bg-white/95 backdrop-blur-sm
          lg:hidden
        "
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">

          {BOTTOM_ITEMS.map((item) => {
            const Icon     = item.icon;
            const isActive = activeTab === item.key;
            const isAI     = item.key === 'ai_carbon';

            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  relative flex flex-1 flex-col items-center gap-0.5 py-2.5
                  transition-all duration-200
                  ${isActive ? '' : 'opacity-50 hover:opacity-80'}
                `}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className={`absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full ${
                    isAI ? 'bg-[#2ABD41]' : 'bg-[#072C0E]'
                  }`} />
                )}

                <div
                  className={`
                    flex items-center justify-center rounded-xl transition-all duration-200
                    ${isAI
                      ? `h-9 w-9 ${isActive
                          ? 'bg-[#2ABD41] shadow-md shadow-[#2ABD41]/25'
                          : 'bg-[#2ABD41]/10'}`
                      : `h-7 w-7 ${isActive ? 'bg-[#072C0E]/8' : ''}`
                    }
                  `}
                >
                  <Icon
                    className={`h-4 w-4 transition-all ${
                      isAI && isActive ? 'text-white'
                      : isAI ? 'text-[#2ABD41]'
                      : isActive ? 'text-[#072C0E]'
                      : 'text-[#072C0E]/40'
                    }`}
                  />
                </div>

                <span className={`text-[9px] font-bold leading-none tracking-wide ${
                  isActive ? 'text-[#072C0E]' : 'text-[#072C0E]/35'
                }`}>
                  {tr ? item.trS : item.enS}
                </span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className={`
              relative flex flex-1 flex-col items-center gap-0.5 py-2.5 transition
              ${['settings', 'review', 'benchmark'].includes(activeTab) ? '' : 'opacity-50 hover:opacity-80'}
            `}
          >
            {['settings', 'review', 'benchmark'].includes(activeTab) && (
              <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#072C0E]" />
            )}
            <div className="flex h-7 w-7 items-center justify-center rounded-xl">
              <MoreHorizontal className={`h-4 w-4 ${
                ['settings', 'review', 'benchmark'].includes(activeTab) ? 'text-[#072C0E]' : 'text-[#072C0E]/40'
              }`} />
            </div>
            <span className={`text-[9px] font-bold leading-none tracking-wide ${
              ['settings', 'review', 'benchmark'].includes(activeTab) ? 'text-[#072C0E]' : 'text-[#072C0E]/35'
            }`}>
              {tr ? 'Daha' : 'More'}
            </span>
          </button>
        </div>
      </nav>

      {/* Logout confirm dialog */}
      <ConfirmDialog
        open={showLogoutConfirm}
        type="danger"
        title={tr ? 'Oturumu kapat' : 'Sign out'}
        message={tr
          ? 'Hesabinizdan çikis yapilacak. Devam etmek istiyor musunuz?'
          : 'You will be signed out of your account. Do you want to continue?'}
        confirmText={tr ? 'Çikis yap' : 'Sign out'}
        cancelText={tr ? 'Iptal' : 'Cancel'}
        onConfirm={() => { setShowLogoutConfirm(false); onLogout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
