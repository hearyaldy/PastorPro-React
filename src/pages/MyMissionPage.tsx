import { useHierarchyLabels } from '../hooks/useHierarchyLabels';
import { MissionReportingDashboard, type MissionReportContext } from '../components/MissionReportingDashboard';
import { assignedMission, hasAlias, missionEntities } from '../lib/missionReporting';
import { StatisticsCards } from '../components/StatisticsCards';
import { ReportPreview } from '../components/ReportPreview';
import type { PrintableReport } from '../lib/pdfReport';
import { useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Search,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { formatIsoDate } from '../lib/exportUtils';
import type { NavRouteId } from '../components/WorkspaceShell';

export function MyMissionPage({
  onNavigate, onReportNavigate,
}: {
  onNavigate: (route: NavRouteId) => void;
  onReportNavigate: (route: 'borang-b' | 'financial-reports', context: MissionReportContext) => void;
}) {
  const labels = useHierarchyLabels();
  const { profile } = useAuth();
  const [preview, setPreview] = useState<PrintableReport | null>(null);
  const {
    unions,
    missions,
    regions,
    districts,
    churches,
    staff,
    departments,
    globalEvents,
    loadingHierarchy,
  } = useMission();

  const [selectedMissionId, setSelectedMissionId] = useState<string>('');
  const [tab, setTab] = useState<'overview' | 'districts' | 'churches' | 'staff'>('overview');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const activeMission = useMemo(() => {
    if (!profile) return null;
    if (profile.userRole === 'super_admin' && selectedMissionId) return missions.find(mission => mission.id === selectedMissionId) || null;
    return assignedMission(profile, missions);
  }, [selectedMissionId, profile, missions]);
  const entities = useMemo(() => activeMission ? missionEntities(activeMission, districts, churches, staff) : { districts: [], churches: [], staff: [] }, [activeMission, districts, churches, staff]);

  const parentUnion = useMemo(() => {
    if (!activeMission?.unionId) return null;
    return unions.find((u) => u.id === activeMission.unionId) || null;
  }, [activeMission, unions]);

  const missionRegions = useMemo(
    () => regions.filter((r) => activeMission && hasAlias(r.missionId, activeMission)),
    [regions, activeMission],
  );

  const missionDistricts = useMemo(
    () => entities.districts,
    [entities],
  );

  const missionChurches = useMemo(
    () => entities.churches,
    [entities],
  );

  const missionStaff = useMemo(
    () => entities.staff,
    [entities],
  );

  const missionDepartments = useMemo(
    () => departments.filter((d) => activeMission && hasAlias(d.missionId, activeMission)),
    [departments, activeMission],
  );

  const missionEvents = useMemo(
    () => globalEvents.filter((e) => activeMission && hasAlias(e.missionId, activeMission)),
    [globalEvents, activeMission],
  );

  const totalMembers = useMemo(
    () => missionChurches.reduce((acc, c) => acc + (c.memberCount || 0), 0),
    [missionChurches],
  );

  const filteredDistricts = useMemo(() => {
    return missionDistricts.filter((d) => {
      if (regionFilter !== 'all' && d.regionId !== regionFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          d.name.toLowerCase().includes(s) ||
          (d.districtPastorName || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [missionDistricts, regionFilter, search]);

  const filteredChurches = useMemo(() => {
    return missionChurches.filter((c) => {
      if (regionFilter !== 'all' && c.regionId !== regionFilter) return false;
      if (districtFilter !== 'all' && c.districtId !== districtFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(s) ||
          (c.churchCode || '').toLowerCase().includes(s) ||
          (c.treasurerName || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [missionChurches, regionFilter, districtFilter, search]);

  const filteredStaff = useMemo(() => {
    return missionStaff.filter((s) => {
      if (districtFilter !== 'all' && s.districtId !== districtFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.position.toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [missionStaff, districtFilter, search]);

  return (
    <div className="space-y-6">
      {/* Mission Banner Header */}
      <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <Globe2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{parentUnion ? `${parentUnion.name} (${parentUnion.code})` : 'Malaysia Union Mission'}</span>
            {activeMission?.country && (
              <>
                <span aria-hidden="true">·</span>
                <span>{activeMission.country}</span>
              </>
            )}
          </div>
          <h2 className="text-xl font-display font-semibold tracking-tight">
            {activeMission ? `${activeMission.name} (${activeMission.code})` : 'Mission Directory'}
          </h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
            {activeMission?.headquarters && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>HQ: {activeMission.headquarters}</span>
              </span>
            )}
            <span>
              Your Assignment: {labels.region(profile?.regionId, profile?.regionName)} ·{' '}
              {labels.district(profile?.districtId, profile?.districtName)}
            </span>
          </div>
        </div>

        {profile?.userRole === 'super_admin' && (
          <div className="shrink-0">
            <label className="block text-[11px] text-[var(--text-muted)] mb-1">
              Viewing Mission
            </label>
            <select
              value={selectedMissionId}
              onChange={(e) => {
                setSelectedMissionId(e.target.value);
                setRegionFilter('all');
                setDistrictFilter('all');
              }}
              className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
            >
              <option value="">My assigned mission</option>
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!loadingHierarchy && !activeMission && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 p-5">Your account has no matching mission assignment. Ask an administrator to assign your mission{profile?.userRole === 'super_admin' ? ', or select a mission above' : ''}.</div>}
      {activeMission && profile && <MissionReportingDashboard key={`${profile.uid}:${profile.userRole}:${activeMission.id}`} profile={profile} mission={activeMission} districts={missionDistricts} churches={missionChurches}
        onBorang={context => onReportNavigate('borang-b', context)} onFinance={context => onReportNavigate('financial-reports', context)} />}
      <h3 className="font-semibold">Mission Directory · {activeMission?.name || 'No mission assigned'}</h3>
      <StatisticsCards items={[
        { label: 'Regions & Districts', value: `${missionRegions.length} / ${missionDistricts.length}`, icon: 'distance', color: 'blue' },
        { label: 'Organized Churches', value: missionChurches.length, icon: 'people', color: 'purple' },
        { label: 'Reported Membership', value: totalMembers.toLocaleString(), icon: 'people', color: 'green' },
        { label: 'Mission Workers', value: missionStaff.length, icon: 'people', color: 'orange' },
      ]} />
      <button className="no-print text-xs border border-[var(--border-hairline)] rounded-lg px-3 py-2" onClick={() => setPreview({
        title: 'Mission Statistics & Directory', subtitle: activeMission?.name || '', filename: 'Mission_Statistics',
        summary: [['Churches', missionChurches.length], ['Membership', totalMembers], ['Workers', missionStaff.length]],
        sections: [{ title: 'Churches', columns: ['Church', 'District', 'Membership'], rows: missionChurches.map(church => [church.name, labels.district(church.districtId), church.memberCount || 0]) },
          { title: 'Mission Workers', columns: ['Name', 'Position', 'Email'], rows: missionStaff.map(member => [member.fullName, member.position, member.email || '-']) }],
      })}>Preview / Print Mission Statistics</button>
      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}

      {/* Segmented Tabs + Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start overflow-x-auto max-w-full">
          {(
            [
              ['overview', 'Mission Overview'],
              ['districts', `Districts (${missionDistricts.length})`],
              ['churches', `Churches (${missionChurches.length})`],
              ['staff', `Staff & Pastors (${missionStaff.length})`],
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

        {tab !== 'overview' && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search directory..."
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] w-56"
              />
            </div>
            {(tab === 'districts' || tab === 'churches') && (
              <select
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setDistrictFilter('all');
                }}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
              >
                <option value="all">All Regions</option>
                {missionRegions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            {(tab === 'churches' || tab === 'staff') && (
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
              >
                <option value="all">All Districts</option>
                {missionDistricts
                  .filter((d) => regionFilter === 'all' || d.regionId === regionFilter)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* TAB: OVERVIEW */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Regions & Departments */}
          <section className="lg:col-span-7 space-y-6">
            <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[var(--accent-primary)]" />
                  <h3 className="text-sm font-semibold">Regions & Pastoral Coverage</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('districts')}
                  className="text-xs font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap shrink-0"
                >
                  Browse districts
                </button>
              </div>
              {loadingHierarchy ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 rounded bg-[var(--bg-subtle)] animate-pulse" />
                  ))}
                </div>
              ) : missionRegions.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  No regions configured for this mission yet.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {missionRegions.map((reg) => {
                    const regDistricts = missionDistricts.filter((d) => d.regionId === reg.id);
                    const regChurches = missionChurches.filter((c) => c.regionId === reg.id);
                    return (
                      <div key={reg.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium">{reg.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {reg.code || 'Region'}
                          </div>
                        </div>
                        <div className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                          {regDistricts.length} Districts · {regChurches.length} Churches
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
                <h3 className="text-sm font-semibold">Mission Departments</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('departments')}
                  className="text-xs font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap shrink-0"
                >
                  View all departments
                </button>
              </div>
              {missionDepartments.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  No departments listed yet.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {missionDepartments.slice(0, 6).map((dept) => (
                    <div key={dept.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{dept.name}</div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          {dept.code || 'DEPT'} · {dept.directorName || 'Mission Department'}
                        </div>
                      </div>
                      {dept.resourceUrl && (
                        <a
                          href={dept.resourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap shrink-0"
                        >
                          <span>Portal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Mission Events & Resources */}
          <section className="lg:col-span-5 space-y-6">
            <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[var(--accent-primary)]" />
                  <h3 className="text-sm font-semibold">Mission Calendar Events</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('calendar')}
                  className="text-xs font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap shrink-0"
                >
                  Open calendar
                </button>
              </div>
              {missionEvents.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                  No upcoming mission-wide events posted.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {missionEvents.slice(0, 5).map((ev) => (
                    <div key={ev.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{ev.title}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">
                          {ev.category} · {ev.location || 'Mission-wide'}
                        </div>
                      </div>
                      <span className="text-xs font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap shrink-0">
                        {formatIsoDate(ev.startDate)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                <h3 className="text-sm font-semibold">Quick Directory Access</h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Look up district pastors, church treasurers, membership counts, and official manuals across your mission field.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTab('staff')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
                >
                  View Staff Directory
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('resources-settings')}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
                >
                  Open Resource Library
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB: DISTRICTS */}
      {tab === 'districts' && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          {filteredDistricts.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--text-muted)]">
              No districts match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">District</th>
                    <th className="py-3 px-4 font-medium">Region</th>
                    <th className="py-3 px-4 font-medium">District Pastor</th>
                    <th className="py-3 px-4 font-medium text-right">Churches</th>
                    <th className="py-3 px-4 font-medium text-right">Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {filteredDistricts.map((d) => {
                    const reg = missionRegions.find((r) => r.id === d.regionId);
                    const distChurches = missionChurches.filter((c) => c.districtId === d.id);
                    const members = distChurches.reduce((acc, c) => acc + (c.memberCount || 0), 0);
                    return (
                      <tr key={d.id} className="hover:bg-[var(--bg-subtle)]/50">
                        <td className="py-3 px-4 font-medium">{d.name}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {reg?.name || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {d.districtPastorName || 'Unassigned'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {distChurches.length}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {members.toLocaleString()}
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

      {/* TAB: CHURCHES */}
      {tab === 'churches' && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          {filteredChurches.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--text-muted)]">
              No churches match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Church</th>
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">District</th>
                    <th className="py-3 px-4 font-medium">Region</th>
                    <th className="py-3 px-4 font-medium">Treasurer</th>
                    <th className="py-3 px-4 font-medium text-right">Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {filteredChurches.map((c) => {
                    const dist = missionDistricts.find((d) => d.id === c.districtId);
                    const reg = missionRegions.find((r) => r.id === c.regionId);
                    return (
                      <tr key={c.id} className="hover:bg-[var(--bg-subtle)]/50">
                        <td className="py-3 px-4 font-medium">{c.name}</td>
                        <td className="py-3 px-4 text-xs font-mono-tabular text-[var(--text-muted)]">
                          {c.churchCode || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {dist?.name || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {reg?.name || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {c.treasurerName || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {(c.memberCount ?? 0).toLocaleString()}
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

      {/* TAB: STAFF & PASTORS */}
      {tab === 'staff' && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          {filteredStaff.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--text-muted)]">
              No mission staff records match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Position</th>
                    <th className="py-3 px-4 font-medium">District</th>
                    <th className="py-3 px-4 font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {filteredStaff.map((s) => {
                    const dist = missionDistricts.find((d) => d.id === s.districtId);
                    return (
                      <tr key={s.id} className="hover:bg-[var(--bg-subtle)]/50">
                        <td className="py-3 px-4 font-medium">{s.fullName}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {s.position}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {dist?.name || 'Mission Office'}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-muted)]">
                          <div className="flex flex-wrap items-center gap-3">
                            {s.email && (
                              <a
                                href={`mailto:${s.email}`}
                                className="inline-flex items-center gap-1 hover:text-[var(--accent-primary)]"
                              >
                                <Mail className="w-3 h-3" />
                                <span>{s.email}</span>
                              </a>
                            )}
                            {s.phone && (
                              <a
                                href={`tel:${s.phone}`}
                                className="inline-flex items-center gap-1 font-mono-tabular hover:text-[var(--accent-primary)]"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{s.phone}</span>
                              </a>
                            )}
                            {!s.email && !s.phone && <span>—</span>}
                          </div>
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
    </div>
  );
}
