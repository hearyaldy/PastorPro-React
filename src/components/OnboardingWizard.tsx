import React, { useMemo, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Check, MapPinPlus, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { bootstrapSabahMissionBaseline } from '../lib/seedData';
import { ROLE_META } from '../types';
import { useToast } from './Toast';

export function OnboardingWizard() {
  const { profile, updateOwnProfile, bypassOnboarding, signOut } = useAuth();
  const { missions, regions, districts, churches, loadingHierarchy } = useMission();
  const { notify } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [missionId, setMissionId] = useState(profile?.missionId || '');
  const [regionId, setRegionId] = useState(profile?.regionId || '');
  const [districtId, setDistrictId] = useState(profile?.districtId || '');
  const [churchId, setChurchId] = useState(profile?.churchId || '');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [reqRegion, setReqRegion] = useState('');
  const [reqDistrict, setReqDistrict] = useState('');
  const [reqChurch, setReqChurch] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  const filteredRegions = useMemo(
    () => regions.filter((r) => !missionId || r.missionId === missionId),
    [regions, missionId],
  );

  const filteredDistricts = useMemo(
    () => districts.filter((d) => !regionId || d.regionId === regionId),
    [districts, regionId],
  );

  const filteredChurches = useMemo(
    () => churches.filter((c) => !districtId || c.districtId === districtId),
    [churches, districtId],
  );

  const canBootstrap =
    profile?.userRole === 'super_admin' || profile?.userRole === 'admin';

  const handleBootstrap = async () => {
    if (!profile) return;
    setSeeding(true);
    try {
      await bootstrapSabahMissionBaseline(profile.uid, profile.displayName);
      setMissionId('sam_sabah');
      notify('Sabah Adventist Mission baseline structure initialized.', 'success');
    } catch {
      notify('Could not initialize baseline hierarchy.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      notify('Please enter your display name.', 'error');
      return;
    }
    setSaving(true);
    const mission = missions.find((m) => m.id === missionId);
    const region = regions.find((r) => r.id === regionId);
    const district = districts.find((d) => d.id === districtId);
    const church = churches.find((c) => c.id === churchId);

    try {
      await updateOwnProfile({
        displayName: displayName.trim().slice(0, 120),
        phone: phone.trim().slice(0, 40),
        ...(profile?.userRole === 'user' ? {
        unionId: mission?.unionId || '',
        unionName: mission?.unionName || '',
        missionId: mission?.id || '',
        missionName: mission?.name || '',
        regionId: region?.id || '',
        regionName: region?.name || '',
        districtId: district?.id || '',
        districtName: district?.name || '',
        churchId: church?.id || '',
        churchName: church?.name || '',
        } : {}),
        onboardingCompleted: true,
      });
      notify('Onboarding completed. Welcome to PastorPro.', 'success');
    } catch {
      notify('Failed to save onboarding details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBypassOnboarding = async () => {
    setSaving(true);
    try {
      await bypassOnboarding();
      notify('Onboarding skipped. You can complete your assignment anytime in My Profile.', 'info');
    } finally {
      setSaving(false);
    }
  };

  const handleLocationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !reqChurch.trim()) return;
    setSubmittingReq(true);
    try {
      await addDoc(collection(db, 'locationRequests'), {
        userId: profile.uid,
        requestedBy: profile.uid,
        missionId: profile.missionId || '',
        userName: displayName.trim() || profile.displayName,
        userEmail: profile.email,
        missionName:
          missions.find((m) => m.id === missionId)?.name || 'General Mission',
        regionName: reqRegion.trim().slice(0, 120),
        districtName: reqDistrict.trim().slice(0, 120),
        churchName: reqChurch.trim().slice(0, 160),
        notes: reqNotes.trim().slice(0, 1000),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify('Location request submitted for mission administrator review.', 'success');
      setShowLocationModal(false);
      setReqRegion('');
      setReqDistrict('');
      setReqChurch('');
      setReqNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'locationRequests');
    } finally {
      setSubmittingReq(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
        <div className="px-8 py-6 border-b border-[var(--border-hairline)] flex items-center justify-between gap-4">
          <div>
            <div className="text-xs text-[var(--text-muted)]">
              Account Setup · Step {step} of 2
            </div>
            <h1 className="text-xl font-display font-semibold mt-1">
              Configure Your Mission Assignment
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBypassOnboarding}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
            >
              Skip for now
            </button>
            <button
              type="button"
              onClick={signOut}
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0"
            >
              Sign out
            </button>
          </div>
        </div>

        <form onSubmit={handleCompleteOnboarding} className="p-8 space-y-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Full Name / Pastoral Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Pr. Daniel Mojin"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Account Email
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile?.email || ''}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    maxLength={40}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+60 12-345 6789"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  />
                </div>
              </div>
              <div className="p-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-xs text-[var(--text-secondary)] space-y-1">
                <div>
                  Assigned Role:{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {profile ? ROLE_META[profile.userRole].label : 'Pastor / User'}
                  </span>
                </div>
                <div>
                  Administrators can elevate your role to District Pastor, Church Treasurer, or Mission Leadership after onboarding.
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBypassOnboarding}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
                >
                  Bypass Onboarding
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap shrink-0"
                >
                  Continue to Location Assignment
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {!loadingHierarchy && missions.length === 0 && canBootstrap && (
                <div className="p-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex items-center justify-between gap-4">
                  <div className="text-xs text-[var(--text-secondary)]">
                    No missions exist yet in Firestore. Initialize the Sabah Adventist Mission hierarchy now?
                  </div>
                  <button
                    type="button"
                    onClick={handleBootstrap}
                    disabled={seeding}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{seeding ? 'Initializing...' : 'Initialize SAM Baseline'}</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Mission
                  </label>
                  <select
                    value={missionId}
                    onChange={(e) => {
                      setMissionId(e.target.value);
                      setRegionId('');
                      setDistrictId('');
                      setChurchId('');
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  >
                    <option value="">Select Mission...</option>
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Region
                  </label>
                  <select
                    value={regionId}
                    onChange={(e) => {
                      setRegionId(e.target.value);
                      setDistrictId('');
                      setChurchId('');
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  >
                    <option value="">Select Region...</option>
                    {filteredRegions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    District
                  </label>
                  <select
                    value={districtId}
                    onChange={(e) => {
                      setDistrictId(e.target.value);
                      setChurchId('');
                    }}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  >
                    <option value="">Select District...</option>
                    {filteredDistricts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Primary Church (Optional)
                  </label>
                  <select
                    value={churchId}
                    onChange={(e) => setChurchId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  >
                    <option value="">Select Church...</option>
                    {filteredChurches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                >
                  <MapPinPlus className="w-3.5 h-3.5" />
                  <span>My church or district isn&apos;t listed</span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Enter Workspace'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h2 className="text-base font-display font-semibold">
              Request Missing Church or District
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Submit your congregation details so a Mission Administrator can add it to the directory.
            </p>
            <form onSubmit={handleLocationRequest} className="space-y-3">
              <input
                type="text"
                placeholder="Region name"
                maxLength={120}
                value={reqRegion}
                onChange={(e) => setReqRegion(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="text"
                placeholder="District name"
                maxLength={120}
                value={reqDistrict}
                onChange={(e) => setReqDistrict(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="text"
                required
                placeholder="Church name *"
                maxLength={160}
                value={reqChurch}
                onChange={(e) => setReqChurch(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <textarea
                rows={3}
                placeholder="Additional notes (optional)"
                maxLength={1000}
                value={reqNotes}
                onChange={(e) => setReqNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReq}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
                >
                  {submittingReq ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
