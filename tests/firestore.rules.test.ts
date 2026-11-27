import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { readActivity, writeActivity } from '../src/lib/activities';

// A demo project and an explicit emulator host prevent accidental production access.
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
let env: RulesTestEnvironment;

before(async () => {
  if (!emulatorHost) throw new Error('Run with npm run test:rules; the Firestore emulator is required.');
  const [host, port] = emulatorHost.split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-pastorpro-sync',
    firestore: { host, port: Number(port), rules: readFileSync('firestore.rules', 'utf8') },
  });
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); });

function dbFor(uid: string) {
  return env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true }).firestore();
}

function user(uid: string, extra: Record<string, unknown> = {}) {
  return {
    uid, email: `${uid}@example.com`, displayName: uid, userRole: 'user', role: 'user',
    level: 1, isActive: true, approvalStatus: 'approved', onboardingCompleted: true,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra,
  };
}

async function seed(records: Record<string, Record<string, unknown>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    for (const [path, data] of Object.entries(records)) await setDoc(doc(context.firestore(), path), data);
  });
}

test('new users cannot smuggle an administrative role through metadata', async () => {
  const db = dbFor('new-user');
  const pending = user('new-user', { isActive: false, approvalStatus: 'pending', onboardingCompleted: false });
  await assertFails(setDoc(doc(db, 'users/new-user'), { ...pending, role: 'super_admin' }));
  await assertFails(setDoc(doc(db, 'users/new-user'), { ...pending, roleTitle: 'Super Admin' }));
  await assertSucceeds(setDoc(doc(db, 'users/new-user'), pending));
  await assertFails(setDoc(doc(db, 'unions/unauthorized'), { name: 'Unauthorized' }));
});

test('conflicting display roles and legacy flags never grant access', async () => {
  await seed({
    'users/attacker': user('attacker', { role: 'super_admin', roleTitle: 'Super Admin', isAdmin: true }),
    'users/victim': user('victim'),
  });
  await assertFails(getDoc(doc(dbFor('attacker'), 'users/victim')));
  await assertFails(updateDoc(doc(dbFor('attacker'), 'users/attacker'), {
    userRole: 'superAdmin', updatedAt: serverTimestamp(),
  }));
});

for (const role of ['mission_admin', 'missionAdmin', 'ministerial_secretary', 'ministerialSecretary', 'director', 'officer']) {
  test(`${role} can query own mission reports but cannot read another mission`, async () => {
    await seed({
      'users/leader': user('leader', { userRole: role, mission: 'mission-a' }),
      'borang_b_reports/own': { userId: 'pastor-a', missionId: 'mission-a' },
      'borang_b_reports/other': { userId: 'pastor-b', missionId: 'mission-b' },
      'financial_reports/other': { submittedBy: 'pastor-b', churchId: 'church-b', missionId: 'mission-b' },
      'quarterly_department_reports/other': { submittedBy: 'pastor-b', districtId: 'district-b', missionId: 'mission-b' },
    });
    const db = dbFor('leader');
    await assertSucceeds(getDoc(doc(db, 'borang_b_reports/own')));
    await assertSucceeds(getDocs(query(collection(db, 'borang_b_reports'), where('missionId', '==', 'mission-a'))));
    await assertFails(getDocs(collection(db, 'borang_b_reports')));
    for (const col of ['borang_b_reports', 'financial_reports', 'quarterly_department_reports']) {
      await assertFails(getDoc(doc(db, `${col}/other`)));
    }
  });
}

for (const account of [
  { userRole: 'user', isActive: false },
  { userRole: 'user', approvalStatus: 'pending' },
  { userRole: 'user', approvalStatus: 'rejected' },
  { userRole: 'user', isApproved: false },
  { userRole: 'superAdmin', isActive: false },
]) {
  test(`inactive or unapproved ${JSON.stringify(account)} cannot access personal records`, async () => {
    await seed({
      'users/blocked': user('blocked', account),
      'activities/own': { userId: 'blocked' },
    });
    const db = dbFor('blocked');
    await assertSucceeds(getDoc(doc(db, 'users/blocked')));
    await assertFails(getDoc(doc(db, 'activities/own')));
    await assertFails(setDoc(doc(db, 'activities/new'), { userId: 'blocked' }));
  });
}

test('camelCase admin roles work while admins cannot promote or demote global admins', async () => {
  await seed({
    'users/super': user('super', { userRole: 'superAdmin' }),
    'users/admin': user('admin', { userRole: 'admin' }),
    'users/target': user('target'),
  });
  await assertSucceeds(getDoc(doc(dbFor('super'), 'users/target')));
  await assertFails(updateDoc(doc(dbFor('admin'), 'users/target'), {
    userRole: 'superAdmin', updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(dbFor('admin'), 'users/super'), {
    userRole: 'user', updatedAt: serverTimestamp(),
  }));
});

test('mission admins cannot move users between missions or assign camelCase admin roles', async () => {
  await seed({
    'users/manager': user('manager', { userRole: 'missionAdmin', missionId: 'mission-a' }),
    'users/target': user('target', { missionId: 'mission-a' }),
  });
  const db = dbFor('manager');
  await assertFails(updateDoc(doc(db, 'users/target'), { userRole: 'missionAdmin', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, 'users/target'), { missionId: 'mission-b', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db, 'users/target'), { userRole: 'districtPastor', updatedAt: serverTimestamp() }));
});

test('assigned leaders cannot change their own district to gain access elsewhere', async () => {
  await seed({ 'users/pastor': user('pastor', { userRole: 'districtPastor', districtId: 'district-a' }) });
  await assertFails(updateDoc(doc(dbFor('pastor'), 'users/pastor'), {
    districtId: 'district-b', updatedAt: serverTimestamp(),
  }));
});

test('React can update a legacy Flutter user without adding missing metadata or dropping fields', async () => {
  await seed({ 'users/legacy': {
    email: 'legacy@example.com', displayName: 'Legacy user', userRole: 'user',
    mission: 'mission-a', district: null, region: null, churchId: null, roleTitle: null,
    isAdmin: false, isEditor: false, isMissionAdmin: false,
    isPremium: false, onboardingCompleted: true,
  } });
  await assertSucceeds(updateDoc(doc(dbFor('legacy'), 'users/legacy'), {
    displayName: 'Updated in React', updatedAt: serverTimestamp(),
  }));
});

test('mission-scoped user queries work and do not return users from other missions', async () => {
  await seed({
    'users/manager': user('manager', { userRole: 'missionAdmin', missionId: 'mission-a' }),
    'users/own': user('own', { missionId: 'mission-a' }),
    'users/other': user('other', { missionId: 'mission-b' }),
  });
  const db = dbFor('manager');
  await assertSucceeds(getDocs(query(collection(db, 'users'), where('missionId', '==', 'mission-a'))));
  await assertFails(getDocs(collection(db, 'users')));
});

test('Flutter and React can write and edit the same activity while preserving ownership', async () => {
  await seed({ 'users/pastor': user('pastor'), 'users/other': user('other') });
  const db = dbFor('pastor');
  const ref = doc(db, 'activities/shared');
  await assertSucceeds(setDoc(ref, {
    id: 'flutter-id', userId: 'pastor', activities: 'Visitation', mileage: 15.5,
    note: 'Flutter note', date: '2026-11-27T00:00:00.000', location: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
  const before = (await getDoc(ref)).data()!;
  const activity = readActivity('shared', before);
  await assertSucceeds(updateDoc(ref, {
    ...writeActivity({ ...activity, title: 'Edited in React', mileage: 20 }),
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(updateDoc(ref, {
    activities: 'Edited on phone', note: 'Phone note', mileage: 23,
    updatedAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(dbFor('other'), 'activities/shared'), {
    activities: 'Someone else', updatedAt: serverTimestamp(),
  }));
});

test('mission resources, requests, and audit logs cannot be read across missions', async () => {
  await seed({
    'users/manager': user('manager', { userRole: 'missionAdmin', missionId: 'mission-a' }),
    'resources/own': { missionId: 'mission-a' },
    'resources/other': { missionId: 'mission-b' },
    'global_events/other': { missionId: 'mission-b' },
    'locationRequests/other': { userId: 'other', missionId: 'mission-b' },
    'admin_activity/other': { actorId: 'other', missionId: 'mission-b' },
  });
  const db = dbFor('manager');
  await assertSucceeds(getDoc(doc(db, 'resources/own')));
  for (const col of ['resources', 'global_events', 'locationRequests', 'admin_activity']) {
    await assertSucceeds(getDocs(query(collection(db, col), where('missionId', '==', 'mission-a'))));
    await assertFails(getDoc(doc(db, `${col}/other`)));
  }
});

test('unverified accounts cannot create profiles or access personal activity data', async () => {
  await seed({ 'users/unverified': user('unverified'), 'activities/own': { userId: 'unverified' } });
  const db = env.authenticatedContext('unverified', {
    email: 'unverified@example.com', email_verified: false,
  }).firestore();
  await assertFails(getDoc(doc(db, 'activities/own')));
  await assertFails(updateDoc(doc(db, 'users/unverified'), {
    displayName: 'Changed', updatedAt: serverTimestamp(),
  }));
});

test('district pastors can query district reports and legacy church finances without reading another district', async () => {
  await seed({
    'users/pastor': user('pastor', { userRole: 'districtPastor', mission: 'mission-a', district: 'district-a' }),
    'churches/church-a': { districtId: 'district-a', missionId: 'mission-a' },
    'churches/church-b': { districtId: 'district-b', missionId: 'mission-a' },
    'financial_reports/old': { churchId: 'church-a', districtId: null, missionId: 'mission-a', submittedBy: 'someone' },
    'financial_reports/other': { churchId: 'church-b', districtId: 'district-b', missionId: 'mission-a', submittedBy: 'someone' },
    'borang_b_reports/own-district': { districtId: 'district-a', missionId: 'mission-a', userId: 'someone' },
    'borang_b_reports/other-district': { districtId: 'district-b', missionId: 'mission-a', userId: 'someone' },
  });
  const db = dbFor('pastor');
  await assertSucceeds(getDocs(query(collection(db, 'financial_reports'), where('churchId', '==', 'church-a'))));
  await assertSucceeds(getDocs(query(collection(db, 'borang_b_reports'), where('districtId', '==', 'district-a'))));
  await assertFails(getDoc(doc(db, 'financial_reports/other')));
  await assertFails(getDoc(doc(db, 'borang_b_reports/other-district')));
  await assertFails(getDocs(collection(db, 'financial_reports')));
});

test('a pastor without a district assignment cannot read unassigned reports owned by someone else', async () => {
  await seed({
    'users/pastor': user('pastor', { userRole: 'districtPastor' }),
    'financial_reports/unassigned': { churchId: 'church-a', submittedBy: 'someone', missionId: 'mission-a' },
    'borang_b_reports/unassigned': { userId: 'someone', missionId: 'mission-a' },
  });
  await assertFails(getDoc(doc(dbFor('pastor'), 'financial_reports/unassigned')));
  await assertFails(getDoc(doc(dbFor('pastor'), 'borang_b_reports/unassigned')));
});

test('queued account deletion blocks stale sessions from reading, writing or recreating personal data', async () => {
  await seed({
    'users/deleting': user('deleting'),
    'account_deletion_jobs/deleting': { status: 'queued' },
    'activities/personal': { userId: 'deleting' },
  });
  await assertFails(getDoc(doc(dbFor('deleting'), 'activities/personal')));
  await assertFails(getDoc(doc(dbFor('deleting'), 'users/deleting')));
  await assertFails(getDoc(doc(dbFor('deleting'), 'account_deletion_jobs/deleting')));
  await assertFails(setDoc(doc(dbFor('deleting'), 'activities/another'), { userId: 'deleting' }));
  await env.withSecurityRulesDisabled(context => context.firestore().doc('users/deleting').delete());
  await assertFails(setDoc(doc(dbFor('deleting'), 'users/deleting'), user('deleting')));
});
