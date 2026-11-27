import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType, reportListenerError } from '../lib/firebase';
import {
  exportToCsv,
  exportToExcel,
  formatCurrencyRM,
  MONTHS,
  triggerPrintPdf,
} from '../lib/exportUtils';
import { useToast } from '../components/Toast';
import type {
  FamData,
  FamLineItem,
  FinancialReport,
  FinancialReportHistory,
} from '../types';

const DEFAULT_FAM_FUNDS: FamLineItem[] = [
  { name: 'Tithe (10%)', category: 'Mission Remittance', amount: 0 },
  { name: 'Combined Budget', category: 'Mission / Local Split', amount: 0 },
  { name: 'Mission Offering', category: 'World Mission', amount: 0 },
  { name: 'Local Church Budget', category: 'Local Operating', amount: 0 },
];

const DEFAULT_FAM_EXPENSES: FamLineItem[] = [
  { name: 'Utilities & Facility Maintenance', category: 'Operations', amount: 0 },
  { name: 'Sabbath School & Evangelism', category: 'Ministry', amount: 0 },
  { name: 'Welfare & Dorcas Assistance', category: 'Community', amount: 0 },
];

export function FinancialReportsPage() {
  const { profile, capabilities } = useAuth();
  const { churches, districts, regions } = useMission();
  const { notify } = useToast();

  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ledger' | 'all'>(
    capabilities.canAccessAllFinancialReports ? 'all' : 'ledger',
  );

  // Filters
  const [regionFilter, setRegionFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  // Editor Drawer State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<FinancialReport | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<FinancialReport | null>(null);

  const now = new Date();
  const [churchId, setChurchId] = useState(profile?.churchId || '');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tithe, setTithe] = useState(0);
  const [combinedBudget, setCombinedBudget] = useState(0);
  const [missionOffering, setMissionOffering] = useState(0);
  const [localChurchOffering, setLocalChurchOffering] = useState(0);
  const [specialOffering, setSpecialOffering] = useState(0);
  const [notes, setNotes] = useState('');
  const [reportStatus, setReportStatus] = useState<'draft' | 'submitted' | 'verified'>('submitted');

  // 1:1 FAM State
  const [openingBalance, setOpeningBalance] = useState(0);
  const [famFunds, setFamFunds] = useState<FamLineItem[]>(DEFAULT_FAM_FUNDS);
  const [famExpenses, setFamExpenses] = useState<FamLineItem[]>(DEFAULT_FAM_EXPENSES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);

    const q = capabilities.canAccessAllFinancialReports
      ? query(collection(db, 'financial_reports'), orderBy('year', 'desc'))
      : profile.userRole === 'church_treasurer' && profile.churchId
        ? query(
            collection(db, 'financial_reports'),
            where('churchId', '==', profile.churchId),
          )
        : query(
            collection(db, 'financial_reports'),
            where('submittedBy', '==', profile.uid),
          );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<FinancialReport, 'id'>),
          }))
          .sort((a, b) => (b.year - a.year) || (b.month - a.month));
        setReports(items);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        reportListenerError(err, OperationType.LIST, 'financial_reports');
      },
    );
    return () => unsub();
  }, [profile, capabilities.canAccessAllFinancialReports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (activeTab === 'ledger' && profile?.churchId && r.churchId !== profile.churchId) {
        if (r.submittedBy !== profile.uid) return false;
      }
      if (regionFilter !== 'all' && r.regionId !== regionFilter) return false;
      if (districtFilter !== 'all' && r.districtId !== districtFilter) return false;
      if (monthFilter !== 'all' && String(r.month) !== monthFilter) return false;
      if (yearFilter !== 'all' && String(r.year) !== yearFilter) return false;
      return true;
    });
  }, [reports, activeTab, profile, regionFilter, districtFilter, monthFilter, yearFilter]);

  const totalIncomeCalc =
    Number(tithe || 0) +
    Number(combinedBudget || 0) +
    Number(missionOffering || 0) +
    Number(localChurchOffering || 0) +
    Number(specialOffering || 0);

  const famTotalFunds = famFunds.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const famTotalExpenses = famExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const closingBalanceCalc = Number(openingBalance || 0) + famTotalFunds - famTotalExpenses;

  const openNewReport = () => {
    setEditingReport(null);
    setChurchId(profile?.churchId || churches[0]?.id || '');
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setTithe(0);
    setCombinedBudget(0);
    setMissionOffering(0);
    setLocalChurchOffering(0);
    setSpecialOffering(0);
    setNotes('');
    setReportStatus('submitted');
    setOpeningBalance(0);
    setFamFunds(DEFAULT_FAM_FUNDS.map((i) => ({ ...i })));
    setFamExpenses(DEFAULT_FAM_EXPENSES.map((i) => ({ ...i })));
    setEditorOpen(true);
  };

  const openEditReport = async (rep: FinancialReport) => {
    setEditingReport(rep);
    setChurchId(rep.churchId);
    setYear(rep.year);
    setMonth(rep.month);
    setTithe(rep.tithe);
    setCombinedBudget(rep.combinedBudget);
    setMissionOffering(rep.missionOffering);
    setLocalChurchOffering(rep.localChurchOffering);
    setSpecialOffering(rep.specialOffering);
    setNotes(rep.notes || '');
    setReportStatus(rep.status);

    const famDocId = rep.famId || `fam_${rep.id}`;
    try {
      const famSnap = await getDoc(doc(db, 'fam_data', famDocId));
      if (famSnap.exists()) {
        const fd = famSnap.data() as FamData;
        setOpeningBalance(fd.openingBalance || 0);
        setFamFunds(fd.funds?.length ? fd.funds : DEFAULT_FAM_FUNDS.map((i) => ({ ...i })));
        setFamExpenses(
          fd.expenses?.length ? fd.expenses : DEFAULT_FAM_EXPENSES.map((i) => ({ ...i })),
        );
      } else {
        setOpeningBalance(0);
        setFamFunds(DEFAULT_FAM_FUNDS.map((i) => ({ ...i })));
        setFamExpenses(DEFAULT_FAM_EXPENSES.map((i) => ({ ...i })));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `fam_data/${famDocId}`);
    }
    setEditorOpen(true);
  };

  const handleSaveFinancialAndFam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const selectedChurch = churches.find((c) => c.id === churchId);
    if (!selectedChurch) {
      notify('Please select a church from the Mission directory.', 'error');
      return;
    }

    setSaving(true);
    const reportId =
      editingReport?.id ||
      `${selectedChurch.id}_${year}_${String(month).padStart(2, '0')}`;
    const famId = editingReport?.famId || `fam_${reportId}`;

    const historyEntry: FinancialReportHistory = {
      userId: profile.uid,
      userName: profile.displayName,
      action: editingReport ? `Updated (${reportStatus})` : `Created (${reportStatus})`,
      timestamp: new Date().toISOString(),
      changes: `Income: ${formatCurrencyRM(totalIncomeCalc)} | Expense: ${formatCurrencyRM(famTotalExpenses)}`,
    };

    const existingHistory = editingReport?.history || [];
    const nextHistory = [...existingHistory.slice(-49), historyEntry];

    const batch = writeBatch(db);
    const nowTs = serverTimestamp();

    batch.set(
      doc(db, 'financial_reports', reportId),
      {
        missionId: selectedChurch.missionId,
        regionId: selectedChurch.regionId,
        districtId: selectedChurch.districtId,
        churchId: selectedChurch.id,
        churchName: selectedChurch.name,
        submittedBy: editingReport?.submittedBy || profile.uid,
        submittedByName: editingReport?.submittedByName || profile.displayName,
        year,
        month,
        tithe: Number(tithe || 0),
        combinedBudget: Number(combinedBudget || 0),
        missionOffering: Number(missionOffering || 0),
        localChurchOffering: Number(localChurchOffering || 0),
        specialOffering: Number(specialOffering || 0),
        totalIncome: totalIncomeCalc,
        totalExpense: famTotalExpenses,
        status: reportStatus,
        notes: notes.trim().slice(0, 2000),
        famId,
        history: nextHistory,
        createdAt: editingReport?.createdAt || nowTs,
        updatedAt: nowTs,
      },
      { merge: true },
    );

    batch.set(
      doc(db, 'fam_data', famId),
      {
        reportId,
        missionId: selectedChurch.missionId,
        districtId: selectedChurch.districtId,
        churchId: selectedChurch.id,
        submittedBy: editingReport?.submittedBy || profile.uid,
        year,
        month,
        openingBalance: Number(openingBalance || 0),
        closingBalance: closingBalanceCalc,
        funds: famFunds.slice(0, 50),
        expenses: famExpenses.slice(0, 50),
        createdAt: editingReport?.createdAt || nowTs,
        updatedAt: nowTs,
      },
      { merge: true },
    );

    try {
      await batch.commit();
      notify('Financial report & 1:1 FAM breakdown saved.', 'success');
      setEditorOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `financial_reports/${reportId}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = (fmt: 'csv' | 'xlsx') => {
    const rows = filteredReports.map((r) => ({
      Church: r.churchName,
      Period: `${MONTHS[(r.month || 1) - 1]} ${r.year}`,
      Status: r.status,
      TitheRM: r.tithe,
      CombinedBudgetRM: r.combinedBudget,
      MissionOfferingRM: r.missionOffering,
      LocalOfferingRM: r.localChurchOffering,
      SpecialOfferingRM: r.specialOffering,
      TotalIncomeRM: r.totalIncome,
      TotalExpenseRM: r.totalExpense,
      SubmittedBy: r.submittedByName || r.submittedBy,
    }));
    if (fmt === 'csv') exportToCsv('financial_reports_ledger', rows);
    else exportToExcel('financial_reports_ledger', [{ name: 'Financial Reports', rows }]);
    notify(`Exported ${rows.length} financial records.`, 'success');
  };

  const summary = filteredReports.reduce(
    (acc, r) => ({
      tithe: acc.tithe + (r.tithe || 0),
      income: acc.income + (r.totalIncome || 0),
      expense: acc.expense + (r.totalExpense || 0),
    }),
    { tithe: 0, income: 0, expense: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Top Tabs & Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          {capabilities.canAccessAllFinancialReports && (
            <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'all'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                All Mission Reports
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'ledger'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                My Church Ledger
              </button>
            </div>
          )}

          {activeTab === 'all' && (
            <>
              <select
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setDistrictFilter('all');
                }}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
              >
                <option value="all">All Regions</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
              >
                <option value="all">All Districts</option>
                {districts
                  .filter((d) => regionFilter === 'all' || d.regionId === regionFilter)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </>
          )}

          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
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
            className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] font-mono-tabular"
          >
            <option value="all">All Years</option>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={filteredReports.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            disabled={filteredReports.length === 0}
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
          {capabilities.canSubmitFinancialReports && (
            <button
              type="button"
              onClick={openNewReport}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Financial Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Totals Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-hairline)]">
        <div className="px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">Aggregate Tithe</div>
          <div className="text-xl font-mono-tabular font-semibold mt-1">
            {formatCurrencyRM(summary.tithe)}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">Total Gross Income</div>
          <div className="text-xl font-mono-tabular font-semibold mt-1">
            {formatCurrencyRM(summary.income)}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="text-xs text-[var(--text-muted)]">Total FAM Expenses</div>
          <div className="text-xl font-mono-tabular font-semibold mt-1">
            {formatCurrencyRM(summary.expense)}
          </div>
        </div>
      </div>

      {/* Financial Ledger Table */}
      <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden print-sheet">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded bg-[var(--bg-subtle)] animate-pulse" />
            ))}
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <FileSpreadsheet className="w-7 h-7 text-[var(--text-muted)] mx-auto" />
            <div className="text-sm font-medium">No financial reports found</div>
            <p className="text-xs text-[var(--text-secondary)]">
              Church Treasurers can enter monthly tithe, offerings, and linked FAM fund breakdowns here.
            </p>
            {capabilities.canSubmitFinancialReports && (
              <button
                type="button"
                onClick={openNewReport}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
              >
                Create Monthly Report
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Church</th>
                  <th className="py-3 px-4 font-medium">Period</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Tithe</th>
                  <th className="py-3 px-4 font-medium text-right">Total Income</th>
                  <th className="py-3 px-4 font-medium text-right">FAM Expense</th>
                  <th className="py-3 px-4 font-medium text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {filteredReports.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--bg-subtle)]/60">
                    <td className="py-3 px-4">
                      <div className="font-medium">{r.churchName}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {r.submittedByName || 'Treasurer'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-tabular whitespace-nowrap">
                      {MONTHS[(r.month || 1) - 1]} {r.year}
                    </td>
                    <td className="py-3 px-4 text-xs capitalize">
                      <span
                        className={
                          r.status === 'verified'
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : r.status === 'submitted'
                              ? 'text-[var(--text-primary)] font-medium'
                              : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular">
                      {formatCurrencyRM(r.tithe)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-medium">
                      {formatCurrencyRM(r.totalIncome)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-[var(--text-secondary)]">
                      {formatCurrencyRM(r.totalExpense)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap no-print">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setHistoryDrawer(r)}
                          className="p-1.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                          title="Audit History"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditReport(r)}
                          className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
                        >
                          {capabilities.isReadOnlyOfficer ? 'Inspect' : 'Open / FAM'}
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

      {/* Financial + 1:1 FAM Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end no-print">
          <div className="max-w-3xl w-full h-full bg-[var(--bg-surface)] border-l border-[var(--border-hairline)] overflow-y-auto">
            <div className="sticky top-0 z-10 px-6 py-4 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] flex items-center justify-between">
              <div>
                <h2 className="text-base font-display font-semibold">
                  {editingReport
                    ? `${editingReport.churchName} · ${MONTHS[month - 1]} ${year}`
                    : 'Monthly Financial & FAM Entry'}
                </h2>
                <div className="text-xs text-[var(--text-muted)]">
                  Linked 1:1 with Financial Accounting Method (FAM) breakdown
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1.5 rounded-lg border border-[var(--border-hairline)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFinancialAndFam} className="p-6 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Church *
                  </label>
                  <select
                    required
                    disabled={Boolean(editingReport) || (profile?.userRole === 'church_treasurer' && Boolean(profile.churchId))}
                    value={churchId}
                    onChange={(e) => setChurchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] disabled:opacity-70"
                  >
                    <option value="">Select church...</option>
                    {churches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Month
                  </label>
                  <select
                    disabled={Boolean(editingReport)}
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] disabled:opacity-70"
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    disabled={Boolean(editingReport)}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular disabled:opacity-70"
                  />
                </div>
              </div>

              {/* Monthly Income Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">01. Monthly Tithe & Offerings (RM)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    ['Tithe', tithe, setTithe],
                    ['Combined Budget', combinedBudget, setCombinedBudget],
                    ['Mission Offering', missionOffering, setMissionOffering],
                    ['Local Church Offering', localChurchOffering, setLocalChurchOffering],
                    ['Special / Building Offering', specialOffering, setSpecialOffering],
                  ].map(([label, val, setter]) => (
                    <div key={String(label)}>
                      <label className="block text-xs text-[var(--text-secondary)] mb-1">
                        {label as string}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={val as number}
                        onChange={(e) =>
                          (setter as React.Dispatch<React.SetStateAction<number>>)(
                            Number(e.target.value),
                          )
                        }
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
                      />
                    </div>
                  ))}
                  <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex flex-col justify-center">
                    <div className="text-xs text-[var(--text-muted)]">Gross Income</div>
                    <div className="text-base font-mono-tabular font-semibold">
                      {formatCurrencyRM(totalIncomeCalc)}
                    </div>
                  </div>
                </div>
              </div>

              {/* FAM Breakdown */}
              <div className="space-y-4 pt-4 border-t border-[var(--border-hairline)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">
                    02. FAM (Financial Accounting Method) Fund Ledger
                  </h3>
                  <div className="text-xs font-mono-tabular">
                    Closing Balance:{' '}
                    <strong>{formatCurrencyRM(closingBalanceCalc)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[var(--text-secondary)] mb-1">
                      Opening Balance (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
                    />
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                    <div className="text-xs text-[var(--text-muted)]">FAM Funds In</div>
                    <div className="text-sm font-mono-tabular font-semibold">
                      {formatCurrencyRM(famTotalFunds)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                    <div className="text-xs text-[var(--text-muted)]">FAM Expenses Out</div>
                    <div className="text-sm font-mono-tabular font-semibold">
                      {formatCurrencyRM(famTotalExpenses)}
                    </div>
                  </div>
                </div>

                {/* Funds List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Fund Receipts
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFamFunds((prev) => [
                          ...prev,
                          { name: '', category: 'Fund', amount: 0 },
                        ])
                      }
                      className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
                    >
                      + Add Fund Line
                    </button>
                  </div>
                  {famFunds.map((f, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Fund name"
                        value={f.name}
                        onChange={(e) => {
                          const next = [...famFunds];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setFamFunds(next);
                        }}
                        className="col-span-5 px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                      />
                      <input
                        type="text"
                        placeholder="Category"
                        value={f.category}
                        onChange={(e) => {
                          const next = [...famFunds];
                          next[idx] = { ...next[idx], category: e.target.value };
                          setFamFunds(next);
                        }}
                        className="col-span-3 px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={f.amount}
                        onChange={(e) => {
                          const next = [...famFunds];
                          next[idx] = { ...next[idx], amount: Number(e.target.value) };
                          setFamFunds(next);
                        }}
                        className="col-span-3 px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFamFunds((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="col-span-1 p-1.5 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Expenses List */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Disbursements & Local Expenses
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFamExpenses((prev) => [
                          ...prev,
                          { name: '', category: 'Expense', amount: 0 },
                        ])
                      }
                      className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
                    >
                      + Add Expense Line
                    </button>
                  </div>
                  {famExpenses.map((ex, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Expense item"
                        value={ex.name}
                        onChange={(e) => {
                          const next = [...famExpenses];
                          next[idx] = { ...next[idx], name: e.target.value };
                          setFamExpenses(next);
                        }}
                        className="col-span-5 px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                      />
                      <input
                        type="text"
                        placeholder="Category"
                        value={ex.category}
                        onChange={(e) => {
                          const next = [...famExpenses];
                          next[idx] = { ...next[idx], category: e.target.value };
                          setFamExpenses(next);
                        }}
                        className="col-span-3 px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={ex.amount}
                        onChange={(e) => {
                          const next = [...famExpenses];
                          next[idx] = { ...next[idx], amount: Number(e.target.value) };
                          setFamExpenses(next);
                        }}
                        className="col-span-3 px-2.5 py-1.5 text-xs rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFamExpenses((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="col-span-1 p-1.5 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border-hairline)]">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Treasurer Notes
                  </label>
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Report Status
                  </label>
                  <select
                    value={reportStatus}
                    onChange={(e) =>
                      setReportStatus(
                        e.target.value as 'draft' | 'submitted' | 'verified',
                      )
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  >
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    {capabilities.canManageHierarchy && (
                      <option value="verified">Verified (Locked for Treasurer)</option>
                    )}
                  </select>
                </div>
              </div>

              {!capabilities.isReadOnlyOfficer && (
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Report & FAM'}</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit History Modal */}
      {historyDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 no-print">
          <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-display font-semibold">
                Edit Audit History · {historyDrawer.churchName}
              </h3>
              <button
                type="button"
                onClick={() => setHistoryDrawer(null)}
                className="p-1 text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-[var(--border-hairline)] max-h-80 overflow-y-auto">
              {(historyDrawer.history || []).length === 0 ? (
                <div className="py-6 text-xs text-[var(--text-muted)] text-center">
                  No revision entries recorded.
                </div>
              ) : (
                [...(historyDrawer.history || [])].reverse().map((h, i) => (
                  <div key={i} className="py-3 text-xs space-y-0.5">
                    <div className="font-medium text-[var(--text-primary)]">
                      {h.action} — {h.userName}
                    </div>
                    <div className="text-[var(--text-muted)] font-mono-tabular">
                      {new Date(h.timestamp).toLocaleString()}
                    </div>
                    {h.changes && (
                      <div className="text-[var(--text-secondary)]">{h.changes}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
