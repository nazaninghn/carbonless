'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';
import { Users, UserPlus, Shield, Crown, Pencil, Database, Eye, Info } from 'lucide-react';

const ROLES = [
  { value: 'owner', icon: Crown, color: 'bg-amber-100 text-amber-700 border-amber-300',
    label: { tr: 'Sahip', en: 'Owner' },
    desc: { tr: 'Tam yetki — şirket ayarları, üye yönetimi, veri silme', en: 'Full access — company settings, member management, data deletion' } },
  { value: 'admin', icon: Shield, color: 'bg-purple-100 text-purple-700 border-purple-300',
    label: { tr: 'Yönetici', en: 'Admin' },
    desc: { tr: 'Üye yönetimi, onay/red, rapor oluşturma', en: 'Member management, approve/reject, report generation' } },
  { value: 'manager', icon: Pencil, color: 'bg-blue-100 text-blue-700 border-blue-300',
    label: { tr: 'Müdür', en: 'Manager' },
    desc: { tr: 'Veri girişi, onay/red, rapor görüntüleme', en: 'Data entry, approve/reject, view reports' } },
  { value: 'data_entry', icon: Database, color: 'bg-green-100 text-green-700 border-green-300',
    label: { tr: 'Veri Girişi', en: 'Data Entry' },
    desc: { tr: 'Sadece emisyon verisi girişi', en: 'Emission data entry only' } },
  { value: 'auditor', icon: Eye, color: 'bg-gray-100 text-gray-700 border-gray-300',
    label: { tr: 'Denetçi', en: 'Auditor' },
    desc: { tr: 'Sadece görüntüleme — veri değiştiremez', en: 'View only — cannot modify data' } },
];

const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[3];

export default function TeamManagement({ language }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('data_entry');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [showRoles, setShowRoles] = useState(false);

  const tr = language === 'tr';

  const fetchMembers = async () => {
    try {
      const res = await api.getMemberships();
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.results || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleRoleChange = async (id, newRole) => {
    setUpdating(id);
    try {
      const res = await api.updateMembership(id, { role: newRole });
      if (res.ok) fetchMembers();
    } catch (e) { console.error(e); }
    finally { setUpdating(null); }
  };

  const handleToggleActive = async (m) => {
    setUpdating(m.id);
    try {
      const res = await api.updateMembership(m.id, { is_active: !m.is_active });
      if (res.ok) fetchMembers();
    } catch (e) { console.error(e); }
    finally { setUpdating(null); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-gray-900">
            {tr ? 'Takım Yönetimi' : 'Team Management'}
          </h3>
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-medium">
            {members.length} {tr ? 'üye' : 'members'}
          </span>
        </div>
        <button
          onClick={() => setShowRoles(!showRoles)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          {tr ? 'Roller Hakkında' : 'About Roles'}
        </button>
      </div>

      {/* Role descriptions panel */}
      {showRoles && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">{tr ? 'Rol Açıklamaları' : 'Role Descriptions'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(r => {
              const Icon = r.icon;
              return (
                <div key={r.value} className={`flex items-start gap-2 p-2 rounded-lg border ${r.color}`}>
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">{tr ? r.label.tr : r.label.en}</p>
                    <p className="text-xs opacity-80">{tr ? r.desc.tr : r.desc.en}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Members list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{tr ? 'Henüz üye yok' : 'No members yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => {
            const roleInfo = getRoleInfo(m.role);
            const RoleIcon = roleInfo.icon;
            return (
              <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                !m.is_active ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-primary/30 hover:shadow-sm'
              }`}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${roleInfo.color}`}>
                    {(m.username || m.user_email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{m.username || '—'}</p>
                      {m.role === 'owner' && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                    </div>
                    <p className="text-xs text-gray-500">{m.user_email || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role badge / selector */}
                  {m.role === 'owner' ? (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${roleInfo.color}`}>
                      <RoleIcon className="w-3 h-3" />
                      {tr ? roleInfo.label.tr : roleInfo.label.en}
                    </span>
                  ) : (
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value)}
                      disabled={updating === m.id}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer disabled:opacity-50 ${roleInfo.color}`}
                    >
                      {ROLES.filter(r => r.value !== 'owner').map(r => (
                        <option key={r.value} value={r.value}>
                          {tr ? r.label.tr : r.label.en}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Active/Inactive toggle */}
                  {m.role !== 'owner' && (
                    <button
                      onClick={() => handleToggleActive(m)}
                      disabled={updating === m.id}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                        m.is_active
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-green-200 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {m.is_active ? (tr ? 'Devre Dışı' : 'Deactivate') : (tr ? 'Etkinleştir' : 'Activate')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Form */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl p-4 border border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-gray-900">{tr ? 'Yeni Üye Davet Et' : 'Invite New Member'}</h4>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          {tr ? 'E-posta adresi girin ve rol seçin. Davet edilen kişi kayıt olduktan sonra otomatik olarak takıma eklenir.' : 'Enter email and select a role. The invited person will be automatically added to the team after registration.'}
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); setInviteMsg(''); }}
            placeholder={tr ? 'ornek@sirket.com' : 'example@company.com'}
            className="flex-1 min-w-[200px] px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
          >
            {ROLES.filter(r => r.value !== 'owner').map(r => (
              <option key={r.value} value={r.value}>{tr ? r.label.tr : r.label.en}</option>
            ))}
          </select>
          <button
            onClick={async () => {
              if (!inviteEmail) return;
              setInviting(true); setInviteMsg('');
              try {
                const res = await api.inviteMember({ email: inviteEmail, role: inviteRole });
                if (res.ok) {
                  const data = await res.json();
                  setInviteMsg(tr ? `✅ Davet gönderildi: ${data.email}` : `✅ Invite sent: ${data.email}`);
                  setInviteEmail('');
                } else {
                  const err = await res.json();
                  setInviteMsg(`❌ ${err.error || 'Error'}`);
                }
              } catch { setInviteMsg('❌ Connection error'); }
              setInviting(false);
            }}
            disabled={inviting || !inviteEmail}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" />
            {inviting ? '...' : (tr ? 'Davet Et' : 'Invite')}
          </button>
        </div>
        {inviteMsg && (
          <p className={`text-xs mt-2 ${inviteMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{inviteMsg}</p>
        )}
      </div>
    </div>
  );
}
