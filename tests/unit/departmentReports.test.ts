import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateDepartment, answerRows, departmentExportRows, defaultDepartmentTemplates, departmentAnswers, departmentDocument, normalizeAnswers, readDepartmentTemplate, reportTemplate, templateDefinition, validateAnswers, validateTemplate } from '../../src/lib/departmentReports';
import { readQuarterlyReport } from '../../src/lib/reportViews';
import { buildReportPdf } from '../../src/lib/pdfReport';
const [children, stewardship] = defaultDepartmentTemplates();
test('starter templates match Flutter field IDs and repeating monthly stewardship schema', () => {
  assert.deepEqual(validateTemplate(children), []); assert.deepEqual(validateTemplate(stewardship), []);
  assert.equal(children.steps[0].fields[4].id, 'count13to14');
  assert.equal(stewardship.steps[0].fields[0].type, 'repeatingGroup');
  assert.deepEqual(readDepartmentTemplate(children.id, templateDefinition(children)).steps, children.steps.map(step => ({ ...step, subtitle: '' })));
});
test('new Flutter submissions retain department, answers and submitted status; old fields are preserved', () => {
  const fresh = readQuarterlyReport('id', { templateId: children.id, departmentKey: 'kanak_kanak', departmentName: children.name, values: { count0to2: 3 }, year: 2026, quarter: 4 });
  assert.equal(fresh.department, 'kanak_kanak'); assert.equal(fresh.status, 'submitted'); assert.equal(departmentAnswers(fresh).count0to2, 3);
  const old = readQuarterlyReport('old', { department: 'kanakKanak', year: 2026, quarter: 4, kanakKanakData: { count13to14: 5 }, payload: { age0to4: 9 } });
  assert.equal(departmentAnswers(old).count13to14, 5); assert.equal(departmentAnswers(old).age0to4, 9);
  assert.equal(departmentAnswers(old).count0to2, undefined);
});
test('form validation rejects missing and invalid values without treating zero or false as missing', () => {
  const template = readDepartmentTemplate('test', { key: 'test', name: 'Test', steps: [{ id: 's', title: 'Questions', fields: [
    { id: 'n', label: 'Count', type: 'number' }, { id: 'd', label: 'Choice', type: 'dropdown', options: ['A', 'B'] }, { id: 'b', label: 'Check', type: 'checkbox' },
    { id: 'g', label: 'Months', type: 'repeatingGroup', repeatCount: 1, subFields: [{ id: 'c', label: 'Amount', type: 'currency' }] },
  ] }] });
  assert.ok(validateAnswers(template, {}).n); assert.ok(validateAnswers(template, {}).d); assert.ok(validateAnswers(template, {})['g.0.c']);
  assert.deepEqual(validateAnswers(template, { n: 0, d: 'A', b: false, g: [{ c: 0 }] }), {});
  assert.ok(validateAnswers(template, { n: -1, d: 'C', g: [{ c: 'invalid' }] }).n);
  assert.ok(validateAnswers(template, { n: 1.5, d: 'A', g: [{ c: 1 }] }).n);
});
test('normalization retains retired fields, unknown sub-fields and extra repetitions', () => {
  const result = normalizeAnswers(stewardship, { retired: 'keep', months: [{ titheAmount: '12.345', extra: 'keep' }, {}, {}, { archived: true }] });
  assert.equal(result.retired, 'keep'); const rows = result.months as Record<string, unknown>[];
  assert.equal(rows[0].titheAmount, 12.35); assert.equal(rows[0].extra, 'keep'); assert.equal(rows[3].archived, true);
});
test('historical snapshots keep response labels stable and dynamic PDFs contain all repeating values', () => {
  const report = readQuarterlyReport('r', { templateId: stewardship.id, departmentKey: stewardship.key, departmentName: stewardship.name, values: { months: [{ titheAmount: 123, titheGivers: 2, offeringAmount: 50, systematicGivers: 1 }] }, templateSnapshot: templateDefinition(stewardship), year: 2026, quarter: 4, churchName: 'Sample Church' });
  const changed = { ...stewardship, name: 'New name', steps: [] };
  const historical = reportTemplate(report, [changed])!;
  assert.equal(historical.steps.length, 3); assert.equal(historical.name, stewardship.name);
  const document = departmentDocument(report, historical);
  assert.ok(document.sections[0].rows?.some(row => row[0] === 'Month 1 · Tithe' && row[1] === 'RM 123.00'));
  assert.ok(buildReportPdf(document).output().startsWith('%PDF-'));
  assert.ok(aggregateDepartment(stewardship, [report, report]).some(row => row[0] === 'Month 1 · Tithe' && row[1] === 'RM 246.00'));
  assert.ok(answerRows(stewardship, departmentAnswers(report)).length > 12);
});

test('response spreadsheets use question labels as columns and preserve earlier answers', () => {
  const report = readQuarterlyReport('r', { templateId: children.id, departmentKey: children.key, values: { count0to2: 3, earlierActivity: 'Recorded earlier' }, churchName: 'Sample Church', year: 2026, quarter: 4 });
  const row = departmentExportRows([report], [children])[0];
  assert.equal(row['Answer · Bayi (0–2 years)'], '3');
  assert.equal(row['Answer · earlier Activity'], 'Recorded earlier');
  assert.ok(!('Answers' in row));
  const other = readQuarterlyReport('other', { departmentKey: 'penatalayanan', values: { months: [{ titheAmount: 10 }] }, year: 2026, quarter: 4 });
  const mixed = departmentExportRows([report, other], [children, stewardship]);
  assert.equal(mixed[0]['Answer · Month 1 · Tithe'], '');
  assert.equal(mixed[1]['Answer · Month 1 · Tithe'], 'RM 10.00');
});
