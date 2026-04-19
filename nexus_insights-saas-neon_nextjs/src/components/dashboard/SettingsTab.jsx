'use client';
import { useState } from 'react';
import { Settings, Leaf, Target, Users, Bell, Download, Trash2, User, Shield } from 'lucide-react';
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.exportAll();
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'carbonless_backup.json'; a.click();
      }
    } catch {}
    setExporting(false);
  };

  const handleDelete = async () => {
    const password = prompt(tr ? 'Hesabınızı silmek için şifrenizi girin:' : 'Enter your password to delete your account:');
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{tr ? 'Ayarlar' : 'Settings'}</h1>
        <p className="text-gray-600 mt-1">{tr ? 'Hesap, şirket ve sistem ayarları' : 'Account, company and system settings'}</p>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tr ? tab.tr : tab.en}
            </button>
          );
        })}
      </div>

      {/* ═══ PROFILE ═══ */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
            {tr ? 'Profil Bilgileri' : 'Profile Information'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{tr ? 'Kullanıcı Adı' : 'Username'}</p>
              <p className="text-sm font-medium text-gray-900">{user?.username || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{tr ? 'E-posta' : 'Email'}</p>
              <p className="text-sm font-medium text-gray-900">{user?.email || '-'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{tr ? 'Rol' : 'Role'}</p>
              <p className="text-sm font-medium text-gray-900">{user?.role_display || user?.role || '-'}</p>
            </div>
          </div>
          <ProfileEdit language={language} user={user} onUpdate={fetchData} />

          {/* Permissions */}
          {user?.permissions && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">{tr ? 'İzinleriniz' : 'Your Permissions'}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'can_edit_entries', tr: 'Veri Girişi', en: 'Edit Entries' },
                  { key: 'can_manage_users', tr: 'Kullanıcı Yönetimi', en: 'Manage Users' },
                  { key: 'can_approve_requests', tr: 'Talep Onayı', en: 'Approve Requests' },
                  { key: 'can_generate_reports', tr: 'Rapor Oluşturma', en: 'Generate Reports' },
                ].map(p => (
                  <div key={p.key} className={`p-2.5 rounded-lg text-center text-xs font-medium ${user.permissions[p.key] ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-400 border border-gray-200'}`}>
                    {user.permissions[p.key] ? '✅' : '❌'} {tr ? p.tr : p.en}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TEAM ═══ */}
      {activeTab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <TeamManagement language={language} />
        </div>
      )}

      {/* ═══ COMPANY ═══ */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center"><Leaf className="w-4 h-4 text-secondary" /></div>
            {tr ? 'Şirket Bilgileri' : 'Company Information'}
          </h3>
          <CompanySettings language={language} />
        </div>
      )}

      {/* ═══ FACILITIES ═══ */}
      {activeTab === 'facilities' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center"><Target className="w-4 h-4 text-accent" /></div>
            {tr ? 'Tesis Yönetimi' : 'Facility Management'}
          </h3>
          <FacilitySettings language={language} />
        </div>
      )}

      {/* ═══ SECURITY ═══ */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center"><Shield className="w-4 h-4 text-red-600" /></div>
            {tr ? 'Şifre Değiştir' : 'Change Password'}
          </h3>
          <PasswordChange language={language} />
        </div>
      )}

      {/* ═══ NOTIFICATIONS ═══ */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center"><Bell className="w-4 h-4 text-amber-600" /></div>
            {tr ? 'Bildirim Tercihleri' : 'Notification Preferences'}
          </h3>
          <NotificationPreferences language={language} user={user} />
        </div>
      )}

      {/* ═══ DATA & ACCOUNT ═══ */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Download className="w-4 h-4 text-blue-600" /></div>
              {tr ? 'Veri Dışa Aktarma' : 'Data Export'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{tr ? 'Tüm emisyon verilerinizi JSON formatında indirin.' : 'Download all your emission data in JSON format.'}</p>
            <button onClick={handleExport} disabled={exporting} className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-secondary flex items-center gap-2 disabled:opacity-60 transition-colors">
              <Download className="w-4 h-4" /> {exporting ? '...' : (tr ? 'Tüm Verileri İndir' : 'Export All Data')}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-red-200 p-6">
            <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-600" /></div>
              {tr ? 'Tehlikeli Bölge' : 'Danger Zone'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">{tr ? 'Hesabınızı silmek geri alınamaz. Tüm verileriniz kalıcı olarak silinir.' : 'Deleting your account is irreversible. All your data will be permanently deleted.'}</p>
            <button onClick={handleDelete} disabled={deleting} className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-2 disabled:opacity-60 transition-colors">
              <Trash2 className="w-4 h-4" /> {tr ? 'Hesabı Kalıcı Olarak Sil' : 'Permanently Delete Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
