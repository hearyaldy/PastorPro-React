import { appPath } from '../lib/appPaths';
import { PRIVACY_UPDATED, privacyContact, privacySections } from '../lib/privacyPolicy';
import { LandingHomeLink } from '../components/LandingHomeLink';
export function PrivacyPolicyPage() {
  return <main className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] px-5 py-10"><article className="max-w-3xl mx-auto space-y-7">
    <nav className="flex flex-wrap items-center gap-5 text-sm text-[var(--accent-primary)]"><LandingHomeLink /><a href={appPath()}>WebApp</a><a href={appPath('account-deletion')}>Account deletion</a></nav>
    <header className="space-y-3"><p className="text-sm text-[var(--text-secondary)]">PastorPro · Privacy and account controls</p><h1 className="text-3xl font-semibold">Privacy policy</h1><p className="text-sm text-[var(--text-secondary)]">Last updated: {PRIVACY_UPDATED}</p>{privacyContact.operator && <p>Workspace operator: {privacyContact.operator}</p>}</header>
    {privacySections.map(section => <section key={section.title} className="space-y-3"><h2 className="text-lg font-semibold">{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="text-sm leading-7 text-[var(--text-secondary)]">{paragraph}</p>)}</section>)}
    {privacyContact.email && <p className="text-sm">Privacy contact: <a className="underline text-[var(--accent-primary)]" href={`mailto:${privacyContact.email}`}>{privacyContact.email}</a></p>}
  </article></main>;
}
