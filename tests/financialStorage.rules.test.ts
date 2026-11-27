import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createMockUserToken, getModularInstance } from '@firebase/util';
import { doc, getDoc, setDoc, updateDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { financialForm, findChurchFinancialReports, saveChurchFinancialReport } from '../src/lib/financialStorage';
import { ReportConflictError } from '../src/lib/borangBStorage';
import { readFinancialReport } from '../src/lib/reportViews';
import { readUserProfile } from '../src/lib/userProfiles';
let env: RulesTestEnvironment;
const projectId = 'demo-pastorpro-sync';
const profile = readUserProfile('pastor', { userRole: 'districtPastor', displayName: 'Pastor A', mission: 'mission-a', district: 'district-a', isActive: true, isApproved: true });
const church = { id: 'church-a', name: 'Church A', districtId: 'district-a', missionId: 'mission-a', regionId: 'region-a', isActive: true };
const db = () => getModularInstance<Firestore>(env.authenticatedContext('pastor', { email: 'pastor@example.com', email_verified: true }).firestore() as unknown as { _delegate: Firestore });
const options = () => ({ projectId, databaseId: '(default)', getIdToken: async () => createMockUserToken({ sub: 'pastor', email: 'pastor@example.com', email_verified: true }, projectId), commitUrl: `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents:commit` });
const input = () => ({ church, profile, year: 2026, month: 11, form: { ...financialForm(), tithe: 100, offerings: 20, customFinanceTypes: [{ label: 'Building Fund', amount: 5 }] }, existing: null });
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator required');
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env = await initializeTestEnvironment({ projectId, firestore: { host, port: Number(port), rules: readFileSync(process.env.FIRESTORE_RULES_FILE || 'firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/pastor'), { uid: 'pastor', userRole: 'districtPastor', mission: 'mission-a', district: 'district-a', isActive: true, isApproved: true, approvalStatus: 'approved' });
    await setDoc(doc(context.firestore(), 'churches/church-a'), church);
  });
});
after(async () => { await env?.cleanup(); });
test('canonical financial create stores Flutter timestamps, labels, and history and can be edited in place', async () => {
  const saved = await saveChurchFinancialReport(db(), input(), options());
  assert.ok(saved); assert.equal(saved.month, 11); assert.equal(saved.totalIncome, 125);
  assert.ok(saved.sourceData?.month instanceof Timestamp); assert.ok(saved.sourceData?.createdAt instanceof Timestamp);
  const history = saved.sourceData?.history as Record<string, unknown>[];
  assert.equal(history[0].editedBy, profile.uid); assert.ok(history[0].editedAt instanceof Timestamp);
  const changed = await saveChurchFinancialReport(db(), { ...input(), existing: saved, form: { ...financialForm(saved), tithe: 110 } }, options());
  assert.equal(changed?.tithe, 110); assert.equal((await findChurchFinancialReports(db(), church.id, 2026, 11)).length, 1);
});
test('existing Flutter UUID reports prevent a second create, preserve extension fields, and reject stale edits', async () => {
  const raw = { id: 'uuid', churchId: church.id, missionId: church.missionId, districtId: church.districtId, regionId: church.regionId, year: 2026, month: Timestamp.fromDate(new Date('2026-10-31T16:00:00Z')), submittedBy: 'pastor', status: 'draft', createdAt: Timestamp.now(), submittedAt: Timestamp.now(), updatedAt: Timestamp.now(), editedBy: 'pastor', notes: '', receiptNumberFrom: '', receiptNumberTo: '', tithe: 100, offerings: 20, specialOfferings: 0, customFinanceTypes: [], history: [], preservedFamLink: 'fam-ref' };
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'financial_reports/uuid'), raw));
  await assert.rejects(saveChurchFinancialReport(db(), input(), options()), ReportConflictError);
  const report = readFinancialReport('uuid', raw)!;
  const saved = await saveChurchFinancialReport(db(), { ...input(), existing: report }, options());
  assert.equal(saved?.sourceData?.preservedFamLink, 'fam-ref');
  await assert.rejects(saveChurchFinancialReport(db(), { ...input(), existing: report }, options()), ReportConflictError);
  assert.equal((await getDoc(doc(db(), 'financial_reports/uuid'))).data()?.preservedFamLink, 'fam-ref');
});
test('approved financial reports cannot be changed through this editor', async () => {
  const saved = await saveChurchFinancialReport(db(), input(), options());
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), `financial_reports/${saved!.id}`), { status: 'approved' }));
  const approved = (await findChurchFinancialReports(db(), church.id, 2026, 11))[0];
  await assert.rejects(saveChurchFinancialReport(db(), { ...input(), existing: approved }, options()), /read-only/);
});
