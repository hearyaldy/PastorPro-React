import { collection, doc, getDocFromServer, getDocsFromServer, query, runTransaction, serverTimestamp, Timestamp, where, type Firestore } from 'firebase/firestore';
import { createReportOnce, ReportConflictError } from './borangBStorage';
import { reportRevision } from './borangB';
import { readFinancialReport } from './reportViews';
import type { Church, FinancialReport, UserProfile } from '../types';

export interface FinancialForm { tithe: number; offerings: number; specialOfferings: number; receiptNumberFrom: string; receiptNumberTo: string; notes: string; customFinanceTypes: { label: string; amount: number }[]; status: 'draft' | 'submitted' }
export function financialForm(report?: FinancialReport | null): FinancialForm {
  return { tithe: report?.tithe || 0, offerings: report?.offerings || 0, specialOfferings: report?.specialOfferings || 0,
    receiptNumberFrom: String(report?.sourceData?.receiptNumberFrom || ''), receiptNumberTo: String(report?.sourceData?.receiptNumberTo || ''),
    notes: report?.notes || '', customFinanceTypes: report?.customFinanceTypes?.map(item => ({ label: item.name || '', amount: item.amount || 0 })) || [], status: report?.status === 'submitted' ? 'submitted' : 'draft' };
}
export async function findChurchFinancialReports(db: Firestore, churchId: string, year: number, month: number) {
  const snapshot = await getDocsFromServer(query(collection(db, 'financial_reports'), where('churchId', '==', churchId)));
  return snapshot.docs.map(item => readFinancialReport(item.id, item.data())).filter((item): item is FinancialReport => item !== null && item.year === year && item.month === month);
}
export async function saveChurchFinancialReport(db: Firestore, input: { church: Church; profile: UserProfile; year: number; month: number; form: FinancialForm; existing: FinancialReport | null }, options: {
  projectId: string; databaseId: string; getIdToken: () => Promise<string>; commitUrl?: string;
}) {
  const { church, profile, year, month, form, existing } = input;
  if (existing?.status === 'verified') throw new Error('Approved reports are read-only.');
  if (existing && typeof existing.sourceData?.month === 'number') throw new Error('Use the financial ledger to edit this legacy report.');
  if (existing && (existing.churchId !== church.id || existing.year !== year || existing.month !== month)) throw new Error('The selected report does not match this church and period.');
  const matches = await findChurchFinancialReports(db, church.id, year, month);
  if (!existing && matches.length) throw new ReportConflictError('A report already exists for this church and month. Reload to open it.');
  const values = [form.tithe, form.offerings, form.specialOfferings, ...form.customFinanceTypes.map(item => item.amount)];
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Enter valid non-negative amounts.');
  const id = existing?.id || `${church.id}_${year}_${month}`;
  const now = Timestamp.now();
  const amount = (value: number) => Math.round(value * 100) / 100;
  const raw = existing?.sourceData || {};
  const history = Array.isArray(raw.history) ? raw.history : [];
  if (history.length >= 100) throw new Error('This report has reached the edit-history limit. Ask an administrator to review it.');
  const payload = { id, churchId: church.id, missionId: raw.missionId || church.missionId, districtId: raw.districtId || church.districtId, regionId: raw.regionId || church.regionId || null,
    month: raw.month || Timestamp.fromDate(new Date(Date.UTC(year, month - 1, 1) - 8 * 60 * 60 * 1000)), year,
    tithe: amount(form.tithe), offerings: amount(form.offerings), specialOfferings: amount(form.specialOfferings),
    receiptNumberFrom: form.receiptNumberFrom, receiptNumberTo: form.receiptNumberTo, notes: form.notes,
    customFinanceTypes: form.customFinanceTypes.map(item => ({ label: item.label, amount: amount(item.amount) })),
    submittedBy: existing?.submittedBy || profile.uid, submittedAt: raw.submittedAt || now, createdAt: raw.createdAt || now, updatedAt: now, editedBy: profile.uid, status: form.status,
    history: [...history, { editedBy: profile.uid, editorName: profile.displayName, editedAt: now, action: existing ? 'updated' : 'created', changes: { tithe: amount(form.tithe), offerings: amount(form.offerings), specialOfferings: amount(form.specialOfferings), status: form.status } }],
  };
  const resource = `projects/${options.projectId}/databases/${options.databaseId}/documents`;
  const ref = doc(db, 'financial_reports', id);
  if (!existing) await createReportOnce({ commitUrl: options.commitUrl || `https://firestore.googleapis.com/v1/${resource}:commit`, documentName: `${resource}/financial_reports/${id}`, idToken: await options.getIdToken(), payload,
    serverTimestampFields: ['createdAt', 'updatedAt', 'submittedAt'] });
  else await runTransaction(db, async transaction => {
    const current = await transaction.get(ref);
    if (!current.exists() || reportRevision(current.data()) !== reportRevision(raw)) throw new ReportConflictError('Another device changed this report. Reload before saving; your entries have been kept.');
    transaction.set(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  });
  return readFinancialReport(id, (await getDocFromServer(ref)).data()!);
}
