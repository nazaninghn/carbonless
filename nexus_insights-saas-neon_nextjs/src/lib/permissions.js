// What the signed-in user may do in their current company. The backend is the
// real gate (NotAuditorForWrites, HasCompanyAdminRole, APPROVER_ROLES); these
// flags only hide buttons that would fail, using the `permissions` object that
// /accounts/profile/ derives from the user's CompanyMembership role.
// While the profile is still loading everything is allowed, so nothing flickers
// away for the (common) owner case.
export function getPermissions(user) {
  const p = user?.permissions;
  return {
    canEdit: p ? p.can_edit_entries !== false : true,
    canApprove: p ? p.can_approve_requests !== false : true,
    canManageTeam: p ? p.can_manage_users !== false : true,
  };
}

// Same labels the Team tab uses for each role.
export const ROLE_LABELS = {
  owner: { tr: 'Sahip', en: 'Owner' },
  admin: { tr: 'Yönetici', en: 'Admin' },
  manager: { tr: 'Müdür', en: 'Manager' },
  data_entry: { tr: 'Veri Girişi', en: 'Data Entry' },
  auditor: { tr: 'Denetçi', en: 'Auditor' },
};

export function roleLabel(role, tr) {
  const l = ROLE_LABELS[role];
  return l ? (tr ? l.tr : l.en) : role;
}

export function noPermissionMessage(tr) {
  return tr
    ? 'Bu işlem için yetkiniz yok. Rolünüzü şirket sahibine veya yöneticisine sorun.'
    : "You don't have permission for this. Ask your company owner or admin about your role.";
}
