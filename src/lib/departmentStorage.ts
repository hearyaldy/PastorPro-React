import { collection, doc, getDocsFromServer, query, runTransaction, serverTimestamp, Timestamp, where, type Firestore } from 'firebase/firestore';
import { reportRevision } from './borangB';
import { createReportOnce, ReportConflictError } from './borangBStorage';
import { readQuarterlyReport } from './reportViews';
import { departmentKey, normalizeAnswers, readDepartmentTemplate, templateDefinition, templateFingerprint, validateAnswers, validateTemplate, type DepartmentAnswers, type DepartmentTemplate } from './departmentReports';
import type { Church, QuarterlyDepartmentReport, UserProfile } from '../types';
export async function saveDepartmentTemplate(db: Firestore, template: DepartmentTemplate, uid: string): Promise<void> {
  const errors = validateTemplate(template); if (errors.length) throw new Error(errors[0]);
  const templateId = template.sourceData || template.id.startsWith('default_') ? template.id : `form_${template.key}`;
  const sameKey = await getDocsFromServer(query(collection(db, 'department_report_templates'), where('key', '==', template.key)));
  if (sameKey.docs.some(item => item.id !== templateId)) throw new Error('This department key already exists. Open its existing form.');
  await runTransaction(db, async transaction => {
    const ref = doc(db, 'department_report_templates', templateId), current = await transaction.get(ref);
    if (template.sourceData ? !current.exists() || reportRevision(current.data()) !== reportRevision(template.sourceData) : current.exists()) throw new ReportConflictError('This form changed elsewhere. Reload it before saving.');
    if (current.exists() && current.data().key !== template.key) throw new Error('A published department key cannot be changed.');
    transaction.set(ref, { ...templateDefinition(template), createdAt: current.data()?.createdAt || serverTimestamp(), createdBy: current.data()?.createdBy || uid, updatedAt: serverTimestamp() }, { merge: true });
  });
}
export async function findDepartmentReports(db: Firestore, churchId: string, year: number, quarter: number, key: string) {
  const snapshot = await getDocsFromServer(query(collection(db, 'quarterly_department_reports'), where('churchId', '==', churchId)));
  return snapshot.docs.map(item => readQuarterlyReport(item.id, item.data())).filter(item => item.year === year && item.quarter === quarter && departmentKey(item.department) === key);
}
export async function saveDepartmentReport(db: Firestore, input: { church: Church; profile: UserProfile; template: DepartmentTemplate; year: number; quarter: number; values: DepartmentAnswers; existing: QuarterlyDepartmentReport | null }, options: {
  projectId: string; databaseId: string; getIdToken: () => Promise<string>; commitUrl?: string;
}) {
  const { church, profile, template, year, quarter, values, existing } = input;
  if (validateTemplate(template).length) throw new Error('This form definition needs an administrator’s review before it can accept responses.');
  if (Object.keys(validateAnswers(template, values)).length) throw new Error('Please complete the required questions before submitting.');
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(quarter) || quarter < 1 || quarter > 4) throw new Error('Choose a valid year and quarter.');
  if (!template.isActive) throw new Error('This form is no longer accepting responses.');
  if (existing && (existing.churchId !== church.id || existing.year !== year || existing.quarter !== quarter || departmentKey(existing.department) !== template.key)) throw new Error('This response does not match the selected form and reporting period.');
  const matches = await findDepartmentReports(db, church.id, year, quarter, template.key);
  if (!existing && matches.length) throw new ReportConflictError('A response already exists. Reload and open the saved response.');
  const raw = existing?.sourceData || {}, now = Timestamp.now();
  const id = existing?.id || `${church.id}_${year}_Q${quarter}_${template.key}`;
  const payload = { id, churchId: church.id, churchName: church.name, districtId: raw.districtId || church.districtId, missionId: raw.missionId || church.missionId,
    year, quarter, templateId: template.id, departmentKey: template.key, departmentName: template.name,
    values: normalizeAnswers(template, values), submittedBy: raw.submittedBy || profile.uid, submittedByName: raw.submittedByName || profile.displayName,
    submittedAt: raw.submittedAt || now, createdAt: raw.createdAt || now, updatedAt: now, editedBy: profile.uid,
    templateSnapshot: templateDefinition(template), templateRevision: templateFingerprint(template), ...(template.sourceData?.updatedAt ? { templateUpdatedAt: template.sourceData.updatedAt } : {}), ...('status' in raw ? { status: 'submitted' } : {}),
  };
  // Verify the live template before accepting answers built against an older definition.
  const checkTemplate = (data: Record<string, unknown> | undefined) => { if (!data || templateFingerprint(readDepartmentTemplate(template.id, data)) !== templateFingerprint(template) || data.isActive === false) throw new ReportConflictError('This form changed or closed. Reload the form before submitting. Your answers have been kept.'); };
  const ref = doc(db, 'quarterly_department_reports', id);
  if (existing) await runTransaction(db, async transaction => {
    const current = await transaction.get(ref), currentTemplate = await transaction.get(doc(db, 'department_report_templates', template.id));
    checkTemplate(currentTemplate.data());
    if (!current.exists() || reportRevision(current.data()) !== reportRevision(raw)) throw new ReportConflictError('Another device updated this response. Reload it before saving. Your answers have been kept.');
    transaction.set(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  });
  else {
    const templates = await getDocsFromServer(query(collection(db, 'department_report_templates'), where('key', '==', template.key)));
    checkTemplate(templates.docs.find(item => item.id === template.id)?.data());
    const resource = `projects/${options.projectId}/databases/${options.databaseId}/documents`;
    await createReportOnce({ commitUrl: options.commitUrl || `https://firestore.googleapis.com/v1/${resource}:commit`, documentName: `${resource}/quarterly_department_reports/${id}`, idToken: await options.getIdToken(), payload, serverTimestampFields: ['createdAt', 'submittedAt', 'updatedAt'] });
  }
}
