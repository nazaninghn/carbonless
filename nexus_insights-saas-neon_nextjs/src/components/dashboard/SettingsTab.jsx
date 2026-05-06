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
    <div className="space-y-5 text-[#302817]">
      {/* Header */}
      <div className="rounded-[2rem] border border-[#302817]/10 bg-white/70 p-5 shadow-[0_8px_30px_rgba(48,40,23,0.06)] backdrop-blur-xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8F92A1]">
          Carbonless Workspace
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#302817]">
          {tr ? 'Ayarlar' : 'Settings'}
        </h1>
        <p className="mt-1 text-sm leading-6 text-[#302817]/60">
          {tr
            ? 'Hesap, şirket, güvenlik ve sistem tercihlerinizi yönetin.'
            : 'Manage account, company, security and system preferences.'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Sidebar tabs */}
        <aside className="lg:sticky lg:top-5 lg:h-fit">
          <div className="flex gap-2 overflow-x-auto rounded-[1.75rem] border border-[#302817]/10 bg-white/60 p-2 shadow-[0_8px_30px_rgba(48,40,23,0.05)] backdrop-blur-xl lg:block lg:space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex min-w-fit items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition lg:w-full ${
                    isActive
                      ? 'bg-[#302817] text-[#F9EFE5] shadow-lg shadow-[#302817]/15'
                      : 'text-[#302817]/65 hover:bg-white/80 hover:text-[#302817]'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                      isActive
                        ? 'bg-[#F9EFE5]/12 text-[#F9EFE5]'
                        : 'bg-[#8F92A1]/12 text-[#7F8790]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{tr ? tab.tr : tab.en}</span>
                  <ChevronRight
                    className={`ml-auto hidden h-4 w-4 lg:block ${
                      isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content */}
        <section className="min-w-0">
          {/* Section header */}
          <div className="mb-4 rounded-[1.75rem] border border-[#302817]/10 bg-white/60 p-4 shadow-[0_8px_30px_rgba(48,40,23,0.05)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#8F92A1]/14 text-[#7F8790] ring-1 ring-[#8F92A1]/25">
                {active && <active.icon className="h-5 w-5" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#302817]">
                  {active ? (tr ? active.tr : active.en) : ''}
                </h2>
                <p className="text-sm text-[#302817]/55">
                  {tr ? 'Seçili ayar bölümü' : 'Selected settings section'}
                </p>
              </div>
            </div>
          </div>

          {/* ═══ PROFILE ═══ */}
          {activeTab === 'profile' && (
            <Panel>
              <PanelTitle icon={User} title={tr ? 'Profil Bilgileri' : 'Profile Information'} />
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InfoCard label={tr ? 'Kullanıcı Adı' : 'Username'} value={user?.username || '-'} />
                <InfoCard label={tr ? 'E-posta' : 'Email'} value={user?.email || '-'} />
                <InfoCard label={tr ? 'Rol' : 'Role'} value={user?.role_display || user?.role || '-'} />
              </div>
              <ProfileEdit language={language} user={user} onUpdate={fetchData} />

              {user?.permissions && (
                <div className="mt-5 border-t border-[#302817]/10 pt-5">
                  <h4 className="mb-3 text-sm font-bold text-[#302817]">
                    {tr ? 'İzinleriniz' : 'Your Permissions'}
                  </h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
                              ? 'border-[#8F92A1]/30 bg-[#8F92A1]/12 text-[#302817]'
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
            </Panel>
          )}

          {/* ═══ TEAM ═══ */}
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
    <div className="rounded-[2rem] border border-[#302817]/10 bg-white/70 p-4 shadow-[0_8px_30px_rgba(48,40,23,0.06)] backdrop-blur-xl sm:p-5 lg:p-6">
      {children}
    </div>
  );
}

function PanelTitle({ icon: Icon, title }) {
  return (
    <h3 className="mb-4 flex items-center gap-3 text-base font-bold text-[#302817]">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#8F92A1]/14 text-[#7F8790] ring-1 ring-[#8F92A1]/25">
        <Icon className="h-4 w-4" />
      </div>
      {title}
    </h3>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#302817]/10 bg-[#F8F8F8] p-3">
      <p className="text-xs font-bold text-[#302817]/45">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-[#302817]">{value}</p>
    </div>
  );
}
