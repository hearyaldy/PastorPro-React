import type { BorangBReport, Church, District, FinancialReport, Mission, StaffMember, UserProfile } from '../types';

export type ReportingLevel = 'mission' | 'district' | 'church';
export interface ReportingScope { mission: Mission; level: ReportingLevel; districtId?: string; churchId?: string }
export const missionLeaders = new Set(['super_admin', 'admin', 'mission_admin', 'ministerial_secretary', 'director', 'officer']);
const normalized = (value: unknown) => String(value ?? '').trim().toLowerCase();
export const aliases = (entity: { id: string; name: string; code?: string }) => [...new Set([entity.id, entity.name, entity.code].filter((value): value is string => Boolean(value)))];
export const hasAlias = (value: unknown, entity: { id: string; name: string; code?: string }) => aliases(entity).some(alias => normalized(alias) === normalized(value));

export function assignedMission(profile: UserProfile, missions: Mission[]): Mission | null {
  return missions.find(item => item.id === profile.missionId)
    || missions.find(item => hasAlias(profile.missionId, item))
    || (!profile.missionId ? missions.find(item => hasAlias(profile.missionName, item)) : undefined) || null;
}
export function missionEntities(mission: Mission, districts: District[], churches: Church[], staff: StaffMember[]) {
  const selectedDistricts = districts.filter(item => hasAlias(item.missionId, mission));
  const selectedChurches = churches.filter(item => hasAlias(item.missionId, mission) || (!item.missionId && selectedDistricts.some(district => hasAlias(item.districtId, district))));
  const selectedStaff = staff.filter(item => hasAlias(item.missionId, mission));
  return { districts: selectedDistricts, churches: selectedChurches, staff: selectedStaff };
}
export function reportingAccess(profile: UserProfile, mission: Mission, districts: District[], churches: Church[]) {
  const active = profile.isActive && profile.approvalStatus !== 'pending' && profile.approvalStatus !== 'rejected';
  const sameMission = hasAlias(profile.missionId || profile.missionName, mission);
  const leadership = active && missionLeaders.has(profile.userRole) && (sameMission || profile.userRole === 'super_admin');
  const assignedChurch = churches.find(item => item.id === profile.churchId)
    || churches.find(item => item.treasurerId === profile.uid);
  const assignedDistrict = districts.find(item => hasAlias(profile.districtId, item))
    || districts.find(item => item.id === assignedChurch?.districtId)
    || districts.find(item => item.districtPastorId === profile.uid);
  const canChooseDistrict = leadership;
  const districtChoices = !active ? [] : leadership ? districts : sameMission && assignedDistrict ? [assignedDistrict] : [];
  const churchChoices = !active ? [] : leadership ? churches
    : !sameMission ? [] : profile.userRole === 'district_pastor' && assignedDistrict
      ? churches.filter(item => hasAlias(item.districtId, assignedDistrict)) : assignedChurch ? [assignedChurch] : [];
  return { leadership, assignedChurch, assignedDistrict, districtChoices, churchChoices, canChooseDistrict,
    canCompare: leadership || (active && sameMission && profile.userRole === 'district_pastor'),
    canWrite: active && (profile.userRole === 'super_admin' || (sameMission && ['admin', 'mission_admin', 'district_pastor', 'church_treasurer'].includes(profile.userRole))),
    canOverrideMission: active && profile.userRole === 'super_admin' };
}

export interface ReportQuerySpec { field: string; value: string | string[]; operator?: '==' | 'in' }
export function reportQuerySpecs(profile: UserProfile, scope: ReportingScope, districts: District[], churches: Church[]) {
  const access = reportingAccess(profile, scope.mission, districts, churches);
  const ownFinance = { field: 'submittedBy', value: profile.uid };
  const ownBorang = { field: 'userId', value: profile.uid };
  if (access.leadership) {
    const global = profile.userRole === 'super_admin' || profile.userRole === 'admin';
    const mission = global ? { field: 'missionId', operator: 'in' as const, value: aliases(scope.mission) }
      : { field: 'missionId', value: profile.missionId || scope.mission.id };
    return { finance: [mission, ownFinance], borang: [mission, ownBorang] };
  }
  if (profile.userRole === 'district_pastor' && access.assignedDistrict) {
    const district = { field: 'districtId', value: access.assignedDistrict.id };
    return { finance: [district, ...access.churchChoices.map(church => ({ field: 'churchId', value: church.id })), ownFinance], borang: [district, ownBorang] };
  }
  if (profile.userRole === 'church_treasurer' && access.assignedChurch) {
    return { finance: [{ field: 'churchId', value: access.assignedChurch.id }, ownFinance], borang: [ownBorang] };
  }
  return { finance: [ownFinance], borang: [ownBorang] };
}

const cents = (value: number | undefined) => Math.round((Number.isFinite(value) ? value! : 0) * 100);
const stamp = (value: unknown): number => {
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  return 0;
};
function latest<T extends { id: string; updatedAt?: unknown; createdAt?: unknown }>(items: T[], key: (item: T) => string) {
  const result = new Map<string, T>();
  for (const item of [...items].sort((a, b) => (stamp(b.updatedAt) || stamp(b.createdAt)) - (stamp(a.updatedAt) || stamp(a.createdAt)) || a.id.localeCompare(b.id))) {
    if (!result.has(key(item))) result.set(key(item), item);
  }
  return { items: [...result.values()], duplicateCount: items.length - result.size };
}
export interface FinancialTotals { tithe: number; offerings: number; special: number; custom: number; total: number }
export function financialTotals(reports: FinancialReport[]): FinancialTotals {
  const sum = reports.reduce((total, report) => ({
    tithe: total.tithe + cents(report.tithe), offerings: total.offerings + cents(report.offerings),
    special: total.special + cents(report.specialOfferings),
    custom: total.custom + (report.customFinanceTypes || []).reduce((amount, entry) => amount + cents(entry.amount), 0),
  }), { tithe: 0, offerings: 0, special: 0, custom: 0 });
  return { tithe: sum.tithe / 100, offerings: sum.offerings / 100, special: sum.special / 100, custom: sum.custom / 100,
    total: (sum.tithe + sum.offerings + sum.special + sum.custom) / 100 };
}
export function borangTotals(reports: BorangBReport[]) {
  const tithe = reports.reduce((sum, report) => sum + cents(report.tithe), 0);
  const offerings = reports.reduce((sum, report) => sum + cents(report.offerings), 0);
  return { tithe: tithe / 100, offerings: offerings / 100, total: (tithe + offerings) / 100 };
}

export type DiscrepancyStatus = 'match' | 'discrepancy' | 'field_mismatch' | 'missing_borangb' | 'missing_treasurer' | 'missing_both';
export interface DistrictDiscrepancy {
  district: District; churches: Church[]; reportedChurches: Church[]; missingChurches: Church[];
  finance: FinancialTotals; borang: ReturnType<typeof borangTotals>; borangCount: number; hasTreasurer: boolean;
  difference: number; percentage: number; titheDifference: number; offeringsDifference: number; status: DiscrepancyStatus;
}
export const discrepancyLabel: Record<DiscrepancyStatus, string> = {
  match: 'Match', discrepancy: 'Amount mismatch', field_mismatch: 'Field mismatch', missing_borangb: 'No Borang B', missing_treasurer: 'No treasurer report', missing_both: 'No reports',
};
export function districtDiscrepancies(districts: District[], churches: Church[], financial: FinancialReport[], borang: BorangBReport[]): DistrictDiscrepancy[] {
  return districts.map(district => {
    const districtChurches = churches.filter(church => hasAlias(church.districtId, district));
    const reports = financial.filter(report => hasAlias(report.districtId, district) || (!report.districtId && districtChurches.some(church => church.id === report.churchId)));
    const borangReports = borang.filter(report => hasAlias(report.districtId, district) || (!report.districtId && districtChurches.some(church => church.id === report.churchId)));
    const finance = financialTotals(reports), b = borangTotals(borangReports);
    // Reconcile like-for-like fields. Special/custom offerings do not exist in Borang B.
    const comparable = cents(finance.tithe) + cents(finance.offerings);
    const totalDiff = comparable - cents(b.total);
    const titheDiff = cents(finance.tithe) - cents(b.tithe), offeringsDiff = cents(finance.offerings) - cents(b.offerings);
    const larger = Math.max(comparable, cents(b.total));
    const percentage = larger > 0 ? Math.abs(totalDiff) / larger * 100 : 0;
    const status: DiscrepancyStatus = !reports.length && !borangReports.length ? 'missing_both'
      : !reports.length ? 'missing_treasurer' : !borangReports.length ? 'missing_borangb'
        : Math.abs(totalDiff) <= 1 && (Math.abs(titheDiff) > 1 || Math.abs(offeringsDiff) > 1) ? 'field_mismatch'
          : (larger >= 1000 ? percentage > 1 : Math.abs(totalDiff) > 1) ? 'discrepancy' : 'match';
    const ids = new Set(reports.map(report => report.churchId));
    return { district, churches: districtChurches, reportedChurches: districtChurches.filter(church => ids.has(church.id)), missingChurches: districtChurches.filter(church => !ids.has(church.id)),
      finance, borang: b, borangCount: borangReports.length, hasTreasurer: reports.length > 0,
      difference: totalDiff / 100, percentage, titheDifference: titheDiff / 100, offeringsDifference: offeringsDiff / 100, status };
  });
}

export const ministryFields = ['baptisms', 'professionOfFaith', 'membersBeginning', 'membersReceived', 'membersTransferredIn', 'membersTransferredOut', 'membersDropped', 'membersDeceased', 'membersEnd', 'sabbathServices', 'bibleStudies', 'prayerMeetings', 'evangelisticMeetings',
  'homeVisitations', 'hospitalVisitations', 'prisonVisitations', 'booksDistributed', 'magazinesDistributed', 'tractsDistributed', 'weddings', 'funerals', 'dedications'] as const;

export function aggregateMissionReports(input: {
  scope: ReportingScope; profile: UserProfile; year: number; month: number; districts: District[]; churches: Church[]; financial: FinancialReport[]; borang: BorangBReport[];
}) {
  const { scope, profile, year, month, districts, churches } = input;
  const access = reportingAccess(profile, scope.mission, districts, churches);
  const selectedDistrict = districts.find(item => item.id === scope.districtId);
  const selectedChurch = churches.find(item => item.id === scope.churchId);
  const scopedChurches = churches.filter(church => scope.level === 'mission' || (scope.level === 'district' && selectedDistrict && hasAlias(church.districtId, selectedDistrict)) || (scope.level === 'church' && church.id === selectedChurch?.id));
  const scopedDistricts = districts.filter(district => scope.level === 'mission' || (scope.level === 'district' && district.id === selectedDistrict?.id) || (scope.level === 'church' && hasAlias(selectedChurch?.districtId, district)));
  const inScope = (report: { missionId: string; districtId: string; churchId?: string }, owned: boolean) => {
    const church = churches.find(item => item.id === report.churchId);
    if (report.missionId && !hasAlias(report.missionId, scope.mission)) return false;
    if (!report.missionId && !church && !scopedDistricts.some(district => hasAlias(report.districtId, district)) && !owned) return false;
    if (scope.level === 'mission') return true;
    if (scope.level === 'church') return Boolean(selectedChurch && report.churchId === selectedChurch.id);
    if (!selectedDistrict) return false;
    if (report.districtId) return hasAlias(report.districtId, selectedDistrict);
    if (church) return hasAlias(church.districtId, selectedDistrict);
    return owned && access.assignedDistrict?.id === selectedDistrict.id;
  };
  const validFinancial = input.financial.filter(report => inScope(report, report.submittedBy === profile.uid));
  const validBorang = input.borang.filter(report => inScope(report, report.userId === profile.uid));
  const treasury = latest(validFinancial, report => `${report.churchId || report.id}:${report.year}:${report.month}`);
  const ministry = latest(validBorang, report => `${report.userId}:${report.year}:${report.month}`);
  const monthlyFinancial = treasury.items.filter(report => report.year === year && report.month === month);
  const ytdReports = treasury.items.filter(report => report.year === year && report.month >= 1 && report.month <= month);
  const monthlyBorang = ministry.items.filter(report => report.year === year && report.month === month);
  // Fallbacks for legacy owner records with no district are attributed only to that owner's assigned district.
  const attributedFinancial = monthlyFinancial.map(report => !report.districtId && !churches.some(church => church.id === report.churchId) && report.submittedBy === profile.uid && access.assignedDistrict ? { ...report, districtId: access.assignedDistrict.id } : report);
  const attributedBorang = monthlyBorang.map(report => !report.districtId && !churches.some(church => church.id === report.churchId) && report.userId === profile.uid && access.assignedDistrict ? { ...report, districtId: access.assignedDistrict.id } : report);
  const reportedIds = new Set([...monthlyFinancial.map(report => report.churchId), ...monthlyBorang.map(report => report.churchId)].filter(Boolean));
  const reportedChurches = scopedChurches.filter(church => reportedIds.has(church.id));
  const ministryStats = Object.fromEntries(ministryFields.map(field => [field, monthlyBorang.reduce((sum, report) => sum + report[field], 0)])) as Record<typeof ministryFields[number], number>;
  const discrepancies = districtDiscrepancies(scopedDistricts, scopedChurches, attributedFinancial, attributedBorang);
  return { ytd: financialTotals(ytdReports), monthly: financialTotals(monthlyFinancial), borang: borangTotals(monthlyBorang), monthlyFinancial, monthlyBorang, ministry: ministryStats,
    duplicateCount: treasury.duplicateCount + ministry.duplicateCount, discrepancies, scopedChurches, scopedDistricts,
    reportedChurches, missingChurches: scopedChurches.filter(church => !reportedIds.has(church.id)),
    completion: scopedChurches.length ? Math.floor(reportedChurches.length / scopedChurches.length * 100) : 0,
    pastorReport: monthlyBorang.find(report => report.userId === profile.uid) || null };
}

export function discrepancyExport(rows: DistrictDiscrepancy[]) {
  return rows.map(row => ({ District: row.district.name, ChurchCount: row.churches.length, ChurchesReported: row.reportedChurches.length,
    MissingChurches: row.missingChurches.map(church => church.name).join('; '), Status: discrepancyLabel[row.status],
    TreasurerTitheRM: row.finance.tithe, TreasurerOfferingsRM: row.finance.offerings, TreasurerComparableTotalRM: row.finance.tithe + row.finance.offerings,
    BorangBTitheRM: row.borang.tithe, BorangBOfferingsRM: row.borang.offerings, BorangBTotalRM: row.borang.total,
    DifferenceRM: row.difference, DiscrepancyPercent: Number(row.percentage.toFixed(2)) }));
}
