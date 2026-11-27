import { useHierarchyLabels } from '../hooks/useHierarchyLabels';
import { BORANG_B_SECTIONS } from '../lib/borangB';
import { StatisticsCards } from '../components/StatisticsCards';
import { ReportPreview } from '../components/ReportPreview';
import { ReportTables } from '../components/ReportTables';
import { borangBDocument } from '../lib/reportDocuments';
import type { PrintableReport } from '../lib/pdfReport';
import { readBorangB } from '../lib/borangB';
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CheckCircle2, Clock, Download, Eye, FileJson, Printer, Search, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { missionQuery } from '../lib/queryScope';
import { useMission } from '../contexts/MissionContext';
import { db, OperationType, reportListenerError } from '../lib/firebase';
import {
  exportToCsv,
  exportToExcel,
  exportToJson,
  MONTHS,
  formatCurrencyRM,
} from '../lib/exportUtils';
import { useToast } from '../components/Toast';
import type { BorangBReport } from '../types';

export function AllBorangBPage() {
  const labels = useHierarchyLabels();
  const { profile, capabilities } = useAuth();
  const { districts, regions, staff } = useMission();
  const { notify } = useToast();

  const now = new Date();
  const [viewMode, setViewMode] = useState<'reports' | 'tracker'>('reports');
  const [preview, setPreview] = useState<PrintableReport | null>(null);
  const [storedReports, setReports] = useState<BorangBReport[]>([]);
  const reports = useMemo(() => storedReports.map(report => labels.withNames(report)), [storedReports, labels]);
  const [loading, setLoading] = useState(true);

  // Reports browser filters
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<BorangBReport | null>(null);

  // Submission Tracker period & filters
  const [trackerMonth, setTrackerMonth] = useState<number>(now.getMonth() + 1);
  const [trackerYear, setTrackerYear] = useState<number>(now.getFullYear());
  const [trackerRegionId, setTrackerRegionId] = useState<string>('all');
  const [trackerStatusFilter, setTrackerStatusFilter] = useState<'all' | 'submitted' | 'draft' | 'missing'>('all');

  useEffect(() => {
    if (!profile || !capabilities.canAccessAllBorangB) return;
    setLoading(true);
    const unsub = onSnapshot(
      missionQuery(db, 'borang_b_reports', profile),
      (snap) => {
        const items = snap.docs
          .map((d) => readBorangB(d.id, d.data()))
          .filter((item): item is BorangBReport => item !== null)
          .sort((a, b) => (b.year - a.year) || (b.month - a.month));
        setReports(items);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        reportListenerError(err, OperationType.LIST, 'borang_b_reports');
      },
    );
    return () => unsub();
  }, [profile, capabilities.canAccessAllBorangB]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (districtFilter !== 'all' && r.districtId !== districtFilter) return false;
      if (yearFilter !== 'all' && String(r.year) !== yearFilter) return false;
      if (monthFilter !== 'all' && String(r.month) !== monthFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          r.pastorName.toLowerCase().includes(s) ||
          (r.districtName || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [reports, districtFilter, yearFilter, monthFilter, statusFilter, search]);

  const yearsAvailable = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    reports.forEach((r) => set.add(r.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [reports, now]);

  // District Submission Tracker rows for selected month/year
  const trackerRows = useMemo(() => {
    const periodReports = reports.filter(
      (r) => r.year === trackerYear && r.month === trackerMonth,
    );
    const reportByDistrict = new Map<string, BorangBReport>();
    periodReports.forEach((r) => {
      const existing = reportByDistrict.get(r.districtId);
      if (!existing || (existing.status !== 'submitted' && r.status === 'submitted')) {
        reportByDistrict.set(r.districtId, r);
      }
    });

    return districts
      .filter((d) => trackerRegionId === 'all' || d.regionId === trackerRegionId)
      .map((d) => {
        const region = regions.find((reg) => reg.id === d.regionId);
        const assignedStaff = staff.find((s) => s.districtId === d.id);
        const report = reportByDistrict.get(d.id) || null;
        const compliance: 'submitted' | 'draft' | 'missing' = report
          ? report.status === 'submitted'
            ? 'submitted'
            : 'draft'
          : 'missing';
        return {
          district: d,
          regionName: region?.name || '—',
          pastorName:
            report?.pastorName || d.districtPastorName || assignedStaff?.fullName || 'Unassigned',
          report,
          compliance,
        };
      })
      .filter((row) =>
        trackerStatusFilter === 'all' ? true : row.compliance === trackerStatusFilter,
      );
  }, [districts, regions, staff, reports, trackerMonth, trackerYear, trackerRegionId, trackerStatusFilter]);

  const trackerSummary = useMemo(() => {
    const allForRegion = districts.filter(
      (d) => trackerRegionId === 'all' || d.regionId === trackerRegionId,
    );
    const periodReports = reports.filter(
      (r) => r.year === trackerYear && r.month === trackerMonth,
    );
    const submittedIds = new Set(
      periodReports.filter((r) => r.status === 'submitted').map((r) => r.districtId),
    );
    const draftIds = new Set(
      periodReports
        .filter((r) => r.status !== 'submitted' && !submittedIds.has(r.districtId))
        .map((r) => r.districtId),
    );
    const total = allForRegion.length;
    const submitted = allForRegion.filter((d) => submittedIds.has(d.id)).length;
    const draft = allForRegion.filter((d) => draftIds.has(d.id)).length;
    const missing = Math.max(0, total - submitted - draft);
    const rate = total > 0 ? Math.round((submitted / total) * 100) : 0;
    return { total, submitted, draft, missing, rate };
  }, [districts, reports, trackerMonth, trackerYear, trackerRegionId]);

  const handleExport = (fmt: 'csv' | 'xlsx' | 'json') => {
    if (viewMode === 'tracker') {
      const rows = trackerRows.map((row) => ({
        District: row.district.name,
        Region: row.regionName,
        AssignedPastor: row.pastorName,
        Period: `${MONTHS[trackerMonth - 1]} ${trackerYear}`,
        Status: row.compliance,
        SabbathServices: row.report?.sabbathServices ?? 0,
        Baptisms: row.report?.baptisms ?? 0,
      }));
      const base = `borang_b_tracker_${trackerYear}_${String(trackerMonth).padStart(2, '0')}`;
      if (fmt === 'csv') exportToCsv(base, rows);
      else if (fmt === 'xlsx') exportToExcel(base, [{ name: 'Submission Tracker', rows }]);
      else exportToJson(base, rows);
      notify(`Exported ${rows.length} submission tracker rows.`, 'success');
      return;
    }

    const rows = filtered.map((r) => ({
      Pastor: r.pastorName,
      District: labels.district(r.districtId, r.districtName),
      Period: `${MONTHS[(r.month || 1) - 1]} ${r.year}`,
      Status: r.status,
      SabbathServices: r.sabbathServices,
      LegacySermons: r.sermonsPreached,
      BibleStudies: r.bibleStudiesGiven,
      HomeVisits: r.homeVisitations,
      HospitalVisits: r.hospitalVisitations,
      Counseling: r.counselingSessions,
      EvangelisticMeetings: r.evangelisticMeetings,
      Baptisms: r.baptisms,
      ProfessionsOfFaith: r.professionsOfFaith,
    }));
    if (fmt === 'csv') exportToCsv('mission_borang_b_reports', rows);
    else if (fmt === 'xlsx') exportToExcel('mission_borang_b_reports', [{ name: 'Borang B', rows }]);
    else exportToJson('mission_borang_b_reports', filtered);
    notify(`Exported ${rows.length} Borang B reports.`, 'success');
  };

  const totals = filtered.reduce(
    (acc, r) => ({
      sermons: acc.sermons + (r.sermonsPreached || 0),
      visits: acc.visits + (r.homeVisitations || 0) + (r.hospitalVisitations || 0) + (r.prisonVisitations || 0),
      studies: acc.studies + (r.bibleStudiesGiven || 0),
      baptisms: acc.baptisms + (r.baptisms || 0),
    }),
    { sermons: 0, visits: 0, studies: 0, baptisms: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher + Export Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start">
          {(
            [
              ['reports', `Submitted Reports (${reports.length})`],
              ['tracker', 'Submission Tracker'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewMode(id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                viewMode === id
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={viewMode === 'reports' ? filtered.length === 0 : trackerRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            disabled={viewMode === 'reports' ? filtered.length === 0 : trackerRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            disabled={viewMode === 'reports' ? filtered.length === 0 : trackerRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() => setPreview(viewMode === 'tracker' ? {
              title: 'Borang B Submission Tracker', subtitle: `${MONTHS[trackerMonth - 1]} ${trackerYear}`, filename: 'Borang_B_Submission_Tracker',
              summary: [['Submission Rate', `${trackerSummary.rate}%`], ['Submitted', trackerSummary.submitted], ['Draft', trackerSummary.draft], ['Missing', trackerSummary.missing]],
              sections: [{ title: 'District Compliance', columns: ['District', 'Region', 'Pastor', 'Status'], rows: trackerRows.map(row => [row.district.name, row.regionName, row.pastorName, row.compliance]) }],
            } : {
              title: 'Mission Borang B Statistics', subtitle: `${filtered.length} filtered reports`, filename: 'Mission_Borang_B_Statistics',
              sections: [{ title: 'Reports', columns: ['Pastor', 'District', 'Period', 'Status', 'Baptisms', 'Members'], rows: filtered.map(report => [report.pastorName, labels.district(report.districtId, report.districtName), `${MONTHS[report.month - 1]} ${report.year}`, report.status, report.baptisms, report.membersEnd]) }],
            })}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {viewMode === 'reports' ? (
        <>
          <div className="flex flex-wrap items-center gap-2.5 no-print">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pastor or district..."
                className="pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] w-56"
              />
            </div>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Months</option>
              {MONTHS.map((m, idx) => (
                <option key={m} value={String(idx + 1)}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] font-mono-tabular"
            >
              <option value="all">All Years</option>
              {yearsAvailable.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Aggregate Totals */}
          <StatisticsCards items={[
            { label: 'Total Reports', value: filtered.length, icon: 'activity', color: 'blue' },
            { label: 'Baptisms', value: totals.baptisms, icon: 'people', color: 'teal' },
            { label: 'Highest Membership', value: Math.max(0, ...filtered.map(report => report.membersEnd)), icon: 'people', color: 'blue', hint: 'Highest reported value, not a sum of monthly membership' },
            { label: 'Tithes & Offerings', value: formatCurrencyRM(filtered.reduce((sum, report) => sum + report.tithe + report.offerings, 0)), icon: 'money', color: 'teal' },
          ]} />

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden print-sheet">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 rounded bg-[var(--bg-subtle)] animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                No mission Borang B submissions match the active filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                      <th className="py-3 px-4 font-medium">Pastor</th>
                      <th className="py-3 px-4 font-medium">District</th>
                      <th className="py-3 px-4 font-medium">Period</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Sabbath Services</th>
                      <th className="py-3 px-4 font-medium text-right">Visits</th>
                      <th className="py-3 px-4 font-medium text-right">Studies</th>
                      <th className="py-3 px-4 font-medium text-right">Baptisms</th>
                      <th className="py-3 px-4 font-medium text-right no-print">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-[var(--bg-subtle)]/60">
                        <td className="py-3 px-4 font-medium">{r.pastorName}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {labels.district(r.districtId, r.districtName)}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono-tabular whitespace-nowrap">
                          {MONTHS[(r.month || 1) - 1]} {r.year}
                        </td>
                        <td className="py-3 px-4 text-xs capitalize">
                          <span
                            className={
                              r.status === 'submitted'
                                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                : 'text-amber-700 dark:text-amber-400'
                            }
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {r.sabbathServices}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {(r.homeVisitations || 0) + (r.hospitalVisitations || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {r.bibleStudiesGiven}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {r.baptisms}
                        </td>
                        <td className="py-3 px-4 text-right no-print">
                          <button
                            type="button"
                            onClick={() => setSelected(r)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* MINISTERIAL SECRETARY SUBMISSION TRACKER */
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2.5 no-print">
            <select
              value={trackerMonth}
              onChange={(e) => setTrackerMonth(Number(e.target.value))}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={trackerYear}
              onChange={(e) => setTrackerYear(Number(e.target.value))}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] font-mono-tabular"
            >
              {yearsAvailable.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={trackerRegionId}
              onChange={(e) => setTrackerRegionId(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Regions ({regions.length})</option>
              {regions.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.name}
                </option>
              ))}
            </select>
            <select
              value={trackerStatusFilter}
              onChange={(e) =>
                setTrackerStatusFilter(
                  e.target.value as 'all' | 'submitted' | 'draft' | 'missing',
                )
              }
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Districts</option>
              <option value="submitted">Submitted Only</option>
              <option value="draft">Draft Only</option>
              <option value="missing">Not Yet Submitted</option>
            </select>
          </div>

          <StatisticsCards items={[
            { label: 'Submission Rate', value: `${trackerSummary.rate}%`, icon: 'check', color: 'blue' },
            { label: 'Submitted Districts', value: `${trackerSummary.submitted} / ${trackerSummary.total}`, icon: 'check', color: 'green' },
            { label: 'Draft in Progress', value: trackerSummary.draft, icon: 'activity', color: 'orange' },
            { label: 'Awaiting Submission', value: trackerSummary.missing, icon: 'calendar', color: 'purple' },
          ]} />

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden print-sheet">
            <div className="px-5 py-3.5 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <div className="text-sm font-semibold">
                District Compliance — {MONTHS[trackerMonth - 1]} {trackerYear}
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono-tabular">
                {trackerRows.length} districts shown
              </div>
            </div>
            {trackerRows.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                No districts match the selected compliance filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                      <th className="py-3 px-4 font-medium">District</th>
                      <th className="py-3 px-4 font-medium">Region</th>
                      <th className="py-3 px-4 font-medium">District Pastor</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Sabbath Services</th>
                      <th className="py-3 px-4 font-medium text-right">Baptisms</th>
                      <th className="py-3 px-4 font-medium text-right no-print">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {trackerRows.map(({ district, regionName, pastorName, report, compliance }) => (
                      <tr key={district.id} className="hover:bg-[var(--bg-subtle)]/50">
                        <td className="py-3 px-4 font-medium">{district.name}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {regionName}
                        </td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {pastorName}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {compliance === 'submitted' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Submitted</span>
                            </span>
                          ) : compliance === 'draft' ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Draft Saved</span>
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              Not Submitted
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {report ? report.sabbathServices : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {report ? report.baptisms : '—'}
                        </td>
                        <td className="py-3 px-4 text-right no-print">
                          {report ? (
                            <button
                              type="button"
                              onClick={() => setSelected(report)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inspection Slide-over Drawer */}
      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end no-print">
          <div className="max-w-lg w-full h-full bg-[var(--bg-surface)] border-l border-[var(--border-hairline)] overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
              <div>
                <div className="text-xs text-[var(--text-muted)]">
                  Borang B Inspection · {MONTHS[(selected.month || 1) - 1]} {selected.year}
                </div>
                <h2 className="text-lg font-display font-semibold mt-0.5">
                  {selected.pastorName}
                </h2>
                <div className="text-xs text-[var(--text-secondary)]">
                  {labels.district(selected.districtId, selected.districtName)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg border border-[var(--border-hairline)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button onClick={() => setPreview(borangBDocument(labels.withNames(selected)))} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-hairline)] text-sm"><Printer size={15} />Preview / Print Report</button>
            <ReportTables sections={borangBDocument(labels.withNames(selected)).sections} />
          </div>
        </div>
      )}
    </div>
  );
}
