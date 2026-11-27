import { useState } from 'react';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { deletionErrorMessage } from '../lib/accountDeletion';
export function AccountDeletionPanel({ email, providers, onRequest }: { email: string; providers: string[]; onRequest: (provider: string, password: string) => Promise<void> }) {
  const available = [...new Set(providers)].filter(provider => provider === 'google.com' || provider === 'password');
  const [provider, setProvider] = useState<string>(available.includes('google.com') ? 'google.com' : available[0] || '');
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [understood, setUnderstood] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useUnsavedChanges(false, busy);
  const enabled = confirmation === 'DELETE' && understood && !!provider && (provider !== 'password' || !!password) && !busy;
  return <section className="rounded-xl border border-red-200 bg-[var(--bg-surface)] p-6 space-y-5" aria-labelledby="delete-account-heading">
    <h2 id="delete-account-heading" className="text-xl font-semibold">Permanently delete my account</h2><p className="text-sm">Signed in as <strong>{email}</strong>.</p>
    <ul className="list-disc pl-5 text-sm leading-7 space-y-1 text-[var(--text-secondary)]"><li>Your login account, profile, activities, appointments, tasks, personal events and other personal workspace records will be removed.</li><li>Submitted church reports will remain as organizational records. Your structured account attribution will be removed or replaced with “Deleted user”. Report answers, notes and statistics remain.</li><li>This affects the same account in both the web and Flutter applications. Download any personal records you want to keep before continuing.</li><li>Browser caches, exported files and device-local Flutter files are not remotely erased. Clear site/app data on shared devices.</li><li>Deletion runs in the background and cannot be undone once processing starts.</li></ul>
    <form className="space-y-5" onSubmit={async event => { event.preventDefault(); if (!enabled) return; setBusy(true); setError(''); try { await onRequest(provider, password); setPassword(''); } catch (err) { setError(deletionErrorMessage(err)); setPassword(''); } finally { setBusy(false); } }}>
      <fieldset disabled={busy} className="space-y-4"><legend className="text-sm font-medium mb-3">Confirm your identity</legend>
        {available.length > 1 && <label className="block text-sm">Sign-in method<select className="block border border-[var(--border-hairline)] rounded-lg p-2 mt-2 bg-[var(--bg-surface)]" value={provider} onChange={event => { setProvider(event.target.value); setPassword(''); }}>{available.map(value => <option value={value} key={value}>{value === 'google.com' ? 'Google' : 'Email and password'}</option>)}</select></label>}
        {provider === 'google.com' && <p className="text-sm text-[var(--text-secondary)]">Google will ask you to sign in again before the deletion request is sent.</p>}
        {provider === 'password' && <label className="block text-sm">Current password<input className="block w-full border border-[var(--border-hairline)] rounded-lg p-3 mt-2 bg-[var(--bg-surface)]" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>}
        {!available.length && <p className="text-sm text-red-700">Your sign-in method needs administrator assistance. Contact your mission administrator to request deletion.</p>}
        <label className="flex gap-3 items-start text-sm leading-6"><input className="mt-1" type="checkbox" checked={understood} onChange={event => setUnderstood(event.target.checked)} required /><span>I understand that my account and personal workspace data will be deleted, and church reports will be retained with my account attribution removed.</span></label>
        <label className="block text-sm">Type DELETE to confirm<input className="block w-full border border-[var(--border-hairline)] rounded-lg p-3 mt-2 bg-[var(--bg-surface)]" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="DELETE" required /></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700 leading-6">{error}</p>}
      <button disabled={!enabled} type="submit" className="rounded-lg px-4 py-3 bg-red-700 text-white text-sm font-medium disabled:opacity-50">{busy ? 'Verifying and requesting deletion…' : 'Verify identity and request deletion'}</button>
      <p className="text-xs text-[var(--text-secondary)]">Select the confirmation checkbox and type DELETE to enable the button. Your account is not deleted by simply opening this page.</p>
    </form>
  </section>;
}
