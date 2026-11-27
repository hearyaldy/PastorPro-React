import { useHierarchyLabels } from '../hooks/useHierarchyLabels';
import type { MissionReportContext } from '../components/MissionReportingDashboard';
import { useEffect, useRef, useState } from 'react';
import { collection, getDocsFromServer, onSnapshot, query, where } from 'firebase/firestore';
import { Check, Eye, Save, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { auth, db, OperationType, reportListenerError } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { MONTHS, formatCurrencyRM } from '../lib/exportUtils';
import { BORANG_B_SECTIONS, BORANG_B_TEXT_FIELDS, borangBForm, emptyBorangB, readBorangB, reportsForPeriod, type BorangBForm } from '../lib/borangB';
import { ReportConflictError, saveBorangB } from '../lib/borangBStorage';
import { borangBDocument } from '../lib/reportDocuments';
import type { PrintableReport } from '../lib/pdfReport';
import { ReportPreview } from '../components/ReportPreview';
import { StatisticsCards } from '../components/StatisticsCards';
import { useToast } from '../components/Toast';
import type { BorangBReport } from '../types';

export function BorangBPage({ initialContext }: { initialContext?: MissionReportContext }) {
  const labels = useHierarchyLabels();
  const { profile } = useAuth();
  const { missions } = useMission();
  const { notify } = useToast();
  const now = new Date();
  const [year, setYear] = useState(initialContext?.year || now.getFullYear());
  const [month, setMonth] = useState(initialContext?.month || now.getMonth() + 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<BorangBReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<BorangBForm>(emptyBorangB);
  const [status, setStatus] = useState<'draft' | 'submitted'>('draft');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [hydratedKey, setHydratedKey] = useState('');
  const [preview, setPreview] = useState<PrintableReport | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const base = useRef<BorangBReport | null>(null);
  const currentKey = useRef('');
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  const matching = reportsForPeriod(history, profile?.uid || '', year, month);
  const selected = selectedId ? matching.find(item => item.id === selectedId) : matching.length === 1 ? matching[0] : undefined;
  const ambiguous = matching.length > 1 && !selected;
  const reportId = selected?.id || `${profile?.uid}_${year}_${String(month).padStart(2, '0')}`;
  const key = `${profile?.uid}:${reportId}`;
  const ready = loaded && !ambiguous && hydratedKey === key;

  useEffect(() => {
    if (!profile) return;
    setLoaded(false);
    return onSnapshot(query(collection(db, 'borang_b_reports'), where('userId', '==', profile.uid)), snapshot => {
      setHistory(snapshot.docs.map(item => readBorangB(item.id, item.data())).filter((item): item is BorangBReport => item !== null).sort((a, b) => b.year - a.year || b.month - a.month));
      setLoaded(true);
    }, err => {
      reportListenerError(err, OperationType.LIST, 'borang_b_reports');
      setError('Unable to load your reports. Check your connection and account access.');
    });
  }, [profile?.uid]);

  useEffect(() => {
    if (!loaded || ambiguous || savingRef.current) return;
    if (dirtyRef.current) {
      if (currentKey.current !== key || selected?.revision !== base.current?.revision) {
        setConflict(true);
        setError('This month changed on another device. Reload the report before saving. Your unsaved entries are still visible.');
      }
      return;
    }
    base.current = selected || null;
    currentKey.current = key;
    setForm(selected ? borangBForm(selected) : emptyBorangB());
    setStatus(selected?.status || 'draft');
    setHydratedKey(key);
    setError(''); setConflict(false);
  }, [loaded, key, selected?.revision, ambiguous, saving, hydratedKey]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    const navigate = (event: Event) => {
      if ((dirtyRef.current || savingRef.current) && !window.confirm(savingRef.current ? 'Your report is still saving. Leave this page?' : 'You have unsaved report entries. Leave without saving?')) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('pastorpro:before-navigate', navigate);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('pastorpro:before-navigate', navigate); };
  }, []);

  const buildCurrent = (nextStatus = status): BorangBReport => {
    const existing = base.current;
    const initial = existing || readBorangB(reportId, {
      ...emptyBorangB(), userId: profile?.uid, userName: profile?.displayName,
      month, year, missionId: profile?.missionId || '', districtId: profile?.districtId || '',
      districtName: profile?.districtName || '', churchId: profile?.churchId || '',
    })!;
    return { ...initial, ...form, status: nextStatus };
  };

  const persist = async (nextStatus = status, manual = false): Promise<boolean> => {
    if (!profile || !auth.currentUser || !ready || conflict || savingRef.current) return false;
    savingRef.current = true; setSaving(true); setError('');
    try {
      const saved = await saveBorangB(db, buildCurrent(nextStatus), {
        isNew: !base.current, expectedRevision: base.current?.revision,
        projectId: firebaseConfig.projectId, databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        getIdToken: () => auth.currentUser!.getIdToken(),
      });
      base.current = saved;
      dirtyRef.current = false;
      setDirty(false); setStatus(saved.status); setSelectedId(saved.id);
      setHistory(items => [saved, ...items.filter(item => item.id !== saved.id)].sort((a, b) => b.year - a.year || b.month - a.month));
      if (manual) notify(nextStatus === 'submitted' ? 'Borang B submitted.' : 'Draft saved.', 'success');
      return true;
    } catch (err) {
      const isConflict = err instanceof ReportConflictError;
      setConflict(isConflict);
      setError(isConflict ? err.message : 'Could not save the report. Your entries are kept. Check your connection and access, then select Save Draft to retry.');
      reportListenerError(err, OperationType.WRITE, `borang_b_reports/${reportId}`);
      return false;
    } finally { savingRef.current = false; setSaving(false); }
  };
  saveRef.current = () => persist();

  useEffect(() => {
    if (!dirty || !ready || saving || error || conflict) return;
    const timer = window.setTimeout(() => { void saveRef.current(); }, 1200);
    return () => window.clearTimeout(timer);
  }, [form, dirty, ready, saving, error, conflict, key]);

  const changePeriod = async (nextYear: number, nextMonth: number, id: string | null = null) => {
    if (savingRef.current) return;
    if (dirtyRef.current && !(await persist())) return;
    dirtyRef.current = false; setDirty(false); setSelectedId(id); setYear(nextYear); setMonth(nextMonth);
  };
  const reload = async () => {
    if (dirtyRef.current && !window.confirm('Reload this report and discard your unsaved entries?')) return;
    try {
      const snapshot = await getDocsFromServer(query(collection(db, 'borang_b_reports'), where('userId', '==', profile!.uid)));
      dirtyRef.current = false; setDirty(false); setConflict(false); setError(''); setHydratedKey('');
      setHistory(snapshot.docs.map(item => readBorangB(item.id, item.data())).filter((item): item is BorangBReport => item !== null));
    } catch { setError('Unable to reload the report. Your entries are kept. Try again when connected.'); }
  };
  const update = (field: keyof BorangBForm, value: string | number) => {
    dirtyRef.current = true; setDirty(true);
    if (!conflict) setError('');
    setForm(previous => ({ ...previous, [field]: value }));
  };
  const missionName = labels.mission(profile?.missionId, profile?.missionName);
  const years = Array.from(new Set([now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, ...history.map(item => item.year)])).sort((a, b) => b - a);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 no-print">
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Report month" disabled={saving} value={month} onChange={event => void changePeriod(year, Number(event.target.value))} className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 text-sm">
          {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
        </select>
        <select aria-label="Report year" disabled={saving} value={year} onChange={event => void changePeriod(Number(event.target.value), month)} className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 text-sm">
          {years.map(value => <option key={value}>{value}</option>)}
        </select>
        <span aria-live="polite" className="text-xs text-[var(--text-secondary)]">{status.toUpperCase()} · {saving ? 'Saving…' : dirty ? 'Unsaved changes' : ready ? 'Up to date' : 'Loading…'}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button disabled={!ready || saving} onClick={() => { const document = borangBDocument(labels.withNames(buildCurrent()), missionName); if (dirty) document.metadata?.push(['Save status', 'Unsaved changes']); setPreview(document); }} className="inline-flex items-center gap-2 border border-[var(--border-hairline)] rounded-lg px-3 py-2 disabled:opacity-50"><Eye size={15} />Preview / Print</button>
        <button disabled={!ready || saving || conflict} onClick={() => void persist(status, true)} className="inline-flex items-center gap-2 border border-[var(--border-hairline)] rounded-lg px-3 py-2 disabled:opacity-50"><Save size={15} />Save Draft / Changes</button>
        <button disabled={!ready || saving || conflict} onClick={() => void persist('submitted', true)} className="inline-flex items-center gap-2 bg-[var(--accent-primary)] text-white rounded-lg px-3 py-2 disabled:opacity-50"><Send size={15} />{status === 'submitted' ? 'Update Submission' : 'Submit Report'}</button>
      </div>
    </div>
    {error && <div role="alert" className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 text-sm">{error}{conflict && <button onClick={() => void reload()} className="ml-3 underline font-semibold">Reload Report</button>}</div>}
    {ambiguous && <div role="alert" className="p-4 rounded-xl border border-amber-300 text-sm">There are {matching.length} reports for this month. Choose an existing record in the history below. A new duplicate will not be created.</div>}
    <StatisticsCards items={[
      { label: 'Members at End', value: form.membersEnd, icon: 'people', color: 'blue' },
      { label: 'Baptisms', value: form.baptisms, icon: 'people', color: 'teal' },
      { label: 'Total Visitations', value: form.homeVisitations + form.hospitalVisitations + form.prisonVisitations, icon: 'distance', color: 'green' },
      { label: 'Tithes & Offerings', value: formatCurrencyRM(form.tithe + form.offerings), icon: 'money', color: 'purple' },
    ]} />
    <div className="text-sm text-[var(--text-secondary)]">{missionName || 'Mission'} · {profile?.displayName} · {labels.district(profile?.districtId, profile?.districtName)}</div>
    <fieldset disabled={!ready || saving || conflict} className="grid gap-5 lg:grid-cols-2 disabled:opacity-60">
      {BORANG_B_SECTIONS.map(section => <section key={section.title} className="border border-[var(--border-hairline)] rounded-2xl bg-[var(--bg-surface)] overflow-hidden shadow-sm">
        <h3 className="px-5 py-4 text-sm font-semibold bg-[var(--bg-subtle)] border-b border-[var(--border-hairline)]">{section.title}</h3>
        <div className="divide-y divide-[var(--border-hairline)]">
          {section.fields.map(([field, label]) => <label key={field} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <span className={field === 'membersEnd' ? 'font-semibold' : ''}>{label}</span>
            <input aria-label={label} type="number" min={0} step={field === 'tithe' || field === 'offerings' ? '0.01' : '1'} value={form[field]}
              onChange={event => update(field, Math.max(0, Number(event.target.value) || 0))}
              className="w-28 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] rounded-lg px-3 py-2 text-right font-mono-tabular" />
          </label>)}
        </div>
      </section>)}
      <section className="border border-[var(--border-hairline)] rounded-2xl bg-[var(--bg-surface)] p-5 space-y-4">
        <h3 className="text-sm font-semibold">Additional Information</h3>
        {BORANG_B_TEXT_FIELDS.map(([field, label]) => <label key={field} className="block text-sm">{label}<textarea rows={3} maxLength={10000} value={form[field]} onChange={event => update(field, event.target.value)} className="mt-2 w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] rounded-lg p-3" /></label>)}
      </section>
    </fieldset>
    <section className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
      <h3 className="px-5 py-4 border-b border-[var(--border-hairline)] text-sm font-semibold">Your Borang B History</h3>
      <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="text-xs text-[var(--text-muted)]">{['Period', 'Status', 'Members', 'Bible Studies', 'Baptisms', ''].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{history.map(item => <tr key={item.id} className="border-t border-[var(--border-hairline)]"><td className="p-3">{MONTHS[item.month - 1]} {item.year}</td><td className="p-3 capitalize">{item.status}</td><td className="p-3">{item.membersEnd}</td><td className="p-3">{item.bibleStudies}</td><td className="p-3">{item.baptisms}</td><td className="p-3"><button disabled={saving} onClick={() => void changePeriod(item.year, item.month, item.id)} className="text-[var(--accent-primary)] font-medium">Open Record</button></td></tr>)}</tbody>
      </table></div>
      {!history.length && <p className="p-5 text-sm text-[var(--text-muted)]">No saved reports yet. Enter this month's statistics and save a draft.</p>}
    </section>
    {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
  </div>;
}
