'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  Globe2,
  Menu,
  Search,
} from 'lucide-react';
import { api } from '@/lib/utils/api';

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i);

const TAB_LABELS = {
  dashboard: { tr: 'Kontrol Paneli',    en: 'Dashboard'    },
  emissions:  { tr: 'Emisyon Yönetimi', en: 'Emissions'    },
  ai_carbon:  { tr: 'AI Carbon',        en: 'AI Carbon'    },
  reduction:  { tr: 'Azaltma Hedefleri',en: 'Targets'      },
  reporting:  { tr: 'Raporlama',        en: 'Reports'      },
  review:     { tr: 'Onay Bekleyenler', en: 'Review'       },
  settings:   { tr: 'Ayarlar',          en: 'Settings'     },
};

export default function DashboardHeader({
  language,
  activeTab,
  setActiveTab,
  selectedYear,
  setSelectedYear,
  selectedCountry,
  setSelectedCountry,
  unreadCount,
  setUnreadCount,
  setSidebarOpen,
}) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifFetchedAt = useRef(0);          // timestamp of last successful fetch
  const notifPanelRef = useRef(null);        // for click-outside detection
  const tr = language === 'tr';

  // Close on Escape or click outside the notification panel
  const closeNotifications = useCallback(() => setShowNotifications(false), []);
  useEffect(() => {
    if (!showNotifications) return;
    const onKey = (e) => { if (e.key === 'Escape') closeNotifications(); };
    const onClickOutside = (e) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        closeNotifications();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [showNotifications, closeNotifications]);

  const loadNotifications = useCallback(async () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (!nextState) return;
    // Cache for 60 s — avoid a round-trip on every open
    const age = Date.now() - notifFetchedAt.current;
    if (age < 60_000 && notifications.length > 0) return;
    try {
      const res = await api.getNotifications();
      if (res.ok) {
        setNotifications(await res.json());
        notifFetchedAt.current = Date.now();
      }
    } catch {
      // Network error — keep existing list visible, no user-facing alert needed
    }
  }, [showNotifications, notifications.length]);

  const markAllRead = async () => {
    const prevCount = unreadCount;
    const prevNotifications = notifications;
    setUnreadCount(0);
    setNotifications((items) =>
      items.map((item) => ({ ...item, is_read: true }))
    );
    try {
      await api.markNotificationsRead();
    } catch {
      // Roll back on failure
      setUnreadCount(prevCount);
      setNotifications(prevNotifications);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#302817]/10 bg-white px-3 py-2.5 sm:px-4 lg:px-5">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
        {/* Left */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#302817]/10 bg-white text-[#302817] shadow-sm transition hover:bg-white md:flex lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          {/* Back to dashboard — tablet only (md–lg), bottom nav handles mobile */}
          {activeTab !== 'dashboard' && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className="hidden h-9 items-center gap-1.5 rounded-xl border border-[#302817]/10 bg-white px-3 text-xs font-bold text-[#302817]/60 shadow-sm transition hover:bg-white hover:text-[#302817] md:flex lg:hidden"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              {tr ? 'Ana Sayfa' : 'Home'}
            </button>
          )}
          {/* Mobile: active tab label */}
          <div className="min-w-0 md:hidden">
            <p className="truncate text-sm font-bold text-[#302817]">
              {TAB_LABELS[activeTab]?.[tr ? 'tr' : 'en'] ?? (tr ? 'Kontrol Paneli' : 'Dashboard')}
            </p>
          </div>
          {/* Desktop: workspace label */}
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-bold text-[#302817]">
              {tr ? 'Kontrol Paneli' : 'Dashboard'}
            </p>
            <p className="text-xs font-semibold text-[#302817]/45">
              {tr ? 'Karbon çalışma alanınız' : 'Your carbon workspace'}
            </p>
          </div>
        </div>

        {/* Right */}
        <div className="flex shrink-0 items-center gap-2">
          {/* ⌘K trigger (desktop only) */}
          <button
            onClick={() => {
              // metaKey = Mac ⌘K, ctrlKey = Windows/Linux Ctrl+K
              const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac, bubbles: true }));
            }}
            className="hidden items-center gap-2 rounded-xl border border-[#302817]/10 bg-white px-3 py-2 text-[#302817]/45 shadow-sm transition hover:bg-white hover:text-[#302817] sm:flex"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-[11px] font-semibold">{tr ? 'Ara…' : 'Search…'}</span>
            <kbd className="ml-1 rounded-md border border-[#302817]/10 bg-[#302817]/5 px-1.5 py-0.5 text-[9px] font-bold leading-none">⌘K</kbd>
          </button>

          {/* Year */}
          <MiniSelect
            icon={CalendarDays}
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </MiniSelect>

          {/* Country */}
          <MiniSelect
            icon={Globe2}
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
          >
            <option value="turkey">{tr ? 'Türkiye' : 'Turkey'}</option>
            <option value="global">Global</option>
          </MiniSelect>

          {/* Notifications */}
          <div className="relative" ref={notifPanelRef}>
            <button
              onClick={loadNotifications}
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#302817]/10 bg-white text-[#302817] shadow-sm transition hover:bg-white"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#F8F8F8]">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-[1.5rem] border border-[#302817]/10 bg-white shadow-[0_12px_40px_rgba(48,40,23,0.12)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[360px]">
                <div className="flex items-center justify-between border-b border-[#302817]/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-[#302817]">
                      {tr ? 'Bildirimler' : 'Notifications'}
                    </p>
                    <p className="text-xs font-semibold text-[#302817]/40">
                      {unreadCount > 0
                        ? `${unreadCount} ${tr ? 'okunmamış' : 'unread'}`
                        : tr
                        ? 'Hepsi güncel'
                        : 'All caught up'}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#B4BE6A]/12 px-3 py-2 text-xs font-bold text-[#95A847] transition hover:bg-[#B4BE6A]/18 hover:text-[#302817]"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {tr ? 'Okundu' : 'Read all'}
                    </button>
                  )}
                </div>

                <div className="max-h-[60vh] overflow-y-auto sm:max-h-80">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#B4BE6A]/12 text-[#95A847]">
                        <Bell className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-[#302817]">
                        {tr ? 'Bildirim yok' : 'No notifications'}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#302817]/45">
                        {tr
                          ? 'Yeni bir şey olduğunda burada görünür.'
                          : 'New updates will appear here.'}
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`border-b border-[#302817]/8 px-4 py-3 last:border-0 ${
                          !n.is_read ? 'bg-[#B4BE6A]/8' : 'bg-white'
                        }`}
                      >
                        <p className="text-sm font-bold text-[#302817]">{n.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#302817]/55">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MiniSelect({ icon: Icon, value, onChange, children }) {
  return (
    <label className="flex items-center gap-1.5 rounded-2xl border border-[#302817]/10 bg-white px-2.5 py-2 text-[#302817] shadow-sm transition hover:bg-white">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#B4BE6A]" />
      <select
        value={value}
        onChange={onChange}
        className="max-w-[76px] appearance-none bg-transparent pr-4 text-xs font-bold text-[#302817] outline-none sm:max-w-[120px]"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none -ml-3 h-3 w-3 shrink-0 text-[#302817]/35" />
    </label>
  );
}
