import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Check,
  Edit3,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType, reportListenerError } from '../lib/firebase';
import { bootstrapSabahMissionBaseline } from '../lib/seedData';
import { useToast } from '../components/Toast';
import {
  normalizeUserRole,
  ROLE_META,
  type Church,
  type District,
  type Mission,
  type Region,
  type Union,
  type UserApprovalStatus,
  type UserProfile,
  type UserRole,
} from '../types';

type AdminTab = 'approvals' | 'unions' | 'missions' | 'regions' | 'districts' | 'churches';

function hydrateUserDoc(uid: string, raw: Record<string, unknown>): UserProfile {
  const userRole = normalizeUserRole(raw);
  return {
    ...(raw as unknown as UserProfile),
    uid,
    email: String(raw.email || ''),
    displayName: String(raw.displayName || raw.name || raw.email || uid),
    userRole,
    role: raw.role ? String(raw.role) : userRole,
    roleTitle: raw.roleTitle ? String(raw.roleTitle) : ROLE_META[userRole].label,
    level: typeof raw.level === 'number' ? raw.level : ROLE_META[userRole].level,
    missionId: String(raw.missionId || raw.mission || ''),
    missionName: String(raw.missionName || ''),
    districtId: String(raw.districtId || raw.district || ''),
    districtName: String(raw.districtName || ''),
    isActive: raw.isActive !== false,
    onboardingCompleted: Boolean(raw.onboardingCompleted),
  };
}

function resolveApprovalStatus(u: UserProfile): UserApprovalStatus {
  if (
    u.approvalStatus === 'pending' ||
    u.approvalStatus === 'approved' ||
    u.approvalStatus === 'rejected'
  ) {
    return u.approvalStatus;
  }
  return u.isActive === false ? 'rejected' : 'approved';
}

export function AdminManagementPage() {
  const { profile, capabilities } = useAuth();
  const { unions, missions, regions, districts, churches, logAdminActivity } = useMission();
  const { notify } = useToast();

  const [tab, setTab] = useState<AdminTab>('approvals');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // User approvals & filtering
  const [userSearch, setUserSearch] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | UserApprovalStatus>('all');
  const [pendingRoleDrafts, setPendingRoleDrafts] = useState<Record<string, UserRole>>({});
  const [pendingMissionDrafts, setPendingMissionDrafts] = useState<Record<string, string>>({});
  const [pendingDistrictDrafts, setPendingDistrictDrafts] = useState<Record<string, string>>({});
  const [rejectModalUser, setRejectModalUser] = useState<UserProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Union form & edit
  const [unionName, setUnionName] = useState('');
  const [unionCode, setUnionCode] = useState('');
  const [unionCountry, setUnionCountry] = useState('Malaysia');
  const [unionHq, setUnionHq] = useState('');
  const [editingUnion, setEditingUnion] = useState<Union | null>(null);

  // Mission form & edit
  const [missionUnionId, setMissionUnionId] = useState('');
  const [missionName, setMissionName] = useState('');
  const [missionCode, setMissionCode] = useState('');
  const [missionCountry, setMissionCountry] = useState('Malaysia');
  const [missionHq, setMissionHq] = useState('');
  const [editingMission, setEditingMission] = useState<Mission | null>(null);

  // Region form & edit
  const [regionMissionFilter, setRegionMissionFilter] = useState('all');
  const [regionMissionId, setRegionMissionId] = useState('');
  const [regionName, setRegionName] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);

  // District form & edit
  const [districtRegionFilter, setDistrictRegionFilter] = useState('all');
  const [districtRegionId, setDistrictRegionId] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [districtPastorName, setDistrictPastorName] = useState('');
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);

  // Church form & edit
  const [churchDistrictFilter, setChurchDistrictFilter] = useState('all');
  const [churchSearch, setChurchSearch] = useState('');
  const [churchDistrictId, setChurchDistrictId] = useState('');
  const [churchName, setChurchName] = useState('');
  const [churchCode, setChurchCode] = useState('');
  const [churchTreasurerName, setChurchTreasurerName] = useState('');
  const [churchMembers, setChurchMembers] = useState(50);
  const [editingChurch, setEditingChurch] = useState<Church | null>(null);

  useEffect(() => {
    if (!profile || !capabilities.canManageUsers) {
      setLoadingUsers(false);
      return;
    }
    setLoadingUsers(true);
    setUsersError(null);

    let fallbackUnsub: (() => void) | null = null;
    const isScopedMissionAdmin =
      profile.userRole === 'mission_admin' && Boolean(profile.missionId);

    const handleSnap = (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => {
      const items = snap.docs
        .map((d) => hydrateUserDoc(d.id, d.data()))
        .sort((a, b) => String(a.displayName || '').localeCompare(String(b.displayName || '')));
      setUsers(items);
      setUsersError(null);
      setLoadingUsers(false);
    };

    const unsub = onSnapshot(
      collection(db, 'users'),
      handleSnap,
      (err) => {
        if (isScopedMissionAdmin) {
          fallbackUnsub = onSnapshot(
            query(collection(db, 'users'), where('mission', '==', profile.missionId)),
            handleSnap,
            (err2) => {
              setLoadingUsers(false);
              setUsersError(reportListenerError(err2, OperationType.LIST, 'users'));
            },
          );
          return;
        }
        setLoadingUsers(false);
        setUsersError(reportListenerError(err, OperationType.LIST, 'users'));
      },
    );
    return () => {
      unsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [profile, capabilities.canManageUsers]);

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

  const pendingUsers = useMemo(
    () => users.filter((u) => resolveApprovalStatus(u) === 'pending'),
    [users],
  );

  const approvedActiveCount = useMemo(
    () =>
      users.filter((u) => resolveApprovalStatus(u) === 'approved' && u.isActive !== false)
        .length,
    [users],
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const status = resolveApprovalStatus(u);
      if (approvalFilter !== 'all' && status !== approvalFilter) return false;
      if (userSearch.trim()) {
        const s = userSearch.toLowerCase();
        return (
          u.displayName.toLowerCase().includes(s) ||
          u.email.toLowerCase().includes(s) ||
          (u.missionName || '').toLowerCase().includes(s) ||
          (u.districtName || '').toLowerCase().includes(s) ||
          (u.churchName || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [users, approvalFilter, userSearch]);

  const filteredRegions = useMemo(
    () =>
      regions.filter(
        (r) => regionMissionFilter === 'all' || r.missionId === regionMissionFilter,
      ),
    [regions, regionMissionFilter],
  );

  const filteredDistricts = useMemo(
    () =>
      districts.filter(
        (d) => districtRegionFilter === 'all' || d.regionId === districtRegionFilter,
      ),
    [districts, districtRegionFilter],
  );

  const filteredChurches = useMemo(
    () =>
      churches.filter((c) => {
        if (churchDistrictFilter !== 'all' && c.districtId !== churchDistrictFilter) {
          return false;
        }
        if (churchSearch.trim()) {
          const s = churchSearch.toLowerCase();
          return (
            c.name.toLowerCase().includes(s) ||
            (c.churchCode || '').toLowerCase().includes(s) ||
            (c.treasurerName || '').toLowerCase().includes(s)
          );
        }
        return true;
      }),
    [churches, churchDistrictFilter, churchSearch],
  );

  const handleSeedBaseline = async () => {
    if (!profile) return;
    setSeeding(true);
    try {
      await bootstrapSabahMissionBaseline(profile.uid, profile.displayName);
      notify('Malaysia Union & Sabah Adventist Mission baseline synchronized.', 'success');
    } catch {
      notify('Could not initialize hierarchy baseline.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  // --- USER APPROVAL & MANAGEMENT ---
  const handleUpdateUser = async (
    target: UserProfile,
    updates: Partial<UserProfile>,
    summary: string,
    toastMsg = 'User updated.',
  ) => {
    try {
      await updateDoc(doc(db, 'users', target.uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('UPDATE_USER', 'users', summary, target.uid);
      notify(toastMsg, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${target.uid}`);
    }
  };

  const handleApproveUser = async (u: UserProfile) => {
    if (!profile) return;
    const chosenRole = pendingRoleDrafts[u.uid] || u.userRole || 'user';
    const chosenMissionId =
      pendingMissionDrafts[u.uid] ?? u.missionId ?? profile.missionId ?? missions[0]?.id ?? '';
    const mission = missions.find((m) => m.id === chosenMissionId);
    const chosenDistrictId = pendingDistrictDrafts[u.uid] ?? u.districtId ?? '';
    const district = districts.find((d) => d.id === chosenDistrictId);
    const region = regions.find((r) => r.id === (district?.regionId || u.regionId));

    await handleUpdateUser(
      u,
      {
        approvalStatus: 'approved',
        approvedBy: profile.uid,
        approvalNote: '',
        isActive: true,
        userRole: chosenRole,
        role: chosenRole,
        roleTitle: ROLE_META[chosenRole].label,
        level: ROLE_META[chosenRole].level,
        isAdmin: chosenRole === 'super_admin' || chosenRole === 'admin',
        ...(mission
          ? {
              unionId: mission.unionId || '',
              unionName: mission.unionName || '',
              missionId: mission.id,
              missionName: mission.name,
            }
          : {}),
        ...(region ? { regionId: region.id, regionName: region.name } : {}),
        ...(district ? { districtId: district.id, districtName: district.name } : {}),
      },
      `Approved login for ${u.displayName} (${u.email}) as ${ROLE_META[chosenRole].label}`,
      `${u.displayName} approved for workspace login.`,
    );
  };

  const handleConfirmRejectUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !rejectModalUser) return;
    await handleUpdateUser(
      rejectModalUser,
      {
        approvalStatus: 'rejected',
        approvedBy: profile.uid,
        approvalNote: rejectReason.trim().slice(0, 300),
        isActive: false,
      },
      `Rejected login for ${rejectModalUser.displayName} (${rejectModalUser.email})`,
      `Login access declined for ${rejectModalUser.displayName}.`,
    );
    setRejectModalUser(null);
    setRejectReason('');
  };

  // --- UNION CRUD ---
  const handleSaveUnion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unionName.trim() || !unionCode.trim()) return;
    try {
      if (editingUnion) {
        await updateDoc(doc(db, 'unions', editingUnion.id), {
          name: unionName.trim().slice(0, 120),
          code: unionCode.trim().toUpperCase().slice(0, 24),
          country: unionCountry.trim().slice(0, 80),
          headquarters: unionHq.trim().slice(0, 200),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity('UPDATE_UNION', 'unions', `Updated union ${unionName}`, editingUnion.id);
        setEditingUnion(null);
        notify('Union updated.', 'success');
      } else {
        const ref = await addDoc(collection(db, 'unions'), {
          name: unionName.trim().slice(0, 120),
          code: unionCode.trim().toUpperCase().slice(0, 24),
          country: unionCountry.trim().slice(0, 80),
          headquarters: unionHq.trim().slice(0, 200),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity('CREATE_UNION', 'unions', `Created union ${unionName}`, ref.id);
        notify('Union created.', 'success');
      }
      setUnionName('');
      setUnionCode('');
      setUnionHq('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'unions');
    }
  };

  // --- MISSION CRUD ---
  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionName.trim() || !missionCode.trim()) return;
    const selectedUnionId = missionUnionId || unions[0]?.id || '';
    const selectedUnion = unions.find((u) => u.id === selectedUnionId);
    try {
      const payload = {
        unionId: selectedUnion?.id || '',
        unionName: selectedUnion?.name || '',
        name: missionName.trim().slice(0, 120),
        code: missionCode.trim().toUpperCase().slice(0, 24),
        country: missionCountry.trim().slice(0, 80),
        headquarters: missionHq.trim().slice(0, 200),
        updatedAt: serverTimestamp(),
      };
      if (editingMission) {
        await updateDoc(doc(db, 'missions', editingMission.id), payload);
        await logAdminActivity('UPDATE_MISSION', 'missions', `Updated mission ${missionName}`, editingMission.id);
        setEditingMission(null);
        notify('Mission updated.', 'success');
      } else {
        const ref = await addDoc(collection(db, 'missions'), {
          ...payload,
          isActive: true,
          createdAt: serverTimestamp(),
        });
        await logAdminActivity('CREATE_MISSION', 'missions', `Created mission ${missionName}`, ref.id);
        notify('Mission created.', 'success');
      }
      setMissionName('');
      setMissionCode('');
      setMissionHq('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'missions');
    }
  };

  // --- REGION CRUD ---
  const handleSaveRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    const mId = regionMissionId || missions[0]?.id;
    if (!regionName.trim() || !mId) return;
    try {
      if (editingRegion) {
        await updateDoc(doc(db, 'regions', editingRegion.id), {
          name: regionName.trim().slice(0, 120),
          code: regionCode.trim().toUpperCase().slice(0, 24),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity('UPDATE_REGION', 'regions', `Updated region ${regionName}`, editingRegion.id);
        setEditingRegion(null);
        notify('Region updated.', 'success');
      } else {
        const ref = await addDoc(collection(db, 'regions'), {
          missionId: mId,
          name: regionName.trim().slice(0, 120),
          code: regionCode.trim().toUpperCase().slice(0, 24),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity('CREATE_REGION', 'regions', `Created region ${regionName}`, ref.id);
        notify('Region added.', 'success');
      }
      setRegionName('');
      setRegionCode('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'regions');
    }
  };

  // --- DISTRICT CRUD ---
  const handleSaveDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    const reg = regions.find((r) => r.id === (districtRegionId || regions[0]?.id));
    if (!districtName.trim() || !reg) return;
    try {
      if (editingDistrict) {
        await updateDoc(doc(db, 'districts', editingDistrict.id), {
          regionId: reg.id,
          name: districtName.trim().slice(0, 120),
          districtPastorName: districtPastorName.trim().slice(0, 120),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity('UPDATE_DISTRICT', 'districts', `Updated district ${districtName}`, editingDistrict.id);
        setEditingDistrict(null);
        notify('District updated.', 'success');
      } else {
        const ref = await addDoc(collection(db, 'districts'), {
          missionId: reg.missionId,
          regionId: reg.id,
          name: districtName.trim().slice(0, 120),
          districtPastorName: districtPastorName.trim().slice(0, 120),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity('CREATE_DISTRICT', 'districts', `Created district ${districtName}`, ref.id);
        notify('District added.', 'success');
      }
      setDistrictName('');
      setDistrictPastorName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'districts');
    }
  };

  // --- CHURCH CRUD ---
  const handleSaveChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    const dist = districts.find((d) => d.id === (churchDistrictId || districts[0]?.id));
    if (!churchName.trim() || !dist) return;
    try {
      if (editingChurch) {
        await updateDoc(doc(db, 'churches', editingChurch.id), {
          regionId: dist.regionId,
          districtId: dist.id,
          name: churchName.trim().slice(0, 160),
          churchCode: churchCode.trim().slice(0, 32),
          treasurerName: churchTreasurerName.trim().slice(0, 120),
          memberCount: Math.max(0, Math.round(Number(churchMembers) || 0)),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity('UPDATE_CHURCH', 'churches', `Updated church ${churchName}`, editingChurch.id);
        setEditingChurch(null);
        notify('Church updated.', 'success');
      } else {
        const ref = await addDoc(collection(db, 'churches'), {
          missionId: dist.missionId,
          regionId: dist.regionId,
          districtId: dist.id,
          name: churchName.trim().slice(0, 160),
          churchCode: churchCode.trim().slice(0, 32),
          treasurerName: churchTreasurerName.trim().slice(0, 120),
          memberCount: Math.max(0, Math.round(Number(churchMembers) || 0)),
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity('CREATE_CHURCH', 'churches', `Created church ${churchName}`, ref.id);
        notify('Church added.', 'success');
      }
      setChurchName('');
      setChurchCode('');
      setChurchTreasurerName('');
      setChurchMembers(50);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'churches');
    }
  };

  const handleToggleEntityActive = async (
    col: 'unions' | 'missions' | 'regions' | 'districts' | 'churches',
    id: string,
    nextActive: boolean,
    label: string,
  ) => {
    try {
      await updateDoc(doc(db, col, id), {
        isActive: nextActive,
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity(
        `${nextActive ? 'ACTIVATE' : 'DEACTIVATE'}_${col.toUpperCase()}`,
        col,
        `${nextActive ? 'Activated' : 'Deactivated'} ${label}`,
        id,
      );
      notify(`${label} ${nextActive ? 'activated' : 'deactivated'}.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${col}/${id}`);
    }
  };

  const handleDeleteEntity = async (
    col: 'unions' | 'missions' | 'regions' | 'districts' | 'churches',
    id: string,
    label: string,
  ) => {
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
      {/* Top KPI Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Pending Login Approvals</div>
          <div
            className={`text-2xl font-display font-semibold mt-1 font-mono-tabular ${
              pendingUsers.length > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {pendingUsers.length}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            {pendingUsers.length > 0 ? 'Awaiting administrator decision' : 'All sign-ins reviewed'}
          </div>
        </div>
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Approved Active Accounts</div>
          <div className="text-2xl font-display font-semibold mt-1 font-mono-tabular">
            {approvedActiveCount} / {users.length}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            Verified Google workspace logins
          </div>
        </div>
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Unions & Missions</div>
          <div className="text-2xl font-display font-semibold mt-1 font-mono-tabular">
            {unions.length} · {missions.length}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            Top-level administrative bodies
          </div>
        </div>
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-4">
          <div className="text-xs text-[var(--text-muted)]">Regions · Districts · Churches</div>
          <div className="text-2xl font-display font-semibold mt-1 font-mono-tabular">
            {regions.length} · {districts.length} · {churches.length}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1">
            Field pastoral & church directory
          </div>
        </div>
      </section>

      {/* Toolbar: Segmented Navigation + Baseline Seed */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex flex-wrap p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start gap-0.5">
          {(
            [
              ['approvals', `User Login Approvals (${pendingUsers.length})`],
              ['unions', `Unions (${unions.length})`],
              ['missions', `Missions (${missions.length})`],
              ['regions', `Regions (${regions.length})`],
              ['districts', `Districts (${districts.length})`],
              ['churches', `Churches (${churches.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleSeedBaseline}
          disabled={seeding}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] self-start whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{seeding ? 'Syncing...' : 'Sync MAUM & SAM Baseline'}</span>
        </button>
      </div>

      {/* TAB 1: USER LOGIN APPROVALS & ACCESS CONTROL */}
      {tab === 'approvals' && (
        <div className="space-y-6">
          {/* Pending Login Approval Queue */}
          <section className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold">Pending Login Approvals</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  New Google Sign-In accounts remain pending until an administrator approves workspace access.
                </p>
              </div>
              <span className="text-xs font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap shrink-0">
                {pendingUsers.length} pending
              </span>
            </div>

            {usersError && (
              <div className="p-5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-200 space-y-1">
                <div className="font-semibold">Unable to load user directory from Firestore ({usersError})</div>
                <div>
                  Your active Firebase rules on <span className="font-mono-tabular">pastor-report-e4c52</span> are blocking <span className="font-mono-tabular">users</span> list access for this account. Ensure your user document has <span className="font-mono-tabular">isAdmin: true</span> (or <span className="font-mono-tabular">userRole: &quot;superAdmin&quot;</span>), or publish the updated <span className="font-mono-tabular">firestore.rules</span> in Firebase Console.
                </div>
              </div>
            )}

            {loadingUsers ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                Loading user approval queue...
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No pending login requests. All registered accounts have been reviewed.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {pendingUsers.map((u) => {
                  const draftRole = pendingRoleDrafts[u.uid] || u.userRole || 'user';
                  const draftMissionId =
                    pendingMissionDrafts[u.uid] ?? u.missionId ?? missions[0]?.id ?? '';
                  const draftDistrictId = pendingDistrictDrafts[u.uid] ?? u.districtId ?? '';
                  const missionDistricts = districts.filter(
                    (d) => !draftMissionId || d.missionId === draftMissionId,
                  );

                  return (
                    <div
                      key={u.uid}
                      className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {u.displayName}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {u.email}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <select
                          aria-label={`Assign initial role for ${u.displayName}`}
                          value={draftRole}
                          onChange={(e) =>
                            setPendingRoleDrafts((prev) => ({
                              ...prev,
                              [u.uid]: e.target.value as UserRole,
                            }))
                          }
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                        >
                          {assignableRoles.map(([key, meta]) => (
                            <option key={key} value={key}>
                              {meta.label}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`Assign mission for ${u.displayName}`}
                          value={draftMissionId}
                          onChange={(e) =>
                            setPendingMissionDrafts((prev) => ({
                              ...prev,
                              [u.uid]: e.target.value,
                            }))
                          }
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                        >
                          <option value="">Select Mission...</option>
                          {missions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.code})
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`Assign district for ${u.displayName}`}
                          value={draftDistrictId}
                          onChange={(e) =>
                            setPendingDistrictDrafts((prev) => ({
                              ...prev,
                              [u.uid]: e.target.value,
                            }))
                          }
                          className="px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                        >
                          <option value="">Assign District (Optional)</option>
                          {missionDistricts.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleApproveUser(u)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Approve Login</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRejectModalUser(u);
                            setRejectReason('');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] text-red-600 dark:text-red-400 hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* All Users Table */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start">
                {(
                  [
                    ['all', `All (${users.length})`],
                    ['pending', `Pending (${pendingUsers.length})`],
                    ['approved', 'Approved'],
                    ['rejected', 'Rejected / Suspended'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setApprovalFilter(key)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      approvalFilter === key
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name, email, mission, district..."
                  className="pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] w-72"
                />
              </div>
            </div>

            <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                      <th className="py-3 px-4 font-medium">Account</th>
                      <th className="py-3 px-4 font-medium">Role</th>
                      <th className="py-3 px-4 font-medium">Mission</th>
                      <th className="py-3 px-4 font-medium">District / Church</th>
                      <th className="py-3 px-4 font-medium">Login Status</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {filteredUsers.map((u) => {
                      const isSelf = u.uid === profile?.uid;
                      const status = resolveApprovalStatus(u);
                      const statusLabel =
                        status === 'pending'
                          ? 'Pending Approval'
                          : status === 'rejected'
                            ? 'Declined'
                            : u.isActive
                              ? 'Approved · Active'
                              : 'Suspended';
                      const statusClass =
                        status === 'pending'
                          ? 'text-amber-700 dark:text-amber-400'
                          : status === 'rejected' || !u.isActive
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-700 dark:text-emerald-400';

                      return (
                        <tr key={u.uid} className="hover:bg-[var(--bg-subtle)]/40">
                          <td className="py-3 px-4">
                            <div className="font-medium text-[var(--text-primary)]">
                              {u.displayName}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">{u.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              disabled={
                                isSelf ||
                                (u.userRole === 'super_admin' &&
                                  profile?.userRole !== 'super_admin')
                              }
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
                                    isAdmin:
                                      nextRole === 'super_admin' || nextRole === 'admin',
                                  },
                                  `Changed ${u.displayName} role to ${ROLE_META[nextRole].label}`,
                                );
                              }}
                              className="px-2 py-1 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] disabled:opacity-60"
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
                              value={u.missionId || ''}
                              onChange={(e) => {
                                const m = missions.find((item) => item.id === e.target.value);
                                handleUpdateUser(
                                  u,
                                  {
                                    unionId: m?.unionId || '',
                                    unionName: m?.unionName || '',
                                    missionId: m?.id || '',
                                    missionName: m?.name || '',
                                  },
                                  `Assigned ${u.displayName} to ${m?.name || 'Unassigned'}`,
                                );
                              }}
                              className="px-2 py-1 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] max-w-[170px]"
                            >
                              <option value="">Unassigned</option>
                              {missions.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <select
                                value={u.districtId || ''}
                                onChange={(e) => {
                                  const dist = districts.find(
                                    (d) => d.id === e.target.value,
                                  );
                                  const reg = regions.find(
                                    (r) => r.id === dist?.regionId,
                                  );
                                  handleUpdateUser(
                                    u,
                                    {
                                      districtId: dist?.id || '',
                                      districtName: dist?.name || '',
                                      regionId: reg?.id || '',
                                      regionName: reg?.name || '',
                                    },
                                    `Updated ${u.displayName} district to ${dist?.name || 'None'}`,
                                  );
                                }}
                                className="px-2 py-1 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] max-w-[160px]"
                              >
                                <option value="">No District</option>
                                {districts.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={u.churchId || ''}
                                onChange={(e) => {
                                  const ch = churches.find(
                                    (c) => c.id === e.target.value,
                                  );
                                  handleUpdateUser(
                                    u,
                                    {
                                      churchId: ch?.id || '',
                                      churchName: ch?.name || '',
                                    },
                                    `Updated ${u.displayName} church to ${ch?.name || 'None'}`,
                                  );
                                }}
                                className="px-2 py-1 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] max-w-[160px]"
                              >
                                <option value="">No Church</option>
                                {churches.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs font-medium">
                            <div className={statusClass}>{statusLabel}</div>
                            {u.approvalNote && (
                              <div className="text-[11px] text-[var(--text-muted)] font-normal truncate max-w-[150px]">
                                {u.approvalNote}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {!isSelf && (
                              <div className="inline-flex items-center gap-2 text-xs">
                                {(status !== 'approved' || !u.isActive) && (
                                  <button
                                    type="button"
                                    onClick={() => handleApproveUser(u)}
                                    className="px-2.5 py-1 rounded-md bg-[var(--accent-primary)] text-white font-medium whitespace-nowrap"
                                  >
                                    Approve
                                  </button>
                                )}
                                {status === 'approved' && u.isActive && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateUser(
                                        u,
                                        { isActive: false },
                                        `Suspended workspace access for ${u.displayName}`,
                                        `${u.displayName} suspended.`,
                                      )
                                    }
                                    className="font-medium text-red-600 dark:text-red-400 hover:underline whitespace-nowrap"
                                  >
                                    Suspend
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: UNIONS */}
      {tab === 'unions' && (
        <div className="space-y-5">
          {capabilities.canManageUnions ? (
            <form
              onSubmit={handleSaveUnion}
              className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {editingUnion ? `Edit Union: ${editingUnion.name}` : 'Create Union'}
                </h2>
                {editingUnion && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUnion(null);
                      setUnionName('');
                      setUnionCode('');
                      setUnionHq('');
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Union Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={unionName}
                    onChange={(e) => setUnionName(e.target.value)}
                    placeholder="Malaysia Union Mission"
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
                    maxLength={24}
                    value={unionCode}
                    onChange={(e) => setUnionCode(e.target.value)}
                    placeholder="MAUM"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Headquarters
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={unionHq}
                    onChange={(e) => setUnionHq(e.target.value)}
                    placeholder="Petaling Jaya, Selangor"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px] whitespace-nowrap"
                >
                  {editingUnion ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{editingUnion ? 'Save Union' : 'Add Union'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)]">
              Union creation and editing require Admin or Super Admin privileges.
            </div>
          )}

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Union Name</th>
                  <th className="py-3 px-4 font-medium">Headquarters</th>
                  <th className="py-3 px-4 font-medium text-right">Missions</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {unions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[var(--text-muted)]">
                      No unions configured yet. Add a union above or click Sync MAUM & SAM Baseline.
                    </td>
                  </tr>
                ) : (
                  unions.map((u) => {
                    const missionCount = missions.filter((m) => m.unionId === u.id).length;
                    return (
                      <tr key={u.id} className="hover:bg-[var(--bg-subtle)]/40">
                        <td className="py-3 px-4 font-mono-tabular text-xs font-semibold">
                          {u.code}
                        </td>
                        <td className="py-3 px-4 font-medium">{u.name}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {u.headquarters || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {missionCount}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span
                            className={
                              u.isActive
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-[var(--text-muted)]'
                            }
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {capabilities.canManageUnions && (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUnion(u);
                                  setUnionName(u.name);
                                  setUnionCode(u.code);
                                  setUnionCountry(u.country || 'Malaysia');
                                  setUnionHq(u.headquarters || '');
                                }}
                                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                aria-label={`Edit ${u.name}`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleEntityActive('unions', u.id, !u.isActive, u.name)
                                }
                                className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              >
                                {u.isActive ? 'Disable' : 'Enable'}
                              </button>
                              {profile?.userRole === 'super_admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntity('unions', u.id, u.name)}
                                  className="p-1 text-red-600 dark:text-red-400"
                                  aria-label={`Delete ${u.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MISSIONS */}
      {tab === 'missions' && (
        <div className="space-y-5">
          {capabilities.canManageMissions && (
            <form
              onSubmit={handleSaveMission}
              className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {editingMission ? `Edit Mission: ${editingMission.name}` : 'Create Mission'}
                </h2>
                {editingMission && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMission(null);
                      setMissionName('');
                      setMissionCode('');
                      setMissionHq('');
                    }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Parent Union
                  </label>
                  <select
                    value={missionUnionId || unions[0]?.id || ''}
                    onChange={(e) => setMissionUnionId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  >
                    <option value="">No Union Linked</option>
                    {unions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Mission Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
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
                    maxLength={24}
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
                    maxLength={200}
                    value={missionHq}
                    onChange={(e) => setMissionHq(e.target.value)}
                    placeholder="Tamparuli, Sabah"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px] whitespace-nowrap"
                >
                  {editingMission ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{editingMission ? 'Save Mission' : 'Add Mission'}</span>
                </button>
              </div>
            </form>
          )}

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Mission</th>
                  <th className="py-3 px-4 font-medium">Parent Union</th>
                  <th className="py-3 px-4 font-medium">Headquarters</th>
                  <th className="py-3 px-4 font-medium text-right">Regions · Churches</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {missions.map((m) => {
                  const rCount = regions.filter((r) => r.missionId === m.id).length;
                  const cCount = churches.filter((c) => c.missionId === m.id).length;
                  const unionLabel =
                    unions.find((u) => u.id === m.unionId)?.name || m.unionName || '—';
                  return (
                    <tr key={m.id} className="hover:bg-[var(--bg-subtle)]/40">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold">
                        {m.code}
                      </td>
                      <td className="py-3 px-4 font-medium">{m.name}</td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {unionLabel}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {m.headquarters || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-xs">
                        {rCount} · {cCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {capabilities.canManageMissions && (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMission(m);
                                setMissionUnionId(m.unionId || '');
                                setMissionName(m.name);
                                setMissionCode(m.code);
                                setMissionCountry(m.country || 'Malaysia');
                                setMissionHq(m.headquarters || '');
                              }}
                              className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              aria-label={`Edit ${m.name}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {profile?.userRole === 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteEntity('missions', m.id, m.name)}
                                className="p-1 text-red-600 dark:text-red-400"
                                aria-label={`Delete ${m.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REGIONS */}
      {tab === 'regions' && (
        <div className="space-y-5">
          <form
            onSubmit={handleSaveRegion}
            className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {editingRegion ? `Edit Region: ${editingRegion.name}` : 'Add Region'}
              </h2>
              {editingRegion && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingRegion(null);
                    setRegionName('');
                    setRegionCode('');
                  }}
                  className="text-xs text-[var(--text-muted)]"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Mission
                </label>
                <select
                  disabled={Boolean(editingRegion)}
                  value={regionMissionId || missions[0]?.id || ''}
                  onChange={(e) => setRegionMissionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] disabled:opacity-60"
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
                  maxLength={120}
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  placeholder="e.g. West Coast Region"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Code
                </label>
                <input
                  type="text"
                  maxLength={24}
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  placeholder="WCR"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px] whitespace-nowrap"
              >
                {editingRegion ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingRegion ? 'Save Region' : 'Add Region'}</span>
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-3">
            <select
              value={regionMissionFilter}
              onChange={(e) => setRegionMissionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Missions</option>
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--text-muted)] font-mono-tabular">
              {filteredRegions.length} regions
            </span>
          </div>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Region</th>
                  <th className="py-3 px-4 font-medium">Mission</th>
                  <th className="py-3 px-4 font-medium text-right">Districts · Churches</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {filteredRegions.map((r) => {
                  const dCount = districts.filter((d) => d.regionId === r.id).length;
                  const cCount = churches.filter((c) => c.regionId === r.id).length;
                  return (
                    <tr key={r.id} className="hover:bg-[var(--bg-subtle)]/40">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold">
                        {r.code || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium">{r.name}</td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {missions.find((m) => m.id === r.missionId)?.name || r.missionId}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-xs">
                        {dCount} · {cCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRegion(r);
                              setRegionMissionId(r.missionId);
                              setRegionName(r.name);
                              setRegionCode(r.code || '');
                            }}
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            aria-label={`Edit ${r.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntity('regions', r.id, r.name)}
                            className="p-1 text-red-600 dark:text-red-400"
                            aria-label={`Delete ${r.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* TAB 5: DISTRICTS */}
      {tab === 'districts' && (
        <div className="space-y-5">
          <form
            onSubmit={handleSaveDistrict}
            className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {editingDistrict ? `Edit District: ${editingDistrict.name}` : 'Add District'}
              </h2>
              {editingDistrict && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDistrict(null);
                    setDistrictName('');
                    setDistrictPastorName('');
                  }}
                  className="text-xs text-[var(--text-muted)]"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Region
                </label>
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
                  maxLength={120}
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  placeholder="e.g. Tamparuli District"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  District Pastor
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={districtPastorName}
                  onChange={(e) => setDistrictPastorName(e.target.value)}
                  placeholder="Pr. Name"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px] whitespace-nowrap"
              >
                {editingDistrict ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingDistrict ? 'Save District' : 'Add District'}</span>
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between gap-3">
            <select
              value={districtRegionFilter}
              onChange={(e) => setDistrictRegionFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Regions</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--text-muted)] font-mono-tabular">
              {filteredDistricts.length} districts
            </span>
          </div>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">District</th>
                  <th className="py-3 px-4 font-medium">Region</th>
                  <th className="py-3 px-4 font-medium">District Pastor</th>
                  <th className="py-3 px-4 font-medium text-right">Churches</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {filteredDistricts.map((d) => {
                  const cCount = churches.filter((c) => c.districtId === d.id).length;
                  return (
                    <tr key={d.id} className="hover:bg-[var(--bg-subtle)]/40">
                      <td className="py-3 px-4 font-medium">{d.name}</td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {regions.find((r) => r.id === d.regionId)?.name || d.regionId}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {d.districtPastorName || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-xs">
                        {cCount}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDistrict(d);
                              setDistrictRegionId(d.regionId);
                              setDistrictName(d.name);
                              setDistrictPastorName(d.districtPastorName || '');
                            }}
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            aria-label={`Edit ${d.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntity('districts', d.id, d.name)}
                            className="p-1 text-red-600 dark:text-red-400"
                            aria-label={`Delete ${d.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* TAB 6: CHURCHES */}
      {tab === 'churches' && (
        <div className="space-y-5">
          <form
            onSubmit={handleSaveChurch}
            className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {editingChurch ? `Edit Church: ${editingChurch.name}` : 'Add Church'}
              </h2>
              {editingChurch && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingChurch(null);
                    setChurchName('');
                    setChurchCode('');
                    setChurchTreasurerName('');
                    setChurchMembers(50);
                  }}
                  className="text-xs text-[var(--text-muted)]"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  District *
                </label>
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
                  maxLength={160}
                  value={churchName}
                  onChange={(e) => setChurchName(e.target.value)}
                  placeholder="e.g. Kiulu SDA Church"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Code
                </label>
                <input
                  type="text"
                  maxLength={32}
                  value={churchCode}
                  onChange={(e) => setChurchCode(e.target.value)}
                  placeholder="SAM-015"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Members
                </label>
                <input
                  type="number"
                  min={0}
                  max={100000}
                  value={churchMembers}
                  onChange={(e) => setChurchMembers(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white h-[38px] whitespace-nowrap"
              >
                {editingChurch ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingChurch ? 'Save Church' : 'Add Church'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Church Treasurer Name (Optional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={churchTreasurerName}
                  onChange={(e) => setChurchTreasurerName(e.target.value)}
                  placeholder="Assigned treasurer name"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
            </div>
          </form>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <select
              value={churchDistrictFilter}
              onChange={(e) => setChurchDistrictFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] self-start"
            >
              <option value="all">All Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={churchSearch}
                onChange={(e) => setChurchSearch(e.target.value)}
                placeholder="Search church or code..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] w-64"
              />
            </div>
          </div>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">Church</th>
                    <th className="py-3 px-4 font-medium">District</th>
                    <th className="py-3 px-4 font-medium">Region</th>
                    <th className="py-3 px-4 font-medium">Treasurer</th>
                    <th className="py-3 px-4 font-medium text-right">Members</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {filteredChurches.map((c) => (
                    <tr key={c.id} className="hover:bg-[var(--bg-subtle)]/40">
                      <td className="py-3 px-4 font-mono-tabular text-xs font-semibold">
                        {c.churchCode || '—'}
                      </td>
                      <td className="py-3 px-4 font-medium">{c.name}</td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {districts.find((d) => d.id === c.districtId)?.name || c.districtId}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {regions.find((r) => r.id === c.regionId)?.name || c.regionId}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {c.treasurerName || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {c.memberCount ?? 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingChurch(c);
                              setChurchDistrictId(c.districtId);
                              setChurchName(c.name);
                              setChurchCode(c.churchCode || '');
                              setChurchTreasurerName(c.treasurerName || '');
                              setChurchMembers(c.memberCount ?? 0);
                            }}
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            aria-label={`Edit ${c.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntity('churches', c.id, c.name)}
                            className="p-1 text-red-600 dark:text-red-400"
                            aria-label={`Delete ${c.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reject Login Modal */}
      {rejectModalUser && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-semibold">Decline Login Request</h3>
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Declining login prevents <span className="font-semibold">{rejectModalUser.displayName}</span> ({rejectModalUser.email}) from entering the workspace until re-approved.
            </p>
            <form onSubmit={handleConfirmRejectUser} className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Reason / Note (Optional)
                </label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Please verify your Sabah Adventist Mission district with the Ministerial Secretary."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalUser(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
