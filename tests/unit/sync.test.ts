import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readActivity, writeActivity } from '../../src/lib/activities';
import { readUserProfile, writeUserUpdates } from '../../src/lib/userProfiles';
import { normalizeUserRole } from '../../src/types';

test('Flutter activity records round-trip without losing mileage, notes, date, or document identity', () => {
  const legacy = {
    id: 'embedded-old-id', userId: 'pastor', date: '2026-11-27T00:00:00.000',
    activities: 'Hospital visit', mileage: 37.5, note: 'Follow up next week', location: 'Kota Kinabalu',
  };
  const view = readActivity('firestore-document-id', legacy);
  assert.equal(view.id, 'firestore-document-id');
  assert.equal(view.title, legacy.activities);
  assert.equal(view.mileage, 37.5);
  const written = writeActivity(view);
  for (const key of ['userId', 'activities', 'mileage', 'note', 'location', 'date']) {
    assert.equal(written[key], legacy[key as keyof typeof legacy]);
  }
});

test('a subsequent Flutter edit overrides stale React activity aliases', () => {
  const view = readActivity('activity', {
    activities: 'Edited on phone', title: 'Old title', note: '', notes: 'Old note', mileage: 0,
    date: '2026-11-27T00:00:00.000',
  });
  assert.equal(view.title, 'Edited on phone');
  assert.equal(view.notes, '');
  assert.equal(view.mileage, 0);
});

test('old React activities can be written in the Flutter format without losing extensions', () => {
  const view = readActivity('activity', {
    title: 'Board meeting', notes: 'Minutes recorded', date: '2026-11-27',
    category: 'meeting', durationMinutes: 90, participants: 12,
  });
  const written = writeActivity(view);
  assert.equal(written.activities, 'Board meeting');
  assert.equal(written.note, 'Minutes recorded');
  assert.equal(written.durationMinutes, 90);
  assert.equal(written.mileage, 0);
});

test('new React activity records contain the fields Flutter requires to parse them', () => {
  const written = writeActivity(readActivity('activity', {
    title: 'Visitation', date: '2026-11-27', userId: 'pastor', mileage: 12,
  }));
  assert.equal(typeof written.id, 'string');
  assert.equal(typeof written.activities, 'string');
  assert.equal(typeof written.mileage, 'number');
  assert.ok(Number.isFinite(Date.parse(String(written.date))));
});

test('role normalization accepts both clients but never elevates display metadata', () => {
  assert.equal(normalizeUserRole({ userRole: 'missionAdmin' }), 'mission_admin');
  assert.equal(normalizeUserRole({ userRole: 'district_pastor' }), 'district_pastor');
  assert.equal(normalizeUserRole({ userRole: 'user', role: 'super_admin', isAdmin: true }), 'user');
  assert.equal(normalizeUserRole({ roleTitle: 'Super Admin', superAdmin: true }), 'user');
});

test('React role and assignment updates use Flutter role names and synchronized aliases', () => {
  const data = writeUserUpdates({ userRole: 'district_pastor', missionId: 'sam', districtId: 'kiulu', regionId: 'west' });
  assert.equal(data.userRole, 'districtPastor');
  assert.equal(data.role, 'District Pastor');
  assert.equal(data.mission, 'sam');
  assert.equal(data.district, 'kiulu');
  assert.equal(data.region, 'west');
  const view = readUserProfile('pastor', { ...data, email: 'pastor@example.com', isActive: true });
  assert.equal(view.userRole, 'district_pastor');
  assert.equal(view.missionId, 'sam');
});

test('inactive administrator records stay inactive despite their role', () => {
  const view = readUserProfile('admin', { userRole: 'superAdmin', isActive: false });
  assert.equal(view.isActive, false);
});

test('Flutter pending approval is respected and React approval updates both representations', () => {
  const pending = readUserProfile('pastor', { userRole: 'user', isApproved: false });
  assert.equal(pending.approvalStatus, 'pending');
  assert.equal(pending.isActive, false);
  const approved = writeUserUpdates({ approvalStatus: 'approved', isActive: true }, pending);
  assert.equal(approved.isApproved, true);
  const inactiveData = { ...approved, ...writeUserUpdates({ isActive: false }, readUserProfile('pastor', approved)) };
  const inactive = readUserProfile('pastor', inactiveData);
  assert.equal(inactive.approvalStatus, 'approved');
  assert.equal(inactive.isActive, false);
  assert.equal(writeUserUpdates({ isActive: true }, inactive).isApproved, true);
});
