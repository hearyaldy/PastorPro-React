import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { findChurchFinancialReports, financialForm, saveChurchFinancialReport, type FinancialForm } from '../lib/financialStorage';
import { financialDocument } from '../lib/reportDocuments';
import { MONTHS } from '../lib/exportUtils';
import type { Church, FinancialReport, UserProfile } from '../types';
import { ReportPreview } from './ReportPreview';
import type { PrintableReport } from '../lib/pdfReport';

export function MissionFinancialEditor({ church, profile, year, month, onClose }: { church: Church; profile: UserProfile; year: number; month: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<FinancialForm>(financialForm());
  const [loading, setLoading] = useState(true);
  const [loadSucceeded, setLoadSucceeded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<PrintableReport | null>(null);
  const selected = reports.find(report => report.id === selectedId) || null;
  const legacy = selected && typeof selected.sourceData?.month === 'number';
  const readOnly = selected?.status === 'verified' || legacy || (reports.length > 1 && !selected);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const close = () => { if (!saving && (!dirty || window.confirm('Discard unsaved financial entries?'))) onClose(); };
  useEffect(() => {
    const guard = (event: Event) => {
      if (saving || (dirty && !window.confirm('Discard unsaved financial entries?'))) event.preventDefault();
    };
    const unload = (event: BeforeUnloadEvent) => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('pastorpro:before-navigate', guard); window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('pastorpro:before-navigate', guard); window.removeEventListener('beforeunload', unload); };
  }, [dirty, saving]);
  const load = async () => {
    setLoading(true); setLoadSucceeded(false); setError('');
    try {
      const records = await findChurchFinancialReports(db, church.id, year, month);
      setLoadSucceeded(true); setReports(records); const report = records.length === 1 ? records[0] : null;
      setSelectedId(report?.id || ''); setForm(financialForm(report)); setDirty(false);
    } catch { setError('Unable to load this church’s reports. Check your connection and account permissions. Saving is disabled until reports can be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [church.id, year, month]);
  const update = <K extends keyof FinancialForm,>(key: K, value: FinancialForm[K]) => { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); };
  const save = async () => {
    if (saving || loading || !loadSucceeded || readOnly) return;
    setSaving(true); setError('');
    try {
      if (!auth.currentUser) throw new Error('Sign in again before saving.');
      const saved = await saveChurchFinancialReport(db, { church, profile, year, month, form, existing: selected }, {
        projectId: firebaseConfig.projectId, databaseId: firebaseConfig.firestoreDatabaseId, getIdToken: () => auth.currentUser!.getIdToken(),
      });
      if (saved) { setReports([saved]); setSelectedId(saved.id); setForm(financialForm(saved)); }
      setDirty(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed. Your entries have been kept.'); }
    finally { setSaving(false); }
  };
  const control = 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded-lg px-3 py-2';
  return <dialog ref={dialog} aria-labelledby="mission-finance-title" onCancel={event => { event.preventDefault(); close(); }} className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl p-5 bg-[var(--bg-surface)] text-[var(--text-primary)] backdrop:bg-black/40">
    <div className="flex justify-between gap-4"><h3 id="mission-finance-title" className="font-semibold">{church.name} · {MONTHS[month - 1]} {year}</h3><button className={control} disabled={saving} onClick={close}>Close</button></div>
    <p className="text-sm my-3">Church financial report · {selected ? selected.status : 'New report'}</p>
    {loading ? <p role="status">Loading existing reports…</p> : <>
      {reports.length > 1 && <label>Multiple reports exist. Select the exact record to review: <select className={`${control} w-full`} value={selectedId} onChange={event => { if (dirty && !window.confirm('Discard unsaved entries?')) return; setSelectedId(event.target.value); setForm(financialForm(reports.find(report => report.id === event.target.value))); setDirty(false); }}><option value="">Select report</option>{reports.map(report => <option value={report.id} key={report.id}>{report.id} · {report.status}</option>)}</select></label>}
      {legacy && <p className="text-sm my-3">This report uses the older React financial structure. Preview it here, or edit it in the financial ledger.</p>}
      {selected?.status === 'verified' && <p className="text-sm my-3">Approved reports are read-only.</p>}
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
        <fieldset disabled={saving || !loadSucceeded || !!readOnly} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">{(['tithe', 'offerings', 'specialOfferings'] as const).map(key => <label key={key} className="text-sm">{key === 'specialOfferings' ? 'Special Offerings' : key === 'tithe' ? 'Tithe' : 'Offerings'} (RM)<input className={`${control} w-full mt-1`} type="number" min="0" step="0.01" required value={form[key]} onChange={event => update(key, Number(event.target.value))} /></label>)}</div>
          <div className="grid sm:grid-cols-2 gap-3">{(['receiptNumberFrom', 'receiptNumberTo'] as const).map(key => <label key={key} className="text-sm">Receipt {key.endsWith('From') ? 'From' : 'To'}<input className={`${control} w-full mt-1`} maxLength={120} value={form[key]} onChange={event => update(key, event.target.value)} /></label>)}</div>
          <div className="space-y-2"><h4 className="text-sm font-medium">Custom Finance Types</h4>{form.customFinanceTypes.map((item, index) => <div key={index} className="flex gap-2"><input className={`${control} min-w-0 flex-1`} aria-label={`Custom finance label ${index + 1}`} maxLength={120} required value={item.label} onChange={event => update('customFinanceTypes', form.customFinanceTypes.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} /><input className={`${control} w-28`} aria-label={`Custom finance amount ${index + 1}`} type="number" min="0" step="0.01" required value={item.amount} onChange={event => update('customFinanceTypes', form.customFinanceTypes.map((entry, i) => i === index ? { ...entry, amount: Number(event.target.value) } : entry))} /><button type="button" aria-label={`Remove custom finance ${index + 1}`} onClick={() => update('customFinanceTypes', form.customFinanceTypes.filter((_, i) => i !== index))}>Remove</button></div>)}<button type="button" className={control} disabled={form.customFinanceTypes.length >= 30} onClick={() => update('customFinanceTypes', [...form.customFinanceTypes, { label: '', amount: 0 }])}>Add Custom Type</button></div>
          <label className="block text-sm">Notes<textarea className={`${control} block w-full mt-1`} rows={3} maxLength={2000} value={form.notes} onChange={event => update('notes', event.target.value)} /></label>
          <label className="block text-sm">Status <select className={control} value={form.status} onChange={event => update('status', event.target.value as FinancialForm['status'])}><option value="draft">Draft</option><option value="submitted">Submitted</option></select></label>
          <button className={control} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Financial Report'}</button>
        </fieldset>
      </form>
      {selected && <button className={`${control} mt-3`} onClick={() => setPreview(financialDocument({ ...selected, churchName: church.name }))}>Preview / Print Saved Report</button>}
      <button className={`${control} ml-2 mt-3`} disabled={saving} onClick={() => { if (!dirty || window.confirm('Discard entries and reload?')) void load(); }}>Reload Saved Report</button>
    </>}
    {error && <p role="alert" className="text-red-700 mt-3">{error}</p>}
    {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
  </dialog>;
}
