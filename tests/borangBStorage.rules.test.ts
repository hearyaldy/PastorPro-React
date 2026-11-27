import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { createMockUserToken, getModularInstance } from '@firebase/util';
import { type Firestore, collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { emptyBorangB, readBorangB } from '../src/lib/borangB';
import { createReportOnce, ReportConflictError, saveBorangB } from '../src/lib/borangBStorage';

let env: RulesTestEnvironment;
const projectId = 'demo-pastorpro-sync';
const raw = { ...emptyBorangB(), id: 'flutter-uuid', userId: 'pastor', userName: 'Pastor A',
  month: '2026-11-01T00:00:00.000', status: 'draft', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
  membersEnd: 120, prisonVisitations: 3, churchId: 'church-a', missionId: 'mission-a', districtId: 'district-a' };
const db = () => getModularInstance<Firestore>(env.authenticatedContext('pastor', { email: 'pastor@example.com', email_verified: true }).firestore() as unknown as { _delegate: Firestore });
const token = () => createMockUserToken({ sub: 'pastor', email: 'pastor@example.com', email_verified: true }, projectId);
const options = (extra = {}) => ({ projectId, databaseId: '(default)', getIdToken: async () => token(),
  commitUrl: `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents:commit`, isNew: true, ...extra });

before(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error('Firestore emulator is required.');
  const [hostname, port] = host.split(':');
  env = await initializeTestEnvironment({ projectId, firestore: { host: hostname, port: Number(port), rules: readFileSync(process.env.FIRESTORE_RULES_FILE || 'firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users/pastor'), { uid: 'pastor', email: 'pastor@example.com', displayName: 'Pastor A', userRole: 'user', isActive: true, isApproved: true, approvalStatus: 'approved' });
  });
});
after(async () => { await env?.cleanup(); });
async function seedReport(value = raw) {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'borang_b_reports/flutter-uuid'), value));
}

test('React edits a Flutter UUID report in place and retains fields outside the form', async () => {
  await seedReport({ ...raw, legacyNote: 'preserve' } as typeof raw);
  const loaded = readBorangB('flutter-uuid', (await getDoc(doc(db(), 'borang_b_reports/flutter-uuid'))).data()!)!;
  await saveBorangB(db(), { ...loaded, bibleStudies: 17, remarks: 'Edited in React' }, options({ isNew: false, expectedRevision: loaded.revision }));
  const saved = (await getDoc(doc(db(), 'borang_b_reports/flutter-uuid'))).data()!;
  assert.equal(saved.id, 'flutter-uuid'); assert.equal(saved.bibleStudies, 17);
  assert.equal(saved.legacyNote, 'preserve'); assert.equal(saved.month, raw.month);
  assert.equal((await getDocs(query(collection(db(), 'borang_b_reports'), where('userId', '==', 'pastor')))).size, 1);
});

test('stale React edits cannot overwrite a later phone edit', async () => {
  await seedReport();
  const loaded = readBorangB('flutter-uuid', raw)!;
  await updateDoc(doc(db(), 'borang_b_reports/flutter-uuid'), { remarks: 'New phone note' });
  await assert.rejects(saveBorangB(db(), { ...loaded, remarks: 'Stale desktop note' }, options({ isNew: false, expectedRevision: loaded.revision })), ReportConflictError);
  assert.equal((await getDoc(doc(db(), 'borang_b_reports/flutter-uuid'))).data()?.remarks, 'New phone note');
});

test('an existing Flutter month prevents creation of a second React report', async () => {
  await seedReport();
  const draft = readBorangB('pastor_2026_11', raw)!;
  await assert.rejects(saveBorangB(db(), draft, options()), ReportConflictError);
});

test('conditional creation succeeds once and rejects racing writes without overwriting', async () => {
  const payload = { ...raw, id: 'pastor_2026_11' };
  const input = { commitUrl: options().commitUrl, documentName: `projects/${projectId}/databases/(default)/documents/borang_b_reports/pastor_2026_11`, idToken: token(), payload };
  const results = await Promise.allSettled([createReportOnce(input), createReportOnce({ ...input, payload: { ...payload, remarks: 'racing write' } })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
  assert.ok(failure.reason instanceof ReportConflictError);
});

test('first React save creates a Flutter-readable month and allows later transaction edits', async () => {
  const draft = readBorangB('pastor_2026_11', raw)!;
  const saved = await saveBorangB(db(), draft, options());
  const updated = await saveBorangB(db(), { ...saved, membersEnd: 125 }, options({ isNew: false, expectedRevision: saved.revision }));
  assert.equal(updated.membersEnd, 125);
  assert.equal((await getDoc(doc(db(), 'borang_b_reports/pastor_2026_11'))).data()?.month, raw.month);
});
