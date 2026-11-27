import type { BorangBReport } from '../types';

export const BORANG_B_SECTIONS = [
  { title: 'Church Membership Statistics', color: 'blue', fields: [
    ['membersBeginning', 'Members at Beginning'], ['membersReceived', 'Members Received'],
    ['membersTransferredIn', 'Transferred In'], ['membersTransferredOut', 'Transferred Out'],
    ['membersDropped', 'Dropped / Removed'], ['membersDeceased', 'Deceased'], ['membersEnd', 'Members at End'],
  ] },
  { title: 'Baptisms & Professions', color: 'teal', fields: [['baptisms', 'Baptisms'], ['professionOfFaith', 'Professions of Faith']] },
  { title: 'Church Services', color: 'purple', fields: [
    ['sabbathServices', 'Sabbath Services'], ['prayerMeetings', 'Prayer Meetings'], ['bibleStudies', 'Bible Studies'], ['evangelisticMeetings', 'Evangelistic Meetings'],
  ] },
  { title: 'Visitations', color: 'green', fields: [['homeVisitations', 'Home Visitations'], ['hospitalVisitations', 'Hospital Visitations'], ['prisonVisitations', 'Prison Visitations']] },
  { title: 'Special Events', color: 'orange', fields: [['weddings', 'Weddings'], ['funerals', 'Funerals'], ['dedications', 'Baby Dedications']] },
  { title: 'Literature Distribution', color: 'orange', fields: [['booksDistributed', 'Books Distributed'], ['magazinesDistributed', 'Magazines Distributed'], ['tractsDistributed', 'Tracts Distributed']] },
  { title: 'Tithes & Offerings (RM)', color: 'teal', fields: [['tithe', 'Tithe'], ['offerings', 'Offerings']] },
] as const;
export type BorangBNumberKey = typeof BORANG_B_SECTIONS[number]['fields'][number][0];
export const BORANG_B_TEXT_FIELDS = [['otherActivities', 'Other Activities'], ['challenges', 'Challenges Faced'], ['remarks', 'Remarks']] as const;
export type BorangBTextKey = typeof BORANG_B_TEXT_FIELDS[number][0];
export type BorangBForm = Record<BorangBNumberKey, number> & Record<BorangBTextKey, string>;

export const numberValue = (value: unknown) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? Math.max(0, result) : 0;
};

export function reportPeriod(month: unknown, year?: unknown): { month: number; year: number } | null {
  if (typeof month === 'number' && Number.isInteger(month) && month >= 1 && month <= 12 && Number(year) >= 2000) return { month, year: Number(year) };
  if (typeof month === 'string') {
    const match = /^(\d{4})-(\d{2})(?:-|T|$)/.exec(month);
    if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return { year: Number(match[1]), month: Number(match[2]) };
  }
  if (month && typeof month === 'object' && 'toDate' in month && typeof month.toDate === 'function') {
    const date: Date = month.toDate();
    // Financial months are local calendar dates, stored by Flutter as timestamps.
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'numeric' }).formatToParts(date);
    return { year: Number(parts.find(p => p.type === 'year')?.value), month: Number(parts.find(p => p.type === 'month')?.value) };
  }
  return null;
}

export function emptyBorangB(): BorangBForm {
  const result = {} as BorangBForm;
  for (const section of BORANG_B_SECTIONS) for (const [key] of section.fields) result[key] = 0;
  for (const [key] of BORANG_B_TEXT_FIELDS) result[key] = '';
  return result;
}

export function borangBForm(report: Partial<BorangBReport>): BorangBForm {
  const result = emptyBorangB();
  for (const section of BORANG_B_SECTIONS) for (const [key] of section.fields) result[key] = numberValue(report[key]);
  for (const [key] of BORANG_B_TEXT_FIELDS) result[key] = String(report[key] ?? '');
  return result;
}

/** Stable snapshot revision; compares all fields, not just an optional updatedAt. */
export function reportRevision(data: unknown): string {
  const stable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]));
    return value;
  };
  return JSON.stringify(stable(data));
}

export function readBorangB(id: string, raw: Record<string, unknown>): BorangBReport | null {
  const period = reportPeriod(raw.month, raw.year);
  if (!period) return null;
  const form = borangBForm(raw as Partial<BorangBReport>);
  // These aliases describe the same statistic; sermons are not Sabbath services.
  form.bibleStudies = numberValue(raw.bibleStudies ?? raw.bibleStudiesGiven);
  form.professionOfFaith = numberValue(raw.professionOfFaith ?? raw.professionsOfFaith);
  form.dedications = numberValue(raw.dedications ?? raw.childDedications);
  form.challenges = String(raw.challenges ?? raw.challengesAndPrayer ?? '');
  return {
    ...raw, ...form, ...period, id,
    userId: String(raw.userId || ''), pastorName: String(raw.userName ?? raw.pastorName ?? ''),
    missionId: String(raw.missionId || ''), districtId: String(raw.districtId || ''),
    status: raw.status === 'submitted' ? 'submitted' : 'draft',
    sermonsPreached: numberValue(raw.sermonsPreached), bibleStudiesGiven: form.bibleStudies,
    professionsOfFaith: form.professionOfFaith, childDedications: form.dedications,
    counselingSessions: numberValue(raw.counselingSessions), boardMeetings: numberValue(raw.boardMeetings),
    communionServices: numberValue(raw.communionServices),
    sourceData: raw, revision: reportRevision(raw),
  };
}

export function writeBorangB(report: BorangBReport, timestamp: string): Record<string, unknown> {
  const form = borangBForm(report);
  for (const section of BORANG_B_SECTIONS) for (const [key] of section.fields) {
    form[key] = key === 'tithe' || key === 'offerings' ? Math.round(numberValue(form[key]) * 100) / 100 : Math.round(numberValue(form[key]));
  }
  return {
    ...form, id: report.id, userId: report.userId, userName: report.pastorName,
    month: `${report.year}-${String(report.month).padStart(2, '0')}-01T00:00:00.000`,
    missionId: report.missionId, districtId: report.districtId,
    ...(report.regionId ? { regionId: report.regionId } : {}),
    ...(report.districtName ? { districtName: report.districtName } : {}),
    ...(report.churchId ? { churchId: report.churchId } : {}),
    status: report.status,
    createdAt: typeof report.createdAt === 'string' ? report.createdAt : isoTimestamp(report.createdAt) || timestamp,
    updatedAt: timestamp,
    ...(report.status === 'submitted' ? { submittedAt: isoTimestamp(report.sourceData?.submittedAt) || timestamp } : {}),
    // Keep aliases already present in older React records consistent on edits.
    ...(report.sourceData && 'bibleStudiesGiven' in report.sourceData ? { bibleStudiesGiven: form.bibleStudies } : {}),
    ...(report.sourceData && 'professionsOfFaith' in report.sourceData ? { professionsOfFaith: form.professionOfFaith } : {}),
    ...(report.sourceData && 'childDedications' in report.sourceData ? { childDedications: form.dedications } : {}),
    ...(report.sourceData && 'challengesAndPrayer' in report.sourceData ? { challengesAndPrayer: form.challenges } : {}),
  };
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
}

export function reportsForPeriod(reports: BorangBReport[], userId: string, year: number, month: number) {
  return reports.filter(report => report.userId === userId && report.year === year && report.month === month);
}
