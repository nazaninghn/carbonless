'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/utils/api';
import { Users } from 'lucide-react';

const ROLES = [
  { value: 'owner', label: { tr: 'Sahip', en: 'Owner' } },
  { value: 'admin', label: { tr: 'Yönetici', en: 'Admin' } },
  { value: 'manager', label: { tr: 'Müdür', en: 'Manager' } },
  { value: 'data_entry', label: { tr: 'Veri Girişi', en: 'Data Entry' } },
  { value: 'auditor', label: { tr: 'Denetçi', en: 'Auditor' } },
];

export default function TeamManagement({ language }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('data_entry');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

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

  if (loading) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-gray-900">
          {language === 'tr' ? 'Takım Üyeleri' : 'Team Members'} ({members.length})
        </h3>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-gray-500">{language === 'tr' ? 'Henüz üye yok' : 'No members yet'}</p>
      ) : (
        <div className="space-y-3">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-semibold text-sm">
                  {(m.username || m.user_email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.username || m.user_name}</p>
                  <p className="text-xs text-gray-500">{m.user_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={m.role}
                  onChange={e => handleRoleChange(m.id, e.target.value)}
                  disabled={updating === m.id || m.role === 'owner'}
                  className="px-2 py-1 border border-gray-300 rounded text-xs disabled:opacity-50"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>
                      {language === 'tr' ? r.label.tr : r.label.en}
                    </option>
                  ))}
                </select>
                <span className={`px-2 py-0.5 rounded text-xs ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {m.is_active ? (language === 'tr' ? 'Aktif' : 'Active') : (language === 'tr' ? 'Pasif' : 'Inactive')}
                </span>
                {m.role !== 'owner' && (
                  <button
                    onClick={() => handleRoleChange(m.id, m.is_active ? { is_active: false } : { is_active: true })}
                    className={`px-2 py-0.5 rounded text-xs ${m.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                  >
                    {m.is_active ? (language === 'tr' ? 'Devre Dışı' : 'Deactivate') : (language === 'tr' ? 'Etkinleştir' : 'Activate')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Form */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-2">{language === 'tr' ? 'Yeni Üye Davet Et' : 'Invite New Member'}</h4>
        <div className="flex gap-2">
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder={language === 'tr' ? 'E-posta adresi' : 'Email address'}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="px-2 py-2 border border-gray-300 rounded text-xs">
            {ROLES.filter(r => r.value !== 'owner').map(r => (
              <option key={r.value} value={r.value}>{language === 'tr' ? r.label.tr : r.label.en}</option>
            ))}
          </select>
          <button onClick={async () => {
            if (!inviteEmail) return;
            setInviting(true); setInviteMsg('');
            const res = await api.inviteMember({ email: inviteEmail, role: inviteRole });
            if (res.ok) {
              const data = await res.json();
              setInviteMsg(language === 'tr' ? `Davet gönderildi: ${data.email}` : `Invite sent: ${data.email}`);
              setInviteEmail('');
            }
            setInviting(false);
          }} disabled={inviting} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-secondary disabled:opacity-60">
            {inviting ? '...' : (language === 'tr' ? 'Davet Et' : 'Invite')}
          </button>
        </div>
        {inviteMsg && <p className="text-xs text-green-600 mt-2">{inviteMsg}</p>}
      </div>
    </div>
  );
}
