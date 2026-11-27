import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Download, Eye, Printer, Search, X } from 'lucide-react';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  exportToCsv,
  exportToExcel,
  MONTHS,
  triggerPrintPdf,
} from '../lib/exportUtils';
import { useToast } from '../components/Toast';
import type { BorangBReport } from '../types';

export function AllBorangBPage() {
  const { districts } = useMission();
  const { notify } = useToast();

  const [reports, setReports] = useState<BorangBReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<BorangBReport | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'borang_b_reports'),
      orderBy('year', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReports(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BorangBReport, 'id'>),
          })),
        );
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'borang_b_reports');
      },
    );
    return () => unsub();
  }, []);

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

  const yearsAvailable = useMemo(
    () => Array.from(new Set(reports.map((r) => r.year))).sort((a, b) => b - a),
    [reports],
  );

  const handleExport = (fmt: 'csv' | 'xlsx') => {
    const rows = filtered.map((r) => ({
      Pastor: r.pastorName,
      District: r.districtName || r.districtId,
      Period: `${MONTHS[(r.month || 1) - 1]} ${r.year}`,
      Status: r.status,
      Sermons: r.sermonsPreached,
      BibleStudies: r.bibleStudiesGiven,
      HomeVisits: r.homeVisitations,
      HospitalVisits: r.hospitalVisitations,
      Counseling: r.counselingSessions,
      EvangelisticMeetings: r.evangelisticMeetings,
      Baptisms: r.baptisms,
      ProfessionsOfFaith: r.professionsOfFaith,
    }));
    if (fmt === 'csv') exportToCsv('mission_borang_b_reports', rows);
    else exportToExcel('mission_borang_b_reports', [{ name: 'Borang B', rows }]);
    notify(`Exported ${rows.length} Borang B reports.`, 'success');
  };

  const totals = filtered.reduce(
    (acc, r) => ({
      sermons: acc.sermons + (r.sermonsPreached || 0),
      visits: acc.visits + (r.homeVisitations || 0) + (r.hospitalVisitations || 0),
      studies: acc.studies + (r.bibleStudiesGiven || 0),
      baptisms: acc.baptisms + (r.baptisms || 0),
    }),
    { sermons: 0, visits: 0, studies: 0, baptisms: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-2.5">
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={triggerPrintPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Aggregate Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-hairline)]">
        <div className="px-5 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">Total Sermons</div>
          <div className="text-lg font-mono-tabular font-semibold mt-0.5">
            {totals.sermons.toLocaleString()}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">Total Visitations</div>
          <div className="text-lg font-mono-tabular font-semibold mt-0.5">
            {totals.visits.toLocaleString()}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">Total Bible Studies</div>
          <div className="text-lg font-mono-tabular font-semibold mt-0.5">
            {totals.studies.toLocaleString()}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">Total Baptisms</div>
          <div className="text-lg font-mono-tabular font-semibold mt-0.5">
            {totals.baptisms.toLocaleString()}
          </div>
        </div>
      </div>

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
                  <th className="py-3 px-4 font-medium text-right">Sermons</th>
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
                      {r.districtName || r.districtId}
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
                      {r.sermonsPreached}
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

      {/* Inspection Slide-over Drawer */}
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
                  {selected.districtName || selected.districtId}
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

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Sermons Preached', selected.sermonsPreached],
                ['Bible Studies', selected.bibleStudiesGiven],
                ['Home Visitations', selected.homeVisitations],
                ['Hospital Visitations', selected.hospitalVisitations],
                ['Counseling Sessions', selected.counselingSessions],
                ['Evangelistic Meetings', selected.evangelisticMeetings],
                ['Baptisms', selected.baptisms],
                ['Professions of Faith', selected.professionsOfFaith],
                ['Board Meetings', selected.boardMeetings],
                ['Communion Services', selected.communionServices],
                ['Anointings', selected.anointings ?? 0],
                ['Weddings / Funerals', `${selected.weddings ?? 0} / ${selected.funerals ?? 0}`],
              ].map(([label, val]) => (
                <div
                  key={String(label)}
                  className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex items-center justify-between"
                >
                  <span className="text-xs text-[var(--text-secondary)]">{label}</span>
                  <span className="font-mono-tabular font-semibold">{val}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                  Stewardship & Tithe Notes
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs leading-relaxed">
                  {selected.titheFaithfulnessNotes || 'No notes provided.'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                  Challenges & Prayer Requests
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs leading-relaxed">
                  {selected.challengesAndPrayer || 'No notes provided.'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                  Next Month Goals
                </div>
                <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs leading-relaxed">
                  {selected.nextMonthGoals || 'No notes provided.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
