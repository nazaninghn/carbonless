'use client';
import { LayoutDashboard, Leaf, TrendingDown, FileText, Settings, LogOut, X, ClipboardCheck } from 'lucide-react';
import NextLink from 'next/link';

export default function DashboardSidebar({ language, activeTab, setActiveTab, user, sidebarOpen, setSidebarOpen, onLogout }) {
  const sidebarItems = [
    { key: 'dashboard', icon: LayoutDashboard, label: language === 'tr' ? 'Kontrol Paneli' : 'Dashboard' },
    { key: 'emissions', icon: Leaf, label: language === 'tr' ? 'Emisyon Yönetimi' : 'Emission Management' },
    { key: 'review', icon: ClipboardCheck, label: language === 'tr' ? 'Onay Bekleyenler' : 'Pending Review' },
    { key: 'reduction', icon: TrendingDown, label: language === 'tr' ? 'Azaltma Hedefleri' : 'Reduction Targets' },
    { key: 'reporting', icon: FileText, label: language === 'tr' ? 'Raporlama' : 'Reporting' },
    { key: 'settings', icon: Settings, label: language === 'tr' ? 'Ayarlar' : 'Settings' },
  ];

  return (
    <>
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
            <NextLink href="/" className="flex items-center gap-2">
              <img src="/carbonless.png" alt="Carbonless" className="h-8 w-auto" />
              <span className="font-bold text-lg gradient-text">Carbonless</span>
            </NextLink>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X className="w-5 h-5" /></button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {sidebarItems.map(item => (
              <button key={item.key} onClick={() => setActiveTab(item.key)} aria-label={item.label} aria-current={activeTab === item.key ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === item.key ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-50'}`}>
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center text-white font-semibold">
                {user?.username?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{user?.username || 'User'}</p>
                <p className="text-xs text-gray-500">{user?.email || ''}</p>
              </div>
            </div>
            <button onClick={onLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <LogOut className="w-4 h-4" />
              <span>{language === 'tr' ? 'Çıkış Yap' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </aside>
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-40 lg:hidden" />}
    </>
  );
}
