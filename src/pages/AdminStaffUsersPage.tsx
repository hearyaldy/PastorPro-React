import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { Check, Plus, Search, Trash2, Upload, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useToast } from '../components/Toast';
import {
  ROLE_META,
  type AdminActivityLog,
  type LocationRequest,
  type UserProfile,
  type UserRole,
} from '../types';

export function AdminStaffUsersPage() {
  const { profile } = useAuth();
  const { missions, regions, districts, churches, staff, logAdminActivity } = useMission();
  const { notify } = useToast();

  const [tab, setTab] = useState<'users' | 'staff' | 'requests' | 'audit'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<LocationRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminActivityLog[]>([]);
  const [search, setSearch] = useState('');

  // Add Staff form
  const [staffName, setStaffName] = useState('');
  const [staffPosition, setStaffPosition] = useState('District Pastor');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffDistrictId, setStaffDistrictId] = useState('');

  useEffect(() => {
    if (!profile) return;
    const unsubs = [
      onSnapshot(
        query(collection(db, 'users'), orderBy('displayName', 'asc')),
        (snap) => {
          setUsers(
            snap.docs.map((d) => ({
              ...(d.data() as UserProfile),
              uid: d.id,
            })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
      ),
      onSnapshot(
        query(collection(db, 'locationRequests'), orderBy('createdAt', 'desc')),
        (snap) => {
          setRequests(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<LocationRequest, 'id'>),
            })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'locationRequests'),
      ),
      onSnapshot(
        query(collection(db, 'admin_activity'), orderBy('createdAt', 'desc'), limit(50)),
        (snap) => {
          setAuditLogs(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<AdminActivityLog, 'id'>),
            })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'admin_activity'),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [profile]);

  const assignableRoles = useMemo(() => {
    const all = Object.entries(ROLE_META) as [UserRole, { label: string; level: number }][];
    if (profile?.userRole === 'super_admin') return all;
    if (profile?.userRole === 'admin') {
      return all.filter(([r]) => r !== 'super_admin' && r !== 'admin');
    }
    return all.filter(
      ([r]) => r !== 'super_admin' && r !== 'admin' && r !== 'mission_admin',
    );
  }, [profile]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        u.displayName.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.districtName || '').toLowerCase().includes(s)
      );
    });
  }, [users, search]);

  const handleUpdateUser = async (
    target: UserProfile,
    updates: Partial<UserProfile>,
    summary: string,
  ) => {
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('UPDATE_USER', 'users', summary, target.uid);
      notify('User record updated.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${target.uid}`);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim()) return;
    const dist = districts.find((d) => d.id === staffDistrictId);
    const missionId = dist?.missionId || profile?.missionId || missions[0]?.id || 'sam_sabah';
    try {
      const ref = await addDoc(collection(db, 'staff'), {
        missionId,
        ...(dist ? { regionId: dist.regionId, districtId: dist.id } : {}),
        fullName: staffName.trim().slice(0, 120),
        position: staffPosition.trim().slice(0, 80),
        email: staffEmail.trim().slice(0, 200),
        status: 'active',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('CREATE_STAFF', 'staff', `Added ${staffName}`, ref.id);
      setStaffName('');
      setStaffEmail('');
      notify('Staff member added.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'staff');
    }
  };

  const handleBulkStaffImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const missionId = profile?.missionId || missions[0]?.id || 'sam_sabah';
      let rows: Record<string, unknown>[] = [];
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        rows = Array.isArray(parsed) ? parsed : [];
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws);
      }

      if (rows.length === 0) {
        notify('No valid rows found in import file.', 'error');
        return;
      }

      const batch = writeBatch(db);
      const nowTs = serverTimestamp();
      let count = 0;

      for (const r of rows.slice(0, 100)) {
        const fullName = String(r.fullName || r.name || r.Name || '').trim();
        if (!fullName) continue;
        const position = String(r.position || r.Position || 'Pastor').trim();
        const email = String(r.email || r.Email || '').trim();
        const ref = doc(collection(db, 'staff'));
        batch.set(ref, {
          missionId,
          fullName: fullName.slice(0, 120),
          position: position.slice(0, 80),
          email: email.slice(0, 200),
          status: 'active',
          isActive: true,
          createdAt: nowTs,
          updatedAt: nowTs,
        });
        count++;
      }

      await batch.commit();
      await logAdminActivity('BULK_IMPORT_STAFF', 'staff', `Imported ${count} staff rows from ${file.name}`);
      notify(`Imported ${count} staff records.`, 'success');
    } catch {
      notify('Failed to parse CSV/JSON/Excel import file.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleReviewRequest = async (
    req: LocationRequest,
    status: 'approved' | 'rejected',
  ) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'locationRequests', req.id), {
        status,
        reviewedBy: profile.uid,
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity(
        'REVIEW_LOCATION_REQUEST',
        'locationRequests',
        `${status.toUpperCase()} request for ${req.churchName}`,
        req.id,
      );
      notify(`Request marked ${status}.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `locationRequests/${req.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start">
          {(
            [
              ['users', `Users (${users.length})`],
              ['staff', `Staff Directory (${staff.length})`],
              ['requests', `Location Requests (${requests.filter((r) => r.status === 'pending').length})`],
              ['audit', 'Audit Log'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                tab === id
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] w-64"
            />
          </div>
        )}
      </div>

      {/* USERS & ROLES */}
      {tab === 'users' && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">User</th>
                  <th className="py-3 px-4 font-medium">Role (Level)</th>
                  <th className="py-3 px-4 font-medium">District</th>
                  <th className="py-3 px-4 font-medium">Church</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {filteredUsers.map((u) => {
                  const isSelf = u.uid === profile?.uid;
                  return (
                    <tr key={u.uid} className="hover:bg-[var(--bg-subtle)]/50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{u.displayName}</div>
                        <div className="text-xs text-[var(--text-muted)]">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          disabled={isSelf || (u.userRole === 'super_admin' && profile?.userRole !== 'super_admin')}
                          value={u.userRole}
                          onChange={(e) => {
                            const nextRole = e.target.value as UserRole;
                            handleUpdateUser(
                              u,
                              {
                                userRole: nextRole,
                                role: nextRole,
                                roleTitle: ROLE_META[nextRole].label,
                                level: ROLE_META[nextRole].level,
                                isAdmin: nextRole === 'super_admin' || nextRole === 'admin',
                              },
                              `Changed ${u.displayName} role to ${ROLE_META[nextRole].label}`,
                            );
                          }}
                          className="px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] disabled:opacity-60"
                        >
                          {assignableRoles.map(([key, meta]) => (
                            <option key={key} value={key}>
                              {meta.label} (L{meta.level})
                            </option>
                          ))}
                          {!assignableRoles.some(([k]) => k === u.userRole) && (
                            <option value={u.userRole}>
                              {ROLE_META[u.userRole]?.label || u.userRole}
                            </option>
                          )}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.districtId || ''}
                          onChange={(e) => {
                            const dist = districts.find((d) => d.id === e.target.value);
                            const reg = regions.find((r) => r.id === dist?.regionId);
                            const mission = missions.find((m) => m.id === (dist?.missionId || u.missionId));
                            handleUpdateUser(
                              u,
                              {
                                districtId: dist?.id || '',
                                districtName: dist?.name || '',
                                regionId: reg?.id || '',
                                regionName: reg?.name || '',
                                missionId: dist?.missionId || u.missionId || 'sam_sabah',
                                missionName: mission?.name || u.missionName || '',
                                unionId: mission?.unionId || u.unionId || '',
                                unionName: mission?.unionName || u.unionName || '',
                              },
                              `Assigned ${u.displayName} to ${dist?.name || 'Unassigned'}`,
                            );
                          }}
                          className="px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                        >
                          <option value="">Unassigned</option>
                          {districts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.churchId || ''}
                          onChange={(e) => {
                            const ch = churches.find((c) => c.id === e.target.value);
                            handleUpdateUser(
                              u,
                              {
                                churchId: ch?.id || '',
                                churchName: ch?.name || '',
                              },
                              `Assigned ${u.displayName} church to ${ch?.name || 'None'}`,
                            );
                          }}
                          className="px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                        >
                          <option value="">None</option>
                          {churches.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 text-xs">
                          <label className="inline-flex items-center gap-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(u.isPremium)}
                              onChange={(e) =>
                                handleUpdateUser(
                                  u,
                                  { isPremium: e.target.checked },
                                  `Set premium=${e.target.checked} for ${u.displayName}`,
                                )
                              }
                            />
                            <span>Premium</span>
                          </label>
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateUser(
                                  u,
                                  {
                                    isActive: !u.isActive,
                                    approvalStatus: !u.isActive ? 'approved' : 'rejected',
                                    approvedBy: profile?.uid || '',
                                  },
                                  `${u.isActive ? 'Deactivated' : 'Reactivated'} ${u.displayName}`,
                                )
                              }
                              className={`font-medium ${
                                u.isActive
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Reactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STAFF DIRECTORY & BULK IMPORT */}
      {tab === 'staff' && (
        <div className="space-y-5">
          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Add or Bulk Import Mission Staff</h2>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] cursor-pointer hover:bg-[var(--bg-subtle)]">
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV / Excel / JSON</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={handleBulkStaffImport}
                  className="hidden"
                />
              </label>
            </div>

            <form
              onSubmit={handleAddStaff}
              className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
            >
              <input
                type="text"
                required
                placeholder="Full name *"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="text"
                required
                placeholder="Position *"
                value={staffPosition}
                onChange={(e) => setStaffPosition(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="email"
                placeholder="Email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <select
                value={staffDistrictId}
                onChange={(e) => setStaffDistrictId(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                <option value="">Mission Office / Unassigned</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Staff</span>
              </button>
            </form>
          </div>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Position</th>
                  <th className="py-3 px-4 font-medium">District</th>
                  <th className="py-3 px-4 font-medium">Email</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-4 font-medium">{s.fullName}</td>
                    <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                      {s.position}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                      {districts.find((d) => d.id === s.districtId)?.name || 'Mission Office'}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-muted)]">
                      {s.email || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deleteDoc(doc(db, 'staff', s.id));
                            notify('Staff entry removed.', 'info');
                          } catch (err) {
                            handleFirestoreError(err, OperationType.DELETE, `staff/${s.id}`);
                          }
                        }}
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

      {/* LOCATION REQUESTS */}
      {tab === 'requests' && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] divide-y divide-[var(--border-hairline)]">
          {requests.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--text-muted)]">
              No onboarding location requests submitted.
            </div>
          ) : (
            requests.map((req) => (
              <div key={req.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold">
                    {req.churchName}{' '}
                    <span className="text-xs font-normal text-[var(--text-muted)]">
                      ({req.status})
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Requested by {req.userName} ({req.userEmail}) · Region:{' '}
                    {req.regionName || '—'} · District: {req.districtName || '—'}
                  </div>
                  {req.notes && (
                    <div className="text-xs text-[var(--text-muted)]">{req.notes}</div>
                  )}
                </div>
                {req.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReviewRequest(req, 'approved')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewRequest(req, 'rejected')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] text-red-600 dark:text-red-400"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* AUDIT LOG */}
      {tab === 'audit' && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] divide-y divide-[var(--border-hairline)]">
          {auditLogs.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--text-muted)]">
              No administrative actions logged yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium">{log.summary}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {log.actorName} · {log.action} · {log.targetType}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
