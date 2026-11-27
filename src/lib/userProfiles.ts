import { normalizeUserRole, ROLE_META, storedUserRole, type UserProfile } from '../types';

export function readUserProfile(uid: string, raw: Record<string, unknown>): UserProfile {
  const userRole = normalizeUserRole(raw);
  const approvalStatus = raw.approvalStatus === 'pending' || raw.approvalStatus === 'rejected' || raw.approvalStatus === 'approved'
    ? raw.approvalStatus : raw.isApproved === false ? 'pending' : 'approved';
  return {
    ...raw,
    uid,
    email: String(raw.email || ''),
    displayName: String(raw.displayName || raw.name || raw.email || uid),
    userRole,
    roleTitle: String(raw.roleTitle || ROLE_META[userRole].label),
    level: ROLE_META[userRole].level,
    isAdmin: userRole === 'super_admin' || userRole === 'admin',
    missionId: String(raw.missionId ?? raw.mission ?? ''),
    districtId: String(raw.districtId ?? raw.district ?? ''),
    regionId: String(raw.regionId ?? raw.region ?? ''),
    approvalStatus,
    isActive: raw.isActive !== false && raw.isApproved !== false && approvalStatus === 'approved',
    onboardingCompleted: raw.onboardingCompleted === true,
  };
}

/** Keep Flutter's assignment aliases and role names in sync with the React view. */
export function writeUserUpdates(updates: Partial<UserProfile>, current?: UserProfile): Record<string, unknown> {
  const data: Record<string, unknown> = { ...updates };
  for (const [key, legacy] of [['missionId', 'mission'], ['districtId', 'district'], ['regionId', 'region']]) {
    if (key in data) data[legacy] = data[key];
  }
  if (updates.userRole) {
    data.userRole = storedUserRole(updates.userRole);
    data.role = ROLE_META[updates.userRole].label;
    data.roleTitle = ROLE_META[updates.userRole].label;
    data.level = ROLE_META[updates.userRole].level;
    data.isAdmin = updates.userRole === 'super_admin' || updates.userRole === 'admin';
  }
  if ('approvalStatus' in updates || 'isActive' in updates) {
    data.isApproved = (updates.approvalStatus ?? current?.approvalStatus ?? 'approved') === 'approved'
      && (updates.isActive ?? current?.isActive ?? true);
  }
  return data;
}
