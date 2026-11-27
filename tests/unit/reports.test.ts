import { readChurch, readStaff } from '../../src/lib/hierarchyViews';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Timestamp } from 'firebase/firestore';
import { emptyBorangB, readBorangB, reportPeriod, reportRevision, reportsForPeriod, writeBorangB } from '../../src/lib/borangB';
import { activityDocument, activityStatistics, borangBDocument, financialDocument, quarterlyDocument } from '../../src/lib/reportDocuments';
import { readFinancialReport, readQuarterlyReport } from '../../src/lib/reportViews';
import { readActivity } from '../../src/lib/activities';
import { buildReportPdf } from '../../src/lib/pdfReport';
import { readUserProfile } from '../../src/lib/userProfiles';
import { readAppointment, readTodo } from '../../src/lib/scheduleViews';

const timestamp = '2026-11-27T12:00:00.000Z';
const raw = { ...emptyBorangB(), id: 'flutter-uuid', userId: 'pastor', userName: 'Pastor A', month: '2026-11-01T00:00:00.000',
  createdAt: timestamp, updatedAt: timestamp, status: 'submitted', membersEnd: 120, prisonVisitations: 3, booksDistributed: 17,
  bibleStudies: 12, professionOfFaith: 2, dedications: 1, tithe: 1000, offerings: 250, remarks: 'Keep this note', churchId: 'church-a' };

test('Borang B reads and writes every Flutter statistic without substituting sermons for services', () => {
  const report = readBorangB('actual-document-id', { ...raw, id: 'embedded-id', sermonsPreached: 9, sabbathServices: 4, customUnedited: 'retained' })!;
  assert.equal(report.id, 'actual-document-id');
  assert.equal(report.month, 11); assert.equal(report.year, 2026);
  const patch = writeBorangB(report, timestamp);
  for (const field of Object.keys(emptyBorangB())) assert.deepEqual(patch[field], field === 'sabbathServices' ? 4 : raw[field as keyof typeof raw]);
  assert.equal(patch.id, 'actual-document-id');
  assert.equal(patch.sabbathServices, 4);
  assert.equal(patch.month, raw.month);
  assert.equal(patch.createdAt, raw.createdAt);
  assert.equal(patch.submittedAt, timestamp);
  assert.equal(report.sourceData?.customUnedited, 'retained');
});

test('later Flutter zero values and empty notes override older React aliases', () => {
  const report = readBorangB('report', { ...raw, bibleStudies: 0, bibleStudiesGiven: 99, challenges: '', challengesAndPrayer: 'Old note' })!;
  assert.equal(report.bibleStudiesGiven, 0);
  assert.equal(report.challenges, '');
  assert.equal(writeBorangB(report, timestamp).bibleStudiesGiven, 0);
});

test('React numeric month records remain discoverable alongside Flutter UUID reports', () => {
  const first = readBorangB('react-id', { ...raw, month: 11, year: 2026 })!;
  const second = readBorangB('flutter-uuid', raw)!;
  assert.equal(reportsForPeriod([first, second], 'pastor', 2026, 11).length, 2);
  assert.equal(readBorangB('invalid', { month: 'invalid' }), null);
  assert.equal(reportRevision({ a: 1, b: 2 }), reportRevision({ b: 2, a: 1 }));
  assert.notEqual(reportRevision({ ...raw, remarks: 'changed' }), reportRevision(raw));
});

test('Flutter financial timestamps retain the local calendar month and offerings are not double counted', () => {
  const month = Timestamp.fromDate(new Date('2026-10-31T16:00:00.000Z'));
  assert.deepEqual(reportPeriod(month), { year: 2026, month: 11 });
  const report = readFinancialReport('finance', { month, tithe: 100, offerings: 50, combinedBudget: 999, localChurchOffering: 888,
    specialOfferings: 10, customFinanceTypes: [{ label: 'Building', amount: 5 }], status: 'approved' })!;
  assert.equal(report.totalIncome, 165);
  assert.equal(report.offerings, 50);
  assert.equal(report.customFinanceTypes?.[0].name, 'Building');
  const document = financialDocument(report, { buildingFund: 12, salaries: 7 });
  assert.deepEqual(document.sections[0].totals, ['TOTAL', 'RM 165.00']);
  assert.ok(document.sections.some(section => section.title === 'FAM Income' && section.rows?.some(row => row[0] === 'Building Fund' && row[1] === 'RM 12.00')));
});

test('quarterly previews preserve Flutter age groups and all monthly stewardship measures', () => {
  const report = readQuarterlyReport('quarter', { department: 'kanakKanak', quarter: 4, year: 2026, kanakKanakData: { count0to2: 3, count3to5: 4, count13to14: 5 } });
  const rows = quarterlyDocument(report, 'Children').sections[0].rows!;
  assert.deepEqual(rows.find(row => row[0] === 'Ages 13-14'), ['Ages 13-14', 5]);
  assert.equal(report.department, 'kanak_kanak');
  const stewardship = readQuarterlyReport('quarter', { department: 'penatalayanan', quarter: 4, year: 2026,
    penatalayananData: { months: [{ titheAmount: 100, titheGivers: 4, offeringAmount: 30, systematicGivers: 2 }], unemployed: 3 } });
  assert.deepEqual(quarterlyDocument(stewardship, 'Stewardship').sections[0].rows?.[0], ['October', '100.00', 4, '30.00', 2]);
});

test('activity totals and print rows use the same selected records and mileage rate', () => {
  const activities = [readActivity('a', { activities: 'Visit', date: '2026-11-01', mileage: 10.5 }), readActivity('b', { activities: 'Meeting', date: '2026-11-02', mileage: 9.5 })];
  const profile = readUserProfile('pastor', { displayName: 'Pastor A', userRole: 'user' });
  assert.deepEqual(activityStatistics(activities, 0.5), { count: 2, distance: 20, cost: 10 });
  const report = activityDocument(activities, profile, 'November 2026', 0.5);
  assert.deepEqual(report.sections[0].totals, ['TOTAL', '', '', '20.0', '10.00']);
});

test('Borang B PDF includes full grouped statistics and paginates long reports', () => {
  const document = borangBDocument(readBorangB('report', raw)!);
  assert.equal(document.sections[0].title, 'Church Membership Statistics');
  assert.ok(document.sections.some(section => section.rows?.some(row => row[0] === 'Prison Visitations' && row[1] === 3)));
  assert.deepEqual(document.sections.find(section => section.title === 'Tithes & Offerings (RM)')?.totals, ['TOTAL', 'RM 1,250.00']);
  const pdf = buildReportPdf({ ...document, sections: [...document.sections, { title: 'Long Report', columns: ['Entry', 'Notes'], rows: Array.from({ length: 160 }, (_, index) => [`Entry ${index}`, 'Full notes remain visible across multiple pages']) }] }, new Date(timestamp));
  assert.ok(pdf.getNumberOfPages() > 2);
  assert.equal(Math.round(pdf.internal.pageSize.getWidth()), 595);
  const output = pdf.output();
  assert.ok(output.startsWith('%PDF-'));
  assert.ok(output.includes(`Page ${pdf.getNumberOfPages()} of ${pdf.getNumberOfPages()}`));
  assert.ok(output.includes('Full notes remain visible'));
});

test('Flutter completion flags drive dashboard task and appointment statistics', () => {
  assert.equal(readTodo('todo', { content: 'Done', isCompleted: true, completed: false, priority: 2 }).completed, true);
  assert.equal(readTodo('todo', { content: 'Done', isCompleted: true, priority: 2 }).priority, 'high');
  assert.equal(readAppointment('appointment', { title: 'Visit', isCompleted: true, status: 'scheduled', contactPerson: 'John' }).status, 'completed');
});


test('Flutter church and staff names remain visible to mission statistics', () => {
  assert.equal(readChurch('church', { churchName: 'Kiulu', memberCount: 120 }).name, 'Kiulu');
  assert.equal(readChurch('church', { churchName: 'Kiulu', memberCount: 120 }).memberCount, 120);
  const staff = readStaff('staff', { name: 'Pastor A', role: 'Pastor', mission: 'sam', district: 'kiulu' });
  assert.equal(staff.fullName, 'Pastor A'); assert.equal(staff.position, 'Pastor');
  assert.equal(staff.missionId, 'sam'); assert.equal(staff.districtId, 'kiulu');
});
