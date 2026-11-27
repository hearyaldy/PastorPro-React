import { useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function AuthGate() {
  const { signInWithGoogle, authError, connectionOk } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [signingIn, setSigningIn] = useState(false);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      // error is captured in authError
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col">
      <header className="flex items-center justify-between gap-8 px-6 md:px-10 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="text-lg font-display font-semibold tracking-tight whitespace-nowrap shrink-0">
          Pastor Report
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {signingIn ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 md:px-10 py-14 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <section className="lg:col-span-7 space-y-6">
          <div className="text-xs font-medium text-[var(--text-muted)] tracking-wide">
            Sabah Adventist Mission · Ministerial & Church Reporting Platform
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-semibold tracking-tight leading-tight text-[var(--text-primary)]">
            Unified pastoral ledgers, monthly Borang B, and mission governance.
          </h1>
          <p className="text-base text-[var(--text-secondary)] leading-relaxed max-w-2xl">
            Designed for pastors, district leaders, church treasurers, and mission officers across Sabah. Log field ministry, compile financial FAM breakdowns, and review quarterly departmental reports in one structured workspace.
          </p>

          {!connectionOk && (
            <div className="p-4 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-900 dark:text-amber-200">
              Offline cache mode active. Changes will synchronize automatically once Firestore reconnects.
            </div>
          )}

          {authError && (
            <div className="p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-sm text-red-800 dark:text-red-200">
              {authError}
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <span>{signingIn ? 'Connecting Account...' : 'Continue with Google Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-xs text-[var(--text-muted)]">
              Version 3.2 · Offline-capable Firestore sync
            </span>
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
                Enforced across Mission, Region, District, and Church boundaries with full administrative audit logging.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
