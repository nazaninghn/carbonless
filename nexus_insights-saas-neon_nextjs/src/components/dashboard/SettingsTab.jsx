'use client';
import { useState, useRef, useCallback, useMemo } from 'react';
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
  // Delete-account confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const deleteInputRef = useRef(null);
  const tr = language === 'tr';
  // TABS is module-level (never changes); only dep is activeTab
  const active = useMemo(() => TABS.find((tab) => tab.id === activeTab), [activeTab]);

  const handleExport = useCallback(async () => {
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
        // Revoke after 30 s — enough time for the browser to start the download
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch {}
    setExporting(false);
  }, []);

  const openDeleteModal = useCallback(() => {
    setDeletePassword('');
    setDeleteError('');
    setShowDeleteModal(true);
    // Focus the input after the modal renders
    setTimeout(() => deleteInputRef.current?.focus(), 50);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletePassword) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await api.deleteAccount(deletePassword);
      if (res.ok) {
        // Navigate away — no beforeunload mutation needed; page is intentionally leaving
        window.location.href = '/login';
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || (tr ? 'Hata oluştu' : 'An error occurred'));
        setDeleting(false);
      }
    } catch {
      setDeleteError(tr ? 'Bağlantı hatası' : 'Connection error');
      setDeleting(false);
    }
  }, [deletePassword, tr]);

  return (
    <div className="space-y-3 text-[#302817]">
      {/* Header */}
      <div className="rounded-[1.25rem] border border-[#302817]/10 bg-white p-4 shadow-sm">
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
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 scrollbar-none lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-[1.25rem] lg:border lg:border-[#302817]/10 lg:bg-white lg:p-1.5 lg:pb-1.5 lg:shadow-sm">
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
                      : 'border border-[#302817]/8 bg-white text-[#302817]/60 hover:bg-white hover:text-[#302817] lg:border-0 lg:bg-transparent'
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
          <div className="mb-3 rounded-xl border border-[#302817]/10 bg-white p-2.5 shadow-sm lg:rounded-[1.25rem] lg:p-3">
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
                    onClick={() => { try { localStorage.setItem('language', 'en'); window.location.reload(); } catch {} }}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition ${language === 'en' ? 'border-[#95A847]/40 bg-[#95A847]/12 text-[#75863B]' : 'border-[#302817]/10 bg-[#F8F8F8] text-[#302817]/60 hover:bg-white'}`}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    onClick={() => { try { localStorage.setItem('language', 'tr'); window.location.reload(); } catch {} }}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition ${language === 'tr' ? 'border-[#95A847]/40 bg-[#95A847]/12 text-[#75863B]' : 'border-[#302817]/10 bg-[#F8F8F8] text-[#302817]/60 hover:bg-white'}`}
                  >
                    🇹🇷 Türkçe
                  </button>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-[#302817]/35">
                  {tr ? 'Dil değiştirmek sayfayı yeniden yükler.' : 'Switching language reloads the page.'}
                </p>
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

              <div className="rounded-[2rem] border border-red-200 bg-red-50 p-5 shadow-[0_8px_30px_rgba(48,40,23,0.05)]">
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
                  onClick={openDeleteModal}
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

      {/* ─── Delete Account Confirmation Modal ─────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[1.5rem] border border-red-200 bg-white p-6 shadow-[0_24px_60px_rgba(48,40,23,0.18)]">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100">
              <Trash2 className="h-5 w-5 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-[#302817]">
              {tr ? 'Hesabı Sil' : 'Delete Account'}
            </h3>
            <p className="mt-1.5 text-xs leading-5 text-[#302817]/60">
              {tr
                ? 'Bu işlem geri alınamaz. Onaylamak için şifrenizi girin.'
                : 'This action is irreversible. Enter your password to confirm.'}
            </p>
            <input
              ref={deleteInputRef}
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
              placeholder={tr ? 'Şifreniz' : 'Your password'}
              className="mt-4 w-full rounded-xl border border-[#302817]/10 bg-[#F8F8F8] px-3.5 py-2.5 text-sm font-semibold text-[#302817] outline-none placeholder:text-[#302817]/30 focus:border-red-300 focus:ring-4 focus:ring-red-100"
            />
            {deleteError && (
              <p className="mt-2 text-xs font-semibold text-red-600">{deleteError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting || !deletePassword}
                className="flex-1 rounded-full bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '...' : tr ? 'Sil' : 'Delete'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 rounded-full border border-[#302817]/10 py-2.5 text-xs font-bold text-[#302817] transition hover:bg-[#F8F8F8]"
              >
                {tr ? 'İptal' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ children }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#302817]/10 bg-white p-3 shadow-sm sm:rounded-[1.25rem] sm:p-4">
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
