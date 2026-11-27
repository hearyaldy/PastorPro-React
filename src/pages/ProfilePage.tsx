import { useHierarchyLabels } from '../hooks/useHierarchyLabels';
import React, { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { Check, MapPinPlus, Shield, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType, reportListenerError } from '../lib/firebase';
import { useToast } from '../components/Toast';
import { ROLE_META } from '../types';

export function ProfilePage() {
  const labels = useHierarchyLabels();
  const { profile, updateOwnProfile } = useAuth();
  const { unions, missions, regions, districts, churches } = useMission();
  const { notify } = useToast();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [photoLoadError, setPhotoLoadError] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Assignment form
  const [missionId, setMissionId] = useState(profile?.missionId || '');
  const [regionId, setRegionId] = useState(profile?.regionId || '');
  const [districtId, setDistrictId] = useState(profile?.districtId || '');
  const [churchId, setChurchId] = useState(profile?.churchId || '');
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Location Request modal
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [reqRegion, setReqRegion] = useState('');
  const [reqDistrict, setReqDistrict] = useState('');
  const [reqChurch, setReqChurch] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  // Personal activity & Borang B counts
  const [activityCount, setActivityCount] = useState(0);
  const [borangBCount, setBorangBCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setPhone(profile.phone || '');
    setPhotoURL(profile.photoURL || '');
    setMissionId(profile.missionId || '');
    setRegionId(profile.regionId || '');
    setDistrictId(profile.districtId || '');
    setChurchId(profile.churchId || '');
    setPhotoLoadError(false);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const unsubAct = onSnapshot(
      query(collection(db, 'activities'), where('userId', '==', profile.uid)),
      (snap) => setActivityCount(snap.size),
      (err) => {
        reportListenerError(err, OperationType.LIST, 'activities');
      },
    );
    const unsubB = onSnapshot(
      query(collection(db, 'borang_b_reports'), where('userId', '==', profile.uid)),
      (snap) => setBorangBCount(snap.size),
      (err) => {
        reportListenerError(err, OperationType.LIST, 'borang_b_reports');
      },
    );
    return () => {
      unsubAct();
      unsubB();
    };
  }, [profile]);

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

  const selectedMission = missions.find((m) => m.id === (profile?.missionId || missionId));
  const resolvedUnionName = labels.union(profile?.unionId || selectedMission?.unionId, profile?.unionName || selectedMission?.unionName);

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
      setPhotoLoadError(false);
      notify('Personal profile updated.', 'success');
    } catch {
      notify('Could not save profile changes.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.onboardingCompleted || profile.userRole !== 'user') return;
    setSavingAssignment(true);
    const mission = missions.find((m) => m.id === missionId);
    const region = regions.find((r) => r.id === regionId);
    const district = districts.find((d) => d.id === districtId);
    const church = churches.find((c) => c.id === churchId);
    const union = unions.find((u) => u.id === mission?.unionId);

    try {
      await updateOwnProfile({
        unionId: union?.id || mission?.unionId || '',
        unionName: union?.name || mission?.unionName || '',
        missionId: mission?.id || '',
        missionName: mission?.name || '',
        regionId: region?.id || '',
        regionName: region?.name || '',
        districtId: district?.id || '',
        districtName: district?.name || '',
        churchId: church?.id || '',
        churchName: church?.name || '',
      });
      notify('Ministry assignment updated.', 'success');
    } catch {
      notify('Could not update assignment.', 'error');
    } finally {
      setSavingAssignment(false);
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
        userName: profile.displayName,
        userEmail: profile.email,
        missionName: selectedMission?.name || 'General Mission',
        regionName: reqRegion.trim().slice(0, 120),
        districtName: reqDistrict.trim().slice(0, 120),
        churchName: reqChurch.trim().slice(0, 160),
        notes: reqNotes.trim().slice(0, 1000),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      notify('Missing location request sent to administrators.', 'success');
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

  if (!profile) return null;

  return (
    <div className="space-y-8">
      {/* Top Identity Summary */}
      <section className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          {profile.photoURL && !photoLoadError ? (
            <img
              src={profile.photoURL}
              alt={profile.displayName}
              referrerPolicy="no-referrer"
              onError={() => setPhotoLoadError(true)}
              className="w-16 h-16 rounded-full object-cover border border-[var(--border-hairline)] shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-lg font-display font-semibold shrink-0">
              {profile.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <h2 className="text-xl font-display font-semibold truncate">
              {profile.displayName}
            </h2>
            <div className="text-xs text-[var(--text-secondary)] truncate">
              {profile.email}
              {profile.phone ? ` · ${profile.phone}` : ''}
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              {ROLE_META[profile.userRole].label} (Level {profile.level}) · Approved Account
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 shrink-0 border-t md:border-t-0 md:border-l border-[var(--border-hairline)] pt-4 md:pt-0 md:pl-6">
          <div>
            <div className="text-[11px] text-[var(--text-muted)]">Activities Logged</div>
            <div className="text-xl font-display font-semibold font-mono-tabular mt-0.5">
              {activityCount}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--text-muted)]">Borang B Reports</div>
            <div className="text-xl font-display font-semibold font-mono-tabular mt-0.5">
              {borangBCount}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Personal Profile Form */}
        <section className="lg:col-span-6 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-3">
            <User className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-sm font-semibold">Personal Details</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Full Name / Pastoral Title *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Google Account Email
              </label>
              <input
                type="email"
                disabled
                value={profile.email}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--text-muted)]"
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
                placeholder="+60 12-345 6789"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Avatar Photo URL
              </label>
              <input
                type="url"
                maxLength={500}
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingProfile ? 'Saving...' : 'Save Personal Profile'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Right: Organizational & Hierarchy Assignment */}
        <section className="lg:col-span-6 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 className="text-sm font-semibold">Ministry & Hierarchy Assignment</h3>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{resolvedUnionName}</span>
          </div>

          <p className="text-xs text-[var(--text-secondary)]">
            Administrators manage your saved mission and church assignment. Contact your mission administrator to request a change.
          </p>
          <form onSubmit={handleSaveAssignment} className="space-y-4">
            <fieldset disabled={Boolean(profile?.onboardingCompleted || profile?.userRole !== 'user')} className="space-y-4 disabled:opacity-70">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
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
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
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
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Region
                </label>
                <select
                  value={regionId}
                  onChange={(e) => {
                    setRegionId(e.target.value);
                    setDistrictId('');
                    setChurchId('');
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
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
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  District
                </label>
                <select
                  value={districtId}
                  onChange={(e) => {
                    setDistrictId(e.target.value);
                    setChurchId('');
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
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
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Primary Church
                </label>
                <select
                  value={churchId}
                  onChange={(e) => setChurchId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
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

            </fieldset>

            <div className="p-3.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-xs text-[var(--text-secondary)]">
              Role permissions: <span className="font-semibold text-[var(--text-primary)]">{ROLE_META[profile.userRole].summary}</span>
            </div>

            <div className="flex items-center justify-between pt-2 gap-3">
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline"
              >
                <MapPinPlus className="w-3.5 h-3.5" />
                <span>Request missing church or district</span>
              </button>

              <button
                type="submit"
                disabled={savingAssignment || profile.onboardingCompleted || profile.userRole !== 'user'}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-60 whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{savingAssignment ? 'Updating...' : 'Save Assignment'}</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <h2 className="text-base font-display font-semibold">
              Request Missing Church or District
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Submit your congregation details so an administrator can add it to the mission hierarchy.
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
                placeholder="Notes (optional)"
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
