import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { PERSONAL_COLLECTIONS, SHARED_COLLECTIONS, anonymizeAttribution, deletionRequestError } from './deletion-policy.js';
initializeApp();
const databaseId = process.env.ACCOUNT_DATABASE_ID || '(default)';
const region = 'asia-southeast1';
export const requestAccountDeletion = onCall({ region, timeoutSeconds: 60, maxInstances: 5 }, async request => {
  const invalid = deletionRequestError(request.auth, request.data?.confirmation, Date.now() / 1000);
  if (invalid === 'unauthenticated') throw new HttpsError('unauthenticated', 'Sign in before requesting account deletion.');
  if (invalid === 'recent-login-required') throw new HttpsError('failed-precondition', 'Sign in again to confirm account deletion.');
  if (invalid) throw new HttpsError('invalid-argument', 'Type DELETE to confirm account deletion.');
  // No UID is accepted from the client. A caller can only delete its own account.
  const uid = request.auth.uid, db = getFirestore(databaseId), job = db.doc(`account_deletion_jobs/${uid}`);
  await db.runTransaction(async transaction => {
    const existing = await transaction.get(job);
    if (existing.exists) return;
    transaction.create(job, { status: 'queued', requestedAt: FieldValue.serverTimestamp(), replacement: `deleted_${randomUUID()}`, retention: 'retain-church-reports', progress: {} });
    transaction.set(db.doc(`users/${uid}`), { deletionPending: true, isActive: false, isApproved: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { status: 'queued' };
});

async function erasePersonal(db, job, uid, collection) {
  for (const owner of new Set(['userId', 'uid', ...(collection === 'locationRequests' ? ['submittedBy', 'requestedBy'] : [])])) {
    while (true) {
      const records = await db.collection(collection).where(owner, '==', uid).limit(150).get();
      if (records.empty) break;
      for (let i = 0; i < records.docs.length; i += 10) await Promise.all(records.docs.slice(i, i + 10).map(record => db.recursiveDelete(record.ref)));
    }
  }
  await job.set({ progress: { [`personal_${collection}`]: true } }, { merge: true });
}
async function anonymizeCollection(db, job, uid, replacement, name, group = false, identity = {}) {
  const key = `${group ? 'group_' : ''}${name}`;
  let progress = (await job.get()).data()?.progress?.[key];
  if (progress === true) return;
  while (true) {
    let query = (group ? db.collectionGroup(name) : db.collection(name)).orderBy(FieldPath.documentId()).limit(100);
    if (typeof progress === 'string') query = query.startAfter(db.doc(progress));
    const records = await query.get();
    if (records.empty) { await job.set({ progress: { [key]: true } }, { merge: true }); return; }
    const batch = db.batch();
    for (const record of records.docs) {
      if (record.ref.path === `users/${uid}`) continue;
      const raw = record.data(), changed = anonymizeAttribution(raw, uid, replacement);
      if (name === 'staff' && identity.email && typeof raw.email === 'string' && raw.email.toLowerCase() === identity.email.toLowerCase()) {
        for (const field of ['fullName', 'name']) if (field in changed) changed[field] = 'Deleted user';
        for (const field of ['email', 'phone', 'photoURL']) if (field in changed) changed[field] = '';
        changed.isActive = false; changed.status = 'inactive';
      }
      // Borang B IDs from React embed the UID. Move those records to an opaque
      // document ID, keeping the report itself and its statistics.
      if (name === 'borang_b_reports' && raw.userId === uid && record.id.includes(uid)) {
        const ref = db.collection(name).doc(); batch.create(ref, { ...changed, id: ref.id }); batch.delete(record.ref, { lastUpdateTime: record.updateTime });
      } else if (!isDeepStrictEqual(raw, changed)) batch.update(record.ref, changed, { lastUpdateTime: record.updateTime });
    }
    progress = records.docs.at(-1).ref.path;
    batch.set(job, { progress: { [key]: progress } }, { merge: true });
    await batch.commit();
  }
}
export const processAccountDeletion = onDocumentCreated({ document: 'account_deletion_jobs/{uid}', database: databaseId, region, retry: true, timeoutSeconds: 540, memory: '512MiB', maxInstances: 3 }, async event => {
  const uid = event.params.uid, db = getFirestore(databaseId), job = db.doc(`account_deletion_jobs/${uid}`);
  const current = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(job), data = snapshot.data();
    if (!data || data.status === 'complete') return null;
    if (data.leaseUntil?.toMillis() > Date.now()) throw new Error('Account cleanup is already running; retry after its lease expires.');
    transaction.set(job, { status: 'processing', leaseUntil: Timestamp.fromMillis(Date.now() + 600_000), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return data;
  });
  if (!current) return;
  try {
    let identity = {};
    try { identity = await getAuth().getUser(uid); await getAuth().updateUser(uid, { disabled: true }); await getAuth().revokeRefreshTokens(uid); }
    catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    for (const collection of PERSONAL_COLLECTIONS) await erasePersonal(db, job, uid, collection);
    for (const collection of SHARED_COLLECTIONS) await anonymizeCollection(db, job, uid, current.replacement, collection, false, identity);
    for (const collection of ['departments', 'reports']) await anonymizeCollection(db, job, uid, current.replacement, collection, true, identity);
    // Authentication goes first so the old login cannot recreate a missing profile.
    try { await getAuth().deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    await db.recursiveDelete(db.doc(`users/${uid}`));
    await job.set({ status: 'complete', completedAt: FieldValue.serverTimestamp(), progress: FieldValue.delete(), replacement: FieldValue.delete(), leaseUntil: FieldValue.delete() }, { merge: true });
  } catch (error) {
    // The event retries from persisted collection checkpoints. Do not record
    // profile contents, credentials, email addresses or free-text answers.
    await job.set({ status: 'retrying', leaseUntil: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
});
