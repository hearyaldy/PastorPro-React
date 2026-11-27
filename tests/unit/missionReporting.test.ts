import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateMissionReports, assignedMission, districtDiscrepancies, financialTotals, missionEntities, reportQuerySpecs, reportingAccess } from '../../src/lib/missionReporting';
import { readBorangB } from '../../src/lib/borangB';
import { readFinancialReport } from '../../src/lib/reportViews';
import { readUserProfile } from '../../src/lib/userProfiles';
import type { Church, District, Mission } from '../../src/types';
const mission: Mission = { id: 'm', name: 'Mission A', code: 'MA', isActive: true };
const districts: District[] = [{ id: 'd', missionId: 'm', regionId: 'r', name: 'District A', districtPastorId: 'p', isActive: true }, { id: 'e', missionId: 'm', regionId: 'r', name: 'District B', isActive: true }];
const churches: Church[] = [{ id: 'c', missionId: 'm', districtId: 'd', regionId: 'r', name: 'Church A', isActive: true }, { id: 'c2', missionId: 'm', districtId: 'e', regionId: 'r', name: 'Church B', isActive: true }];
const profile = readUserProfile('p', { userRole: 'districtPastor', isActive: true, isApproved: true, mission: 'm', district: 'd' });
const f = (id: string, extra = {}) => readFinancialReport(id, { churchId: 'c', missionId: 'm', districtId: 'd', month: 11, year: 2026, tithe: 100, offerings: 20, submittedBy: 'p', ...extra })!;
const b = (id: string, extra = {}) => readBorangB(id, { churchId: 'c', missionId: 'm', districtId: 'd', month: 11, year: 2026, userId: 'p', tithe: 100, offerings: 20, ...extra })!;
test('mission assignment never falls back to an unrelated first mission', () => {
  assert.equal(assignedMission({ ...profile, missionId: undefined, missionName: undefined }, [mission]), null);
  assert.equal(assignedMission({ ...profile, missionId: 'MA' }, [mission]), mission);
  assert.equal(missionEntities(mission, districts, [{ ...churches[0], missionId: '' }], []).churches.length, 1);
});
test('report scopes follow authoritative role, approval, and assignment', () => {
  assert.deepEqual(reportingAccess(profile, mission, districts, churches).churchChoices.map(item => item.id), ['c']);
  assert.equal(reportingAccess({ ...profile, roleTitle: 'Super Admin' }, mission, districts, churches).canOverrideMission, false);
  assert.equal(reportingAccess({ ...profile, isActive: false }, mission, districts, churches).canWrite, false);
  assert.equal(reportingAccess({ ...profile, userRole: 'director' }, mission, districts, churches).canWrite, false);
  assert.ok(reportQuerySpecs(profile, { mission, level: 'district', districtId: 'd' }, districts, churches).finance.some(spec => spec.field === 'churchId' && spec.value === 'c'));
});
test('monthly/YTD aggregation deduplicates records, filters foreign missions and excludes special from comparison', () => {
  const model = aggregateMissionReports({ scope: { mission, level: 'district', districtId: 'd' }, profile, year: 2026, month: 11, districts, churches,
    financial: [f('old', { tithe: 999, updatedAt: '2026-11-01' }), f('new', { specialOfferings: 5, customFinanceTypes: [{ label: 'Fund', amount: 3 }], updatedAt: '2026-11-02' }), f('jan', { month: 1 }), f('future', { month: 12 }), f('foreign', { churchId: 'other', missionId: 'other' })],
    borang: [b('b', { baptisms: 3, membersBeginning: 50, membersEnd: 53, prisonVisitations: 2 })] });
  assert.equal(model.monthly.total, 128); assert.equal(model.ytd.total, 248);
  assert.equal(model.discrepancies[0].difference, 0); assert.equal(model.discrepancies[0].status, 'match');
  assert.equal(model.duplicateCount, 1); assert.equal(model.completion, 100);
  assert.equal(model.ministry.prisonVisitations, 2); assert.equal(model.pastorReport?.id, 'b');
});
test('discrepancy matching flags missing sources and cancelling field mismatches with Flutter thresholds', () => {
  const status = (financial: ReturnType<typeof f>[], borang: ReturnType<typeof b>[]) => districtDiscrepancies([districts[0]], churches, financial, borang)[0].status;
  assert.equal(status([], []), 'missing_both'); assert.equal(status([f('f')], []), 'missing_borangb'); assert.equal(status([], [b('b')]), 'missing_treasurer');
  assert.equal(status([f('f', { tithe: 110, offerings: 10 })], [b('b')]), 'field_mismatch');
  assert.equal(status([f('f', { tithe: 10.05, offerings: 0 })], [b('b', { tithe: 10, offerings: 0 })]), 'match');
  assert.equal(status([f('f', { tithe: 1.02, offerings: 0 })], [b('b', { tithe: 1, offerings: 0 })]), 'discrepancy');
  assert.equal(financialTotals([f('f', { tithe: 0.1, offerings: 0.2 })]).total, 0.3);
});
test('church scope does not attribute district-level Borang B to every church', () => {
  const model = aggregateMissionReports({ scope: { mission, level: 'church', churchId: 'c' }, profile, year: 2026, month: 11, districts, churches, financial: [], borang: [b('district', { churchId: undefined })] });
  assert.equal(model.monthlyBorang.length, 0); assert.equal(model.completion, 0); assert.equal(model.missingChurches.length, 1);
});
