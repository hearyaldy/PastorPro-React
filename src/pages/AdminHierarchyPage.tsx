import React, { useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { bootstrapSabahMissionBaseline } from '../lib/seedData';
import { useToast } from '../components/Toast';

export function AdminHierarchyPage() {
  const { profile, capabilities } = useAuth();
  const { missions, regions, districts, churches, logAdminActivity } = useMission();
  const { notify } = useToast();

  const [tab, setTab] = useState<'missions' | 'regions' | 'districts' | 'churches'>('churches');
  const [seeding, setSeeding] = useState(false);

  // Quick add states
  const [missionName, setMissionName] = useState('');
  const [missionCode, setMissionCode] = useState('');
  const [missionHq, setMissionHq] = useState('');

  const [regionName, setRegionName] = useState('');
  const [regionMissionId, setRegionMissionId] = useState('');

  const [districtName, setDistrictName] = useState('');
  const [districtRegionId, setDistrictRegionId] = useState('');
  const [districtPastorName, setDistrictPastorName] = useState('');

  const [churchName, setChurchName] = useState('');
  const [churchDistrictId, setChurchDistrictId] = useState('');
  const [churchCode, setChurchCode] = useState('');
  const [churchMembers, setChurchMembers] = useState(50);

  const handleSeedBaseline = async () => {
    if (!profile) return;
    setSeeding(true);
    try {
      await bootstrapSabahMissionBaseline(profile.uid, profile.displayName);
      notify('Sabah Adventist Mission hierarchy initialized.', 'success');
    } catch {
      notify('Could not initialize baseline.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleAddMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionName.trim() || !missionCode.trim()) return;
    try {
      const ref = await addDoc(collection(db, 'missions'), {
        name: missionName.trim().slice(0, 120),
        code: missionCode.trim().toUpperCase().slice(0, 24),
        headquarters: missionHq.trim().slice(0, 200),
        country: 'Malaysia',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('CREATE_MISSION', 'missions', `Created ${missionName}`, ref.id);
      setMissionName('');
      setMissionCode('');
      setMissionHq('');
      notify('Mission created.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'missions');
    }
  };

  const handleAddRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    const mId = regionMissionId || missions[0]?.id;
    if (!regionName.trim() || !mId) return;
    try {
      const ref = await addDoc(collection(db, 'regions'), {
        missionId: mId,
        name: regionName.trim().slice(0, 120),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('CREATE_REGION', 'regions', `Created ${regionName}`, ref.id);
      setRegionName('');
      notify('Region added.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'regions');
    }
  };

  const handleAddDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    const reg = regions.find((r) => r.id === (districtRegionId || regions[0]?.id));
    if (!districtName.trim() || !reg) return;
    try {
      const ref = await addDoc(collection(db, 'districts'), {
        missionId: reg.missionId,
        regionId: reg.id,
        name: districtName.trim().slice(0, 120),
        districtPastorName: districtPastorName.trim().slice(0, 120),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('CREATE_DISTRICT', 'districts', `Created ${districtName}`, ref.id);
      setDistrictName('');
      setDistrictPastorName('');
      notify('District added.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'districts');
    }
  };

  const handleAddChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    const dist = districts.find((d) => d.id === (churchDistrictId || districts[0]?.id));
    if (!churchName.trim() || !dist) return;
    try {
      const ref = await addDoc(collection(db, 'churches'), {
        missionId: dist.missionId,
        regionId: dist.regionId,
        districtId: dist.id,
        name: churchName.trim().slice(0, 160),
        churchCode: churchCode.trim().slice(0, 32),
        memberCount: Math.max(0, Number(churchMembers) || 0),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('CREATE_CHURCH', 'churches', `Created ${churchName}`, ref.id);
      setChurchName('');
      setChurchCode('');
      notify('Church added to directory.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'churches');
    }
  };

  const handleAssignDistrictPastorName = async (id: string, pastorName: string) => {
    try {
      await updateDoc(doc(db, 'districts', id), {
        districtPastorName: pastorName.slice(0, 120),
        updatedAt: serverTimestamp(),
      });
      notify('District pastor updated.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `districts/${id}`);
    }
  };

  const handleDeleteDoc = async (col: string, id: string, label: string) => {
    try {
      await deleteDoc(doc(db, col, id));
      await logAdminActivity(`DELETE_${col.toUpperCase()}`, col, `Deleted ${label}`, id);
      notify(`${label} removed.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${col}/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start">
          {(['churches', 'districts', 'regions', 'missions'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                tab === t
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSeedBaseline}
          disabled={seeding}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] self-start"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{seeding ? 'Populating...' : 'Seed / Sync SAM Baseline'}</span>
        </button>
      </div>

      {/* MISSIONS */}
      {tab === 'missions' && (
        <div className="space-y-5">
          {capabilities.canManageMissions && (
            <form
              onSubmit={handleAddMission}
              className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Mission Name *
                </label>
                <input
                  type="text"
                  required
                  value={missionName}
                  onChange={(e) => setMissionName(e.target.value)}
                  placeholder="Sabah Adventist Mission"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  value={missionCode}
                  onChange={(e) => setMissionCode(e.target.value)}
                  placeholder="SAM"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Headquarters
                </label>
                <input
                  type="text"
                  value={missionHq}
                  onChange={(e) => setMissionHq(e.target.value)}
                  placeholder="Tamparuli, Sabah"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Mission</span>
              </button>
            </form>
          )}

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Mission Name</th>
                  <th className="py-3 px-4 font-medium">Headquarters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {missions.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 font-mono-tabular text-xs font-semibold">
                      {m.code}
                    </td>
                    <td className="py-3 px-4 font-medium">{m.name}</td>
                    <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                      {m.headquarters || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REGIONS */}
      {tab === 'regions' && (
        <div className="space-y-5">
          <form
            onSubmit={handleAddRegion}
            className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Mission</label>
              <select
                value={regionMissionId || missions[0]?.id || ''}
                onChange={(e) => setRegionMissionId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Region Name *
              </label>
              <input
                type="text"
                required
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="e.g. Northern Kudat Region"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Region</span>
            </button>
          </form>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Region</th>
                  <th className="py-3 px-4 font-medium">Mission</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {regions.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 px-4 font-medium">{r.name}</td>
                    <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                      {missions.find((m) => m.id === r.missionId)?.name || r.missionId}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc('regions', r.id, r.name)}
                        className="p-1 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISTRICTS */}
      {tab === 'districts' && (
        <div className="space-y-5">
          <form
            onSubmit={handleAddDistrict}
            className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Region</label>
              <select
                value={districtRegionId || regions[0]?.id || ''}
                onChange={(e) => setDistrictRegionId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                District Name *
              </label>
              <input
                type="text"
                required
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                placeholder="e.g. Papar District"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                District Pastor
              </label>
              <input
                type="text"
                value={districtPastorName}
                onChange={(e) => setDistrictPastorName(e.target.value)}
                placeholder="Pr. Name"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add District</span>
            </button>
          </form>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">District</th>
                  <th className="py-3 px-4 font-medium">Region</th>
                  <th className="py-3 px-4 font-medium">Assigned Pastor</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {districts.map((d) => (
                  <tr key={d.id}>
                    <td className="py-3 px-4 font-medium">{d.name}</td>
                    <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                      {regions.find((r) => r.id === d.regionId)?.name || d.regionId}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        defaultValue={d.districtPastorName || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (d.districtPastorName || '')) {
                            handleAssignDistrictPastorName(d.id, e.target.value);
                          }
                        }}
                        placeholder="Assign pastor..."
                        className="px-2.5 py-1 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc('districts', d.id, d.name)}
                        className="p-1 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CHURCHES */}
      {tab === 'churches' && (
        <div className="space-y-5">
          <form
            onSubmit={handleAddChurch}
            className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">District</label>
              <select
                value={churchDistrictId || districts[0]?.id || ''}
                onChange={(e) => setChurchDistrictId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--text-secondary)] mb-1">
                Church Name *
              </label>
              <input
                type="text"
                required
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                placeholder="e.g. Kiulu SDA Church"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-secondary)] mb-1">Members</label>
              <input
                type="number"
                min={0}
                value={churchMembers}
                onChange={(e) => setChurchMembers(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Church</span>
            </button>
          </form>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Church</th>
                    <th className="py-3 px-4 font-medium">District</th>
                    <th className="py-3 px-4 font-medium">Region</th>
                    <th className="py-3 px-4 font-medium text-right">Members</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {churches.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--bg-subtle)]/60">
                      <td className="py-3 px-4 font-medium">{c.name}</td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {districts.find((d) => d.id === c.districtId)?.name || c.districtId}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {regions.find((r) => r.id === c.regionId)?.name || c.regionId}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {c.memberCount ?? 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteDoc('churches', c.id, c.name)}
                          className="p-1 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
