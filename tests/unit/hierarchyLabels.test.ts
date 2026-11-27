import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHierarchyLabels } from '../../src/lib/hierarchyLabels';
import { borangBDocument, quarterlyDocument } from '../../src/lib/reportDocuments';
import { readBorangB } from '../../src/lib/borangB';
import { readQuarterlyReport } from '../../src/lib/reportViews';
const id = 'iqatSkQaKBhoOZgD0Dhn';
const directory = { unions: [{ id: 'u', name: 'Malaysia Union', code: 'MAUM', isActive: true }], missions: [{ id: 'm', name: 'Sabah Mission', code: 'SAM', isActive: true }], regions: [{ id: 'r', name: 'West Coast', missionId: 'm', isActive: true }], districts: [{ id, name: 'Kiulu', regionId: 'r', missionId: 'm', isActive: true }], churches: [{ id: 'c', name: 'Kiulu Church', churchCode: 'KLU', districtId: id, regionId: 'r', missionId: 'm', isActive: true }] };
const labels = createHierarchyLabels(directory);
test('directory names replace raw IDs and stale saved names for every hierarchy level', () => {
  assert.equal(labels.district(id), 'Kiulu'); assert.equal(labels.district(id, 'Outdated District'), 'Kiulu');
  assert.equal(labels.mission('m'), 'Sabah Mission'); assert.equal(labels.region('r'), 'West Coast');
  assert.equal(labels.church('c'), 'Kiulu Church'); assert.equal(labels.union('u'), 'Malaysia Union');
  assert.equal(labels.district(undefined, id), 'Kiulu');
  assert.equal(labels.mission('sam'), 'Sabah Mission'); assert.equal(labels.church('KLU'), 'Kiulu Church');
});
test('unavailable, deleted and unassigned records do not leak opaque IDs or imply a different assignment', () => {
  const empty = createHierarchyLabels({ unions: [], missions: [], regions: [], districts: [], churches: [] });
  assert.equal(empty.district(id, id), 'District name unavailable');
  assert.equal(empty.district(), 'District not assigned');
  assert.equal(empty.district('deleted', 'Former District'), 'Former District');
  assert.equal(empty.district('deleted'), 'District name unavailable');
  assert.equal(labels.district('deleted'), 'District name unavailable');
});
test('resolved report labels appear in print metadata without modifying stored IDs or source data', () => {
  const raw = { districtId: id, missionId: 'm', month: 11, year: 2026, userId: 'pastor' };
  const report = readBorangB('b', raw)!;
  const resolved = labels.withNames(report);
  const metadata = borangBDocument(resolved).metadata!;
  assert.ok(metadata.some(([key, value]) => key === 'District' && value === 'Kiulu'));
  assert.ok(metadata.some(([key, value]) => key === 'Mission' && value === 'Sabah Mission'));
  assert.equal(resolved.districtId, id); assert.equal(resolved.sourceData, report.sourceData);
  assert.equal(report.districtName, undefined); assert.deepEqual(report.sourceData, raw);
  assert.ok(!JSON.stringify(borangBDocument(report).metadata).includes(id));
  const quarterly = quarterlyDocument(labels.withNames(readQuarterlyReport('q', { districtId: id, churchId: 'c', year: 2026, quarter: 4 })), 'Quarterly');
  assert.ok(quarterly.metadata!.some(([key, value]) => key === 'Church' && value === 'Kiulu Church'));
  assert.ok(quarterly.metadata!.some(([key, value]) => key === 'District' && value === 'Kiulu'));
});
