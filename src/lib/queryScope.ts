import { collection, query, where, type Firestore } from 'firebase/firestore';
import type { UserProfile } from '../types';

export function isGlobalAdmin(profile: UserProfile): boolean {
  return profile.userRole === 'super_admin' || profile.userRole === 'admin' || profile.userRole === 'union_maum';
}

/** Filter on the server: Firestore rules do not filter collection-wide reads. */
export function missionQuery(db: Firestore, path: string, profile: UserProfile) {
  const ref = collection(db, path);
  return isGlobalAdmin(profile)
    ? query(ref)
    : query(ref, where('missionId', '==', profile.missionId || '__unassigned__'));
}
