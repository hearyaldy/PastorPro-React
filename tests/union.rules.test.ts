import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;
const candidate = readFileSync('firebase/union-hotfix/firestore.rules', 'utf8');

before(async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error('Run npm run test:union-rules using the local emulator.');
  const [hostname, port] = host.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-pastorpro-sync', firestore: { host: hostname, port: Number(port), rules: candidate },
  });
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); });

const payload = () => ({
  name: 'Malaysia Union Mission', code: 'MAUM', country: 'Malaysia', headquarters: '',
  isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});

async function account(role: string, flags: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/test-admin'), { userRole: role, ...flags });
  });
  return env.authenticatedContext('test-admin', { email_verified: true }).firestore();
}

test('the candidate adds only the reviewed Union block to the deployed baseline', () => {
  const baseline = readFileSync('firebase/union-hotfix/deployed-before.rules', 'utf8');
  const addition = readFileSync('firebase/union-hotfix/unions.rules', 'utf8');
  const position = baseline.lastIndexOf('\n  }');
  assert.equal(candidate, baseline.slice(0, position) + addition + baseline.slice(position));
  assert.doesNotMatch(baseline, /match\s+\/unions\//);
});

for (const role of ['admin', 'superAdmin', 'super_admin']) {
  test(`${role} can add, list, and update a valid Union`, async () => {
    const db = await account(role);
    const ref = doc(db, 'unions/maum');
    await assertSucceeds(setDoc(ref, payload()));
    await assertSucceeds(getDocs(collection(db, 'unions')));
    await assertSucceeds(updateDoc(ref, { headquarters: 'Petaling Jaya', updatedAt: serverTimestamp() }));
  });
}

for (const fields of [
  { userRole: 'user', role: 'Super Admin', isAdmin: true },
  { userRole: 'missionAdmin' },
  { userRole: 'superAdmin', isActive: false },
  { userRole: 'superAdmin', isApproved: false },
  { userRole: 'superAdmin', approvalStatus: 'pending' },
]) {
  test(`unauthorized profile ${JSON.stringify(fields)} cannot add a Union`, async () => {
    const db = await account(fields.userRole, fields);
    await assertFails(setDoc(doc(db, 'unions/maum'), payload()));
  });
}

test('anonymous and unverified accounts cannot add a Union', async () => {
  await account('superAdmin');
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'unions/maum'), payload()));
  await assertFails(setDoc(doc(env.authenticatedContext('test-admin', { email_verified: false }).firestore(), 'unions/maum'), payload()));
});

test('invalid Union fields and changed creation timestamps are rejected', async () => {
  const db = await account('admin');
  const ref = doc(db, 'unions/maum');
  await assertFails(setDoc(ref, { ...payload(), unexpected: true }));
  await assertFails(setDoc(ref, { ...payload(), name: '' }));
  await assertSucceeds(setDoc(ref, payload()));
  await assertFails(updateDoc(ref, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(ref));
});
