import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
let app, db, auth;
const projectId = 'demo-pastorpro-sync';
before(() => { if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Auth and Firestore emulators are required.'); app = initializeApp({ projectId }, 'deletion-tests'); db = getFirestore(app); auth = getAuth(app); });
after(async () => { if (app) await deleteApp(app); });
const endpoint = `http://127.0.0.1:5008/${projectId}/asia-southeast1/requestAccountDeletion`;
async function until(check) { const end = Date.now() + 60_000; while (Date.now() < end) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 150)); } throw new Error('Timed out waiting for background deletion.'); }
test('unauthenticated calls cannot queue a deletion', async () => {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { confirmation: 'DELETE', uid: 'someone-else' } }) });
  assert.equal(response.status, 401);
});
test('a confirmed request removes only its caller, cleans personal subcollections, and retains de-attributed church records', async () => {
  const uid = 'delete-test-owner', email = 'delete-owner@example.com';
  await auth.createUser({ uid, email, password: 'test-password-123', emailVerified: true });
  await auth.createUser({ uid: 'someone-else', email: 'other-account@example.com', emailVerified: true });
  for (const [path, data] of Object.entries({
    [`users/${uid}`]: { uid, email, displayName: 'Owner', isActive: true, isApproved: true },
    [`users/${uid}/private/reminder`]: { message: 'Private' },
    [`activities/personal`]: { userId: uid, note: 'Private activity' },
    [`activities/personal/private/child`]: { note: 'Private nested data' },
    ['activities/other-user']: { userId: 'someone-else', note: 'Keep' },
    ['appointments/personal']: { userId: uid }, ['todos/personal']: { userId: uid },
    ['events/personal']: { userId: uid }, ['ministry_team/personal']: { userId: uid },
    ['locationRequests/personal']: { userId: uid },
    [`borang_b_reports/${uid}_2026_11`]: { id: `${uid}_2026_11`, userId: uid, userName: 'Owner', baptisms: 4, remarks: 'Church record' },
    ['financial_reports/shared']: { submittedBy: uid, submittedByName: 'Owner', tithe: 100, history: [{ editedBy: uid, editorName: 'Owner' }, { editedBy: 'someone-else', editorName: 'Other' }] },
    ['quarterly_department_reports/shared']: { submittedBy: 'someone-else', submittedByName: 'Other', editedBy: uid, editorName: 'Owner', values: { children: 5 } },
    ['missions/m/departments/d']: { name: 'Department', createdBy: uid },
    ['staff/email-linked']: { fullName: 'Owner', email, phone: '123', position: 'Pastor', isActive: true },
  })) await db.doc(path).set(data);
  const customToken = await auth.createCustomToken(uid);
  const signIn = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-key`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const { idToken } = await signIn.json(); assert.ok(idToken);
  const request = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ data: { confirmation: 'DELETE', uid: 'someone-else' } }) });
  assert.equal(request.status, 200); assert.equal((await request.json()).result.status, 'queued');
  await until(async () => (await db.doc(`account_deletion_jobs/${uid}`).get()).data()?.status === 'complete');
  await assert.rejects(auth.getUser(uid), error => error.code === 'auth/user-not-found');
  assert.equal((await db.doc(`users/${uid}`).get()).exists, false);
  assert.equal((await db.doc(`users/${uid}/private/reminder`).get()).exists, false);
  assert.equal((await db.doc('activities/personal/private/child').get()).exists, false);
  assert.equal((await db.doc('activities/other-user').get()).data().note, 'Keep');
  assert.equal((await auth.getUser('someone-else')).email, 'other-account@example.com');
  assert.equal((await db.doc(`borang_b_reports/${uid}_2026_11`).get()).exists, false);
  const retained = await db.collection('borang_b_reports').where('baptisms', '==', 4).get();
  assert.equal(retained.size, 1); assert.equal(retained.docs[0].data().userName, 'Deleted user'); assert.equal(retained.docs[0].data().remarks, 'Church record');
  const finance = (await db.doc('financial_reports/shared').get()).data();
  assert.equal(finance.submittedByName, 'Deleted user'); assert.equal(finance.history[1].editorName, 'Other'); assert.equal(finance.tithe, 100);
  const quarterly = (await db.doc('quarterly_department_reports/shared').get()).data(); assert.equal(quarterly.submittedByName, 'Other'); assert.equal(quarterly.editorName, 'Deleted user'); assert.equal(quarterly.values.children, 5);
  assert.ok((await db.doc('missions/m/departments/d').get()).data().createdBy.startsWith('deleted_'));
  assert.equal((await db.doc('staff/email-linked').get()).data().email, '');
  const job = (await db.doc(`account_deletion_jobs/${uid}`).get()).data(); assert.equal(job.replacement, undefined); assert.equal(job.leaseUntil, undefined);
});
