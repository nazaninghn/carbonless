'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { timeAgo } from '@/lib/timeAgo';
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
import { REVIEW_FOCUS_KEY, REVIEW_FOCUS_EVENT } from '@/lib/reviewFocus';
import { FOCUS_ENTRY_EVENT, FOCUS_ENTRY_KEY } from '@/components/dashboard/CommandPalette';
import { openChat } from '@/lib/openChat';

const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i);

const TAB_LABELS = {
  dashboard:     { tr: 'Kontrol Paneli',    en: 'Dashboard'        },
  questionnaire: { tr: 'Karbon Envanteri',  en: 'Carbon Inventory' },
  emissions:     { tr: 'Emisyon Yönetimi',  en: 'Emissions'        },
  ai_carbon:     { tr: 'AI Asistan',        en: 'AI Assistant'     },
  reduction:     { tr: 'Azaltma Hedefleri', en: 'Targets'          },
  reporting:     { tr: 'Raporlama',         en: 'Reports'          },
  review:        { tr: 'Onay Bekleyenler',  en: 'Review'           },
  settings:      { tr: 'Ayarlar',           en: 'Settings'         },
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
  onLanguageChange,
}) {
  const [notifications, setNotifications] = useState([]);
  // Unread notices of the user's other companies: named with a switch, as
  // the list below holds the company being worked in.
  const [otherCompanies, setOtherCompanies] = useState([]);
  const [switchingTo, setSwitchingTo] = useState(null);
  const switchTo = useCallback(async (id) => {
    setSwitchingTo(id);
    const res = await api.switchCompany(id).catch(() => null);
    if (res?.ok) { window.location.href = '/dashboard'; return; }
    setSwitchingTo(null);
  }, []);
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
    api.getUnreadCount()
      .then(r => (r.ok ? r.json() : null))
      .then(d => setOtherCompanies(Array.isArray(d?.other_companies) ? d.other_companies : []))
      .catch(() => {});
    // Cache for 60 s — avoid a round-trip on every open
    const age = Date.now() - notifFetchedAt.current;
    if (age < 60_000 && notifications.length > 0) return;
    try {
      const res = await api.getNotifications();
      if (res.ok) {
        // Fix 28A: coerce to array — backend may return {results:[], count:0}
        const d = await res.json().catch(() => []);
        setNotifications(Array.isArray(d) ? d : (d.results ?? []));
        notifFetchedAt.current = Date.now();
      }
    } catch {
      // Network error — keep existing list visible, no user-facing alert needed
    }
  }, [showNotifications, notifications.length]);

  const markAllRead = useCallback(async () => {
    const prevCount = unreadCount;
    const prevNotifications = notifications;
    // Only this company's notices are marked; other companies' stay counted.
    setUnreadCount(otherCompanies.reduce((n, c) => n + (c.unread || 0), 0));
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
  }, [unreadCount, notifications, setUnreadCount, otherCompanies]);

  // Where each kind of notification takes you when clicked.
  const NOTIFICATION_TAB = {
    entry_submitted: 'review',
    entry_approved: 'emissions',
    entry_rejected: 'emissions',
    custom_approved: 'emissions',
    custom_rejected: 'emissions',
    target_alert: 'reduction',
    report_ready: 'reporting',
  };

  const openNotification = useCallback(async (n) => {
    // A notice may name its page in its link ("/dashboard?tab=questionnaire"
    // for an edited inventory); the type decides for the others.
    const params = new URLSearchParams((n.link || '').split('?')[1] || '');
    // The link's own tab first: a rejected Danışman Onayı is an
    // "entry_rejected" notice but opens the inventory, not Emisyon.
    const tab = params.get('tab') || NOTIFICATION_TAB[n.notification_type];
    if (tab) setActiveTab?.(tab);
    // The support team's answer opens the chat it was posted in.
    if (params.get('chat')) openChat(params.get('chat'));
    // "Kaydınız onaylandı / reddedildi" opens Emisyon Yönetimi on that entry
    // (the year is set below), scrolled to it and marked.
    if (params.get('entry') && tab === 'emissions') {
      try { sessionStorage.setItem(FOCUS_ENTRY_KEY, params.get('entry')); } catch { /* event below */ }
      setTimeout(() => window.dispatchEvent(new CustomEvent(FOCUS_ENTRY_EVENT, { detail: params.get('entry') })), 120);
    }
    // "Onay bekleyen kayıt" opens the review page on that entry.
    if (params.get('entry') && tab === 'review') {
      try { sessionStorage.setItem(REVIEW_FOCUS_KEY, params.get('entry')); } catch { /* opens at the top */ }
      window.dispatchEvent(new Event(REVIEW_FOCUS_EVENT));
    }
    // "Danışman onayı reddedildi" opens the inventory on that question.
    if (tab === 'questionnaire' && params.get('report') && params.get('step')) {
      try {
        sessionStorage.setItem('carboniq_open_request',
          JSON.stringify({ report_id: Number(params.get('report')), step_id: params.get('step') }));
      } catch { /* opens the inventory list */ }
      window.dispatchEvent(new CustomEvent('carboniq-navigate', { detail: { tab: 'questionnaire' } }));
    }
    // An entry notification opens on the entry's own year.
    const year = Number(params.get('year'));
    if (year) setSelectedYear?.(year);
    setShowNotifications(false);
    if (!n.is_read) {
      setNotifications(items => items.map(item => (item.id === n.id ? { ...item, is_read: true } : item)));
      setUnreadCount?.(Math.max(0, (unreadCount || 0) - 1));
      try { await api.markNotificationsRead([n.id]); } catch { /* the badge re-syncs on next load */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActiveTab, setSelectedYear, setUnreadCount, unreadCount]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#DEFAE1] bg-white px-3 sm:px-4 lg:px-5">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3">
        {/* Left: sidebar toggle (mobile only) — logo/brand removed, the
            sidebar already shows the Carbonless logo, so this header used to
            repeat it right next to the mode-switcher pill on a second line */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#072C0E]/50 hover:bg-[#F1FCF2] lg:hidden"
            aria-label={tr ? 'Kenar çubuğunu aç' : 'Open sidebar'}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Center: Mode switcher pill */}
        <div className="flex items-center gap-0.5 rounded-full bg-[#F5F5F5] border border-[#DEFAE1] p-0.5 sm:p-1">
          <button
            // AI mode: the Carbon Inventory with the AI assistant beside it,
            // full screen.
            onClick={() => setActiveTab('ai_carbon')}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-[12px] font-semibold transition-all duration-200 ${
              activeTab === 'ai_carbon'
                ? 'bg-[#2ABD41] text-white shadow-sm'
                : 'text-[#072C0E]/50 hover:text-[#072C0E] hover:bg-white/70'
            }`}
          >
            <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>
            <span className="sm:hidden">AI</span>
            <span className="hidden sm:inline">{tr ? 'AI Hesaplayıcı' : 'AI Analyzer'}</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-[12px] font-semibold transition-all duration-200 ${
              activeTab !== 'ai_carbon'
                ? 'bg-[#51D766] text-[#072C0E] shadow-sm'
                : 'text-[#072C0E]/50 hover:text-[#072C0E] hover:bg-white/70'
            }`}
          >
            <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
            <span className="sm:hidden">{tr ? 'Panel' : 'Dash'}</span>
            <span className="hidden sm:inline">{tr ? 'Kontrol Paneli' : 'Dashboard'}</span>
          </button>
        </div>

        {/* Right: language + year + notifications */}
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          {onLanguageChange && (
            <div className="flex items-center gap-0.5 rounded-full bg-[#F1FCF2] border border-[#DEFAE1] p-0.5">
              {['tr', 'en'].map(l => (
                <button
                  key={l}
                  onClick={() => onLanguageChange(l)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition ${
                    language === l ? 'bg-white text-[#072C0E] shadow-sm' : 'text-[#072C0E]/40 hover:text-[#072C0E]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Year selector */}
          <select
            aria-label={tr ? 'Raporlama yılı' : 'Reporting year'}
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="hidden sm:block h-8 rounded-lg border border-[#DEFAE1] bg-white px-2 text-[11px] font-semibold text-[#072C0E]/70 outline-none"
          >
            {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Notification bell */}
          <div className="relative" ref={notifPanelRef}>
            <button
              onClick={loadNotifications}
              aria-label={tr ? 'Bildirimler' : 'Notifications'}
              aria-expanded={showNotifications}
              aria-haspopup="dialog"
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#DEFAE1] text-[#072C0E]/50 hover:text-[#072C0E] transition"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-[#DEFAE1] bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[360px]">
                <div className="flex items-center justify-between border-b border-[#DEFAE1] px-4 py-3">
                  <p className="text-sm font-bold text-[#072C0E]">
                    {tr ? 'Bildirimler' : 'Notifications'}
                  </p>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[11px] font-semibold text-[#2ABD41] hover:underline">
                      {tr ? 'Hepsini oku' : 'Mark all read'}
                    </button>
                  )}
                </div>
                {otherCompanies.length > 0 && (
                  <div className="border-b border-[#DEFAE1] bg-amber-50/60 px-3 py-2">
                    {otherCompanies.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2 py-1 text-[11px] font-semibold text-amber-900">
                        <span className="min-w-0 truncate">
                          {tr ? `${c.name}: ${c.unread} okunmamış bildirim` : `${c.name}: ${c.unread} unread`}
                        </span>
                        <button
                          type="button"
                          disabled={switchingTo === c.id}
                          onClick={() => switchTo(c.id)}
                          className="shrink-0 rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {tr ? 'Geç' : 'Switch'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-[#072C0E]/35">{tr ? 'Bildirim yok' : 'No notifications'}</p>
                  ) : notifications.map(n => (
                    <button
                      type="button"
                      key={n.id}
                      onClick={() => openNotification(n)}
                      className={`block w-full text-left rounded-xl px-3 py-2.5 mb-1 transition hover:bg-[#DEFAE1]/60 ${n.is_read ? '' : 'bg-[#F1FCF2]'}`}
                    >
                      <p className="text-[12px] font-semibold text-[#072C0E]">{n.title}</p>
                      <p className="text-[10px] text-[#072C0E]/50 mt-0.5">{n.message}</p>
                      {n.created_at && (
                        <p className="text-[9px] font-semibold text-[#072C0E]/35 mt-1" title={new Date(n.created_at).toLocaleString(tr ? 'tr-TR' : 'en-GB')}>
                          {timeAgo(n.created_at, tr)}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
