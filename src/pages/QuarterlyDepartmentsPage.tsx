import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { Download, Eye, Printer, Save, Send, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType, reportListenerError } from '../lib/firebase';
import {
  exportToCsv,
  exportToExcel,
  formatCurrencyRM,
  triggerPrintPdf,
} from '../lib/exportUtils';
import { useToast } from '../components/Toast';
import type { DepartmentType, QuarterlyDepartmentReport } from '../types';

const DEPT_CONFIG: Record<
  DepartmentType,
  {
    label: string;
    subtitle: string;
    fields: { key: string; label: string; isCurrency?: boolean }[];
  }
> = {
  kanak_kanak: {
    label: 'Kanak-Kanak (Children’s Ministry)',
    subtitle: 'Age-band demographics, APTA families, KID enrollment, and family worship',
    fields: [
      { key: 'age0to4', label: 'Ages 0–4 (Beginners)' },
      { key: 'age5to6', label: 'Ages 5–6 (Kindergarten)' },
      { key: 'age7to9', label: 'Ages 7–9 (Primary)' },
      { key: 'age10to12', label: 'Ages 10–12 (Juniors)' },
      { key: 'aptaFamilies', label: 'APTA Registered Families' },
      { key: 'kidEnrolled', label: 'KID Curriculum Enrolled' },
      { key: 'regularFamilyWorship', label: 'Regular Family Worship Homes' },
      { key: 'vbsHeld', label: 'VBS / Children’s Programs Held' },
    ],
  },
  penatalayanan: {
    label: 'Penatalayanan (Stewardship)',
    subtitle: 'Borang AP 3-month tithe/offering totals & Borang BP leader/employment metrics',
    fields: [
      { key: 'borangApMonth1Tithe', label: 'Borang AP Month 1 Tithe (RM)', isCurrency: true },
      { key: 'borangApMonth1Offering', label: 'Borang AP Month 1 Offering (RM)', isCurrency: true },
      { key: 'borangApMonth2Tithe', label: 'Borang AP Month 2 Tithe (RM)', isCurrency: true },
      { key: 'borangApMonth2Offering', label: 'Borang AP Month 2 Offering (RM)', isCurrency: true },
      { key: 'borangApMonth3Tithe', label: 'Borang AP Month 3 Tithe (RM)', isCurrency: true },
      { key: 'borangApMonth3Offering', label: 'Borang AP Month 3 Offering (RM)', isCurrency: true },
      { key: 'stewardshipLeaders', label: 'Borang BP Stewardship Leaders' },
      { key: 'employedMembers', label: 'Employed Members' },
      { key: 'selfEmployedMembers', label: 'Self-Employed / Farmers' },
      { key: 'retiredOrStudentMembers', label: 'Retired / Student Members' },
      { key: 'stewardshipSeminars', label: 'Stewardship Seminars Conducted' },
      { key: 'faithfulnessVisitations', label: 'Faithfulness Visitations' },
    ],
  },
  sspm: {
    label: 'SSPM (Sabbath School & Personal Ministries)',
    subtitle: 'Sabbath School division attendance, Bible study groups, and outreach',
    fields: [
      { key: 'sabbathSchoolAdultAttendance', label: 'Adult Sabbath School Avg Attendance' },
      { key: 'sabbathSchoolYouthAttendance', label: 'Youth Sabbath School Avg Attendance' },
      { key: 'sabbathSchoolChildrenAttendance', label: 'Children Division Avg Attendance' },
      { key: 'activeBibleStudyGroups', label: 'Active Action Units / Study Groups' },
      { key: 'smallGroupOutreachContacts', label: 'Small Group Outreach Contacts' },
      { key: 'literatureDistributed', label: 'Tracts & Books Distributed' },
      { key: 'baptismalInterests', label: 'New Baptismal Interests' },
      { key: 'communityBibleStudies', label: 'Community Bible Studies Given' },
    ],
  },
  wanita: {
    label: 'Wanita (Women’s Ministry)',
    subtitle: 'Women’s membership, fellowship attendance, welfare outreach, and retreats',
    fields: [
      { key: 'activeWomenMembers', label: 'Active Women Members' },
      { key: 'regularFellowshipAttendance', label: 'Regular Fellowship Attendance' },
      { key: 'prayerGroupMeetings', label: 'Women’s Prayer Group Meetings' },
      { key: 'communityWelfarePrograms', label: 'Community Welfare Programs' },
      { key: 'leadershipWorkshops', label: 'Leadership & Health Workshops' },
      { key: 'devotionalRetreats', label: 'Devotional Retreats Held' },
      { key: 'familiesAssisted', label: 'Families Assisted' },
    ],
  },
};

export function QuarterlyDepartmentsPage() {
  const { profile, capabilities } = useAuth();
  const { churches, districts } = useMission();
  const { notify } = useToast();

  const now = new Date();
  const currentQuarter = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;

  const [activeTab, setActiveTab] = useState<'browser' | 'submit'>(
    capabilities.canSubmitDepartmentReports ? 'submit' : 'browser',
  );

  // Shared stream of quarterly reports
  const [reports, setReports] = useState<QuarterlyDepartmentReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Submission Form state
  const [formChurchId, setFormChurchId] = useState(profile?.churchId || '');
  const [formYear, setFormYear] = useState(now.getFullYear());
  const [formQuarter, setFormQuarter] = useState<1 | 2 | 3 | 4>(currentQuarter);
  const [formDept, setFormDept] = useState<DepartmentType>('kanak_kanak');
  const [payload, setPayload] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [existingCreatedAt, setExistingCreatedAt] = useState<unknown>(null);

  // Browser filters
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(String(now.getFullYear()));
  const [filterQuarter, setFilterQuarter] = useState<string>('all');
  const [inspectReport, setInspectReport] = useState<QuarterlyDepartmentReport | null>(null);

  const scopedChurches = useMemo(() => {
    if (
      profile?.userRole === 'district_pastor' &&
      profile.districtId
    ) {
      return churches.filter((c) => c.districtId === profile.districtId);
    }
    return churches;
  }, [churches, profile]);

  useEffect(() => {
    if (!formChurchId && scopedChurches.length > 0) {
      setFormChurchId(scopedChurches[0].id);
    }
  }, [scopedChurches, formChurchId]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const q = capabilities.canAccessAllFinancialReports
      ? query(collection(db, 'quarterly_department_reports'), orderBy('year', 'desc'))
      : profile.districtId
        ? query(
            collection(db, 'quarterly_department_reports'),
            where('districtId', '==', profile.districtId),
          )
        : query(
            collection(db, 'quarterly_department_reports'),
            where('submittedBy', '==', profile.uid),
          );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<QuarterlyDepartmentReport, 'id'>),
          }))
          .sort((a, b) => (b.year - a.year) || (b.quarter - a.quarter));
        setReports(items);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        reportListenerError(err, OperationType.LIST, 'quarterly_department_reports');
      },
    );
    return () => unsub();
  }, [profile, capabilities.canAccessAllFinancialReports]);

  // Deterministic document ID: {churchId}_{year}_Q{quarter}_{department}
  const deterministicId = formChurchId
    ? `${formChurchId}_${formYear}_Q${formQuarter}_${formDept}`
    : '';

  useEffect(() => {
    if (!deterministicId) return;
    getDoc(doc(db, 'quarterly_department_reports', deterministicId))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as QuarterlyDepartmentReport;
          setPayload(data.payload || {});
          setNotes(data.notes || '');
          setExistingCreatedAt(data.createdAt || null);
        } else {
          setPayload({});
          setNotes('');
          setExistingCreatedAt(null);
        }
      })
      .catch((err) =>
        reportListenerError(
          err,
          OperationType.GET,
          `quarterly_department_reports/${deterministicId}`,
        ),
      );
  }, [deterministicId]);

  const handleSaveQuarterly = async (submitStatus: 'draft' | 'submitted') => {
    if (!profile || !deterministicId) return;
    const church = churches.find((c) => c.id === formChurchId);
    if (!church) {
      notify('Please select a church.', 'error');
      return;
    }

    setSaving(true);
    const district = districts.find((d) => d.id === church.districtId);

    const sanitizedPayload: Record<string, number> = {};
    for (const f of DEPT_CONFIG[formDept].fields) {
      sanitizedPayload[f.key] = Math.max(0, Number(payload[f.key] || 0));
    }

    try {
      await setDoc(
        doc(db, 'quarterly_department_reports', deterministicId),
        {
          missionId: church.missionId,
          regionId: church.regionId,
          districtId: church.districtId,
          churchId: church.id,
          churchName: church.name,
          districtName: district?.name || '',
          department: formDept,
          year: formYear,
          quarter: formQuarter,
          submittedBy: profile.uid,
          submittedByName: profile.displayName,
          status: submitStatus,
          payload: sanitizedPayload,
          notes: notes.trim().slice(0, 2000),
          createdAt: existingCreatedAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      notify(
        `${DEPT_CONFIG[formDept].label} Q${formQuarter} ${formYear} ${
          submitStatus === 'submitted' ? 'submitted' : 'saved as draft'
        }.`,
        'success',
      );
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `quarterly_department_reports/${deterministicId}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredBrowserReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterDistrict !== 'all' && r.districtId !== filterDistrict) return false;
      if (filterDept !== 'all' && r.department !== filterDept) return false;
      if (filterYear !== 'all' && String(r.year) !== filterYear) return false;
      if (filterQuarter !== 'all' && String(r.quarter) !== filterQuarter) return false;
      return true;
    });
  }, [reports, filterDistrict, filterDept, filterYear, filterQuarter]);

  const handleExport = (fmt: 'csv' | 'xlsx') => {
    const rows = filteredBrowserReports.map((r) => ({
      Church: r.churchName,
      District: r.districtName || r.districtId,
      Department: DEPT_CONFIG[r.department]?.label || r.department,
      Period: `Q${r.quarter} ${r.year}`,
      Status: r.status,
      SubmittedBy: r.submittedByName || r.submittedBy,
      ...r.payload,
    }));
    if (fmt === 'csv') exportToCsv('quarterly_department_reports', rows);
    else exportToExcel('quarterly_department_reports', [{ name: 'Quarterly Reports', rows }]);
    notify(`Exported ${rows.length} quarterly department reports.`, 'success');
  };

  const currentConfig = DEPT_CONFIG[formDept];
  const penatalayananApTotal =
    formDept === 'penatalayanan'
      ? Number(payload.borangApMonth1Tithe || 0) +
        Number(payload.borangApMonth1Offering || 0) +
        Number(payload.borangApMonth2Tithe || 0) +
        Number(payload.borangApMonth2Offering || 0) +
        Number(payload.borangApMonth3Tithe || 0) +
        Number(payload.borangApMonth3Offering || 0)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="inline-flex p-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] self-start">
          {capabilities.canSubmitDepartmentReports && (
            <button
              type="button"
              onClick={() => setActiveTab('submit')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'submit'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Submit Quarterly Report
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('browser')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'browser'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Read-Only Report Browser
          </button>
        </div>

        <div className="text-xs text-[var(--text-muted)]">
          Central Data Schema · Kanak-Kanak, Penatalayanan, SSPM & Wanita
        </div>
      </div>

      {/* TAB 1: SUBMISSION FORM */}
      {activeTab === 'submit' && capabilities.canSubmitDepartmentReports && (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b border-[var(--border-hairline)]">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Church
              </label>
              <select
                value={formChurchId}
                onChange={(e) => setFormChurchId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                {scopedChurches.length === 0 && (
                  <option value="">No churches available</option>
                )}
                {scopedChurches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Department
              </label>
              <select
                value={formDept}
                onChange={(e) => setFormDept(e.target.value as DepartmentType)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                {Object.entries(DEPT_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Quarter
              </label>
              <select
                value={formQuarter}
                onChange={(e) => setFormQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
              >
                <option value={1}>Q1 (Jan – Mar)</option>
                <option value={2}>Q2 (Apr – Jun)</option>
                <option value={3}>Q3 (Jul – Sep)</option>
                <option value={4}>Q4 (Oct – Dec)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Year
              </label>
              <select
                value={formYear}
                onChange={(e) => setFormYear(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
              >
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-display font-semibold">
                {currentConfig.label}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {currentConfig.subtitle}
              </p>
            </div>
            <div className="text-xs font-mono-tabular text-[var(--text-muted)]">
              ID: {deterministicId || '—'}
            </div>
          </div>

          {formDept === 'penatalayanan' && (
            <div className="p-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Combined Borang AP 3-Month Tithe & Offering Total
              </span>
              <span className="text-base font-mono-tabular font-semibold">
                {formatCurrencyRM(penatalayananApTotal)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentConfig.fields.map((field) => (
              <div
                key={field.key}
                className="p-3.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
                  {field.label}
                </label>
                <input
                  type="number"
                  min={0}
                  step={field.isCurrency ? '0.01' : '1'}
                  value={payload[field.key] ?? 0}
                  onChange={(e) =>
                    setPayload((prev) => ({
                      ...prev,
                      [field.key]: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-1.5 text-sm font-mono-tabular font-semibold rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Departmental Remarks & Action Plan
            </label>
            <textarea
              rows={3}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Highlights, leadership needs, or training notes for this quarter..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveQuarterly('draft')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveQuarterly('submitted')}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{saving ? 'Submitting...' : 'Submit Quarterly Report'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: READ-ONLY REPORT BROWSER */}
      {activeTab === 'browser' && (
        <div className="space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
              >
                <option value="all">All Districts</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
              >
                <option value="all">All 4 Departments</option>
                {Object.entries(DEPT_CONFIG).map(([k, cfg]) => (
                  <option key={k} value={k}>
                    {cfg.label}
                  </option>
                ))}
              </select>
              <select
                value={filterQuarter}
                onChange={(e) => setFilterQuarter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] font-mono-tabular"
              >
                <option value="all">All Quarters</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport('csv')}
                disabled={filteredBrowserReports.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('xlsx')}
                disabled={filteredBrowserReports.length === 0}
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

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden print-sheet">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded bg-[var(--bg-subtle)] animate-pulse" />
                ))}
              </div>
            ) : filteredBrowserReports.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--text-muted)]">
                No quarterly department reports match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                      <th className="py-3 px-4 font-medium">Church</th>
                      <th className="py-3 px-4 font-medium">District</th>
                      <th className="py-3 px-4 font-medium">Department</th>
                      <th className="py-3 px-4 font-medium">Period</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">Submitted By</th>
                      <th className="py-3 px-4 font-medium text-right no-print">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    {filteredBrowserReports.map((r) => (
                      <tr key={r.id} className="hover:bg-[var(--bg-subtle)]/60">
                        <td className="py-3 px-4 font-medium">{r.churchName}</td>
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {r.districtName || r.districtId}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {DEPT_CONFIG[r.department]?.label || r.department}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono-tabular whitespace-nowrap">
                          Q{r.quarter} {r.year}
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
                        <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                          {r.submittedByName || 'Pastor'}
                        </td>
                        <td className="py-3 px-4 text-right no-print">
                          <button
                            type="button"
                            onClick={() => setInspectReport(r)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Detail</span>
                          </button>
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

      {/* Read-Only Inspection Drawer */}
      {inspectReport && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end no-print">
          <div className="max-w-lg w-full h-full bg-[var(--bg-surface)] border-l border-[var(--border-hairline)] overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
              <div>
                <div className="text-xs text-[var(--text-muted)]">
                  {DEPT_CONFIG[inspectReport.department]?.label} · Q{inspectReport.quarter}{' '}
                  {inspectReport.year}
                </div>
                <h2 className="text-lg font-display font-semibold mt-0.5">
                  {inspectReport.churchName}
                </h2>
                <div className="text-xs text-[var(--text-secondary)]">
                  Submitted by {inspectReport.submittedByName || 'District Pastor'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectReport(null)}
                className="p-1.5 rounded-lg border border-[var(--border-hairline)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-[var(--border-hairline)] border border-[var(--border-hairline)] rounded-lg overflow-hidden">
              {(DEPT_CONFIG[inspectReport.department]?.fields || []).map((f) => {
                const rawVal = Number(inspectReport.payload?.[f.key] || 0);
                return (
                  <div
                    key={f.key}
                    className="px-4 py-2.5 flex items-center justify-between text-sm bg-[var(--bg-canvas)]"
                  >
                    <span className="text-xs text-[var(--text-secondary)]">{f.label}</span>
                    <span className="font-mono-tabular font-semibold">
                      {f.isCurrency ? formatCurrencyRM(rawVal) : rawVal.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>

            {inspectReport.notes && (
              <div>
                <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
                  Remarks & Action Plan
                </div>
                <div className="p-3.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-xs leading-relaxed">
                  {inspectReport.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
