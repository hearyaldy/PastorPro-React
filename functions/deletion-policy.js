// Personal workspace records are erased. Church records retain their operational
// content, with this account's structured attribution replaced by a random ID.
export const PERSONAL_COLLECTIONS = ['activities', 'appointments', 'todos', 'events', 'ministry_team', 'notes', 'notifications', 'devices', 'locationRequests'];
export const SHARED_COLLECTIONS = ['borang_b_reports', 'financial_reports', 'fam_data', 'quarterly_department_reports', 'admin_activity', 'global_events', 'staff', 'churches', 'districts', 'regions', 'missions', 'unions', 'department_report_templates', 'users'];
const identityNames = { userId: ['userName', 'pastorName'], submittedBy: ['submittedByName'], editedBy: ['editorName', 'editedByName'], actorId: ['actorName'], approvedBy: ['approvedByName'], createdBy: ['createdByName'], districtPastorId: ['districtPastorName'], pastorId: ['pastorName'], treasurerId: ['treasurerName'], uid: ['displayName', 'fullName', 'name', 'email', 'phone', 'photoURL'] };
export function anonymizeAttribution(value, uid, replacement) {
  if (Array.isArray(value)) return value.map(child => anonymizeAttribution(child, uid, replacement));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, anonymizeAttribution(child, uid, replacement)]));
  for (const [key, names] of Object.entries(identityNames)) {
    if (value[key] !== uid) continue;
    // Empty assignment fields disconnect the former user from hierarchy roles.
    result[key] = ['districtPastorId', 'pastorId', 'treasurerId', 'approvedBy'].includes(key) ? '' : replacement;
    for (const name of names) if (name in result) result[name] = ['email', 'phone', 'photoURL'].includes(name) ? '' : 'Deleted user';
  }
  // Older React edit history uses userId/userName rather than editedBy/editorName.
  return result;
}
export function deletionRequestError(auth, confirmation, nowSeconds) {
  if (!auth?.uid) return 'unauthenticated';
  const authTime = Number(auth.token?.auth_time);
  if (!Number.isFinite(authTime) || authTime > nowSeconds + 60 || nowSeconds - authTime > 300) return 'recent-login-required';
  if (confirmation !== 'DELETE') return 'confirmation-required';
  return null;
}
