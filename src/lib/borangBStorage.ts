import { collection, doc, getDocsFromServer, query, runTransaction, where, type Firestore } from 'firebase/firestore';
import { readBorangB, reportRevision, reportsForPeriod, writeBorangB } from './borangB';
import type { BorangBReport } from '../types';

export class ReportConflictError extends Error {}

function firestoreValue(value: unknown): Record<string, unknown> {
  if (value == null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return { timestampValue: value.toDate().toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value as object).map(([key, child]) => [key, firestoreValue(child)])) } };
}

/** Browser SDK setDoc has no exists:false option. This conditional commit prevents a racing create from overwriting a report. */
export async function createReportOnce(options: { commitUrl: string; documentName: string; idToken: string; payload: Record<string, unknown>; serverTimestampFields?: string[] }) {
  const result = await fetch(options.commitUrl, {
    method: 'POST', headers: { Authorization: `Bearer ${options.idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{
      update: { name: options.documentName, fields: Object.fromEntries(Object.entries(options.payload).map(([key, value]) => [key, firestoreValue(value)])) },
      currentDocument: { exists: false },
      ...(options.serverTimestampFields?.length ? { updateTransforms: options.serverTimestampFields.map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })) } : {}),
    }] }),
  });
  if (result.ok) return;
  if (result.status === 409 || result.status === 412) throw new ReportConflictError('A report was created elsewhere. Reload this month before saving.');
  const body = await result.json().catch(() => ({}));
  const error = new Error(body.error?.message || 'Unable to save this report. Check your connection and access.');
  Object.assign(error, { code: result.status === 403 ? 'permission-denied' : 'unavailable' });
  throw error;
}

export async function saveBorangB(db: Firestore, report: BorangBReport, options: {
  isNew: boolean; expectedRevision?: string; projectId: string; databaseId: string;
  getIdToken: () => Promise<string>; commitUrl?: string;
}): Promise<BorangBReport> {
  // Query the server before choosing an ID; cached absence must not create a duplicate Flutter UUID report.
  const snapshot = await getDocsFromServer(query(collection(db, 'borang_b_reports'), where('userId', '==', report.userId)));
  const all = snapshot.docs.map(d => readBorangB(d.id, d.data())).filter((item): item is BorangBReport => item !== null);
  const matching = reportsForPeriod(all, report.userId, report.year, report.month);
  if (options.isNew && matching.length) throw new ReportConflictError('A report already exists for this month. Reload and open that report instead.');
  if (!options.isNew && !matching.some(item => item.id === report.id)) throw new ReportConflictError('This report changed or was deleted. Reload this month before saving.');
  const payload = writeBorangB(report, new Date().toISOString());
  const resource = `projects/${options.projectId}/databases/${options.databaseId}/documents`;
  if (options.isNew) {
    await createReportOnce({
      commitUrl: options.commitUrl || `https://firestore.googleapis.com/v1/${resource}:commit`,
      documentName: `${resource}/borang_b_reports/${report.id}`, idToken: await options.getIdToken(), payload,
    });
  } else {
    await runTransaction(db, async transaction => {
      const ref = doc(db, 'borang_b_reports', report.id);
      const current = await transaction.get(ref);
      if (!current.exists() || !options.expectedRevision || reportRevision(current.data()) !== options.expectedRevision) {
        throw new ReportConflictError('Another device updated this report. Reload it before saving your changes.');
      }
      transaction.set(ref, payload, { merge: true });
    });
  }
  const saved = readBorangB(report.id, { ...report.sourceData, ...payload });
  if (!saved) throw new Error('The report period is invalid.');
  return saved;
}
