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
  Activity,
  BookOpen,
  Building2,
  CheckSquare,
  Edit3,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType, reportListenerError } from '../lib/firebase';
import { MONTHS } from '../lib/exportUtils';
import { useToast } from '../components/Toast';
import type { NavRouteId } from '../components/WorkspaceShell';
import type { BorangBReport, MinistryTeamMember, PastoralActivity } from '../types';

const TEAM_ROLES = [
  'Head Elder',
  'Elder',
  'Head Deacon',
  'Deaconess',
  'Church Treasurer',
  'Church Clerk',
  'SSPM Leader',
  'Youth Leader',
  'Stewardship Leader',
  'Women\'s Ministry Leader',
  'Children\'s Ministry Leader',
  'Ministry Team Member',
];

export function MyMinistryPage({
  onNavigate,
}: {
  onNavigate: (route: NavRouteId) => void;
}) {
  const { profile } = useAuth();
  const { missions, districts, churches } = useMission();
  const { notify } = useToast();

  const [tab, setTab] = useState<'team' | 'churches' | 'summary'>('team');
  const [team, setTeam] = useState<MinistryTeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [recentActivities, setRecentActivities] = useState<PastoralActivity[]>([]);
  const [currentBorangB, setCurrentBorangB] = useState<BorangBReport | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [churchFilter, setChurchFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'elders' | 'deacons' | 'leaders'>('all');

  // Team member modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MinistryTeamMember | null>(null);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Elder');
  const [churchId, setChurchId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  useEffect(() => {
    if (!profile) return;
    setLoadingTeam(true);
    const unsubs = [
      onSnapshot(
        query(
          collection(db, 'ministry_team'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as Omit<MinistryTeamMember, 'id'>),
            }))
            .sort((a, b) => String(a.fullName || '').localeCompare(String(b.fullName || '')));
          setTeam(items);
          setLoadingTeam(false);
        },
        (err) => {
          setLoadingTeam(false);
          reportListenerError(err, OperationType.LIST, 'ministry_team');
        },
      ),
      onSnapshot(
        query(
          collection(db, 'activities'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as Omit<PastoralActivity, 'id'>),
            }))
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
          setRecentActivities(items);
        },
        (err) => {
          reportListenerError(err, OperationType.LIST, 'activities');
        },
      ),
      onSnapshot(
        query(
          collection(db, 'borang_b_reports'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          const match = snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as Omit<BorangBReport, 'id'>),
            }))
            .find((r) => r.year === currentYear && r.month === currentMonth);
          setCurrentBorangB(match || null);
        },
        (err) => {
          reportListenerError(err, OperationType.LIST, 'borang_b_reports');
        },
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [profile, currentYear, currentMonth]);

  const myDistrict = useMemo(
    () => districts.find((d) => d.id === profile?.districtId) || null,
    [districts, profile?.districtId],
  );

  const districtChurches = useMemo(() => {
    if (profile?.districtId) {
      return churches.filter((c) => c.districtId === profile.districtId);
    }
    if (profile?.missionId) {
      return churches.filter((c) => c.missionId === profile.missionId);
    }
    return churches;
  }, [churches, profile?.districtId, profile?.missionId]);

  const totalDistrictMembers = useMemo(
    () => districtChurches.reduce((acc, c) => acc + (c.memberCount || 0), 0),
    [districtChurches],
  );

  const elderCount = useMemo(
    () => team.filter((m) => m.isActive && m.role.toLowerCase().includes('elder')).length,
    [team],
  );

  const filteredTeam = useMemo(() => {
    return team.filter((m) => {
      if (churchFilter !== 'all' && m.churchId !== churchFilter) return false;
      const lowerRole = m.role.toLowerCase();
      if (roleFilter === 'elders' && !lowerRole.includes('elder')) return false;
      if (roleFilter === 'deacons' && !lowerRole.includes('deacon')) return false;
      if (
        roleFilter === 'leaders' &&
        (lowerRole.includes('elder') || lowerRole.includes('deacon'))
      ) {
        return false;
      }
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          m.fullName.toLowerCase().includes(s) ||
          m.role.toLowerCase().includes(s) ||
          (m.churchName || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [team, churchFilter, roleFilter, search]);

  const openCreateModal = () => {
    setEditing(null);
    setFullName('');
    setRole('Elder');
    setChurchId(profile?.churchId || districtChurches[0]?.id || '');
    setPhone('');
    setEmail('');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (member: MinistryTeamMember) => {
    setEditing(member);
    setFullName(member.fullName);
    setRole(member.role);
    setChurchId(member.churchId || '');
    setPhone(member.phone || '');
    setEmail(member.email || '');
    setNotes(member.notes || '');
    setModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !fullName.trim()) return;
    const missionId = profile.missionId || missions[0]?.id || 'sam_sabah';
    const selectedChurch = churches.find((c) => c.id === churchId);
    setSaving(true);
    try {
      const payload = {
        userId: profile.uid,
        missionId,
        districtId: selectedChurch?.districtId || profile.districtId || '',
        churchId: selectedChurch?.id || '',
        churchName: selectedChurch?.name || '',
        fullName: fullName.trim().slice(0, 120),
        role: role.trim().slice(0, 80) || 'Ministry Team Member',
        phone: phone.trim().slice(0, 40),
        email: email.trim().slice(0, 200),
        notes: notes.trim().slice(0, 1000),
        isActive: editing ? editing.isActive : true,
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        await updateDoc(doc(db, 'ministry_team', editing.id), payload);
        notify('Ministry team member updated.', 'success');
      } else {
        await addDoc(collection(db, 'ministry_team'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        notify('Ministry team member added.', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      handleFirestoreError(
        err,
        editing ? OperationType.UPDATE : OperationType.CREATE,
        editing ? `ministry_team/${editing.id}` : 'ministry_team',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: MinistryTeamMember) => {
    try {
      await updateDoc(doc(db, 'ministry_team', member.id), {
        isActive: !member.isActive,
        updatedAt: serverTimestamp(),
      });
      notify(
        `${member.fullName} marked ${!member.isActive ? 'active' : 'inactive'}.`,
        'info',
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ministry_team/${member.id}`);
    }
  };

  const handleDeleteMember = async (member: MinistryTeamMember) => {
    try {
      await deleteDoc(doc(db, 'ministry_team', member.id));
      notify(`${member.fullName} removed from ministry team.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `ministry_team/${member.id}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Ministry Assignment Header */}
      <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-[var(--text-muted)]">
            {profile?.missionName || 'Mission Unassigned'} ·{' '}
            {profile?.regionName || 'Region Unassigned'}
          </div>
          <h2 className="text-xl font-display font-semibold tracking-tight">
            {myDistrict ? `${myDistrict.name} Ministry` : 'My Pastoral Ministry'}
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            {profile?.churchName
              ? `Primary Church: ${profile.churchName}`
              : 'Manage your local church elders, ministry leaders, and assigned congregations.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
          >
            Update Assignment
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Elder / Team Member</span>
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-hairline)]">
        <div className="px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">Assigned Churches</div>
          <div className="text-xl font-mono-tabular font-semibold mt-1">
            {districtChurches.length}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">District Membership</div>
          <div className="text-xl font-mono-tabular font-semibold mt-1">
            {totalDistrictMembers.toLocaleString()}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">Elders & Ministry Team</div>
          <div className="text-xl font-mono-tabular font-semibold mt-1">
            {elderCount} Elders · {team.length} Total
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">
            {MONTHS[currentMonth - 1]} Borang B
          </div>
          <div className="text-xl font-display font-semibold mt-1">
            {currentBorangB
              ? currentBorangB.status === 'submitted'
                ? 'Submitted'
                : 'Draft Saved'
              : 'Not Started'}
          </div>
        </div>
      </div>

      {/* Tabs + Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start">
          {(
            [
              ['team', `Ministry Team & Elders (${team.length})`],
              ['churches', `District Churches (${districtChurches.length})`],
              ['summary', 'Ministry Workflows'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'team' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search elder or leader..."
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] w-52"
              />
            </div>
            <select
              value={churchFilter}
              onChange={(e) => setChurchFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Churches</option>
              {districtChurches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as 'all' | 'elders' | 'deacons' | 'leaders')
              }
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Roles</option>
              <option value="elders">Elders</option>
              <option value="deacons">Deacons / Deaconesses</option>
              <option value="leaders">Department Leaders</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB: MINISTRY TEAM & ELDERS */}
      {tab === 'team' && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          {loadingTeam ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded bg-[var(--bg-subtle)] animate-pulse" />
              ))}
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <Users className="w-7 h-7 text-[var(--text-muted)] mx-auto" />
              <div className="text-sm font-medium">
                {team.length === 0
                  ? 'No church elders or ministry team members recorded yet'
                  : 'No team members match your filters'}
              </div>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                Keep track of your local church elders, head deacons, treasurers, and ministry leaders so you can coordinate visitations and church board meetings easily.
              </p>
              {team.length === 0 && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Elder / Leader</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Ministry Role</th>
                    <th className="py-3 px-4 font-medium">Church</th>
                    <th className="py-3 px-4 font-medium">Contact</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {filteredTeam.map((member) => (
                    <tr key={member.id} className="hover:bg-[var(--bg-subtle)]/50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{member.fullName}</div>
                        {member.notes && (
                          <div className="text-xs text-[var(--text-muted)] truncate max-w-[260px]">
                            {member.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {member.role}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                        {member.churchName || 'District-wide'}
                      </td>
                      <td className="py-3 px-4 text-xs text-[var(--text-muted)]">
                        <div className="flex flex-wrap items-center gap-3">
                          {member.phone && (
                            <a
                              href={`tel:${member.phone}`}
                              className="inline-flex items-center gap-1 font-mono-tabular hover:text-[var(--accent-primary)]"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{member.phone}</span>
                            </a>
                          )}
                          {member.email && (
                            <a
                              href={`mailto:${member.email}`}
                              className="inline-flex items-center gap-1 hover:text-[var(--accent-primary)]"
                            >
                              <Mail className="w-3 h-3" />
                              <span>{member.email}</span>
                            </a>
                          )}
                          {!member.phone && !member.email && <span>—</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(member)}
                          className={`font-medium ${
                            member.isActive
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            aria-label="Edit team member"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(member)}
                            className="p-1 text-red-600 dark:text-red-400"
                            aria-label="Delete team member"
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
          )}
        </div>
      )}

      {/* TAB: DISTRICT CHURCHES */}
      {tab === 'churches' && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          {districtChurches.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--text-muted)]">
              No churches found for your assigned district yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Church</th>
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">Church Treasurer</th>
                    <th className="py-3 px-4 font-medium text-right">Elders / Team</th>
                    <th className="py-3 px-4 font-medium text-right">Membership</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {districtChurches.map((ch) => {
                    const teamCount = team.filter((m) => m.churchId === ch.id && m.isActive).length;
                    return (
                      <tr key={ch.id} className="hover:bg-[var(--bg-subtle)]/50">
                        <td className="py-3 px-4 font-medium">{ch.name}</td>
                        <td className="py-3 px-4 text-xs font-mono-tabular text-[var(--text-muted)]">
                          {ch.churchCode || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {ch.treasurerName || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {teamCount}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {(ch.memberCount ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: MINISTRY WORKFLOWS */}
      {tab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('activities')}
            className="text-left p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors space-y-2"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Pastoral Activities ({recentActivities.length})</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Log home visitations, hospital visits, Bible studies, evangelistic meetings, and counseling sessions.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('borang-b')}
            className="text-left p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors space-y-2"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{MONTHS[currentMonth - 1]} Borang B</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Complete and submit your monthly ministerial report to the Mission Ministerial Secretary.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('appointments-todos')}
            className="text-left p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors space-y-2"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckSquare className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Appointments & To-Do</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Coordinate pastoral appointments with elders and track upcoming follow-up tasks.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('my-mission')}
            className="text-left p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors space-y-2"
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>My Mission Directory</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Explore Mission headquarters, regions, sister districts, churches, and fellow mission pastors.
            </p>
          </button>
        </div>
      )}

      {/* ADD / EDIT TEAM MEMBER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <h3 className="text-base font-display font-semibold">
                {editing ? 'Edit Team Member' : 'Add Elder / Ministry Leader'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveMember} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Elder John Petrus"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Role / Office *
                  </label>
                  <select
                    value={TEAM_ROLES.includes(role) ? role : '__custom'}
                    onChange={(e) => {
                      if (e.target.value !== '__custom') setRole(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  >
                    {TEAM_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Local Church
                  </label>
                  <select
                    value={churchId}
                    onChange={(e) => setChurchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  >
                    <option value="">District-wide</option>
                    {districtChurches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    maxLength={200}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="elder@church.org"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Notes / Ministry Focus
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Care group area, Sabbath preaching rotation, visitation notes..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
