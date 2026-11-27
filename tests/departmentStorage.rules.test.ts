import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createMockUserToken, getModularInstance } from '@firebase/util';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, Timestamp, type Firestore } from 'firebase/firestore';
import { defaultDepartmentTemplates, departmentAnswers, readDepartmentTemplate, templateDefinition } from '../src/lib/departmentReports';
import { findDepartmentReports, saveDepartmentReport, saveDepartmentTemplate } from '../src/lib/departmentStorage';
import { ReportConflictError } from '../src/lib/borangBStorage';
import { readQuarterlyReport } from '../src/lib/reportViews';
import { readUserProfile } from '../src/lib/userProfiles';
const projectId = 'demo-pastorpro-sync';
let env: RulesTestEnvironment;
const profile = readUserProfile('pastor', { displayName: 'Pastor Sample', userRole: 'districtPastor', mission: 'm', district: 'd', isActive: true, isApproved: true });
const church = { id: 'c', name: 'Sample Church', missionId: 'm', districtId: 'd', regionId: 'r', isActive: true };
const template = defaultDepartmentTemplates()[0];
const values = Object.fromEntries(template.steps.flatMap(step => step.fields.map(field => [field.id, 2])));
const db = (uid = 'pastor') => getModularInstance<Firestore>(env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore() as unknown as { _delegate: Firestore });
const options = () => ({ projectId, databaseId: '(default)', getIdToken: async () => createMockUserToken({ sub: 'pastor', email: 'pastor@example.com', email_verified: true }, projectId), commitUrl: `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents:commit` });
const input = () => ({ church, profile, template, year: 2026, quarter: 4, values, existing: null });
before(async () => { if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator required'); const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':'); env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: readFileSync(process.env.DEPARTMENT_RULES_FILE || 'firestore.rules', 'utf8') } }); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    for (const [uid, role, district] of [['pastor', 'districtPastor', 'd'], ['other', 'districtPastor', 'other-d'], ['admin', 'admin', 'd'], ['inactive', 'districtPastor', 'd']]) await setDoc(doc(context.firestore(), `users/${uid}`), { uid, userRole: role, district, mission: 'm', isActive: uid !== 'inactive', isApproved: uid !== 'inactive', approvalStatus: uid === 'inactive' ? 'pending' : 'approved' });
    await setDoc(doc(context.firestore(), 'churches/c'), church);
    await setDoc(doc(context.firestore(), `department_report_templates/${template.id}`), { ...templateDefinition(template), createdBy: 'admin', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  });
});
after(async () => { await env?.cleanup(); });
test('canonical department responses create, read and update in place with Flutter fields and a historical snapshot', async () => {
  await saveDepartmentReport(db(), input(), options());
  const saved = (await findDepartmentReports(db(), church.id, 2026, 4, template.key))[0];
  assert.equal(saved.status, 'submitted'); assert.equal(saved.department, template.key);
  assert.equal(departmentAnswers(saved).count0to2, 2); assert.ok(saved.sourceData?.submittedAt instanceof Timestamp);
  assert.ok(saved.sourceData?.templateSnapshot);
  await saveDepartmentReport(db(), { ...input(), existing: saved, values: { ...values, count0to2: 7 } }, options());
  assert.equal(departmentAnswers((await findDepartmentReports(db(), church.id, 2026, 4, template.key))[0]).count0to2, 7);
  await assert.rejects(saveDepartmentReport(db(), input(), options()), ReportConflictError);
  await assert.rejects(saveDepartmentReport(db(), { ...input(), existing: saved }, options()), ReportConflictError);
});
test('legacy children UUID/department aliases reuse the original ID and preserve unknown data', async () => {
  const raw = { churchId: 'c', churchName: church.name, missionId: 'm', districtId: 'd', regionId: 'r', department: 'kanakKanak', year: 2026, quarter: 4, submittedBy: 'pastor', createdAt: Timestamp.now(), updatedAt: Timestamp.now(), kanakKanakData: { count0to2: 4 }, archivedNote: 'keep', payload: { age0to4: 9 } };
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'quarterly_department_reports/legacy-uuid'), raw));
  const saved = readQuarterlyReport('legacy-uuid', raw);
  await assert.rejects(saveDepartmentReport(db(), input(), options()), ReportConflictError);
  await saveDepartmentReport(db(), { ...input(), existing: saved, values: { ...departmentAnswers(saved), ...values } }, options());
  const result = (await getDoc(doc(db(), 'quarterly_department_reports/legacy-uuid'))).data()!;
  assert.equal(result.archivedNote, 'keep'); assert.equal(result.values.age0to4, 9); assert.equal(result.id, 'legacy-uuid');
  assert.equal((await findDepartmentReports(db(), 'c', 2026, 4, template.key)).length, 1);
});
test('changed or closed templates reject answers prepared against the older definition', async () => {
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), `department_report_templates/${template.id}`), { isActive: false }));
  await assert.rejects(saveDepartmentReport(db(), input(), options()), ReportConflictError);
});
test('template saves enforce administrator access and reject stale schema edits', async () => {
  const loaded = readDepartmentTemplate(template.id, (await getDoc(doc(db('admin'), `department_report_templates/${template.id}`))).data()!);
  await assert.rejects(saveDepartmentTemplate(db(), { ...loaded, name: 'Unauthorized' }, 'pastor'));
  await saveDepartmentTemplate(db('admin'), { ...loaded, name: 'Updated title' }, 'admin');
  await assert.rejects(saveDepartmentTemplate(db('admin'), { ...loaded, name: 'Stale title' }, 'admin'), ReportConflictError);
});
// The saved production snapshot is used only for compatibility, not as a secure policy baseline.
if (!process.env.DEPARTMENT_RULES_FILE) {
  test('district and approval boundaries protect responses and template management', async () => {
    await saveDepartmentReport(db(), input(), options());
    const id = `${church.id}_2026_Q4_${template.key}`;
    await assertFails(getDoc(doc(db('other'), `quarterly_department_reports/${id}`)));
    await assertFails(getDoc(doc(db('inactive'), `quarterly_department_reports/${id}`)));
    await assertSucceeds(getDocs(query(collection(db(), 'quarterly_department_reports'), where('districtId', '==', 'd'))));
    await assertFails(getDocs(collection(db(), 'quarterly_department_reports')));
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'department_report_templates')));
    await assertFails(updateDoc(doc(db(), `department_report_templates/${template.id}`), { isActive: false }));
    const stored = (await getDoc(doc(db(), `quarterly_department_reports/${id}`))).data()!;
    await assertFails(updateDoc(doc(db(), `quarterly_department_reports/${id}`), { ...stored, districtId: 'other-d', editedBy: 'pastor' }));
  });
}

test('new admin forms use a stable department key identity and cannot race a second create', async () => {
  const blank = { ...template, id: 'unsaved-editor-id', key: 'new_department', name: 'New Department', sourceData: undefined };
  await saveDepartmentTemplate(db('admin'), blank, 'admin');
  assert.ok((await getDoc(doc(db('admin'), 'department_report_templates/form_new_department'))).exists());
  await assert.rejects(saveDepartmentTemplate(db('admin'), { ...blank, id: 'second-unsaved-id' }, 'admin'), ReportConflictError);
  assert.equal((await getDocs(query(collection(db('admin'), 'department_report_templates'), where('key', '==', 'new_department')))).size, 1);
});
