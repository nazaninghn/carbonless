'use client';
import { useState, useCallback } from 'react';
import {
  LayoutDashboard, Leaf, TrendingDown, FileText, Settings, LogOut, X,
  ClipboardCheck, Bot, ChevronRight, MoreHorizontal, BarChart2, Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard',  icon: LayoutDashboard, tr: 'Kontrol Paneli',    en: 'Dashboard',     trS: 'Panel',    enS: 'Home',      section: 'main' },
  { key: 'ai_carbon',  icon: Bot,             tr: 'AI Hesaplayıcı',    en: 'AI Calculator', trS: 'AI',       enS: 'AI',        section: 'main' },
  { key: 'emissions',  icon: Leaf,            tr: 'Emisyon Yönetimi',  en: 'Emissions',     trS: 'Emisyon',  enS: 'Emissions', section: 'data' },
  { key: 'reduction',  icon: TrendingDown,    tr: 'Azaltma Hedefleri', en: 'Targets',       trS: 'Hedefler', enS: 'Targets',   section: 'data' },
  { key: 'reporting',  icon: FileText,        tr: 'Raporlama',         en: 'Reports',       trS: 'Rapor',    enS: 'Reports',   section: 'data' },
  { key: 'benchmark',  icon: BarChart2,       tr: 'Benchmark',         en: 'Benchmark',     trS: 'Kıyas',    enS: 'Benchmark', section: 'data' },
  { key: 'review',     icon: ClipboardCheck,  tr: 'Onay Bekleyenler',  en: 'Review',        trS: 'Onay',     enS: 'Review',    section: 'manage' },
  { key: 'settings',   icon: Settings,        tr: 'Ayarlar',           en: 'Settings',      trS: 'Ayarlar',  enS: 'Settings',  section: 'manage' },
];

// Bottom nav shows the most-used tabs — AI FIRST
const BOTTOM_NAV_KEYS = ['ai_carbon', 'dashboard', 'emissions', 'reporting', 'reduction'];
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

    return (
      <button
        key={item.key}
        onClick={() => navigate(item.key)}
        aria-current={isActive ? 'page' : undefined}
        className={`
          group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200
          ${isActive
            ? isAI
              ? 'bg-[#4CAF50] text-white shadow-md shadow-[#4CAF50]/20'
              : 'bg-[#1a1a1a] text-white shadow-md shadow-black/10'
            : 'text-[#302817]/60 hover:bg-[#f5f5f0] hover:text-[#302817]'}
        `}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          isActive
            ? isAI ? 'bg-white/20' : 'bg-white/10'
            : isAI ? 'bg-[#4CAF50]/10' : 'bg-[#302817]/5'
        }`}>
          <Icon className={`h-[16px] w-[16px] ${
            isActive ? 'text-white' : isAI ? 'text-[#4CAF50]' : 'text-[#302817]/50'
          }`} />
        </div>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {tr ? item.tr : item.en}
        </span>
        {isAI && !isActive && (
          <span className="rounded-full bg-[#4CAF50]/10 px-2 py-0.5 text-[9px] font-bold text-[#4CAF50]">
            AI
          </span>
        )}
        {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
      </button>
    );
  }

  return (
    <>
      {/* ═══════════════════ DESKTOP SIDEBAR ════════════════════════════ */}
      <aside
        aria-label={tr ? 'Ana gezinme' : 'Main navigation'}
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] bg-white
          border-r border-[#e8e8e0] transition-transform duration-300
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0 shadow-[0_8px_40px_rgba(0,0,0,0.08)]' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">

          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-[#e8e8e0] px-4">
            <button
              onClick={() => navigate('dashboard')}
              className="flex min-w-0 items-center gap-2.5"
            >
              <Image src="/carbonless.png" alt="Carbonless" width={36} height={36} className="h-9 w-9 object-contain" />
              <span className="truncate text-[15px] font-bold tracking-tight text-[#1a1a1a]">
                Carbonless
              </span>
            </button>
            <button
              onClick={closeSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#f5f5f0] lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {/* AI Bold Section — PRIMARY action */}
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#4CAF50]/70">
                {tr ? 'AI Motor' : 'AI Engine'}
              </p>
              {mainItems.filter(i => i.key === 'ai_carbon').map(renderNavItem)}
              {/* Quick info card */}
              <div className="mt-2 mx-1 rounded-xl bg-gradient-to-br from-[#f0f9f0] to-[#e8f5e9] border border-[#4CAF50]/10 p-2.5">
                <p className="text-[10px] text-[#2d6235]/70 leading-relaxed">
                  {tr
                    ? '💡 Verilerinizi söyleyin, AI hesaplar ve kaydeder.'
                    : '💡 Tell your data, AI calculates & saves automatically.'}
                </p>
              </div>
            </div>

            {/* Dashboard section — secondary */}
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#302817]/30">
                {tr ? 'Kontrol Paneli' : 'Dashboard'}
              </p>
              {mainItems.filter(i => i.key !== 'ai_carbon').map(renderNavItem)}
            </div>

            {/* Data section */}
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#302817]/30">
                {tr ? 'Veri ve Raporlar' : 'Data & Reports'}
              </p>
              {dataItems.map(renderNavItem)}
            </div>

            {/* Management section */}
            <div className="space-y-1">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#302817]/30">
                {tr ? 'Yönetim' : 'Management'}
              </p>
              {manageItems.map(renderNavItem)}
            </div>
          </nav>

          {/* Quick mode switch card */}
          <div className="px-3 pb-3">
            <div className="rounded-xl border border-[#4CAF50]/20 bg-[#f0f9f0] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-[#4CAF50]" />
                <span className="text-[11px] font-bold text-[#2d6235]">
                  {tr ? 'Çalışma Modları' : 'Work Modes'}
                </span>
              </div>
              <p className="text-[10px] text-[#302817]/50 leading-relaxed">
                {tr
                  ? 'Dashboard ve AI aynı veritabanına kaydeder. Nerede girerseniz girin, her yerde görünür.'
                  : 'Dashboard & AI both write to the same database. Data entered anywhere shows everywhere.'}
              </p>
            </div>
          </div>

          {/* User footer */}
          <div className="border-t border-[#e8e8e0] p-3">
            <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-[#f9f9f7] px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-[12px] font-bold text-white">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-[#1a1a1a]">
                  {user?.username || 'User'}
                </p>
                <p className="truncate text-[11px] text-[#302817]/40">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500/70 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              {tr ? 'Çıkış' : 'Logout'}
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

      {/* ═══════════════════ MOBILE BOTTOM NAV ══════════════════════════ */}
      <nav
        aria-label="Mobile navigation"
        className="
          fixed bottom-0 left-0 right-0 z-40
          border-t border-[#e8e8e0]
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
                    isAI ? 'bg-[#4CAF50]' : 'bg-[#1a1a1a]'
                  }`} />
                )}

                <div
                  className={`
                    flex items-center justify-center rounded-xl transition-all duration-200
                    ${isAI
                      ? `h-9 w-9 ${isActive
                          ? 'bg-[#4CAF50] shadow-md shadow-[#4CAF50]/25'
                          : 'bg-[#4CAF50]/10'}`
                      : `h-7 w-7 ${isActive ? 'bg-[#1a1a1a]/8' : ''}`
                    }
                  `}
                >
                  <Icon
                    className={`h-4 w-4 transition-all ${
                      isAI && isActive ? 'text-white'
                      : isAI ? 'text-[#4CAF50]'
                      : isActive ? 'text-[#1a1a1a]'
                      : 'text-[#302817]/40'
                    }`}
                  />
                </div>

                <span className={`text-[9px] font-bold leading-none tracking-wide ${
                  isActive ? 'text-[#1a1a1a]' : 'text-[#302817]/35'
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
              <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
            )}
            <div className="flex h-7 w-7 items-center justify-center rounded-xl">
              <MoreHorizontal className={`h-4 w-4 ${
                ['settings', 'review', 'benchmark'].includes(activeTab) ? 'text-[#1a1a1a]' : 'text-[#302817]/40'
              }`} />
            </div>
            <span className={`text-[9px] font-bold leading-none tracking-wide ${
              ['settings', 'review', 'benchmark'].includes(activeTab) ? 'text-[#1a1a1a]' : 'text-[#302817]/35'
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
          ? 'Hesabınızdan çıkış yapılacak. Devam etmek istiyor musunuz?'
          : 'You will be signed out of your account. Do you want to continue?'}
        confirmText={tr ? 'Çıkış yap' : 'Sign out'}
        cancelText={tr ? 'İptal' : 'Cancel'}
        onConfirm={() => { setShowLogoutConfirm(false); onLogout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
