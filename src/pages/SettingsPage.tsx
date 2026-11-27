import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Check, Info, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LIGHT_THEME_PRESETS, useTheme } from '../contexts/ThemeContext';
import { db, handleFirestoreError, OperationType, reportListenerError } from '../lib/firebase';
import { useToast } from '../components/Toast';

type FontScale = 'compact' | 'standard' | 'comfortable';

const FONT_SCALE_KEY = 'pastor_report_font_scale';

function applyFontScale(scale: FontScale) {
  const root = document.documentElement;
  if (scale === 'compact') {
    root.style.fontSize = '14.5px';
  } else if (scale === 'comfortable') {
    root.style.fontSize = '17px';
  } else {
    root.style.fontSize = '16px';
  }
}

export function SettingsPage({
  sidebarCompact = false,
  onSetSidebarCompact,
}: {
  sidebarCompact?: boolean;
  onSetSidebarCompact?: (compact: boolean) => void;
}) {
  const { profile, capabilities, connectionOk, signOut } = useAuth();
  const { theme, lightTheme, setTheme, setLightTheme } = useTheme();
  const { notify } = useToast();

  const [fontScale, setFontScale] = useState<FontScale>(() => {
    try {
      const saved = localStorage.getItem(FONT_SCALE_KEY);
      if (saved === 'compact' || saved === 'standard' || saved === 'comfortable') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'standard';
  });

  const [domainsInput, setDomainsInput] = useState('sabahadventist.org, gmail.com');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingDomains, setSavingDomains] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    applyFontScale(fontScale);
    try {
      localStorage.setItem(FONT_SCALE_KEY, fontScale);
    } catch {
      // ignore
    }
  }, [fontScale]);

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(
      doc(db, 'settings', 'emailDomains'),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as {
          allowedDomains?: string[];
          maintenanceMode?: boolean;
        };
        if (Array.isArray(data.allowedDomains) && data.allowedDomains.length > 0) {
          setDomainsInput(data.allowedDomains.join(', '));
        }
        if (typeof data.maintenanceMode === 'boolean') {
          setMaintenanceMode(data.maintenanceMode);
        }
      },
      (err) => {
        reportListenerError(err, OperationType.GET, 'settings/emailDomains');
      },
    );
    return () => unsub();
  }, [profile]);

  const handleSaveAdminSettings = async () => {
    if (!profile) return;
    setSavingDomains(true);
    const allowedDomains = domainsInput
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 50);

    try {
      await setDoc(
        doc(db, 'settings', 'emailDomains'),
        {
          key: 'emailDomains',
          allowedDomains,
          appVersion: '3.2.0',
          maintenanceMode,
          updatedBy: profile.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      notify('Platform governance settings saved.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/emailDomains');
    } finally {
      setSavingDomains(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Appearance & Display */}
      <section className="lg:col-span-7 space-y-6">
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
            <div>
              <h2 className="text-base font-display font-semibold">Workspace Appearance</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Customize the workspace canvas, sidebar, header, and accent theme across the application.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark Mode</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light Mode</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-medium text-[var(--text-secondary)]">
              Workspace Color Palettes
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LIGHT_THEME_PRESETS.map((preset) => {
                const active = theme === 'light' && lightTheme === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setLightTheme(preset.id)}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg border text-left transition-colors ${
                      active
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded border border-black/15 overflow-hidden grid grid-cols-2 shrink-0">
                        <span style={{ backgroundColor: preset.sidebar }} />
                        <span style={{ backgroundColor: preset.accent }} />
                      </span>
                      <span className="truncate">{preset.label}</span>
                    </span>
                    {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-medium rounded-lg border text-left transition-colors ${
                  theme === 'dark'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Moon className="w-5 h-5 shrink-0" />
                  <span className="truncate">Dark Console</span>
                </span>
                {theme === 'dark' && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-[var(--border-hairline)]">
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-[var(--text-secondary)]">
                Typography Reading Scale
              </div>
              <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
                {(
                  [
                    ['compact', 'Compact'],
                    ['standard', 'Standard'],
                    ['comfortable', 'Large'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFontScale(id)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      fontScale === id
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {onSetSidebarCompact && (
              <div className="space-y-2.5">
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  Side Menu Layout
                </div>
                <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
                  <button
                    type="button"
                    onClick={() => onSetSidebarCompact(false)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      !sidebarCompact
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Expanded
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetSidebarCompact(true)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      sidebarCompact
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    Compact Rail
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Platform Governance */}
        {capabilities.canManageMissions && (
          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-3">
              <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 className="text-sm font-semibold">Administrator Governance</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Allowed Email Domains (comma-separated)
                </label>
                <input
                  type="text"
                  value={domainsInput}
                  onChange={(e) => setDomainsInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                />
                <span>Enable Maintenance Mode Notice</span>
              </label>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingDomains}
                  onClick={handleSaveAdminSettings}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white disabled:opacity-60"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingDomains ? 'Saving...' : 'Save Admin Settings'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Right Column: Session, About & Privacy */}
      <section className="lg:col-span-5 space-y-6">
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 space-y-4">
          <h3 className="text-sm font-semibold border-b border-[var(--border-hairline)] pb-3">
            Sync & Session
          </h3>
          <div className="space-y-2 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center justify-between">
              <span>Firestore Persistence</span>
              <span className="font-medium text-[var(--text-primary)]">
                Multi-Tab IndexedDB Enabled
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Cloud Connection</span>
              <span className="font-medium text-[var(--text-primary)]">
                {connectionOk ? 'Connected' : 'Offline Cache Mode'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Signed-in Email</span>
              <span className="font-medium text-[var(--text-primary)] truncate max-w-[200px]">
                {profile?.email}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={signOut}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] text-red-600 dark:text-red-400 hover:bg-[var(--bg-subtle)]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Workspace</span>
            </button>
          </div>
        </div>

        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-sm font-semibold">About PastorPro</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Multi-mission ministerial, financial, and departmental reporting platform supporting Unions, Missions, Regions, Districts, and local Churches.
          </p>
          <div className="text-xs text-[var(--text-muted)] space-y-1 pt-1">
            <div>Version 3.2.0 · Editorial React Workspace</div>
            <div>Offline-capable Firebase Firestore & Google Sign-In</div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
            >
              View Privacy & Data Governance Policy
            </button>
          </div>
        </div>
      </section>

      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h3 className="text-base font-display font-semibold">
              Privacy & Data Governance Policy
            </h3>
            <div className="text-xs text-[var(--text-secondary)] space-y-2.5 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              <p>
                Account authentication uses Google Sign-In. Email addresses, profile details, pastoral assignments, and submitted ministerial or treasury ledgers are stored securely in Cloud Firestore.
              </p>
              <p>
                Access is strictly scoped by role and hierarchy: personal activities, appointments, and to-dos are private to your account; Borang B, Financial/FAM, and Quarterly Department reports are accessible only to authorized church, district, and mission officers.
              </p>
              <p>
                Administrative changes to login approvals, roles, unions, missions, regions, districts, and churches are recorded in the mission audit trail.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
