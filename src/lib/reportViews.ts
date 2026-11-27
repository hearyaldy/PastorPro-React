import type { FinancialReport, QuarterlyDepartmentReport } from '../types';
import { numberValue, reportPeriod } from './borangB';

export function readFinancialReport(id: string, raw: Record<string, unknown>): FinancialReport | null {
  const period = reportPeriod(raw.month, raw.year);
  if (!period) return null;
  const custom = Array.isArray(raw.customFinanceTypes) ? raw.customFinanceTypes.map((item: Record<string, unknown>) => ({ name: String(item.label ?? item.name ?? 'Custom Finance'), amount: numberValue(item.amount) })) : [];
  const offerings = numberValue(raw.offerings ?? numberValue(raw.combinedBudget) + numberValue(raw.missionOffering) + numberValue(raw.localChurchOffering));
  const special = numberValue(raw.specialOfferings ?? raw.specialOffering);
  const tithe = numberValue(raw.tithe);
  return {
    ...raw, ...period, id, sourceData: raw,
    missionId: String(raw.missionId || ''), districtId: String(raw.districtId || ''), regionId: String(raw.regionId || ''),
    churchId: String(raw.churchId || ''), churchName: String(raw.churchName || ''), submittedBy: String(raw.submittedBy || ''),
    tithe, offerings, specialOfferings: special, customFinanceTypes: custom,
    combinedBudget: numberValue(raw.combinedBudget), missionOffering: numberValue(raw.missionOffering),
    localChurchOffering: numberValue(raw.localChurchOffering), specialOffering: special,
    totalIncome: tithe + offerings + special + custom.reduce((sum, item) => sum + numberValue(item.amount), 0),
    totalExpense: numberValue(raw.totalExpense),
    history: Array.isArray(raw.history) ? raw.history.map((entry: Record<string, unknown>) => ({ userId: String(entry.editedBy ?? entry.userId ?? ''), userName: String(entry.editorName ?? entry.userName ?? ''), action: String(entry.action || ''), timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : entry.editedAt && typeof entry.editedAt === 'object' && 'toDate' in entry.editedAt && typeof entry.editedAt.toDate === 'function' ? entry.editedAt.toDate().toISOString() : '', changes: typeof entry.changes === 'string' ? entry.changes : JSON.stringify(entry.changes || {}) })) : [],
    status: raw.status === 'approved' || raw.status === 'verified' ? 'verified' : raw.status === 'submitted' ? 'submitted' : 'draft',
  };
}

export function readQuarterlyReport(id: string, raw: Record<string, unknown>): QuarterlyDepartmentReport {
  const key = raw.departmentKey ?? raw.department;
  const department = key === 'kanakKanak' ? 'kanak_kanak' : key;
  return {
    ...raw, id, sourceData: raw, department: String(department || ''),
    missionId: String(raw.missionId || ''), regionId: String(raw.regionId || ''), districtId: String(raw.districtId || ''),
    churchId: String(raw.churchId || ''), churchName: String(raw.churchName || ''), submittedBy: String(raw.submittedBy || ''),
    year: Number(raw.year), quarter: Number(raw.quarter) as QuarterlyDepartmentReport['quarter'],
    status: raw.values && typeof raw.values === 'object' && !Array.isArray(raw.values) ? 'submitted' : raw.status === 'submitted' ? 'submitted' : 'draft', payload: (raw.payload || {}) as Record<string, number>,
  };
}

export const CHILDREN_FIELDS: Record<string, string> = {
  count0to2: 'Ages 0-2', count3to5: 'Ages 3-5', count6to9: 'Ages 6-9', count10to12: 'Ages 10-12', count13to14: 'Ages 13-14',
  aptaSdaFamilies: 'APTA SDA Families', aptaNonSdaFamilies: 'APTA Non-SDA Families', kidEnrollment: 'KID Enrollment', familiesWithRegularWorship: 'Families with Regular Worship',
};
export const STEWARDSHIP_FIELDS: Record<string, string> = {
  employedPermanent: 'Permanently Employed', selfEmployed: 'Self-Employed', unemployed: 'Unemployed',
  sermonsDelivered: 'Sermons Delivered', seminarsHosted: 'Seminars Hosted', familyVisitations: 'Family Visitations',
};
export const FAM_INCOME_FIELDS: Record<string, string> = {
  buildingFund: 'Building Fund', welfareFund: 'Welfare Fund', missionFund: 'Mission Fund', educationFund: 'Education Fund',
  youthFund: 'Youth Fund', childrenFund: 'Children Fund', womenMinistryFund: "Women's Ministry Fund", menMinistryFund: "Men's Ministry Fund",
  seniorMinistryFund: 'Senior Ministry Fund', musicMinistryFund: 'Music Ministry Fund', otherIncome: 'Other Income',
};
export const FAM_EXPENSE_FIELDS: Record<string, string> = {
  maintenanceFund: 'Maintenance', utilitiesFund: 'Utilities', insuranceFund: 'Insurance', salaries: 'Salaries', rent: 'Rent',
  supplies: 'Supplies', transportation: 'Transportation', communication: 'Communication', printing: 'Printing', equipment: 'Equipment', otherExpenses: 'Other Expenses',
};
