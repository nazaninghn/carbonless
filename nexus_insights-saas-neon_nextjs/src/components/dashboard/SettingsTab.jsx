'use client';
import { Settings, Leaf, Target } from 'lucide-react';
import CompanySettings from '@/components/CompanySettings';
import FacilitySettings from '@/components/FacilitySettings';
import PasswordChange from '@/components/PasswordChange';

export default function SettingsTab({ language, user }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{language === 'tr' ? 'Ayarlar' : 'Settings'}</h1>
        <p className="text-gray-600 mt-1">{language === 'tr' ? 'Hesap, şirket ve sistem ayarları' : 'Account, company and system settings'}</p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center"><Settings className="w-4 h-4 text-primary" /></div>
          {language === 'tr' ? 'Hesap Bilgileri' : 'Account Information'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'Kullanıcı Adı' : 'Username'}</p>
            <p className="text-sm font-medium text-gray-900">{user?.username || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'E-posta' : 'Email'}</p>
            <p className="text-sm font-medium text-gray-900">{user?.email || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'Rol' : 'Role'}</p>
            <p className="text-sm font-medium text-gray-900">{user?.role_display || user?.role || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{language === 'tr' ? 'Ad Soyad' : 'Full Name'}</p>
            <p className="text-sm font-medium text-gray-900">{user?.first_name || '-'} {user?.last_name || ''}</p>
          </div>
        </div>
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
    </div>
  );
}
