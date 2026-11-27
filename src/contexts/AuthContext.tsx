import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateOwnProfile: (updates: Partial<UserProfile>) => Promise<void>;
  bypassOnboarding: () => Promise<void>;
}

function getLocalOnboardingBypass(uid: string): boolean {
  try {
    return localStorage.getItem(`pastor_report_onboarding_bypass_${uid}`) === 'true';
  } catch {
    return false;
  }
}

function setLocalOnboardingBypass(uid: string) {
  try {
    localStorage.setItem(`pastor_report_onboarding_bypass_${uid}`, 'true');
  } catch {
    // ignore storage errors
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function buildFallbackSuperAdminProfile(fbUser: FirebaseUser): UserProfile {
  return {
    uid: fbUser.uid,
    email: fbUser.email || BOOTSTRAPPED_ADMIN_EMAIL,
    displayName: fbUser.displayName || fbUser.email || 'Super Admin',
    photoURL: fbUser.photoURL || '',
    userRole: 'super_admin',
    role: 'super_admin',
    roleTitle: ROLE_META.super_admin.label,
    isAdmin: true,
    level: ROLE_META.super_admin.level,
    isPremium: true,
    isActive: true,
    approvalStatus: 'approved',
    onboardingCompleted: true,
  };
}

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

      const isBootstrapEmail =
        fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

      setLoading(true);
      const userRef = doc(db, 'users', fbUser.uid);

      unsubProfile = onSnapshot(
        userRef,
        async (snap) => {
          if (!snap.exists()) {
            const isBootstrapAdmin = isBootstrapEmail;
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
              onboardingCompleted: isBootstrapAdmin,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            try {
              await setDoc(userRef, newProfile);
            } catch (err) {
              if (isBootstrapAdmin) {
                console.warn('Firestore profile create blocked; activating Super Admin bypass session.', err);
                setProfile(buildFallbackSuperAdminProfile(fbUser));
                setLoading(false);
                return;
              }
              setAuthError(
                err instanceof Error
                  ? err.message
                  : 'Unable to create your user profile in Firestore. Check Firestore security rules.',
              );
              setLoading(false);
            }
            return;
          }

          const raw = snap.data() as Record<string, unknown>;
          const normalized = normalizeUserRole(raw);
          const resolvedRole: UserRole =
            isBootstrapEmail || normalized === 'super_admin'
              ? 'super_admin'
              : normalized;
          const isSuperAdminAccount = resolvedRole === 'super_admin' || isBootstrapEmail;

          const rawApproval = String(raw.approvalStatus || '');
          const approvalStatus: UserApprovalStatus = isSuperAdminAccount
            ? 'approved'
            : rawApproval === 'pending' ||
                rawApproval === 'approved' ||
                rawApproval === 'rejected'
              ? rawApproval
              : raw.isActive === false
                ? 'rejected'
                : 'approved';

          const isAdminAccount =
            isSuperAdminAccount ||
            resolvedRole === 'admin' ||
            Boolean(raw.isAdmin) ||
            Boolean(raw.isSuperAdmin);
          const localBypass = getLocalOnboardingBypass(fbUser.uid);

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
            isAdmin: isSuperAdminAccount || Boolean(raw.isAdmin),
            level: isSuperAdminAccount
              ? ROLE_META.super_admin.level
              : typeof raw.level === 'number'
                ? raw.level
                : ROLE_META[resolvedRole].level,
            unionId: raw.unionId ? String(raw.unionId) : '',
            unionName: raw.unionName ? String(raw.unionName) : '',
            missionId: raw.missionId
              ? String(raw.missionId)
              : raw.mission
                ? String(raw.mission)
                : '',
            missionName: raw.missionName ? String(raw.missionName) : '',
            regionId: raw.regionId ? String(raw.regionId) : '',
            regionName: raw.regionName ? String(raw.regionName) : '',
            districtId: raw.districtId
              ? String(raw.districtId)
              : raw.district
                ? String(raw.district)
                : '',
            districtName: raw.districtName ? String(raw.districtName) : '',
            churchId: raw.churchId ? String(raw.churchId) : '',
            churchName: raw.churchName ? String(raw.churchName) : '',
            isPremium: isSuperAdminAccount || Boolean(raw.isPremium),
            isActive: isSuperAdminAccount || (raw.isActive !== false && approvalStatus === 'approved'),
            approvalStatus,
            approvedBy: raw.approvedBy ? String(raw.approvedBy) : '',
            approvalNote: raw.approvalNote ? String(raw.approvalNote) : '',
            onboardingCompleted:
              isAdminAccount || localBypass || Boolean(raw.onboardingCompleted),
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
          });
          setLoading(false);
        },
        (err) => {
          console.warn('Firestore user profile read failed:', err);
          if (isBootstrapEmail) {
            setProfile(buildFallbackSuperAdminProfile(fbUser));
            setAuthError(
              'Signed in with Super Admin bypass. Deploy firestore.rules to your Firebase project so profile and database writes persist.',
            );
          } else {
            setAuthError(
              err instanceof Error
                ? err.message
                : 'Permission denied reading user profile from Firestore.',
            );
          }
          setLoading(false);
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

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Email Sign-In failed.';
      setAuthError(msg);
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    setAuthError(null);
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

  const bypassOnboarding = async () => {
    if (!firebaseUser) return;
    setLocalOnboardingBypass(firebaseUser.uid);
    setProfile((prev) =>
      prev ? { ...prev, onboardingCompleted: true } : prev,
    );
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        onboardingCompleted: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn(
        'Could not persist onboarding bypass to Firestore; continuing with local session bypass.',
        err,
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
        signInWithEmail,
        signOut,
        updateOwnProfile,
        bypassOnboarding,
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
