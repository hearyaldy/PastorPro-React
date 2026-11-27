import React, { useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { ExternalLink, FileText, Moon, Plus, Sun, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { useTheme } from '../contexts/ThemeContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useToast } from '../components/Toast';
import { ROLE_META } from '../types';

export function ResourcesSettingsPage() {
  const { profile, capabilities, updateOwnProfile } = useAuth();
  const { resources, missions, logAdminActivity } = useMission();
  const { theme, setTheme } = useTheme();
  const { notify } = useToast();

  // Profile form
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Resource creation (Admin/Editor)
  const [resTitle, setResTitle] = useState('');
  const [resCategory, setResCategory] = useState('Ministerial Manual');
  const [resUrl, setResUrl] = useState('');
  const [resDesc, setResDesc] = useState('');

  // Allowed domains setting
  const [domainsInput, setDomainsInput] = useState('sabahadventist.org, gmail.com');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingProfile(true);
    try {
      await updateOwnProfile({
        displayName: displayName.trim().slice(0, 120),
        phone: phone.trim().slice(0, 40),
        photoURL: photoURL.trim().slice(0, 500),
      });
      notify('Profile updated.', 'success');
    } catch {
      notify('Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !resTitle.trim() || !resUrl.trim()) return;
    const missionId = profile.missionId || missions[0]?.id || 'sam_sabah';
    try {
      const ref = await addDoc(collection(db, 'resources'), {
        missionId,
        title: resTitle.trim().slice(0, 160),
        category: resCategory.trim().slice(0, 64),
        description: resDesc.trim().slice(0, 1000),
        url: resUrl.trim().slice(0, 500),
        fileType: 'Link / PDF',
        isActive: true,
        uploadedBy: profile.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('ADD_RESOURCE', 'resources', `Published resource ${resTitle}`, ref.id);
      setResTitle('');
      setResUrl('');
      setResDesc('');
      notify('Resource published.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'resources');
    }
  };

  const handleDeleteResource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'resources', id));
      notify('Resource removed.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `resources/${id}`);
    }
  };

  const handleSaveEmailDomains = async () => {
    if (!profile) return;
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
          maintenanceMode: false,
          updatedBy: profile.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      notify('Allowed email domains configuration saved.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/emailDomains');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: Shared Mission Resources */}
      <section className="lg:col-span-7 space-y-6">
        {capabilities.canManageResources && (
          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-4">
            <h2 className="text-base font-display font-semibold">
              Publish Shared Mission Resource
            </h2>
            <form onSubmit={handleAddResource} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Resource title *"
                  maxLength={160}
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
                <input
                  type="text"
                  required
                  placeholder="Category"
                  maxLength={64}
                  value={resCategory}
                  onChange={(e) => setResCategory(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <input
                type="url"
                required
                placeholder="Document or external URL (https://...) *"
                maxLength={500}
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="text"
                placeholder="Brief summary (optional)"
                maxLength={1000}
                value={resDesc}
                onChange={(e) => setResDesc(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Publish Resource</span>
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-hairline)]">
            <h3 className="text-sm font-semibold">Mission Resource Library</h3>
          </div>
          {resources.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <FileText className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
              <div className="text-xs text-[var(--text-muted)]">
                No shared documents uploaded yet.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {resources.map((res) => (
                <div
                  key={res.id}
                  className="px-5 py-4 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{res.title}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {res.category} {res.description ? `· ${res.description}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {capabilities.canManageHierarchy && (
                      <button
                        type="button"
                        onClick={() => handleDeleteResource(res.id)}
                        className="p-1.5 text-red-600 dark:text-red-400"
                        aria-label="Delete resource"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Right: Profile, Appearance & App Settings */}
      <section className="lg:col-span-5 space-y-6">
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-semibold">Profile & Account</h2>
            <span className="text-xs text-[var(--text-muted)]">
              {profile ? ROLE_META[profile.userRole].label : ''}
            </span>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Profile Photo URL
              </label>
              <input
                type="url"
                maxLength={500}
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-3">
          <h3 className="text-sm font-semibold">Workspace Appearance</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border ${
                theme === 'light'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)]'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light Editorial</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border ${
                theme === 'dark'
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                  : 'border-[var(--border-hairline)]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark Console</span>
            </button>
          </div>
        </div>

        {capabilities.canManageMissions && (
          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-3">
            <h3 className="text-sm font-semibold">Allowed Email Domains (Admin)</h3>
            <input
              type="text"
              value={domainsInput}
              onChange={(e) => setDomainsInput(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
            />
            <button
              type="button"
              onClick={handleSaveEmailDomains}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
            >
              Save Settings
            </button>
          </div>
        )}

        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 text-xs text-[var(--text-secondary)] space-y-1">
          <div className="font-semibold text-[var(--text-primary)]">
            Pastor Report — Sabah Adventist Mission
          </div>
          <div>Version 3.2.0 · Native React Editorial Workspace</div>
          <div>Offline-enabled Cloud Firestore synchronization</div>
        </div>
      </section>
    </div>
  );
}
