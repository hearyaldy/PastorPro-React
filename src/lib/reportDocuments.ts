import { readableName } from './hierarchyLabels';
import type { BorangBReport, FinancialReport, PastoralActivity, QuarterlyDepartmentReport, UserProfile } from '../types';
import type { PrintableReport, ReportSection } from './pdfReport';
import { BORANG_B_SECTIONS, BORANG_B_TEXT_FIELDS, numberValue } from './borangB';
import { CHILDREN_FIELDS, FAM_EXPENSE_FIELDS, FAM_INCOME_FIELDS, STEWARDSHIP_FIELDS } from './reportViews';
import { MONTHS, formatCurrencyRM } from './exportUtils';

export function activityStatistics(activities: PastoralActivity[], rate: number) {
  const distance = activities.reduce((sum, item) => sum + numberValue(item.mileage), 0);
  return { count: activities.length, distance, cost: distance * rate };
}

export function activityDocument(activities: PastoralActivity[], profile: UserProfile, period: string, rate: number): PrintableReport {
  const totals = activityStatistics(activities, rate);
  return {
    title: 'Monthly Activities Report', subtitle: period, filename: `Activities_${period.replace(/\W+/g, '_')}`, blueHeader: true,
    metadata: [['Name', profile.displayName], ['Position', profile.roleTitle || 'Pastor'], ['Mission', readableName(profile.missionName) || 'Mission name unavailable'], ['Rate', `${formatCurrencyRM(rate)} / km`]],
    summary: [['Total Activities', totals.count], ['Total Distance', `${totals.distance.toFixed(1)} km`], ['Total Cost', formatCurrencyRM(totals.cost)]],
    sections: [{ title: 'Activities Details', columns: ['Date', 'Activities', 'Location', 'KM', 'Cost (RM)'],
      rows: activities.map(item => [item.date.split('-').reverse().join('/'), `${item.title}${item.notes ? `\nNote: ${item.notes}` : ''}`, item.location || '-', item.mileage.toFixed(1), (item.mileage * rate).toFixed(2)]),
      totals: ['TOTAL', '', '', totals.distance.toFixed(1), totals.cost.toFixed(2)],
    }],
  };
}

export function borangBDocument(report: BorangBReport & { missionName?: string }, missionName?: string): PrintableReport {
  return {
    title: 'BORANG B - MONTHLY PASTORAL REPORT', subtitle: `${MONTHS[report.month - 1]} ${report.year}`, filename: `Borang_B_${report.pastorName.replace(/\W+/g, '_')}_${report.year}_${String(report.month).padStart(2, '0')}`,
    metadata: [['Pastor', report.pastorName], ['Mission', readableName(missionName || report.missionName) || 'Mission name unavailable'], ['District', readableName(report.districtName) || 'District name unavailable'], ['Status', report.status.toUpperCase()]],
    sections: [
      ...BORANG_B_SECTIONS.map(section => ({ title: section.title, rows: section.fields.map(([key, label]) => [label, key === 'tithe' || key === 'offerings' ? formatCurrencyRM(report[key]) : report[key]]),
        ...(section.title === 'Tithes & Offerings (RM)' ? { totals: ['TOTAL', formatCurrencyRM(report.tithe + report.offerings)] } : {}),
      })),
      ...BORANG_B_TEXT_FIELDS.filter(([key]) => report[key]).map(([key, label]) => ({ title: label, text: report[key] })),
    ],
  };
}

export function financialDocument(report: FinancialReport, fam: Record<string, unknown> | null = null): PrintableReport {
  const sections: ReportSection[] = [{ title: 'Financial Summary', rows: [
    ['Tithe', formatCurrencyRM(report.tithe)], ['Offerings', formatCurrencyRM(report.offerings || 0)], ['Special Offerings', formatCurrencyRM(report.specialOfferings || 0)],
    ...(report.customFinanceTypes || []).map(item => [item.name || 'Custom finance', formatCurrencyRM(numberValue(item.amount))]),
  ], totals: ['TOTAL', formatCurrencyRM(report.totalIncome)] }];
  if (fam) {
    for (const [title, fields, arrayKey] of [['FAM Income', FAM_INCOME_FIELDS, 'funds'], ['FAM Expenses', FAM_EXPENSE_FIELDS, 'expenses']] as const) {
      const rows = Array.isArray(fam[arrayKey])
        ? (fam[arrayKey] as { name: string; amount: number }[]).map(item => [item.name, formatCurrencyRM(numberValue(item.amount))])
        : Object.entries(fields).map(([key, label]) => [label, formatCurrencyRM(numberValue(fam[key]))]);
      sections.push({ title, rows });
    }
    if ('openingBalance' in fam) sections.push({ title: 'FAM Balances', rows: [['Opening Balance', formatCurrencyRM(numberValue(fam.openingBalance))], ['Closing Balance', formatCurrencyRM(numberValue(fam.closingBalance))]] });
    if (fam.notes) sections.push({ title: 'FAM Notes', text: String(fam.notes) });
  }
  if (report.notes) sections.push({ title: 'Notes', text: report.notes });
  return { title: `${readableName(report.churchName) || 'Church name unavailable'} - Financial Report`, subtitle: `${MONTHS[report.month - 1]} ${report.year}`, filename: `Financial_Report_${(readableName(report.churchName) || 'Church').replace(/\W+/g, '_')}_${report.year}_${report.month}`,
    metadata: [['Status', report.status === 'verified' ? 'APPROVED' : report.status.toUpperCase()], ['Submitted by', report.submittedByName || report.submittedBy]], sections };
}

export function quarterlyDocument(report: QuarterlyDepartmentReport, label: string, fieldLabels: Record<string, string> = {}): PrintableReport {
  const raw = report.sourceData || {};
  const children = raw.kanakKanakData as Record<string, unknown> | undefined;
  const stewardship = raw.penatalayananData as Record<string, unknown> | undefined;
  const sections: ReportSection[] = [];
  if (children) sections.push({ title: "Children's Ministry Statistics", rows: Object.entries(CHILDREN_FIELDS).map(([key, name]) => [name, numberValue(children[key])]) });
  if (stewardship) {
    const months = Array.isArray(stewardship.months) ? stewardship.months as Record<string, unknown>[] : [];
    sections.push({ title: 'Borang AP - Monthly Stewardship', columns: ['Month', 'Tithe (RM)', 'Tithe Givers', 'Offerings (RM)', 'Systematic Givers'],
      rows: months.map((month, index) => [MONTHS[(report.quarter - 1) * 3 + index], numberValue(month.titheAmount).toFixed(2), numberValue(month.titheGivers), numberValue(month.offeringAmount).toFixed(2), numberValue(month.systematicGivers)]) });
    sections.push({ title: 'Borang BP - Employment & Activities', rows: Object.entries(STEWARDSHIP_FIELDS).map(([key, name]) => [name, numberValue(stewardship[key])]) });
  }
  if (Object.keys(report.payload).length) sections.push({ title: children || stewardship ? 'Additional Recorded Fields' : 'Department Statistics', rows: Object.entries(report.payload).map(([key, value]) => [fieldLabels[key] || key.replace(/([A-Z])/g, ' $1'), value]) });
  if (report.notes) sections.push({ title: 'Remarks & Action Plan', text: report.notes });
  return { title: label, subtitle: `Q${report.quarter} ${report.year}`, filename: `Quarterly_${report.department}_${(readableName(report.churchName) || 'Church').replace(/\W+/g, '_')}_${report.year}_Q${report.quarter}`, metadata: [['Church', readableName(report.churchName) || 'Church name unavailable'], ['District', readableName(report.districtName) || 'District name unavailable'], ['Submitted by', readableName(report.submittedByName) || 'Name unavailable'], ['Status', report.status]], sections };
}
