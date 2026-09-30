'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/utils/api';
import { useToast } from '@/components/ToastProvider';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Users, UserPlus, Shield, Crown, Pencil, Database, Eye, Info, Mail, X } from 'lucide-react';

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
  { value: 'auditor', icon: Eye, color: 'bg-[#F8F8F8] text-[#072C0E] border-[#072C0E]/10',
    label: { tr: 'Denetçi', en: 'Auditor' },
    desc: { tr: 'Sadece görüntüleme — veri değiştiremez', en: 'View only — cannot modify data' } },
];

const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[3];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Invite errors the server names by code.
const INVITE_ERRORS = {
  invalid_email: { tr: 'Geçerli bir e-posta adresi girin (örn. ad@sirket.com).', en: 'Enter a valid email address (e.g. name@company.com).' },
  already_member: { tr: 'Bu kişi zaten takımın üyesi.', en: 'This person is already a member of the team.' },
  inactive_member: { tr: 'Bu kişi takımda ama devre dışı. Aşağıdaki listeden "Etkinleştir" ile erişimini açabilirsiniz.', en: 'This person is in the team but deactivated. Use "Activate" in the list to restore access.' },
};

export default function TeamManagement({ language }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('data_entry');
  const [inviting, setInviting] = useState(false);
  const [showRoles, setShowRoles] = useState(false);

  const tr    = language === 'tr';
  const toast = useToast();

  const fetchMembers = useCallback(async () => {
    try {
      const res = await api.getMemberships();
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.results || []);
      }
    } catch {
      toast.error(tr ? 'Üyeler yüklenemedi' : 'Failed to load members');
    } finally { setLoading(false); }
  }, [tr, toast]);

  // Invites sent but not accepted yet — shown so they can be followed up,
  // re-sent (which renews them) or withdrawn.
  const [invites, setInvites] = useState([]);
  const fetchInvites = useCallback(async () => {
    try {
      const res = await api.getInvites();
      if (res.ok) setInvites(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchMembers(); fetchInvites(); }, [fetchMembers, fetchInvites]);

  const [confirmCancel, setConfirmCancel] = useState(null);
  const handleCancelInvite = useCallback(async (inv) => {
    try {
      const res = await api.cancelInvite(inv.id);
      if (res.ok || res.status === 204) {
        toast.success(tr ? `Davet iptal edildi: ${inv.email}` : `Invite cancelled: ${inv.email}`);
      } else {
        toast.error(tr ? 'Davet iptal edilemedi' : 'Could not cancel the invite');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    }
    fetchInvites();
  }, [tr, toast, fetchInvites]);

  const handleRoleChange = useCallback(async (id, newRole) => {
    setUpdating(id);
    try {
      const res = await api.updateMembership(id, { role: newRole });
      if (res.ok) {
        fetchMembers();
        toast.success(tr ? 'Rol güncellendi' : 'Role updated');
      } else {
        toast.error(tr ? 'Rol güncellenemedi' : 'Failed to update role');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally { setUpdating(null); }
  }, [tr, toast, fetchMembers]);

  const handleInvite = useCallback(async () => {
    if (!inviteEmail) return;
    if (!EMAIL_RE.test(inviteEmail.trim())) {
      toast.error(tr ? INVITE_ERRORS.invalid_email.tr : INVITE_ERRORS.invalid_email.en);
      return;
    }
    // Fix 25E: prevent double-invoke — button has disabled={inviting} but guard the fn too
    if (inviting) return;
    setInviting(true);
    try {
      const res = await api.inviteMember({ email: inviteEmail.trim(), role: inviteRole });
      if (res.ok) {
        const data = await res.json();
        if (data.email_sent === false) {
          // Mail could not be sent — give the inviter the join link to share.
          const link = `${window.location.origin}/accept-invite?token=${data.token}`;
          try { await navigator.clipboard.writeText(link); } catch {}
          toast.error(tr
            ? `Davet e-postası gönderilemedi. Katılım bağlantısı panoya kopyalandı, ${data.email} ile paylaşın: ${link}`
            : `The invite email could not be sent. The join link was copied — share it with ${data.email}: ${link}`);
        } else {
          toast.success(tr ? `Davet e-postası gönderildi: ${data.email}` : `Invite email sent to ${data.email}`);
        }
        setInviteEmail('');
        fetchInvites();
      } else {
        let msg = tr ? 'Davet gönderilemedi' : 'Could not send the invite';
        try {
          const err = await res.json();
          const known = INVITE_ERRORS[err.code];
          msg = known ? (tr ? known.tr : known.en) : (err.error || msg);
        } catch {}
        toast.error(msg);
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, inviteRole, inviting, tr, toast, fetchInvites]);

  // Deactivating cuts the member off at once, so it is confirmed first;
  // re-activating is harmless and happens on click.
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);

  const handleToggleActive = useCallback(async (m) => {
    setUpdating(m.id);
    try {
      const res = await api.updateMembership(m.id, { is_active: !m.is_active });
      if (res.ok) {
        fetchMembers();
        toast.success(m.is_active
          ? (tr ? 'Üye devre dışı bırakıldı' : 'Member deactivated')
          : (tr ? 'Üye etkinleştirildi' : 'Member activated'));
      } else {
        toast.error(tr ? 'Güncelleme başarısız' : 'Update failed');
      }
    } catch {
      toast.error(tr ? 'Bağlantı hatası' : 'Connection error');
    } finally { setUpdating(null); }
  }, [tr, toast, fetchMembers]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#2ABD41]" />
          <h3 className="font-semibold text-[#072C0E]">
            {tr ? 'Takım Yönetimi' : 'Team Management'}
          </h3>
          <span className="px-2 py-0.5 bg-[#072C0E]/10 text-[#2ABD41] text-xs rounded-full font-medium">
            {/* Active members; a deactivated one has no access. */}
            {(() => {
              const active = members.filter(m => m.is_active).length;
              const inactive = members.length - active;
              return tr
                ? `${active} aktif üye${inactive ? ` · ${inactive} devre dışı` : ''}`
                : `${active} active member${active === 1 ? '' : 's'}${inactive ? ` · ${inactive} deactivated` : ''}`;
            })()}
          </span>
        </div>
        <button
          onClick={() => setShowRoles(!showRoles)}
          className="flex items-center gap-1 text-xs text-[#072C0E]/55 hover:text-[#2ABD41] transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          {tr ? 'Roller Hakkında' : 'About Roles'}
        </button>
      </div>

      {/* Role descriptions panel */}
      {showRoles && (
        <div className="bg-[#F8F8F8] rounded-2xl p-4 border border-[#072C0E]/10">
          <h4 className="text-sm font-semibold text-[#072C0E] mb-3">{tr ? 'Rol Açıklamaları' : 'Role Descriptions'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map(r => {
              const Icon = r.icon;
              return (
                <div key={r.value} className={`flex items-start gap-2 p-2 rounded-xl border ${r.color}`}>
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
          <div className="w-6 h-6 border-2 border-[#2ABD41] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 text-[#072C0E]/55/40 mx-auto mb-2" />
          <p className="text-sm text-[#072C0E]/55">{tr ? 'Henüz üye yok' : 'No members yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => {
            const roleInfo = getRoleInfo(m.role);
            const RoleIcon = roleInfo.icon;
            return (
              <div key={m.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                !m.is_active ? 'bg-[#F8F8F8] border-[#072C0E]/10 opacity-60' : 'bg-white border-[#072C0E]/10 hover:border-[#2ABD41]/30 hover:shadow-sm'
              }`}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${roleInfo.color}`}>
                    {(m.full_name || m.user_email || m.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#072C0E]">
                        {m.full_name || (m.username !== m.user_email && m.username) || m.user_email || '—'}
                      </p>
                      {m.role === 'owner' && <Crown className="w-3.5 h-3.5 text-amber-500" />}
                      {!m.is_active && (
                        <span className="rounded-full bg-[#072C0E]/10 px-2 py-0.5 text-[10px] font-semibold text-[#072C0E]/70">
                          {tr ? 'Devre dışı' : 'Deactivated'}
                        </span>
                      )}
                    </div>
                    {(m.full_name || (m.username && m.username !== m.user_email)) && (
                      <p className="text-xs text-[#072C0E]/55">{m.user_email || '—'}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Role badge / selector */}
                  {m.role === 'owner' ? (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium border ${roleInfo.color}`}>
                      <RoleIcon className="w-3 h-3" />
                      {tr ? roleInfo.label.tr : roleInfo.label.en}
                    </span>
                  ) : (
                    <select
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value)}
                      disabled={updating === m.id}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium border cursor-pointer disabled:opacity-50 ${roleInfo.color}`}
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
                      onClick={() => (m.is_active ? setConfirmDeactivate(m) : handleToggleActive(m))}
                      disabled={updating === m.id}
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50 ${
                        m.is_active
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-green-200 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {m.is_active ? (tr ? 'Devre Dışı Bırak' : 'Deactivate') : (tr ? 'Etkinleştir' : 'Activate')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Form */}
      <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl p-4 border border-[#2ABD41]/20">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-[#2ABD41]" />
          <h4 className="text-sm font-semibold text-[#072C0E]">{tr ? 'Yeni Üye Davet Et' : 'Invite New Member'}</h4>
        </div>
        <p className="text-xs text-[#072C0E]/55 mb-3">
          {tr ? 'E-posta adresi girin ve rol seçin. Davet edilen kişi kayıt olduktan sonra otomatik olarak takıma eklenir.' : 'Enter email and select a role. The invited person will be automatically added to the team after registration.'}
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder={tr ? 'ornek@sirket.com' : 'example@company.com'}
            className="flex-1 min-w-[200px] px-3 py-2 bg-white border border-[#072C0E]/10 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="px-3 py-2 bg-white border border-[#072C0E]/10 rounded-xl text-sm"
          >
            {ROLES.filter(r => r.value !== 'owner').map(r => (
              <option key={r.value} value={r.value}>{tr ? r.label.tr : r.label.en}</option>
            ))}
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="px-5 py-2 bg-[#175022] text-white rounded-xl text-sm font-medium hover:bg-[#175022] transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" />
            {inviting ? '...' : (tr ? 'Davet Et' : 'Invite')}
          </button>
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="rounded-2xl border border-[#072C0E]/10 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#2ABD41]" />
            <h4 className="text-sm font-semibold text-[#072C0E]">
              {tr ? `Bekleyen Davetler (${invites.length})` : `Pending Invites (${invites.length})`}
            </h4>
          </div>
          <p className="mb-3 text-xs text-[#072C0E]/55">
            {tr
              ? 'Davet bağlantısı 7 gün geçerlidir. Süresi dolan bir daveti yenilemek için aynı adresi yukarıdan tekrar davet edin.'
              : 'An invite link is valid for 7 days. To renew an expired invite, invite the same address again above.'}
          </p>
          <div className="space-y-2">
            {invites.map(inv => {
              const role = getRoleInfo(inv.role);
              const until = inv.expires_at ? new Date(inv.expires_at).toLocaleDateString(tr ? 'tr-TR' : 'en-GB') : null;
              return (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F8F8F8] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#072C0E]">{inv.email}</p>
                    <p className="text-[11px] text-[#072C0E]/50">
                      {tr ? role.label.tr : role.label.en}
                      {' · '}
                      {inv.expired
                        ? <span className="font-semibold text-red-500">{tr ? 'Süresi doldu' : 'Expired'}</span>
                        : (until && (tr ? `${until} tarihine kadar geçerli` : `Valid until ${until}`))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(inv)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#072C0E]/10 px-3 py-1 text-xs font-semibold text-[#072C0E]/60 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-3 w-3" /> {tr ? 'Daveti iptal et' : 'Cancel invite'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel !== null}
        type="danger"
        language={tr ? 'tr' : 'en'}
        title={tr ? 'Davet iptal edilsin mi?' : 'Cancel this invite?'}
        message={confirmCancel && (tr
          ? `${confirmCancel.email} adresine gönderilen davet bağlantısı artık çalışmayacak.`
          : `The invite link sent to ${confirmCancel.email} will stop working.`)}
        confirmText={tr ? 'Daveti iptal et' : 'Cancel invite'}
        cancelText={tr ? 'Vazgeç' : 'Keep'}
        onConfirm={() => { const inv = confirmCancel; setConfirmCancel(null); if (inv) handleCancelInvite(inv); }}
        onCancel={() => setConfirmCancel(null)}
      />

      <ConfirmDialog
        open={confirmDeactivate !== null}
        type="danger"
        language={tr ? 'tr' : 'en'}
        title={tr ? 'Üye devre dışı bırakılsın mı?' : 'Deactivate this member?'}
        message={confirmDeactivate && (tr
          ? `${confirmDeactivate.full_name || confirmDeactivate.user_email} şirkete erişimini hemen kaybeder: verileri göremez ve giremez. Girdiği kayıtlar silinmez; istediğiniz zaman "Etkinleştir" ile erişimini geri açabilirsiniz.`
          : `${confirmDeactivate.full_name || confirmDeactivate.user_email} immediately loses access to the company: they can no longer see or enter data. Their entries are kept, and you can restore access at any time with "Activate".`)}
        confirmText={tr ? 'Devre dışı bırak' : 'Deactivate'}
        cancelText={tr ? 'İptal' : 'Cancel'}
        onConfirm={() => { const m = confirmDeactivate; setConfirmDeactivate(null); if (m) handleToggleActive(m); }}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}
