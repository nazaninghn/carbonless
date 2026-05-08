'use client';
import { useState } from 'react';
import {
  LayoutDashboard, Leaf, TrendingDown, FileText, Settings, LogOut, X,
  ClipboardCheck, Bot, ChevronRight, MoreHorizontal,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard', icon: LayoutDashboard, tr: 'Kontrol Paneli', en: 'Dashboard',   trS: 'Panel',   enS: 'Home'     },
  { key: 'emissions', icon: Leaf,            tr: 'Emisyon Yönetimi', en: 'Emissions',  trS: 'Emisyon', enS: 'Emissions' },
  { key: 'ai_carbon', icon: Bot,             tr: 'AI Carbon',       en: 'AI Carbon',  trS: 'AI',      enS: 'AI'        },
  { key: 'reduction', icon: TrendingDown,    tr: 'Azaltma Hedefleri', en: 'Targets',  trS: 'Hedefler', enS: 'Targets'  },
  { key: 'reporting', icon: FileText,        tr: 'Raporlama',       en: 'Reports',    trS: 'Rapor',   enS: 'Reports'   },
  { key: 'review',    icon: ClipboardCheck,  tr: 'Onay Bekleyenler', en: 'Review',    trS: 'Onay',    enS: 'Review'    },
  { key: 'settings',  icon: Settings,        tr: 'Ayarlar',         en: 'Settings',   trS: 'Ayarlar', enS: 'Settings'  },
];

// Bottom nav shows the 5 most-used tabs; Settings & Review live in the slide-out
const BOTTOM_NAV_KEYS = ['dashboard', 'emissions', 'ai_carbon', 'reduction', 'reporting'];

export default function DashboardSidebar({
  language, activeTab, setActiveTab, user, sidebarOpen, setSidebarOpen, onLogout,
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const tr = language === 'tr';

  const closeSidebar = () => setSidebarOpen(false);
  const navigate     = (key) => { setActiveTab(key); closeSidebar(); };

  const bottomItems = NAV_ITEMS.filter(i => BOTTOM_NAV_KEYS.includes(i.key));

  return (
    <>
      {/* ═══════════════════ DESKTOP SIDEBAR ════════════════════════════ */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[260px] transform bg-white
          border-r border-[#302817]/6 transition-transform duration-300
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0 shadow-[0_8px_40px_rgba(48,40,23,0.14)]' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col">

          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-[#302817]/6 px-4">
            <button
              onClick={() => navigate('dashboard')}
              className="flex min-w-0 items-center gap-2"
            >
              <img src="/carbonless.png" alt="Carbonless" className="h-10 w-auto shrink-0" />
              <span className="truncate text-base font-bold tracking-tight text-[#302817]">
                Carbonless
              </span>
            </button>
            <button
              onClick={closeSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/5 lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B4BE6A]">
              {tr ? 'Çalışma Alanı' : 'Workspace'}
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon  = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition
                    ${isActive
                      ? 'bg-[#302817] text-white shadow-[0_4px_12px_rgba(48,40,23,0.15)]'
                      : 'text-[#302817]/65 hover:bg-[#B4BE6A]/8 hover:text-[#302817]'}
                  `}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-[#B4BE6A]'}`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {tr ? item.tr : item.en}
                  </span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                </button>
              );
            })}
          </nav>

          {/* User footer */}
          <div className="border-t border-[#302817]/6 p-3">
            <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-[#F8F8F8] px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#302817] text-[11px] font-bold text-white">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-[#302817]">
                  {user?.username || 'User'}
                </p>
                <p className="truncate text-[11px] text-[#302817]/45">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500 transition hover:bg-red-50"
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
          className="fixed inset-0 z-40 bg-[#302817]/25 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ═══════════════════ MOBILE BOTTOM NAV ══════════════════════════ */}
      <nav
        aria-label="Mobile navigation"
        className="
          fixed bottom-0 left-0 right-0 z-40
          border-t border-[#302817]/8
          bg-white/92 backdrop-blur-2xl
          lg:hidden
          safe-bottom
        "
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch">

          {/* 5 main tabs */}
          {bottomItems.map((item) => {
            const Icon     = item.icon;
            const isActive = activeTab === item.key;
            const isAI     = item.key === 'ai_carbon';

            return (
              <button
                key={item.key}
                onClick={() => navigate(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  relative flex flex-1 flex-col items-center gap-0.5 py-2
                  transition-all duration-200
                  ${isActive ? '' : 'opacity-50 hover:opacity-80'}
                `}
              >
                {/* Active indicator bar at top */}
                {isActive && (
                  <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#95A847]" />
                )}

                {/* Icon container */}
                <div
                  className={`
                    flex items-center justify-center rounded-2xl transition-all duration-200
                    ${isAI
                      ? `h-9 w-9 ${isActive
                          ? 'bg-[#302817] shadow-[0_4px_12px_rgba(48,40,23,0.25)]'
                          : 'bg-[#302817]/8'}`
                      : `h-7 w-7 ${isActive
                          ? 'bg-[#302817]/8'
                          : ''}`
                    }
                  `}
                >
                  <Icon
                    className={`
                      transition-all
                      ${isAI ? 'h-4 w-4' : 'h-4 w-4'}
                      ${isAI && isActive
                        ? 'text-white'
                        : isActive
                          ? 'text-[#302817]'
                          : 'text-[#302817]/50'}
                    `}
                  />
                </div>

                {/* Label */}
                <span
                  className={`
                    text-[9px] font-bold leading-none tracking-wide
                    ${isActive ? 'text-[#302817]' : 'text-[#302817]/40'}
                  `}
                >
                  {tr ? item.trS : item.enS}
                </span>
              </button>
            );
          })}

          {/* More button → opens slide-out sidebar (for Settings, Review) */}
          <button
            onClick={() => setSidebarOpen(true)}
            className={`
              relative flex flex-1 flex-col items-center gap-0.5 py-2 transition
              ${['settings', 'review'].includes(activeTab) ? '' : 'opacity-50 hover:opacity-80'}
            `}
          >
            {['settings', 'review'].includes(activeTab) && (
              <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[#95A847]" />
            )}
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-2xl transition
                ${['settings', 'review'].includes(activeTab) ? 'bg-[#302817]/8' : ''}`}
            >
              <MoreHorizontal
                className={`h-4 w-4 ${['settings', 'review'].includes(activeTab) ? 'text-[#302817]' : 'text-[#302817]/50'}`}
              />
            </div>
            <span
              className={`text-[9px] font-bold leading-none tracking-wide
                ${['settings', 'review'].includes(activeTab) ? 'text-[#302817]' : 'text-[#302817]/40'}`}
            >
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
