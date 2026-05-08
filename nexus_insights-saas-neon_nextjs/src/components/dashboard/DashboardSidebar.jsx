'use client';
import { useState } from 'react';
import {
  LayoutDashboard, Leaf, TrendingDown, FileText, Settings, LogOut, X,
  ClipboardCheck, Bot, ChevronRight,
} from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function DashboardSidebar({ language, activeTab, setActiveTab, user, sidebarOpen, setSidebarOpen, onLogout }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const tr = language === 'tr';

  const sidebarItems = [
    { key: 'dashboard', icon: LayoutDashboard, label: tr ? 'Kontrol Paneli' : 'Dashboard' },
    { key: 'emissions', icon: Leaf, label: tr ? 'Emisyon Yönetimi' : 'Emission Management' },
    { key: 'review', icon: ClipboardCheck, label: tr ? 'Onay Bekleyenler' : 'Pending Review' },
    { key: 'reduction', icon: TrendingDown, label: tr ? 'Azaltma Hedefleri' : 'Reduction Targets' },
    { key: 'reporting', icon: FileText, label: tr ? 'Raporlama' : 'Reporting' },
    { key: 'ai_carbon', icon: Bot, label: 'AI Carbon' },
    { key: 'settings', icon: Settings, label: tr ? 'Ayarlar' : 'Settings' },
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] transform bg-white border-r border-[#302817]/6 transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0 shadow-[0_8px_30px_rgba(48,40,23,0.12)]' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-[#302817]/6 px-4">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex min-w-0 items-center gap-2"
            >
              <img src="/carbonless.png" alt="Carbonless" className="h-12 w-auto shrink-0" />
              <span className="truncate text-lg font-bold tracking-tight text-[#302817]">Carbonless</span>
            </button>
            <button onClick={closeSidebar} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#302817]/40 hover:bg-[#302817]/5 lg:hidden">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#B4BE6A]">
              {tr ? 'Çalışma Alanı' : 'Workspace'}
            </p>
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => { setActiveTab(item.key); closeSidebar(); }}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                    active
                      ? 'bg-[#302817] text-white shadow-[0_4px_12px_rgba(48,40,23,0.15)]'
                      : 'text-[#302817]/65 hover:bg-[#B4BE6A]/8 hover:text-[#302817]'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-[#B4BE6A]'}`} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                </button>
              );
            })}
          </nav>

          {/* User */}
          <div className="border-t border-[#302817]/6 p-3">
            <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-[#F8F8F8] px-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#302817] text-[11px] font-bold text-white">
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-[#302817]">{user?.username || 'User'}</p>
                <p className="truncate text-[11px] text-[#302817]/45">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-red-500 transition hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5" />{tr ? 'Çıkış' : 'Logout'}
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button type="button" aria-label="Close sidebar overlay" onClick={closeSidebar} className="fixed inset-0 z-40 bg-[#302817]/25 backdrop-blur-sm lg:hidden" />
      )}

      {/* Logout Confirm */}
      <ConfirmDialog
        open={showLogoutConfirm}
        type="danger"
        title={tr ? 'Oturumu kapat' : 'Sign out'}
        message={tr ? 'Hesabınızdan çıkış yapılacak. Devam etmek istiyor musunuz?' : 'You will be signed out of your account. Do you want to continue?'}
        confirmText={tr ? 'Çıkış yap' : 'Sign out'}
        cancelText={tr ? 'İptal' : 'Cancel'}
        onConfirm={() => { setShowLogoutConfirm(false); onLogout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </>
  );
}
