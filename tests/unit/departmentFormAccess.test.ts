import assert from 'node:assert/strict';
import { test } from 'node:test';
import { departmentFormBlocker } from '../../src/lib/departmentFormAccess';
import { defaultDepartmentTemplates } from '../../src/lib/departmentReports';
import { readUserProfile } from '../../src/lib/userProfiles';
const profile = readUserProfile('pastor', { userRole: 'districtPastor', isActive: true, isApproved: true, district: 'd' });
const access = { profile, churchId: 'c', churchCount: 1, districtAssigned: true, template: defaultDepartmentTemplates()[0] };
test('assigned church and valid active form enable filling; absent selection explains how to enable it', () => {
  assert.equal(departmentFormBlocker(access), null);
  assert.equal(departmentFormBlocker({ ...access, churchId: undefined })?.code, 'church');
  assert.match(departmentFormBlocker({ ...access, churchId: undefined })!.message, /Choose a church above/);
});
test('form eligibility preserves account, role and assignment boundaries with distinct explanations', () => {
  assert.equal(departmentFormBlocker({ ...access, profile: { ...profile, isActive: false } })?.code, 'account');
  assert.equal(departmentFormBlocker({ ...access, profile: { ...profile, userRole: 'mission_admin' } })?.code, 'role');
  assert.equal(departmentFormBlocker({ ...access, districtAssigned: false })?.code, 'district');
  assert.equal(departmentFormBlocker({ ...access, churchCount: 0 })?.code, 'no_churches');
});
test('loading, permission failures, closed forms and invalid definitions never look like an unexplained disabled button', () => {
  assert.equal(departmentFormBlocker({ ...access, reportsLoading: true })?.code, 'loading');
  assert.equal(departmentFormBlocker({ ...access, reportError: 'Read denied' })?.message, 'Read denied');
  assert.equal(departmentFormBlocker({ ...access, templateError: 'Templates unavailable' })?.code, 'templates');
  assert.equal(departmentFormBlocker({ ...access, template: { ...access.template, isActive: false } })?.code, 'closed');
  assert.equal(departmentFormBlocker({ ...access, template: { ...access.template, steps: [] } })?.code, 'definition');
});
