import { createHierarchyLabels } from '../lib/hierarchyLabels';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useMissionReports, type ReportSource } from '../hooks/useMissionReports';
import { aggregateMissionReports, discrepancyExport, discrepancyLabel, reportingAccess, type ReportingLevel, type ReportingScope } from '../lib/missionReporting';
import { BORANG_B_SECTIONS } from '../lib/borangB';
import { MONTHS, exportToExcel, formatCurrencyRM as rm } from '../lib/exportUtils';
import type { PrintableReport } from '../lib/pdfReport';
import type { BorangBReport, Church, District, FinancialReport, Mission, UserProfile } from '../types';
import { StatisticsCards } from './StatisticsCards';
import { ReportPreview } from './ReportPreview';
import { MissionFinancialEditor } from './MissionFinancialEditor';

export interface MissionReportContext { year: number; month: number; churchId?: string; districtId?: string; missionId?: string }
interface Props { profile: UserProfile; mission: Mission; districts: District[]; churches: Church[];
  onBorang: (context: MissionReportContext) => void; onFinance: (context: MissionReportContext) => void }
const control = 'border border-[var(--border-hairline)] rounded-lg px-3 py-2 text-sm bg-[var(--bg-surface)]';

export function MissionReportingDashboard(props: Props) {
  const { profile, mission, districts, churches } = props;
  const access = reportingAccess(profile, mission, districts, churches);
  const [level, setLevel] = useState<ReportingLevel>(access.leadership ? 'mission' : access.assignedDistrict && profile.userRole === 'district_pastor' ? 'district' : access.assignedChurch ? 'church' : 'mission');
  const [districtId, setDistrictId] = useState(access.assignedDistrict?.id || '');
  const [churchId, setChurchId] = useState(access.assignedChurch?.id || '');
  const [period, setPeriod] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; });
  const [year, month] = period.split('-').map(Number);
  const scope: ReportingScope = { mission, level, districtId, churchId };
  const sources = useMissionReports(profile, scope, districts, churches);
  const allowedChurches = access.churchChoices.filter(church => !districtId || level !== 'church' || church.districtId === districtId);
  const move = (offset: number) => {
    const date = new Date(year, month - 1 + offset, 1);
    if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) setPeriod(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };
  return <section className="space-y-4" aria-label="Mission reporting">
    <div className="flex flex-wrap gap-3 items-center">
      <h3 className="text-base font-semibold mr-auto">Mission Reporting</h3>
      <button className={control} aria-label="Previous reporting month" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
      <input className={control} aria-label="Reporting month" type="month" min="2000-01" max="2100-12" value={period} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setPeriod(event.target.value); }} />
      <button className={control} aria-label="Next reporting month" onClick={() => move(1)}><ChevronRight size={18} /></button>
      <button className={`${control} inline-flex gap-2 items-center`} onClick={sources.refresh}><RefreshCw size={16} />Refresh</button>
    </div>
    <div className="flex flex-wrap gap-3">
      {access.leadership || access.assignedDistrict || access.assignedChurch ? <label>View <select className={`${control} ml-2`} aria-label="Reporting scope" value={level} onChange={event => {
        const next = event.target.value as ReportingLevel; setLevel(next);
        if (next === 'district' && !districtId) setDistrictId(access.districtChoices[0]?.id || '');
        if (next === 'church' && !churchId) { const church = access.churchChoices[0]; setChurchId(church?.id || ''); setDistrictId(church?.districtId || ''); }
      }}>
        {access.leadership && <option value="mission">Mission</option>}
        {(access.leadership || profile.userRole === 'district_pastor') && access.districtChoices.length > 0 && <option value="district">District</option>}
        {access.churchChoices.length > 0 && <option value="church">Church</option>}
      </select></label> : <p className="text-sm">Showing your accessible reports. A district or church assignment is required for broader reporting.</p>}
      {level !== 'mission' && access.districtChoices.length > 0 && <select className={control} aria-label="Reporting district" value={districtId} onChange={event => { setDistrictId(event.target.value); setChurchId(access.churchChoices.find(church => church.districtId === event.target.value)?.id || ''); }}>
        {level === 'church' && access.leadership && <option value="">All districts</option>}
        {access.districtChoices.map(district => <option key={district.id} value={district.id}>{district.name}</option>)}
      </select>}
      {level === 'church' && <select className={control} aria-label="Reporting church" value={churchId} onChange={event => setChurchId(event.target.value)}>
        <option value="" disabled>Select church</option>{allowedChurches.map(church => <option key={church.id} value={church.id}>{church.name}</option>)}
      </select>}
    </div>
    <MissionReportSummary {...props} scope={scope} year={year} month={month} finance={sources.finance} borang={sources.borang} />
  </section>;
}

export function MissionReportSummary({ profile, mission, districts, churches, scope, year, month, finance, borang, onFinance, onBorang }: Props & {
  scope: ReportingScope; year: number; month: number; finance: ReportSource<FinancialReport>; borang: ReportSource<BorangBReport>;
}) {
  const access = reportingAccess(profile, mission, districts, churches);
  const model = useMemo(() => aggregateMissionReports({ scope, profile, year, month, districts, churches, financial: finance.records, borang: borang.records }), [scope, profile, year, month, districts, churches, finance.records, borang.records]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [preview, setPreview] = useState<PrintableReport | null>(null);
  const [financeChurchId, setFinanceChurchId] = useState('');
  const [editingChurch, setEditingChurch] = useState<Church | null>(null);
  const rows = model.discrepancies.filter(row => (status === 'all' || row.status === status) && `${row.district.name} ${row.missingChurches.map(church => church.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  const periodLabel = `${MONTHS[month - 1]} ${year}`;
  const scopeLabel = scope.level === 'church' ? churches.find(church => church.id === scope.churchId)?.name || 'Select church' : scope.level === 'district' ? districts.find(district => district.id === scope.districtId)?.name || 'Select district' : mission.name;
  const loading = finance.state === 'loading' || borang.state === 'loading';
  const complete = finance.state === 'ready' && borang.state === 'ready' && !finance.cached && !borang.cached;
  const sourceLabel = (source: ReportSource<unknown>) => source.state === 'error' ? 'Unavailable: access denied or connection failed' : source.state === 'partial' ? 'Partial access: only accessible records included' : source.state === 'loading' ? 'Loading…' : source.cached ? 'Cached records: may be incomplete or out of date' : 'Live';
  const coverage = complete ? 'Church reporting coverage' : 'Visible church reporting coverage (incomplete data)';
  const context: MissionReportContext = { year, month, missionId: mission.id, districtId: scope.districtId, churchId: scope.churchId };
  const labelFor = (field: string) => BORANG_B_SECTIONS.flatMap(section => [...section.fields]).find(([key]) => key === field)?.[1] || field;
  const canShowFinance = finance.state === 'ready' || finance.state === 'partial';
  const canShowBorang = borang.state === 'ready' || borang.state === 'partial';
  const labels = createHierarchyLabels({ unions: [], missions: [mission], regions: [], districts, churches });
  const exportRows = discrepancyExport(rows).map(row => ({ ...row, Status: `${complete ? '' : 'Provisional: '}${row.Status}`, TreasurerData: sourceLabel(finance), BorangBData: sourceLabel(borang),
    ...(!canShowFinance ? { TreasurerTitheRM: 'Unavailable', TreasurerOfferingsRM: 'Unavailable', TreasurerComparableTotalRM: 'Unavailable' } : {}),
    ...(!canShowBorang ? { BorangBTitheRM: 'Unavailable', BorangBOfferingsRM: 'Unavailable', BorangBTotalRM: 'Unavailable' } : {}),
    ...(!canShowFinance || !canShowBorang ? { DifferenceRM: 'Unavailable', DiscrepancyPercent: 'Unavailable' } : {}) }));
  const reportDocument = (): PrintableReport => ({ title: 'My Mission Reporting', filename: `Mission_${year}_${String(month).padStart(2, '0')}`, subtitle: `${scopeLabel} · ${periodLabel}`, orientation: 'landscape', blueHeader: true,
    metadata: [['Treasurer data', sourceLabel(finance)], ['Borang B data', sourceLabel(borang)], ['Coverage', `${model.reportedChurches.length}/${model.scopedChurches.length} churches visible`]],
    sections: [
      { title: `Treasurer totals: January–${MONTHS[month - 1]} ${year}`, columns: ['Tithe', 'Offerings', 'Special', 'Custom', 'Total'], rows: canShowFinance ? [[rm(model.ytd.tithe), rm(model.ytd.offerings), rm(model.ytd.special), rm(model.ytd.custom), rm(model.ytd.total)]] : [], text: !canShowFinance ? sourceLabel(finance) : undefined },
      { title: 'Monthly comparison (tithe and offerings only)', columns: ['Source', 'Tithe', 'Offerings', 'Total'], rows: [
        ...(canShowFinance ? [['Treasurer', rm(model.monthly.tithe), rm(model.monthly.offerings), rm(model.monthly.tithe + model.monthly.offerings)]] : []),
        ...(canShowBorang ? [['Borang B', rm(model.borang.tithe), rm(model.borang.offerings), rm(model.borang.total)]] : [])] },
      ...(access.canCompare ? [{ title: 'District reconciliation (current filters)', columns: ['District', 'Status', 'Treasurer', 'Borang B', 'Difference', 'Missing treasurer reports'], rows: rows.map(row => [row.district.name, `${complete ? '' : 'Provisional: '}${discrepancyLabel[row.status]}`, canShowFinance ? rm(row.finance.tithe + row.finance.offerings) : 'Unavailable', canShowBorang ? rm(row.borang.total) : 'Unavailable', canShowFinance && canShowBorang ? rm(row.difference) : 'Unavailable', row.missingChurches.map(church => church.name).join(', ') || 'None']) }] : []),
      { title: 'Monthly ministry statistics', columns: ['Statistic', 'Total'], rows: canShowBorang ? Object.entries(model.ministry).map(([key, value]) => [labelFor(key), value]) : [] },
      { title: 'Churches without a visible report', text: model.missingChurches.map(church => church.name).join(', ') || (complete ? 'None' : 'Coverage is not confirmed until both sources are live.') },
    ] });
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-3 items-center"><p className="font-medium mr-auto">{scopeLabel} · {periodLabel}</p>
      <button className={control} disabled={loading} onClick={() => setPreview(reportDocument())}>Preview / Print Reporting</button>
      {access.canCompare && <button className={control} disabled={loading} onClick={() => exportToExcel(`Mission_${year}_${month}`, [
        { name: 'District Reconciliation', rows: exportRows },
        { name: 'Ministry', rows: canShowBorang ? Object.entries(model.ministry).map(([key, Total]) => ({ Statistic: labelFor(key), Total })) : [] },
        { name: 'Missing Churches', rows: model.missingChurches.map(church => ({ Church: church.name, District: labels.district(church.districtId) })) },
        { name: 'Data Coverage', rows: [{ Source: 'Treasurer', State: sourceLabel(finance) }, { Source: 'Borang B', State: sourceLabel(borang) }] },
      ])}>Export Excel</button>}
    </div>
    <div role="status" className={`rounded-lg p-3 text-sm ${complete ? 'bg-[var(--bg-subtle)]' : 'bg-amber-50 text-amber-900'}`}>
      <p>Treasurer: {sourceLabel(finance)}. Borang B: {sourceLabel(borang)}.</p>
      {!complete && <p>Totals and missing-report lists reflect available records. Full coverage cannot be confirmed.</p>}
      {model.duplicateCount > 0 && <p>{model.duplicateCount} duplicate record(s) excluded; the latest saved record per church/pastor and month is used. Review duplicates before reconciling.</p>}
      <p className="text-xs mt-1">Draft and submitted reports are included, matching Flutter.</p>
    </div>
    {loading ? <p aria-live="polite">Loading mission reports…</p> : <>
      <p className="text-sm text-[var(--text-secondary)]">Selected scope: {model.scopedDistricts.length} district(s) · {model.scopedChurches.length} church(es) · {model.scopedChurches.reduce((sum, church) => sum + (church.memberCount || 0), 0).toLocaleString()} directory members</p>
      <h4 className="font-semibold">Treasurer totals · January–{MONTHS[month - 1]} {year}</h4>
      {canShowFinance ? <StatisticsCards featured items={[
        { label: 'Tithe', value: rm(model.ytd.tithe), icon: 'money' }, { label: 'Offerings', value: rm(model.ytd.offerings), icon: 'money' },
        { label: 'Special & Custom', value: rm(model.ytd.special + model.ytd.custom), icon: 'money' }, { label: 'Total Income', value: rm(model.ytd.total), icon: 'money' },
      ]} /> : <p>Treasurer totals unavailable. Refresh after account access or connection is restored.</p>}
      <section className="border border-[var(--border-hairline)] rounded-xl p-4 space-y-3">
        <h4 className="font-semibold">Monthly Treasurer / Borang B Comparison</h4>
        <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th className="p-2">Source</th><th>Tithe</th><th>Offerings</th><th>Comparable Total</th></tr></thead><tbody>
          <tr><td className="p-2">Treasurer</td><td>{canShowFinance ? rm(model.monthly.tithe) : 'Unavailable'}</td><td>{canShowFinance ? rm(model.monthly.offerings) : 'Unavailable'}</td><td>{canShowFinance ? rm(model.monthly.tithe + model.monthly.offerings) : 'Unavailable'}</td></tr>
          <tr><td className="p-2">Borang B</td><td>{canShowBorang ? rm(model.borang.tithe) : 'Unavailable'}</td><td>{canShowBorang ? rm(model.borang.offerings) : 'Unavailable'}</td><td>{canShowBorang ? rm(model.borang.total) : 'Unavailable'}</td></tr>
          {canShowFinance && canShowBorang && <tr className="font-semibold"><td className="p-2">Difference</td><td>{rm(model.monthly.tithe - model.borang.tithe)}</td><td>{rm(model.monthly.offerings - model.borang.offerings)}</td><td>{rm(model.monthly.tithe + model.monthly.offerings - model.borang.total)}</td></tr>}
        </tbody></table></div><p className="text-xs text-[var(--text-secondary)]">Special and custom offerings are excluded from this comparison. Positive difference means Treasurer is higher.</p>
      </section>
      <section className="space-y-3"><h4 className="font-semibold">{coverage}</h4>
        <p>{model.reportedChurches.length} / {model.scopedChurches.length} churches · {model.completion}% visible</p>
        <progress className="w-full h-3" max={model.scopedChurches.length || 1} value={model.reportedChurches.length} aria-label={coverage} />
        <details><summary className="cursor-pointer text-sm">Churches without a visible report ({model.missingChurches.length})</summary><ul className="list-disc pl-6 mt-2 text-sm">{model.missingChurches.map(church => <li key={church.id}>{church.name}</li>)}</ul></details>
      </section>
      {access.canCompare && <section className="space-y-3"><h4 className="font-semibold">District Reconciliation</h4>
        <StatisticsCards items={[
          { label: 'Both Report Sources', value: model.discrepancies.filter(row => row.hasTreasurer && row.borangCount > 0).length, icon: 'check', color: 'green' },
          { label: 'Treasurer Only', value: model.discrepancies.filter(row => row.status === 'missing_borangb').length, icon: 'money', color: 'orange' },
          { label: 'Borang B Only', value: model.discrepancies.filter(row => row.status === 'missing_treasurer').length, icon: 'activity', color: 'purple' },
          { label: 'Amount / Field Mismatches', value: model.discrepancies.filter(row => row.status === 'discrepancy' || row.status === 'field_mismatch').length, icon: 'activity', color: 'blue' },
        ]} />
        <p className="text-xs">Counts are by district{!complete ? ' and are provisional while data access is incomplete' : ''}.</p>
        <div className="flex flex-wrap gap-2"><input aria-label="Search reconciliation" placeholder="Search district or missing church" className={`${control} min-w-0`} value={search} onChange={event => setSearch(event.target.value)} />
          <select aria-label="Reconciliation status" className={control} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(discrepancyLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <p className="text-xs">Tolerance: 1% for totals ≥ RM 10; RM 0.01 for smaller totals. Field mismatches are flagged even when totals cancel. Missing lists refer to treasurer reports.</p>
        <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr>{['District', 'Status', 'Treasurer', 'Borang B', 'Difference', 'Missing Churches'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>
          {rows.map(row => <tr key={row.district.id} className="border-t border-[var(--border-hairline)]"><td className="p-2">{row.district.name}</td><td className="p-2">{!complete ? 'Provisional · ' : ''}{discrepancyLabel[row.status]}</td><td className="p-2 whitespace-nowrap">{canShowFinance ? rm(row.finance.tithe + row.finance.offerings) : 'Unavailable'}</td><td className="p-2 whitespace-nowrap">{canShowBorang ? rm(row.borang.total) : 'Unavailable'}</td><td className="p-2 whitespace-nowrap">{canShowFinance && canShowBorang ? `${rm(row.difference)} (${row.percentage.toFixed(2)}%)` : 'Unavailable'}</td><td className="p-2"><details><summary>{row.missingChurches.length} / {row.churches.length}</summary>{row.missingChurches.map(church => <p key={church.id}>{church.name}</p>)}</details></td></tr>)}
          {!rows.length && <tr><td colSpan={6} className="p-4">No districts match the current filters.</td></tr>}
        </tbody></table></div>
      </section>}
      <section className="space-y-3"><h4 className="font-semibold">Monthly Ministry Statistics</h4>
        {canShowBorang ? <><StatisticsCards items={[
          { label: 'Baptisms & Professions', value: model.ministry.baptisms + model.ministry.professionOfFaith, icon: 'people', color: 'blue' },
          { label: 'Members Beginning / End', value: `${model.ministry.membersBeginning} / ${model.ministry.membersEnd}`, icon: 'people', color: 'green', hint: `Net change: ${model.ministry.membersEnd - model.ministry.membersBeginning}` },
          { label: 'Visitations', value: model.ministry.homeVisitations + model.ministry.hospitalVisitations + model.ministry.prisonVisitations, color: 'purple' },
          { label: 'Literature Distributed', value: model.ministry.booksDistributed + model.ministry.magazinesDistributed + model.ministry.tractsDistributed, color: 'orange' },
        ]} /><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{BORANG_B_SECTIONS.filter(section => section.title !== 'Tithes & Offerings (RM)').map(section => <div className="rounded-lg border border-[var(--border-hairline)] p-4" key={section.title}><h5 className="font-medium mb-2">{section.title}</h5><dl className="text-sm space-y-1">{section.fields.filter(([key]) => key in model.ministry).map(([key, label]) => <div key={key} className="flex justify-between gap-3"><dt>{label}</dt><dd>{model.ministry[key as keyof typeof model.ministry]}</dd></div>)}</dl></div>)}</div></> : <p>Ministry statistics unavailable.</p>}
      </section>
      <div className="flex flex-wrap items-center gap-3">
        {profile.userRole === 'district_pastor' && scope.level === 'district' && <><p className="text-sm">Your Borang B: {canShowBorang ? model.pastorReport ? model.pastorReport.status : 'No report for this month' : 'Unavailable'}</p><button className={control} onClick={() => onBorang(context)}>{model.pastorReport ? 'Open' : 'Add'} My Borang B</button></>}
        <button className={control} onClick={() => onFinance(context)}>View Financial Reports for {periodLabel}</button>
        {access.canWrite && <>
          {scope.level !== 'church' && <select className={control} aria-label="Church for financial report" value={financeChurchId} onChange={event => setFinanceChurchId(event.target.value)}><option value="">Select church for financial report</option>{model.scopedChurches.filter(church => access.churchChoices.some(allowed => allowed.id === church.id)).map(church => <option key={church.id} value={church.id}>{church.name}</option>)}</select>}
          <button className={control} disabled={!model.scopedChurches.some(church => access.churchChoices.some(allowed => allowed.id === church.id) && church.id === (scope.level === 'church' ? scope.churchId : financeChurchId))} onClick={() => setEditingChurch(access.churchChoices.find(church => church.id === (scope.level === 'church' ? scope.churchId : financeChurchId)) || null)}>Add / View / Edit Church Financial Report</button>
        </>}
      </div>
    </>}
    {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
    {editingChurch && <MissionFinancialEditor key={`${editingChurch.id}:${year}:${month}`} church={editingChurch} profile={profile} year={year} month={month} onClose={() => setEditingChurch(null)} />}
  </div>;
}
