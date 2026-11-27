import { useEffect, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { Check, Printer, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType, reportListenerError } from '../lib/firebase';
import { MONTHS, triggerPrintPdf } from '../lib/exportUtils';
import { useToast } from '../components/Toast';
import type { BorangBReport } from '../types';

interface BorangBFormState {
  sermonsPreached: number;
  bibleStudiesGiven: number;
  homeVisitations: number;
  hospitalVisitations: number;
  counselingSessions: number;
  evangelisticMeetings: number;
  baptisms: number;
  professionsOfFaith: number;
  boardMeetings: number;
  communionServices: number;
  anointings: number;
  weddings: number;
  funerals: number;
  childDedications: number;
  titheFaithfulnessNotes: string;
  challengesAndPrayer: string;
  nextMonthGoals: string;
}

const EMPTY_FORM: BorangBFormState = {
  sermonsPreached: 0,
  bibleStudiesGiven: 0,
  homeVisitations: 0,
  hospitalVisitations: 0,
  counselingSessions: 0,
  evangelisticMeetings: 0,
  baptisms: 0,
  professionsOfFaith: 0,
  boardMeetings: 0,
  communionServices: 0,
  anointings: 0,
  weddings: 0,
  funerals: 0,
  childDedications: 0,
  titheFaithfulnessNotes: '',
  challengesAndPrayer: '',
  nextMonthGoals: '',
};

const NUMERIC_FIELDS: { key: keyof BorangBFormState; label: string; max: number }[] = [
  { key: 'sermonsPreached', label: 'Sermons Preached', max: 1000 },
  { key: 'bibleStudiesGiven', label: 'Bible Studies Conducted', max: 2000 },
  { key: 'homeVisitations', label: 'Home Visitations', max: 2000 },
  { key: 'hospitalVisitations', label: 'Hospital / Sick Visits', max: 1000 },
  { key: 'counselingSessions', label: 'Pastoral Counseling Sessions', max: 1000 },
  { key: 'evangelisticMeetings', label: 'Evangelistic Meetings', max: 1000 },
  { key: 'baptisms', label: 'Baptisms', max: 5000 },
  { key: 'professionsOfFaith', label: 'Professions of Faith', max: 5000 },
  { key: 'boardMeetings', label: 'Church Board Meetings', max: 500 },
  { key: 'communionServices', label: 'Communion Services', max: 500 },
  { key: 'anointings', label: 'Anointing Services', max: 500 },
  { key: 'weddings', label: 'Weddings Officiated', max: 500 },
  { key: 'funerals', label: 'Funeral Services', max: 500 },
  { key: 'childDedications', label: 'Child Dedications', max: 500 },
];

export function BorangBPage() {
  const { profile } = useAuth();
  const { notify } = useToast();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [form, setForm] = useState<BorangBFormState>(EMPTY_FORM);
  const [status, setStatus] = useState<'draft' | 'submitted'>('draft');
  const [history, setHistory] = useState<BorangBReport[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hasExistingDoc, setHasExistingDoc] = useState(false);

  const debounceRef = useRef<number | null>(null);
  const hydratedRef = useRef(false);

  const reportDocId = profile
    ? `${profile.uid}_${year}_${String(month).padStart(2, '0')}`
    : '';

  useEffect(() => {
    if (!profile) return;
    const unsub = onSnapshot(
      query(
        collection(db, 'borang_b_reports'),
        where('userId', '==', profile.uid),
      ),
      (snap) => {
        const items = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BorangBReport, 'id'>),
          }))
          .sort((a, b) => (b.year - a.year) || (b.month - a.month));
        setHistory(items);
      },
      (err) => {
        reportListenerError(err, OperationType.LIST, 'borang_b_reports');
      },
    );
    return () => unsub();
  }, [profile]);

  useEffect(() => {
    if (!reportDocId) return;
    hydratedRef.current = false;
    const ref = doc(db, 'borang_b_reports', reportDocId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as BorangBReport;
          setHasExistingDoc(true);
          setStatus(data.status || 'draft');
          setForm({
            sermonsPreached: data.sermonsPreached ?? 0,
            bibleStudiesGiven: data.bibleStudiesGiven ?? 0,
            homeVisitations: data.homeVisitations ?? 0,
            hospitalVisitations: data.hospitalVisitations ?? 0,
            counselingSessions: data.counselingSessions ?? 0,
            evangelisticMeetings: data.evangelisticMeetings ?? 0,
            baptisms: data.baptisms ?? 0,
            professionsOfFaith: data.professionsOfFaith ?? 0,
            boardMeetings: data.boardMeetings ?? 0,
            communionServices: data.communionServices ?? 0,
            anointings: data.anointings ?? 0,
            weddings: data.weddings ?? 0,
            funerals: data.funerals ?? 0,
            childDedications: data.childDedications ?? 0,
            titheFaithfulnessNotes: data.titheFaithfulnessNotes || '',
            challengesAndPrayer: data.challengesAndPrayer || '',
            nextMonthGoals: data.nextMonthGoals || '',
          });
        } else {
          setHasExistingDoc(false);
          setStatus('draft');
          setForm(EMPTY_FORM);
        }
        hydratedRef.current = true;
      },
      (err) => {
        hydratedRef.current = true;
        reportListenerError(
          err,
          OperationType.GET,
          `borang_b_reports/${reportDocId}`,
        );
      },
    );
    return () => unsub();
  }, [reportDocId]);

  const persistReport = async (
    nextForm: BorangBFormState,
    nextStatus: 'draft' | 'submitted',
    manualSubmit = false,
  ) => {
    if (!profile || !reportDocId) return;
    setSaveState('saving');
    const ref = doc(db, 'borang_b_reports', reportDocId);
    const payload = {
      userId: profile.uid,
      pastorName: profile.displayName.slice(0, 120),
      missionId: profile.missionId || 'sam_sabah',
      ...(profile.regionId ? { regionId: profile.regionId } : {}),
      districtId: profile.districtId || 'unassigned',
      ...(profile.districtName ? { districtName: profile.districtName } : {}),
      year,
      month,
      status: nextStatus,
      sermonsPreached: Math.max(0, Math.round(nextForm.sermonsPreached || 0)),
      bibleStudiesGiven: Math.max(0, Math.round(nextForm.bibleStudiesGiven || 0)),
      homeVisitations: Math.max(0, Math.round(nextForm.homeVisitations || 0)),
      hospitalVisitations: Math.max(0, Math.round(nextForm.hospitalVisitations || 0)),
      counselingSessions: Math.max(0, Math.round(nextForm.counselingSessions || 0)),
      evangelisticMeetings: Math.max(0, Math.round(nextForm.evangelisticMeetings || 0)),
      baptisms: Math.max(0, Math.round(nextForm.baptisms || 0)),
      professionsOfFaith: Math.max(0, Math.round(nextForm.professionsOfFaith || 0)),
      boardMeetings: Math.max(0, Math.round(nextForm.boardMeetings || 0)),
      communionServices: Math.max(0, Math.round(nextForm.communionServices || 0)),
      anointings: Math.max(0, Math.round(nextForm.anointings || 0)),
      weddings: Math.max(0, Math.round(nextForm.weddings || 0)),
      funerals: Math.max(0, Math.round(nextForm.funerals || 0)),
      childDedications: Math.max(0, Math.round(nextForm.childDedications || 0)),
      titheFaithfulnessNotes: nextForm.titheFaithfulnessNotes.slice(0, 1500),
      challengesAndPrayer: nextForm.challengesAndPrayer.slice(0, 2000),
      nextMonthGoals: nextForm.nextMonthGoals.slice(0, 2000),
      ...(!hasExistingDoc ? { createdAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(ref, payload, { merge: true });
      setStatus(nextStatus);
      setSaveState('saved');
      if (manualSubmit) {
        notify(
          `Borang B for ${MONTHS[month - 1]} ${year} submitted to Mission.`,
          'success',
        );
      }
    } catch (err) {
      setSaveState('idle');
      handleFirestoreError(
        err,
        OperationType.WRITE,
        `borang_b_reports/${reportDocId}`,
      );
    }
  };

  const handleFieldChange = (
    key: keyof BorangBFormState,
    value: number | string,
  ) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (!hydratedRef.current) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSaveState('saving');
    debounceRef.current = window.setTimeout(() => {
      persistReport(next, status);
    }, 800);
  };

  return (
    <div className="space-y-8">
      {/* Period Selector & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[var(--border-hairline)] no-print">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="px-3.5 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3.5 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] font-mono-tabular"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="text-xs text-[var(--text-muted)]">
            Status:{' '}
            <strong className="text-[var(--text-primary)] capitalize">
              {status}
            </strong>
            {saveState === 'saving' && ' · Saving...'}
            {saveState === 'saved' && ' · Auto-saved'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerPrintPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF / Print</span>
          </button>
          <button
            type="button"
            onClick={() => persistReport(form, 'submitted', true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] whitespace-nowrap"
          >
            {status === 'submitted' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Update Submission</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Borang B</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Printable Borang B Form Sheet */}
      <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-6 md:p-8 space-y-8 print-sheet">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[var(--border-hairline)]">
          <div>
            <div className="text-xs text-[var(--text-muted)]">
              Sabah Adventist Mission · Ministerial Department
            </div>
            <h2 className="text-xl font-display font-semibold mt-1">
              Borang B — Monthly Pastoral Report ({MONTHS[month - 1]} {year})
            </h2>
          </div>
          <div className="text-xs text-[var(--text-secondary)] space-y-0.5 text-left sm:text-right">
            <div>Pastor: {profile?.displayName}</div>
            <div>District: {profile?.districtName || 'Unassigned'}</div>
          </div>
        </div>

        {/* Quantitative Metrics Grid */}
        <div>
          <h3 className="text-sm font-semibold mb-4">
            01. Ministerial & Evangelistic Metrics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {NUMERIC_FIELDS.map((field) => (
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
                  max={field.max}
                  value={form[field.key] as number}
                  onChange={(e) =>
                    handleFieldChange(field.key, Math.max(0, Number(e.target.value)))
                  }
                  className="w-full px-2.5 py-1.5 text-base font-mono-tabular font-semibold rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Qualitative Narratives */}
        <div className="space-y-4 pt-2 border-t border-[var(--border-hairline)]">
          <h3 className="text-sm font-semibold">
            02. Pastoral Reflections & District Notes
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Stewardship & Tithe Faithfulness Notes
              </label>
              <textarea
                rows={4}
                maxLength={1500}
                value={form.titheFaithfulnessNotes}
                onChange={(e) =>
                  handleFieldChange('titheFaithfulnessNotes', e.target.value)
                }
                placeholder="Observations across district congregations..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Challenges & Prayer Requests
              </label>
              <textarea
                rows={4}
                maxLength={2000}
                value={form.challengesAndPrayer}
                onChange={(e) =>
                  handleFieldChange('challengesAndPrayer', e.target.value)
                }
                placeholder="Ministry challenges or urgent family needs..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Next Month Ministry Goals
              </label>
              <textarea
                rows={4}
                maxLength={2000}
                value={form.nextMonthGoals}
                onChange={(e) =>
                  handleFieldChange('nextMonthGoals', e.target.value)
                }
                placeholder="Planned baptismal classes, visitations, or campaigns..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Personal Submission History */}
      <section className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden no-print">
        <div className="px-5 py-4 border-b border-[var(--border-hairline)]">
          <h3 className="text-sm font-semibold">Your Borang B Submission History</h3>
        </div>
        {history.length === 0 ? (
          <div className="p-6 text-xs text-[var(--text-muted)] text-center">
            No saved Borang B records yet. Editing any field above automatically saves your draft.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-2.5 px-4 font-medium">Period</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium text-right">Sermons</th>
                  <th className="py-2.5 px-4 font-medium text-right">Visits</th>
                  <th className="py-2.5 px-4 font-medium text-right">Bible Studies</th>
                  <th className="py-2.5 px-4 font-medium text-right">Baptisms</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--bg-subtle)]/60">
                    <td className="py-2.5 px-4 font-medium">
                      {MONTHS[(item.month || 1) - 1]} {item.year}
                    </td>
                    <td className="py-2.5 px-4 text-xs capitalize">
                      <span
                        className={
                          item.status === 'submitted'
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular">
                      {item.sermonsPreached}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular">
                      {(item.homeVisitations || 0) + (item.hospitalVisitations || 0)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular">
                      {item.bibleStudiesGiven}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono-tabular">
                      {item.baptisms}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setYear(item.year);
                          setMonth(item.month);
                        }}
                        className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
                      >
                        Load Month
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const currentYear = new Date().getFullYear();
