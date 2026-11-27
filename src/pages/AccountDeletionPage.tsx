import { appPath } from '../lib/appPaths';
import { useState } from 'react';
import { LandingHomeLink } from '../components/LandingHomeLink';
import { useAuth } from '../contexts/AuthContext';
import { AuthGate } from '../components/AuthGate';
import { AccountDeletionPanel } from '../components/AccountDeletionPanel';
import { requestOwnAccountDeletion } from '../lib/accountDeletion';
import { privacyContact } from '../lib/privacyPolicy';
export function AccountDeletionPage() {
  const { firebaseUser, loading, signOut } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [requested, setRequested] = useState(() => { try { return sessionStorage.getItem('pastorpro_deletion_requested') === 'true'; } catch { return false; } });
  if (signingIn && !firebaseUser) return <AuthGate />;
  return <main className="min-h-screen px-5 py-10 bg-[var(--bg-canvas)] text-[var(--text-primary)]"><div className="max-w-2xl mx-auto space-y-7">
    <nav className="flex flex-wrap items-center gap-5 text-sm text-[var(--accent-primary)]"><LandingHomeLink /><a href={appPath()}>WebApp</a><a href={appPath('privacy-policy')}>Privacy policy</a></nav>
    <header className="space-y-3"><p className="text-sm text-[var(--text-secondary)]">PastorPro · Account controls</p><h1 className="text-3xl font-semibold">Account deletion</h1><p className="text-sm leading-7 text-[var(--text-secondary)]">Request deletion of your PastorPro account and personal workspace data. Submitted church reports are retained with your structured account attribution removed. For help, contact {privacyContact.email ? <a className="underline" href={`mailto:${privacyContact.email}`}>{privacyContact.email}</a> : 'your mission administrator'}.</p></header>
    {requested ? <section role="status" className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4"><h2 className="text-xl font-semibold">Your deletion request was accepted</h2><p className="text-sm leading-7">Server cleanup is processing in the background. This confirms your request was accepted; it does not mean every record has already been removed.</p><p className="text-sm leading-7">{firebaseUser ? 'Your workspace access is being closed.' : 'You have been signed out.'} Submitted church reports will be retained as described above. Clear this site’s browser data on shared devices; exported files and printed copies are not erased automatically.</p><p className="text-sm leading-7">If you need an update or help with information in a retained report, contact your mission administrator.</p><a href={appPath('privacy-policy')} className="inline-block text-sm underline text-[var(--accent-primary)]">Read the privacy policy</a><button className="block text-sm underline" onClick={() => { try { sessionStorage.removeItem('pastorpro_deletion_requested'); } catch {} setRequested(false); }}>Start a new request</button></section>
      : loading ? <p role="status">Checking your sign-in…</p>
      : firebaseUser ? <AccountDeletionPanel email={firebaseUser.email || 'your account'} providers={firebaseUser.providerData.map(provider => provider.providerId)} onRequest={async (provider, password) => {
        await requestOwnAccountDeletion(firebaseUser, provider, password);
        try { localStorage.removeItem(`pastor_report_onboarding_bypass_${firebaseUser.uid}`); sessionStorage.setItem('pastorpro_deletion_requested', 'true'); } catch {}
        setRequested(true); await signOut().catch(() => {});
      }} /> : <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4"><h2 className="text-xl font-semibold">Sign in to verify ownership</h2><p className="text-sm leading-7">Use the account you want to delete. You will review what is retained and confirm deletion before a request is sent.</p><button className="px-4 py-3 rounded-lg bg-[var(--accent-primary)] text-white text-sm" onClick={() => setSigningIn(true)}>Sign in to continue</button></section>}
  </div></main>;
}
