'use client';
import { useState } from 'react';
import { Menu, Bell } from 'lucide-react';
import { api } from '@/lib/utils/api';

export default function DashboardHeader({ language, selectedYear, setSelectedYear, selectedCountry, setSelectedCountry, unreadCount, setUnreadCount, setSidebarOpen }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-auto min-h-[4rem] bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 py-2 flex-wrap gap-2">
      <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu className="w-6 h-6" /></button>
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        <span className="text-sm text-gray-600">{language === 'tr' ? 'Yıl:' : 'Year:'}</span>
        <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
          <option value={2026}>2026</option><option value={2025}>2025</option><option value={2024}>2024</option>
        </select>
        <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)} className="px-2 sm:px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
          <option value="turkey">{language === 'tr' ? 'Türkiye' : 'Turkey'}</option>
          <option value="global">{language === 'tr' ? 'Global' : 'Global'}</option>
        </select>

        {/* Notification Bell */}
        <div className="relative">
          <button onClick={async () => {
            setShowNotifications(!showNotifications);
            if (!showNotifications) {
              const res = await api.getNotifications();
              if (res.ok) setNotifications(await res.json());
            }
          }} className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{unreadCount}</span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
              <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <span className="font-semibold text-sm">{language === 'tr' ? 'Bildirimler' : 'Notifications'}</span>
                {unreadCount > 0 && (
                  <button onClick={async () => { await api.markNotificationsRead(); setUnreadCount(0); setNotifications(n => n.map(x => ({...x, is_read: true}))); }} className="text-xs text-primary">
                    {language === 'tr' ? 'Tümünü okundu işaretle' : 'Mark all read'}
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">{language === 'tr' ? 'Bildirim yok' : 'No notifications'}</div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`p-3 border-b border-gray-100 ${!n.is_read ? 'bg-primary/5' : ''}`}>
                    <p className="text-sm font-medium text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
