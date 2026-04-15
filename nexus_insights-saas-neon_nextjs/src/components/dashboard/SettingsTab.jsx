'use client';
import { useState } from 'react';
import { Settings, Leaf, Target, Users, Bell, Download, Trash2, User } from 'lucide-react';
import CompanySettings from '@/components/CompanySettings';
import FacilitySettings from '@/components/FacilitySettings';
import PasswordChange from '@/components/PasswordChange';
import TeamManagement from '@/components/TeamManagement';
import ProfileEdit from '@/components/ProfileEdit';
import NotificationPreferences from '@/components/NotificationPreferences';
import { api } from '@/lib/utils/api';

export default function SettingsTab({ language, user, fetchData }) {
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    if (!confirm(language === 'tr' ? 'Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.' : 'Are you sure you want to delete your account? This cannot be undone.')) return;
    setDeleting(true);
    await api.deleteAccount();
    window.location.href = '/login';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{language === 'tr' ? 'Ayarlar' : 'Settings'}</h1>
        <p className="text-gray-600 mt-1">{language === 'tr' ? 'Hesap, şirket ve sistem ayarları' : 'Account, company and system settings'}</p>
      </div>

      {/* Profile Edit */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
          {language === 'tr' ? 'Profil Bilgileri' : 'Profile Information'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">{language === 'tr' ? 'Kullanıcı Adı' : 'Username'}</p>
            <p className="text-sm font-medium text-gray-900">{user?.username || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">{language === 'tr' ? 'E-posta' : 'Email'}</p>
            <p className="text-sm font-medium text-gray-900">{user?.email || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">{language === 'tr' ? 'Rol' : 'Role'}</p>
            <p className="text-sm font-medium text-gray-900">{user?.role_display || user?.role || '-'}</p>
          </div>
        </div>
        <ProfileEdit language={language} user={user} onUpdate={fetchData} />
      </div>

      {/* Company */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center"><Leaf className="w-4 h-4 text-secondary" /></div>
          {language === 'tr' ? 'Şirket Bilgileri' : 'Company Information'}
        </h3>
        <CompanySettings language={language} />
      </div>

      {/* Facilities */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center"><Target className="w-4 h-4 text-accent" /></div>
          {language === 'tr' ? 'Tesis Yönetimi' : 'Facility Management'}
        </h3>
        <FacilitySettings language={language} />
      </div>

      {/* Team */}
      {user?.permissions?.can_manage_users && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-blue-600" /></div>
            {language === 'tr' ? 'Takım Yönetimi' : 'Team Management'}
          </h3>
          <TeamManagement language={language} />
        </div>
      )}

      {/* Notification Preferences */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center"><Bell className="w-4 h-4 text-amber-600" /></div>
          {language === 'tr' ? 'Bildirim Tercihleri' : 'Notification Preferences'}
        </h3>
        <NotificationPreferences language={language} user={user} />
      </div>

      {/* Password */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'Şifre Değiştir' : 'Change Password'}</h3>
        <PasswordChange language={language} />
      </div>

      {/* Permissions */}
      {user?.permissions && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'İzinler' : 'Permissions'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'can_edit_entries', tr: 'Veri Girişi', en: 'Edit Entries' },
              { key: 'can_manage_users', tr: 'Kullanıcı Yönetimi', en: 'Manage Users' },
              { key: 'can_approve_requests', tr: 'Talep Onayı', en: 'Approve Requests' },
              { key: 'can_generate_reports', tr: 'Rapor Oluşturma', en: 'Generate Reports' },
            ].map(p => (
              <div key={p.key} className={`p-3 rounded-lg text-center text-sm ${user.permissions[p.key] ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'}`}>
                {user.permissions[p.key] ? '✅' : '❌'} {language === 'tr' ? p.tr : p.en}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Export & Account */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{language === 'tr' ? 'Veri ve Hesap' : 'Data & Account'}</h3>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} disabled={exporting} className="px-4 py-2 border border-primary text-primary rounded-lg text-sm hover:bg-primary/10 flex items-center gap-2 disabled:opacity-60">
            <Download className="w-4 h-4" /> {exporting ? '...' : (language === 'tr' ? 'Tüm Verileri İndir' : 'Export All Data')}
          </button>
          <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 flex items-center gap-2 disabled:opacity-60">
            <Trash2 className="w-4 h-4" /> {language === 'tr' ? 'Hesabı Sil' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
