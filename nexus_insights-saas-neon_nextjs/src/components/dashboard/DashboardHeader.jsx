'use client';
import { useState } from 'react';
import { Bell, CalendarDays, CheckCheck, ChevronDown, Globe2, Menu } from 'lucide-react';
import { api } from '@/lib/utils/api';

export default function DashboardHeader({ language, selectedYear, setSelectedYear, selectedCountry, setSelectedCountry, unreadCount, setUnreadCount, setSidebarOpen }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadNotifications = async () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState) {
      const res = await api.getNotifications();
      if (res.ok) setNotifications(await res.json());
    }
  };

  const markAllRead = async () => {
    await api.markNotificationsRead();
    setUnreadCount(0);
    setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[#302817]/6 bg-white/80 px-4 py-2.5 backdrop-blur-xl sm:px-5">
      <div className="flex items-center justify-between gap-3">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#302817]/50 transition hover:bg-[#302817]/5 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-[15px] font-bold tracking-tight text-[#302817] sm:text-base">
            {language === 'tr' ? 'Carbonless' : 'Carbonless'}
          </h1>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Year */}
          <MiniSelect
            icon={CalendarDays}
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {Array.from({ length: 7 }, (_, i) => 2026 - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </MiniSelect>

          {/* Country */}
          <MiniSelect
            icon={Globe2}
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
          >
            <option value="turkey">{language === 'tr' ? 'TR' : 'TR'}</option>
            <option value="global">{language === 'tr' ? 'Global' : 'Global'}</option>
          </MiniSelect>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={loadNotifications}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[#302817]/50 transition hover:bg-[#302817]/5"
              aria-label="Notifications"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="fixed inset-x-4 top-16 z-50 overflow-hidden rounded-2xl border border-[#302817]/8 bg-white shadow-[0_8px_30px_rgba(48,40,23,0.1)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px]">
                <div className="flex items-center justify-between border-b border-[#302817]/6 px-4 py-3">
                  <p className="text-[13px] font-bold text-[#302817]">{language === 'tr' ? 'Bildirimler' : 'Notifications'}</p>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-bold text-[#8F92A1] hover:text-[#302817]">
                      <CheckCheck className="h-3 w-3" />
                      {language === 'tr' ? 'Okundu' : 'Read all'}
                    </button>
                  )}
                </div>
                <div className="max-h-[60vh] overflow-y-auto sm:max-h-80">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="mx-auto h-5 w-5 text-[#8F92A1]/40" />
                      <p className="mt-2 text-[12px] font-semibold text-[#302817]/40">
                        {language === 'tr' ? 'Bildirim yok' : 'No notifications'}
                      </p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={`border-b border-[#302817]/4 px-4 py-3 last:border-0 ${!n.is_read ? 'bg-[#8F92A1]/5' : ''}`}>
                        <p className="text-[13px] font-semibold text-[#302817]">{n.title}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-[#302817]/50">{n.message}</p>
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
    <label className="hidden items-center gap-1.5 rounded-xl border border-[#302817]/8 bg-[#F8F8F8] px-2.5 py-2 sm:flex">
      <Icon className="h-3.5 w-3.5 text-[#8F92A1]" />
      <select value={value} onChange={onChange} className="appearance-none bg-transparent pr-4 text-[12px] font-bold text-[#302817] outline-none">
        {children}
      </select>
      <ChevronDown className="pointer-events-none -ml-3 h-3 w-3 text-[#302817]/30" />
    </label>
  );
}
