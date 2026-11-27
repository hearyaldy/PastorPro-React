import { before, beforeEach, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
let env: RulesTestEnvironment;
before(async () => { if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator required'); const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':'); env = await initializeTestEnvironment({ projectId: 'demo-pastorpro-sync', firestore: { host, port: Number(port), rules: readFileSync('firebase/account-deletion/firestore.rules', 'utf8') } }); });
beforeEach(async () => { await env.clearFirestore(); await env.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), 'users/owner'), { userRole: 'user', isActive: true, isApproved: true }); await setDoc(doc(context.firestore(), 'activities/personal'), { userId: 'owner' }); }); });
after(async () => { await env?.cleanup(); });
const db = () => env.authenticatedContext('owner', { email: 'owner@example.com', email_verified: true }).firestore();
test('normal users retain existing profile and personal-record access before a deletion request', async () => {
  await assertSucceeds(getDoc(doc(db(), 'users/owner'))); await assertSucceeds(getDoc(doc(db(), 'activities/personal')));
});
test('the minimal guard blocks stale-session reads, writes and profile recreation after deletion is queued', async () => {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'account_deletion_jobs/owner'), { status: 'queued' }));
  await assertFails(getDoc(doc(db(), 'users/owner'))); await assertFails(getDoc(doc(db(), 'activities/personal')));
  await assertFails(setDoc(doc(db(), 'activities/new'), { userId: 'owner' }));
  await env.withSecurityRulesDisabled(context => context.firestore().doc('users/owner').delete());
  await assertFails(setDoc(doc(db(), 'users/owner'), { userRole: 'user' }));
});
test('clients cannot create or alter deletion jobs; the candidate changes only the authentication guard', async () => {
  await assertFails(setDoc(doc(db(), 'account_deletion_jobs/owner'), { status: 'complete' }));
  await assertFails(getDoc(doc(db(), 'account_deletion_jobs/owner')));
  const old = readFileSync('firebase/account-deletion/deployed-before.rules', 'utf8');
  const candidate = readFileSync('firebase/account-deletion/firestore.rules', 'utf8');
  assert.equal(candidate, old.replace('return request.auth != null;', 'return request.auth != null && !exists(/databases/$(database)/documents/account_deletion_jobs/$(request.auth.uid));'));
});
