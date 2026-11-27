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
import { readUserProfile } from '../lib/userProfiles';
import {
  getCapabilities,
  storedUserRole,
  ROLE_META,
  type RoleCapabilities,
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

      setProfile(null);
      setFirebaseUser(fbUser);
      setAuthError(null);

      if (!fbUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!fbUser.emailVerified) {
        setAuthError('Please verify your email address before signing in.');
        setLoading(false);
        return;
      }

      const isBootstrapEmail =
        fbUser.emailVerified && fbUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

      setLoading(true);
      const userRef = doc(db, 'users', fbUser.uid);

      unsubProfile = onSnapshot(
        userRef,
        async (snap) => {
          if (auth.currentUser?.uid !== fbUser.uid) return;
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
              userRole: storedUserRole(initialRole),
              role: initialRole,
              roleTitle: ROLE_META[initialRole].label,
              isAdmin: isBootstrapAdmin,
              level: ROLE_META[initialRole].level,
              isPremium: false,
              isActive: isBootstrapAdmin,
              isApproved: isBootstrapAdmin,
              approvalStatus: isBootstrapAdmin ? 'approved' : 'pending',
              onboardingCompleted: isBootstrapAdmin,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            try {
              await setDoc(userRef, newProfile);
            } catch (err) {
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
          const nextProfile = readUserProfile(fbUser.uid, raw);
          setProfile({
            ...nextProfile,
            email: nextProfile.email || fbUser.email || '',
            photoURL: String(raw.photoURL || fbUser.photoURL || ''),
            isActive: fbUser.emailVerified && nextProfile.isActive,
            onboardingCompleted:
              nextProfile.isAdmin || getLocalOnboardingBypass(fbUser.uid) || nextProfile.onboardingCompleted,
          });
          setLoading(false);
        },
        (err) => {
          if (auth.currentUser?.uid !== fbUser.uid) return;
          console.warn('Firestore user profile read failed:', err);
          setProfile(null);
          setAuthError(
            err instanceof Error ? err.message : 'Permission denied reading user profile from Firestore.',
          );
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

    if ('missionId' in payload) payload.mission = payload.missionId;
    if ('districtId' in payload) payload.district = payload.districtId;
    if ('regionId' in payload) payload.region = payload.regionId;

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
