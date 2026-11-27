import { getApp } from 'firebase/app';
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, type User } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';
export async function requestOwnAccountDeletion(user: User, provider: string, password: string) {
  const uid = user.uid;
  if (auth.currentUser?.uid !== uid) throw new Error('Your session changed. Sign in again before continuing.');
  if (provider === 'google.com') await reauthenticateWithPopup(user, new GoogleAuthProvider());
  else if (provider === 'password' && user.email) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  else throw new Error('This sign-in method needs administrator assistance for account deletion.');
  if (auth.currentUser?.uid !== uid) throw new Error('Your session changed. No deletion request was sent.');
  await user.getIdToken(true);
  const functions = getFunctions(getApp(), import.meta.env.VITE_ACCOUNT_FUNCTIONS_REGION || 'asia-southeast1');
  const request = httpsCallable<{ confirmation: string }, { status: string }>(functions, 'requestAccountDeletion', { timeout: 60_000 });
  const response = await request({ confirmation: 'DELETE' });
  if (response.data.status !== 'queued') throw new Error('Deletion was not confirmed by the service. Try again or contact your mission administrator.');

}
export function deletionErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'The sign-in check was cancelled. No deletion request was sent.';
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'The password could not be verified. No deletion request was sent.';
  if (code.includes('not-found') || code.includes('unimplemented')) return 'The account-deletion service is not available yet. Your account has not been deleted. Please contact your mission administrator.';
  if (code.includes('unavailable') || code.includes('deadline-exceeded') || code.includes('internal')) return 'The service could not confirm your request. Check your connection and sign in again to check your account before retrying. A submitted request may still be processing.';
  return error instanceof Error ? error.message : 'Unable to confirm your deletion request. Please try again or contact your mission administrator.';
}
