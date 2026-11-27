import { reportRevision } from './borangB';
import type { QuarterlyDepartmentReport } from '../types';
import type { PrintableReport } from './pdfReport';

export type QuestionType = 'text' | 'number' | 'currency' | 'checkbox' | 'dropdown' | 'repeatingGroup';
export interface DepartmentQuestion { id: string; label: string; type: QuestionType; required: boolean; helpText?: string; options?: string[]; prefix?: string; repeatCount?: number; repeatLabels?: string[]; subFields?: DepartmentQuestion[] }
export interface DepartmentSection { id: string; title: string; subtitle?: string; fields: DepartmentQuestion[] }
export interface DepartmentTemplate { id: string; key: string; name: string; description?: string; isActive: boolean; order: number; steps: DepartmentSection[]; sourceData?: Record<string, unknown> }
export type Answer = string | number | boolean | Record<string, unknown>[];
export type DepartmentAnswers = Record<string, Answer>;
export const questionTypes: QuestionType[] = ['text', 'number', 'currency', 'checkbox', 'dropdown', 'repeatingGroup'];
export const questionTypeLabels: Record<QuestionType, string> = { text: 'Short answer', number: 'Number', currency: 'Currency', checkbox: 'Checkbox', dropdown: 'Dropdown', repeatingGroup: 'Repeating group' };
export const departmentKey = (value: unknown) => value === 'kanakKanak' ? 'kanak_kanak' : String(value || '');
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const string = (value: unknown) => String(value ?? '');
export function readDepartmentTemplate(id: string, raw: Record<string, unknown>): DepartmentTemplate {
  const field = (value: unknown): DepartmentQuestion => {
    const raw = object(value);
    return { id: string(raw.id), label: string(raw.label), type: questionTypes.includes(raw.type as QuestionType) ? raw.type as QuestionType : 'text', required: raw.required !== false,
      ...(typeof raw.helpText === 'string' ? { helpText: raw.helpText } : {}), ...(Array.isArray(raw.options) ? { options: raw.options.map(string) } : {}),
      ...(typeof raw.prefix === 'string' ? { prefix: raw.prefix } : {}), ...(typeof raw.repeatCount === 'number' ? { repeatCount: raw.repeatCount } : {}),
      ...(Array.isArray(raw.repeatLabels) ? { repeatLabels: raw.repeatLabels.map(string) } : {}), ...(Array.isArray(raw.subFields) ? { subFields: raw.subFields.map(field) } : {}) };
  };
  return { id, key: departmentKey(raw.key), name: string(raw.name), description: string(raw.description), isActive: raw.isActive !== false, order: Number(raw.order) || 0,
    steps: (Array.isArray(raw.steps) ? raw.steps : []).map(value => { const step = object(value); return { id: string(step.id), title: string(step.title), subtitle: string(step.subtitle), fields: (Array.isArray(step.fields) ? step.fields : []).map(field) }; }), sourceData: raw };
}
export function templateDefinition(template: DepartmentTemplate) {
  return { key: template.key, name: template.name, description: template.description || '', isActive: template.isActive, order: template.order, steps: template.steps };
}
export function templateFingerprint(template: DepartmentTemplate) { return reportRevision(templateDefinition(readDepartmentTemplate(template.id, templateDefinition(template)))); }
export function validateTemplate(template: DepartmentTemplate): string[] {
  const errors: string[] = [], ids = new Set<string>();
  if (!/^[a-z][a-z0-9_]{0,63}$/.test(template.key)) errors.push('Use a department key with lowercase letters, numbers and underscores.');
  if (!template.name.trim() || template.name.length > 160) errors.push('Enter a form title (up to 160 characters).');
  if (!template.steps.length || template.steps.length > 20) errors.push('Add between 1 and 20 sections.');
  const unique = (id: string) => { if (!id || ids.has(id)) errors.push('Every section and question needs a unique ID.'); ids.add(id); };
  const validateField = (field: DepartmentQuestion, nested = false) => {
    unique(field.id);
    if (!field.label.trim() || field.label.length > 200) errors.push('Every question needs a label (up to 200 characters).');
    if (!questionTypes.includes(field.type)) errors.push('Unknown question type.');
    if (field.type === 'dropdown' && (!field.options?.length || field.options.some(value => !value.trim()) || new Set(field.options).size !== field.options.length)) errors.push('Dropdown choices must be nonempty and unique.');
    if (field.type === 'repeatingGroup') {
      if (nested) errors.push('Repeating groups cannot be nested.');
      if (!Number.isInteger(field.repeatCount) || field.repeatCount! < 1 || field.repeatCount! > 12) errors.push('Repeating groups need 1–12 repetitions.');
      if (!field.subFields?.length || field.subFields.length > 20) errors.push('Repeating groups need 1–20 sub-questions.');
      field.subFields?.forEach(sub => validateField(sub, true));
    }
  };
  template.steps.forEach(step => { unique(step.id); if (!step.title.trim()) errors.push('Every section needs a title.'); if (!step.fields.length || step.fields.length > 40) errors.push('Every section needs 1–40 questions.'); step.fields.forEach(field => validateField(field)); });
  return [...new Set(errors)];
}
export function validateAnswers(template: DepartmentTemplate, values: DepartmentAnswers, section?: number) {
  const errors: Record<string, string> = {};
  const validate = (field: DepartmentQuestion, value: unknown, path: string) => {
    const blank = value === undefined || value === null || value === '';
    if (field.type === 'checkbox') { if (value !== undefined && typeof value !== 'boolean') errors[path] = 'Choose Yes or No.'; return; }
    if (blank) { if (field.required) errors[path] = 'This question is required.'; return; }
    if (field.type === 'number' || field.type === 'currency') {
      const n = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
      if (!Number.isFinite(n) || n < 0 || (field.type === 'number' && !Number.isInteger(n))) errors[path] = field.type === 'number' ? 'Enter a whole number of 0 or more.' : 'Enter a valid amount of 0 or more.';
    } else if (field.type === 'dropdown' && !field.options?.includes(String(value))) errors[path] = 'Choose an available option.';
    else if (field.type === 'text' && (typeof value !== 'string' || value.length > 4000)) errors[path] = 'Use up to 4,000 characters.';
  };
  (section === undefined ? template.steps : [template.steps[section]]).filter(Boolean).forEach(step => step.fields.forEach(field => {
    if (field.type === 'repeatingGroup') {
      for (let i = 0; i < (field.repeatCount || 0); i++) field.subFields?.forEach(sub => validate(sub, object((values[field.id] as unknown[] | undefined)?.[i])[sub.id], `${field.id}.${i}.${sub.id}`));
    } else validate(field, values[field.id], field.id);
  }));
  return errors;
}
/** Lossless compatibility: map only fields with equivalent definitions. */
export function departmentAnswers(report: QuarterlyDepartmentReport): DepartmentAnswers {
  const raw = report.sourceData || {};
  if (raw.values && typeof raw.values === 'object' && !Array.isArray(raw.values)) return { ...raw.values as DepartmentAnswers };
  const nested = departmentKey(report.department) === 'kanak_kanak' ? object(raw.kanakKanakData) : departmentKey(report.department) === 'penatalayanan' ? object(raw.penatalayananData) : {};
  return { ...report.payload, ...nested } as DepartmentAnswers;
}
export function normalizeAnswers(template: DepartmentTemplate, values: DepartmentAnswers): DepartmentAnswers {
  // Retired/unknown answers remain in the map; questions only update their own IDs.
  const output = { ...values };
  const normalize = (field: DepartmentQuestion, value: unknown): unknown => {
    if (value === '' || value === undefined || value === null) return field.type === 'checkbox' ? false : '';
    if (field.type === 'currency') return Math.round(Number(value) * 100) / 100;
    if (field.type === 'number') return Number(value);
    return value;
  };
  template.steps.forEach(step => step.fields.forEach(field => {
    if (field.type === 'repeatingGroup') {
      const previous = Array.isArray(values[field.id]) ? values[field.id] as Record<string, unknown>[] : [];
      const rows = previous.map(row => ({ ...object(row) }));
      for (let i = 0; i < (field.repeatCount || 0); i++) { const row = { ...rows[i] }; field.subFields?.forEach(sub => { row[sub.id] = normalize(sub, row[sub.id]); }); rows[i] = row; }
      output[field.id] = rows;
    } else output[field.id] = normalize(field, values[field.id]) as Answer;
  }));
  return output;
}
export function answerRows(template: DepartmentTemplate, values: DepartmentAnswers, section?: DepartmentSection): [string, string][] {
  const format = (field: DepartmentQuestion, value: unknown) => value === undefined || value === null || value === '' ? '—' : field.type === 'checkbox' ? value === true ? 'Yes' : 'No' : field.type === 'currency' && Number.isFinite(Number(value)) ? `${field.prefix || 'RM'} ${Number(value).toFixed(2)}` : String(value);
  return (section ? [section] : template.steps).flatMap(step => step.fields.flatMap(field => {
    if (field.type !== 'repeatingGroup') return [[field.label, format(field, values[field.id])] as [string, string]];
    const rows = Array.isArray(values[field.id]) ? values[field.id] as Record<string, unknown>[] : [];
    return Array.from({ length: Math.max(field.repeatCount || 0, rows.length) }, (_, i) => (field.subFields || []).map(sub => [`${field.repeatLabels?.[i] || `Month ${i + 1}`} · ${sub.label}`, format(sub, rows[i]?.[sub.id])] as [string, string])).flat();
  }));
}
export function reportTemplate(report: QuarterlyDepartmentReport, templates: DepartmentTemplate[]) {
  const snapshot = report.sourceData?.templateSnapshot;
  if (snapshot && typeof snapshot === 'object') return readDepartmentTemplate(String(report.sourceData?.templateId || ''), snapshot as Record<string, unknown>);
  return templates.find(template => template.id === report.sourceData?.templateId) || templates.find(template => template.key === departmentKey(report.department));
}
export function retiredAnswerRows(template: DepartmentTemplate, values: DepartmentAnswers): [string, string][] {
  const fields = template.steps.flatMap(step => step.fields), known = new Set(fields.map(field => field.id));
  const title = (id: string) => /^[\da-f-]{36}$/i.test(id) ? 'Earlier question' : id.replace(/([A-Z])/g, ' $1');
  const display = (value: unknown) => typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  const rows: [string, string][] = Object.entries(values).filter(([id]) => !known.has(id)).map(([id, value]) => [title(id), display(value)]);
  fields.filter(field => field.type === 'repeatingGroup').forEach(field => {
    const entries = Array.isArray(values[field.id]) ? values[field.id] as Record<string, unknown>[] : [];
    entries.forEach((row, index) => Object.entries(row).filter(([id]) => !(field.subFields || []).some(sub => sub.id === id)).forEach(([id, value]) => rows.push([`${field.label} · ${index + 1} · ${title(id)}`, display(value)])));
  });
  return rows;
}
export function departmentDocument(report: QuarterlyDepartmentReport, template: DepartmentTemplate): PrintableReport {
  const values = departmentAnswers(report);
  return { title: report.sourceData?.departmentName as string || template.name, filename: `${template.key}_${report.churchName.replace(/\W+/g, '_')}_${report.year}_Q${report.quarter}`, subtitle: `Q${report.quarter} ${report.year}`,
    metadata: [['Church', report.churchName], ['District', report.districtName || 'District name unavailable'], ['Submitted by', report.submittedByName || 'Name unavailable'], ['Status', report.status]],
    sections: [...template.steps.map(step => ({ title: step.title, text: step.subtitle, rows: answerRows(template, values, step) })), ...(retiredAnswerRows(template, values).length ? [{ title: 'Earlier answers', rows: retiredAnswerRows(template, values) }] : [])], blueHeader: true };
}
export function aggregateDepartment(template: DepartmentTemplate, reports: QuarterlyDepartmentReport[]) {
  const rows: [string, string | number][] = [];
  template.steps.forEach(step => step.fields.forEach(field => {
    const aggregate = (question: DepartmentQuestion, values: unknown[], label: string) => {
      if (question.type === 'number' || question.type === 'currency') { const n = values.reduce<number>((sum, value) => sum + (value !== '' && Number.isFinite(Number(value)) ? Number(value) : 0), 0); rows.push([label, question.type === 'currency' ? `${question.prefix || 'RM'} ${n.toFixed(2)}` : n]); }
      if (question.type === 'checkbox') rows.push([label, values.filter(value => value === true).length]);
      if (question.type === 'dropdown') { const tally = new Map<string, number>(); values.filter(value => value !== undefined && value !== '').forEach(value => tally.set(String(value), (tally.get(String(value)) || 0) + 1)); tally.forEach((count, value) => rows.push([`${label} · ${value}`, count])); }
    };
    if (field.type === 'repeatingGroup') { for (let i = 0; i < (field.repeatCount || 0); i++) field.subFields?.forEach(sub => aggregate(sub, reports.map(report => object((departmentAnswers(report)[field.id] as unknown[] | undefined)?.[i])[sub.id]), `${field.repeatLabels?.[i] || `Month ${i + 1}`} · ${sub.label}`)); }
    else aggregate(field, reports.map(report => departmentAnswers(report)[field.id]), field.label);
  }));
  return rows;
}
export function departmentExportRows(reports: QuarterlyDepartmentReport[], templates: DepartmentTemplate[]) {
  const rows = reports.map(report => {
    const template = reportTemplate(report, templates), values = departmentAnswers(report);
    const row: Record<string, string | number> = { Church: report.churchName, District: report.districtName || 'District name unavailable', Department: report.sourceData?.departmentName as string || template?.name || report.department, Year: report.year, Quarter: report.quarter, Status: report.status, 'Submitted by': report.submittedByName || 'Name unavailable' };
    const answers = template ? [...answerRows(template, values), ...retiredAnswerRows(template, values)] : Object.entries(values).map(([key, value]) => [key.replace(/([A-Z])/g, ' $1'), typeof value === 'object' ? JSON.stringify(value) : String(value)] as [string, string]);
    const counts = new Map<string, number>();
    answers.forEach(([label, value]) => { const count = (counts.get(label) || 0) + 1; counts.set(label, count); row[`Answer · ${label}${count > 1 ? ` (${count})` : ''}`] = value; });
    return row;
  });
  // CSV uses the first row's headers, so include the union for mixed forms/versions.
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return rows.map(row => Object.fromEntries(headers.map(header => [header, row[header] ?? ''])));
}
const numberQuestion = (id: string, label: string): DepartmentQuestion => ({ id, label, type: 'number', required: true });
export function defaultDepartmentTemplates(): DepartmentTemplate[] {
  return [{ id: 'default_kanak_kanak', key: 'kanak_kanak', name: "Kanak-Kanak (Children’s Ministry)", description: 'Quarterly children’s ministry report', isActive: true, order: 0, steps: [
    { id: 'demographics', title: 'Demographics (ages under 15)', fields: [['count0to2', 'Bayi (0–2 years)'], ['count3to5', 'Tadika (3–5 years)'], ['count6to9', 'Kanak-Kanak (6–9 years)'], ['count10to12', 'Remaja (10–12 years)'], ['count13to14', 'Pra-Belia (13–14 years)']].map(([id, label]) => numberQuestion(id, label)) },
    { id: 'apta', title: 'APTA', fields: [numberQuestion('aptaSdaFamilies', 'SDA Families'), numberQuestion('aptaNonSdaFamilies', 'Non-SDA Families')] },
    { id: 'discipleship', title: 'Discipleship', fields: [numberQuestion('kidEnrollment', 'Kids in Discipleship (KID) Enrollment'), numberQuestion('familiesWithRegularWorship', 'Families with Regular Family Worship')] },
  ] }, { id: 'default_penatalayanan', key: 'penatalayanan', name: 'Penatalayanan (Stewardship)', description: 'Quarterly stewardship report', isActive: true, order: 1, steps: [
    { id: 'tithe_offerings', title: 'Borang AP — Tithe & Offerings', fields: [{ id: 'months', label: 'Monthly Tithe & Offerings', type: 'repeatingGroup', required: true, repeatCount: 3, repeatLabels: ['Month 1', 'Month 2', 'Month 3'], subFields: [{ id: 'titheAmount', label: 'Tithe', type: 'currency', required: true, prefix: 'RM' }, numberQuestion('titheGivers', 'Tithe Givers'), { id: 'offeringAmount', label: 'Offering', type: 'currency', required: true, prefix: 'RM' }, numberQuestion('systematicGivers', 'Systematic Givers')] }] },
    { id: 'employment', title: 'Borang BP — Employment Breakdown', fields: [numberQuestion('employedPermanent', 'Pekerjaan Tetap (Permanent)'), numberQuestion('selfEmployed', 'Bekerja Sendiri (Self-Employed)'), numberQuestion('unemployed', 'Belum Mempunyai Pekerjaan (Unemployed)')] },
    { id: 'activities', title: 'Borang BP — Activities', fields: [numberQuestion('sermonsDelivered', 'Sermons Delivered'), numberQuestion('seminarsHosted', 'Seminars Hosted'), numberQuestion('familyVisitations', 'Family Visitations')] },
  ] }];
}
