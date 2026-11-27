import React, { useState } from 'react';
import { LandingHomeLink } from './LandingHomeLink';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FileSpreadsheet,
  Lock,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LIGHT_THEME_PRESETS, useTheme } from '../contexts/ThemeContext';

export function AuthGate() {
  const { signInWithGoogle, signInWithEmail, authError, connectionOk } = useAuth();
  const { theme, lightTheme, toggleTheme, setLightTheme } = useTheme();
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // error is captured in authError
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setEmailSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch {
      // error is captured in authError
    } finally {
      setEmailSubmitting(false);
    }
  };

  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname : '';
  const isUnauthorizedDomain =
    Boolean(authError) && authError!.includes('unauthorized-domain');

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 md:px-10 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-header)]">
        <div className="text-lg font-display font-semibold tracking-tight whitespace-nowrap shrink-0">
          PastorPro
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LandingHomeLink />
          <div className="hidden sm:flex items-center gap-1.5 pr-1">
            {LIGHT_THEME_PRESETS.map((preset) => {
              const selected = theme === 'light' && lightTheme === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setLightTheme(preset.id)}
                  title={`${preset.label} theme`}
                  aria-label={`Select ${preset.label} theme`}
                  className={`w-5 h-5 rounded-md overflow-hidden grid grid-cols-2 transition-transform ${
                    selected
                      ? 'ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-header)] scale-105'
                      : 'border border-[var(--border-hairline)] opacity-80 hover:opacity-100'
                  }`}
                >
                  <span style={{ backgroundColor: preset.sidebar }} />
                  <span style={{ backgroundColor: preset.accent }} />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Toggle dark mode"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 md:px-10 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <section className="lg:col-span-7 space-y-6">
          <div className="text-xs font-medium text-[var(--text-muted)] tracking-wide">
            PastorPro · Multi-Mission Ministerial & Church Reporting Platform
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-semibold tracking-tight leading-tight text-[var(--text-primary)]">
            Unified pastoral ledgers, monthly Borang B, and mission governance.
          </h1>
          <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-2xl">
            Built for pastors, district leaders, church treasurers, and officers across Unions and Missions. Log field ministry, compile financial FAM breakdowns, and review quarterly departmental reports in one structured workspace.
          </p>

          {!connectionOk && (
            <div className="p-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-200">
              Offline cache mode active. Changes will synchronize automatically once Firestore reconnects.
            </div>
          )}

          {authError && (
            <div className="p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-200 space-y-1.5">
              <div>{authError}</div>
              {isUnauthorizedDomain && currentHost && (
                <div className="text-xs leading-relaxed">
                  Add <span className="font-mono-tabular font-semibold">{currentHost}</span> under Firebase Console → Authentication → Settings → Authorized domains, or sign in with your Email & Password account below.
                </div>
              )}
            </div>
          )}

          {/* Primary Google Sign-In + Email/Password Sign-In Card */}
          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-4 max-w-md">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <span>{signingIn ? 'Connecting Account...' : 'Continue with Google Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
              <div className="h-px flex-1 bg-[var(--border-hairline)]" />
              <span>Or sign in with email & password</span>
              <div className="h-px flex-1 bg-[var(--border-hairline)]" />
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <button
                type="submit"
                disabled={emailSubmitting}
                className="w-full px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] transition-colors disabled:opacity-60"
              >
                {emailSubmitting ? 'Signing in...' : 'Sign in with Email'}
              </button>
            </form>
          </div>
        </section>

        <section className="lg:col-span-5 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] divide-y divide-[var(--border-hairline)]">
          <div className="p-5 flex items-start gap-4">
            <BookOpen className="w-5 h-5 text-[var(--accent-primary)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Borang B & Activity Logging
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                Auto-saved monthly ministerial reporting with printable PDF summaries and mission-wide review for Ministerial Secretaries.
              </p>
            </div>
          </div>
          <div className="p-5 flex items-start gap-4">
            <FileSpreadsheet className="w-5 h-5 text-[var(--accent-primary)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Financial & Quarterly Department Ledgers
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                Treasurer tithe/offering sheets linked 1:1 with FAM breakdowns plus Kanak-Kanak, Penatalayanan, SSPM, and Wanita quarterly reports.
              </p>
            </div>
          </div>
          <div className="p-5 flex items-start gap-4">
            <CalendarDays className="w-5 h-5 text-[var(--accent-primary)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Mission Calendar & Appointments
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                Shared mission global events combined with local schedules, pastoral appointments, and personal to-do lists.
              </p>
            </div>
          </div>
          <div className="p-5 flex items-start gap-4">
            <ShieldCheck className="w-5 h-5 text-[var(--accent-primary)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                Scoped 10-Role Hierarchy Access
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                Enforced across Union, Mission, Region, District, and Church boundaries with login approval and administrative audit logging.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-wrap justify-center gap-6 p-5 text-xs text-[var(--text-secondary)]"><a className="underline" href="/privacy-policy">Privacy policy</a><a className="underline" href="/account-deletion">Account deletion</a></footer>
    </div>
  );
}
