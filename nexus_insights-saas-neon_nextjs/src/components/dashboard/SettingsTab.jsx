'use client';
import { useState } from 'react';
import {
  Leaf,
  Target,
  Users,
  Bell,
  Download,
  Trash2,
  User,
  Shield,
  ChevronRight,
} from 'lucide-react';
import CompanySettings from '@/components/CompanySettings';
import FacilitySettings from '@/components/FacilitySettings';
import PasswordChange from '@/components/PasswordChange';
import TeamManagement from '@/components/TeamManagement';
import ProfileEdit from '@/components/ProfileEdit';
import NotificationPreferences from '@/components/NotificationPreferences';
import { api } from '@/lib/utils/api';

const TABS = [
  { id: 'profile', icon: User, tr: 'Profil', en: 'Profile' },
  { id: 'team', icon: Users, tr: 'Takım', en: 'Team' },
  { id: 'company', icon: Leaf, tr: 'Şirket', en: 'Company' },
  { id: 'facilities', icon: Target, tr: 'Tesisler', en: 'Facilities' },
  { id: 'security', icon: Shield, tr: 'Güvenlik', en: 'Security' },
  { id: 'notifications', icon: Bell, tr: 'Bildirimler', en: 'Notifications' },
  { id: 'data', icon: Download, tr: 'Veri', en: 'Data' },
];

export default function SettingsTab({ language, user, fetchData }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const tr = language === 'tr';
  const active = TABS.find((tab) => tab.id === activeTab);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.exportAll();
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'carbonless_backup.json';
        a.click();
      }
    } catch {}
    setExporting(false);
  };

  const handleDelete = async () => {
    const password = prompt(
      tr
        ? 'Hesabınızı silmek için şifrenizi girin:'
        : 'Enter your password to delete your account:'
    );
    if (!password) return;
    setDeleting(true);
    const res = await api.deleteAccount(password);
    if (res.ok) {
      window.location.href = '/login';
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Error');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3 text-[#302817]">
      {/* Header */}
      <div className="rounded-[1.25rem] border border-[#302817]/10 bg-white/70 p-4 shadow-[0_6px_20px_rgba(48,40,23,0.04)] backdrop-blur-xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#B4BE6A]">
          Carbonless Workspace
        </p>
        <h1 className="mt-1 text-lg font-bold tracking-[-0.03em] text-[#302817]">
          {tr ? 'Ayarlar' : 'Settings'}
        </h1>
        <p className="mt-0.5 text-xs text-[#302817]/55">
          {tr
            ? 'Hesap, şirket, güvenlik ve sistem tercihlerinizi yönetin.'
            : 'Manage account, company, security and system preferences.'}
        </p>
      </div>

      <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sidebar tabs */}
        <aside className="lg:sticky lg:top-4 lg:h-fit">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 scrollbar-none lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-[1.25rem] lg:border lg:border-[#302817]/10 lg:bg-white/60 lg:p-1.5 lg:pb-1.5 lg:shadow-[0_4px_16px_rgba(48,40,23,0.04)] lg:backdrop-blur-xl">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold transition lg:w-full lg:gap-2 lg:px-3 lg:text-xs ${
                    isActive
                      ? 'bg-[#302817] text-[#F9EFE5] shadow-md shadow-[#302817]/12'
                      : 'border border-[#302817]/8 bg-white/70 text-[#302817]/60 hover:bg-white hover:text-[#302817] lg:border-0 lg:bg-transparent'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg lg:h-7 lg:w-7 ${
                      isActive
                        ? 'bg-[#F9EFE5]/12 text-[#F9EFE5]'
                        : 'bg-[#B4BE6A]/12 text-[#95A847]'
                    }`}
                  >
                    <Icon className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
                  </span>
                  <span className="whitespace-nowrap">{tr ? tab.tr : tab.en}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content */}
        <section className="w-full min-w-0 max-w-full overflow-hidden">
          {/* Section header */}
          <div className="mb-3 rounded-xl border border-[#302817]/10 bg-white/60 p-2.5 shadow-[0_4px_16px_rgba(48,40,23,0.04)] backdrop-blur-xl lg:rounded-[1.25rem] lg:p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B4BE6A]/14 text-[#95A847] ring-1 ring-[#B4BE6A]/25 lg:h-9 lg:w-9 lg:rounded-xl">
                {active && <active.icon className="h-4 w-4" />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#302817]">
                  {active ? (tr ? active.tr : active.en) : ''}
                </h2>
                <p className="text-[11px] text-[#302817]/45">
                  {tr ? 'Seçili ayar bölümü' : 'Selected settings section'}
                </p>
              </div>
            </div>
          </div>

          {/* ═══ PROFILE ═══ */}
          {activeTab === 'profile' && (
            <Panel>
              <PanelTitle icon={User} title={tr ? 'Profil Bilgileri' : 'Profile Information'} />
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <InfoCard label={tr ? 'Kullanıcı Adı' : 'Username'} value={user?.username || '-'} />
                <InfoCard label={tr ? 'E-posta' : 'Email'} value={user?.email || '-'} />
                <InfoCard label={tr ? 'Rol' : 'Role'} value={user?.role_display || user?.role || '-'} />
              </div>
              <div className="w-full min-w-0 overflow-hidden">
                <ProfileEdit language={language} user={user} onUpdate={fetchData} />
              </div>

              {user?.permissions && (
                <div className="mt-5 border-t border-[#302817]/10 pt-5">
                  <h4 className="mb-3 text-sm font-bold text-[#302817]">
                    {tr ? 'İzinleriniz' : 'Your Permissions'}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {[
                      { key: 'can_edit_entries', tr: 'Veri Girişi', en: 'Edit Entries' },
                      { key: 'can_manage_users', tr: 'Kullanıcı Yönetimi', en: 'Manage Users' },
                      { key: 'can_approve_requests', tr: 'Talep Onayı', en: 'Approve Requests' },
                      { key: 'can_generate_reports', tr: 'Rapor Oluşturma', en: 'Generate Reports' },
                    ].map((p) => {
                      const allowed = user.permissions[p.key];
                      return (
                        <div
                          key={p.key}
                          className={`rounded-2xl border px-3 py-3 text-center text-xs font-bold ${
                            allowed
                              ? 'border-[#B4BE6A]/30 bg-[#B4BE6A]/12 text-[#302817]'
                              : 'border-[#302817]/10 bg-[#F8F8F8] text-[#302817]/45'
                          }`}
                        >
                          {allowed ? '✓' : '—'} {tr ? p.tr : p.en}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Language Preference */}
              <div className="mt-4 border-t border-[#302817]/10 pt-4">
                <h4 className="mb-2 text-xs font-bold text-[#302817]">{tr ? 'Dil Tercihi' : 'Language Preference'}</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => { try { localStorage.setItem('language', 'en'); window.onbeforeunload = null; window.location.reload(); } catch {} }}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition ${language === 'en' ? 'border-[#95A847]/40 bg-[#95A847]/12 text-[#75863B]' : 'border-[#302817]/10 bg-[#F8F8F8] text-[#302817]/60 hover:bg-white'}`}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    onClick={() => { try { localStorage.setItem('language', 'tr'); window.onbeforeunload = null; window.location.reload(); } catch {} }}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition ${language === 'tr' ? 'border-[#95A847]/40 bg-[#95A847]/12 text-[#75863B]' : 'border-[#302817]/10 bg-[#F8F8F8] text-[#302817]/60 hover:bg-white'}`}
                  >
                    🇹🇷 Türkçe
                  </button>
                </div>
              </div>
            </Panel>
          )}
          {activeTab === 'team' && (
            <Panel>
              <TeamManagement language={language} />
            </Panel>
          )}

          {/* ═══ COMPANY ═══ */}
          {activeTab === 'company' && (
            <Panel>
              <PanelTitle icon={Leaf} title={tr ? 'Şirket Bilgileri' : 'Company Information'} />
              <CompanySettings language={language} />
            </Panel>
          )}

          {/* ═══ FACILITIES ═══ */}
          {activeTab === 'facilities' && (
            <Panel>
              <PanelTitle icon={Target} title={tr ? 'Tesis Yönetimi' : 'Facility Management'} />
              <FacilitySettings language={language} />
            </Panel>
          )}

          {/* ═══ SECURITY ═══ */}
          {activeTab === 'security' && (
            <Panel>
              <PanelTitle icon={Shield} title={tr ? 'Şifre Değiştir' : 'Change Password'} />
              <PasswordChange language={language} />
            </Panel>
          )}

          {/* ═══ NOTIFICATIONS ═══ */}
          {activeTab === 'notifications' && (
            <Panel>
              <PanelTitle icon={Bell} title={tr ? 'Bildirim Tercihleri' : 'Notification Preferences'} />
              <NotificationPreferences language={language} user={user} />
            </Panel>
          )}

          {/* ═══ DATA & ACCOUNT ═══ */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              <Panel>
                <PanelTitle icon={Download} title={tr ? 'Veri Dışa Aktarma' : 'Data Export'} />
                <p className="mb-4 text-sm leading-6 text-[#302817]/60">
                  {tr
                    ? 'Tüm emisyon verilerinizi JSON formatında indirin.'
                    : 'Download all your emission data in JSON format.'}
                </p>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#302817] px-5 py-3 text-sm font-bold text-[#F9EFE5] shadow-xl shadow-[#302817]/15 transition hover:bg-black disabled:opacity-60 sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? '...' : tr ? 'Tüm Verileri İndir' : 'Export All Data'}
                </button>
              </Panel>

              <div className="rounded-[2rem] border border-red-200 bg-red-50/80 p-5 shadow-[0_8px_30px_rgba(48,40,23,0.05)] backdrop-blur-xl">
                <h3 className="mb-3 flex items-center gap-2 font-bold text-red-700">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-100">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </div>
                  {tr ? 'Tehlikeli Bölge' : 'Danger Zone'}
                </h3>
                <p className="mb-4 text-sm leading-6 text-red-700/70">
                  {tr
                    ? 'Hesabınızı silmek geri alınamaz. Tüm verileriniz kalıcı olarak silinir.'
                    : 'Deleting your account is irreversible. All your data will be permanently deleted.'}
                </p>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60 sm:w-auto"
                >
                  <Trash2 className="h-4 w-4" />
                  {tr ? 'Hesabı Kalıcı Olarak Sil' : 'Permanently Delete Account'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Panel({ children }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#302817]/10 bg-white/70 p-3 shadow-[0_4px_16px_rgba(48,40,23,0.04)] backdrop-blur-xl sm:rounded-[1.25rem] sm:p-4">
      <div className="w-full min-w-0 max-w-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function PanelTitle({ icon: Icon, title }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#302817]">
      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#B4BE6A]/14 text-[#95A847] ring-1 ring-[#B4BE6A]/25 sm:h-7 sm:w-7">
        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </div>
      {title}
    </h3>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#302817]/8 bg-[#F8F8F8] px-3 py-2 sm:block sm:rounded-xl">
      <p className="text-[10px] font-bold text-[#302817]/40">{label}</p>
      <p className="text-xs font-bold text-[#302817] sm:mt-0.5">{value}</p>
    </div>
  );
}
