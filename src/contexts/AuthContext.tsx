import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testConnection,
} from '../lib/firebase';
import {
  getCapabilities,
  normalizeUserRole,
  ROLE_META,
  type RoleCapabilities,
  type UserApprovalStatus,
  type UserProfile,
  type UserRole,
} from '../types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  capabilities: RoleCapabilities;
  loading: boolean;
  authError: string | null;
  connectionOk: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateOwnProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState(true);

  useEffect(() => {
    testConnection().then(setConnectionOk);
  }, []);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setFirebaseUser(fbUser);
      setAuthError(null);

      if (!fbUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const userRef = doc(db, 'users', fbUser.uid);

      unsubProfile = onSnapshot(
        userRef,
        async (snap) => {
          if (!snap.exists()) {
            const isBootstrapAdmin =
              fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
              fbUser.emailVerified;
            const initialRole: UserRole = isBootstrapAdmin
              ? 'super_admin'
              : 'user';
            const newProfile = {
              uid: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || fbUser.email || 'Pastor User',
              photoURL: fbUser.photoURL || '',
              userRole: initialRole,
              role: initialRole,
              roleTitle: ROLE_META[initialRole].label,
              isAdmin: isBootstrapAdmin,
              level: ROLE_META[initialRole].level,
              isPremium: false,
              isActive: isBootstrapAdmin,
              approvalStatus: isBootstrapAdmin ? 'approved' : 'pending',
              onboardingCompleted: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            try {
              await setDoc(userRef, newProfile);
            } catch (err) {
              handleFirestoreError(
                err,
                OperationType.CREATE,
                `users/${fbUser.uid}`,
              );
            }
            return;
          }

          const raw = snap.data() as Record<string, unknown>;
          const resolvedRole = normalizeUserRole(raw);
          const rawApproval = String(raw.approvalStatus || '');
          const approvalStatus: UserApprovalStatus =
            rawApproval === 'pending' ||
            rawApproval === 'approved' ||
            rawApproval === 'rejected'
              ? rawApproval
              : raw.isActive === false
                ? 'rejected'
                : 'approved';

          setProfile({
            uid: String(raw.uid || fbUser.uid),
            email: String(raw.email || fbUser.email || ''),
            displayName: String(
              raw.displayName || fbUser.displayName || 'Pastor User',
            ),
            photoURL: raw.photoURL ? String(raw.photoURL) : fbUser.photoURL || '',
            phone: raw.phone ? String(raw.phone) : '',
            userRole: resolvedRole,
            role: raw.role ? String(raw.role) : resolvedRole,
            roleTitle: raw.roleTitle
              ? String(raw.roleTitle)
              : ROLE_META[resolvedRole].label,
            isAdmin: Boolean(raw.isAdmin),
            level:
              typeof raw.level === 'number'
                ? raw.level
                : ROLE_META[resolvedRole].level,
            unionId: raw.unionId ? String(raw.unionId) : '',
            unionName: raw.unionName ? String(raw.unionName) : '',
            missionId: raw.missionId ? String(raw.missionId) : '',
            missionName: raw.missionName ? String(raw.missionName) : '',
            regionId: raw.regionId ? String(raw.regionId) : '',
            regionName: raw.regionName ? String(raw.regionName) : '',
            districtId: raw.districtId ? String(raw.districtId) : '',
            districtName: raw.districtName ? String(raw.districtName) : '',
            churchId: raw.churchId ? String(raw.churchId) : '',
            churchName: raw.churchName ? String(raw.churchName) : '',
            isPremium: Boolean(raw.isPremium),
            isActive: raw.isActive !== false && approvalStatus === 'approved',
            approvalStatus,
            approvedBy: raw.approvedBy ? String(raw.approvedBy) : '',
            approvalNote: raw.approvalNote ? String(raw.approvalNote) : '',
            onboardingCompleted: Boolean(raw.onboardingCompleted),
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
          });
          setLoading(false);
        },
        (err) => {
          setLoading(false);
          handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
        },
      );
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubAuth();
    };
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Google Sign-In failed.';
      setAuthError(msg);
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
  };

  const updateOwnProfile = async (updates: Partial<UserProfile>) => {
    if (!firebaseUser) return;
    const allowedKeys = [
      'displayName',
      'photoURL',
      'phone',
      'unionId',
      'unionName',
      'missionId',
      'missionName',
      'regionId',
      'regionName',
      'districtId',
      'districtName',
      'churchId',
      'churchName',
      'onboardingCompleted',
    ] as const;

    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    for (const key of allowedKeys) {
      if (key in updates && updates[key] !== undefined) {
        payload[key] = updates[key];
      }
    }

    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), payload);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `users/${firebaseUser.uid}`,
      );
    }
  };

  const capabilities = getCapabilities(profile);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        capabilities,
        loading,
        authError,
        connectionOk,
        signInWithGoogle,
        signOut,
        updateOwnProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
