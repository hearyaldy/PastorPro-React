import { createHierarchyLabels } from '../../src/lib/hierarchyLabels';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { StatisticsCards } from '../../src/components/StatisticsCards';
import { ReportPreview } from '../../src/components/ReportPreview';
import { ReportTables } from '../../src/components/ReportTables';
import { emptyBorangB, readBorangB } from '../../src/lib/borangB';
import { activityDocument, borangBDocument, financialDocument, quarterlyDocument } from '../../src/lib/reportDocuments';
import { readFinancialReport, readQuarterlyReport } from '../../src/lib/reportViews';
import { readActivity } from '../../src/lib/activities';
import { readUserProfile } from '../../src/lib/userProfiles';
import type { PrintableReport } from '../../src/lib/pdfReport';

const profile = readUserProfile('sample', { displayName: 'Pastor A', userRole: 'user', missionName: 'Sabah Adventist Mission' });
const labels = createHierarchyLabels({ unions: [], missions: [{ id: 'sample-mission', name: 'Sabah Adventist Mission', code: 'SAM', isActive: true }], regions: [], churches: [], districts: [{ id: 'iqatSkQaKBhoOZgD0Dhn', name: 'Kiulu', missionId: 'sample-mission', regionId: '', isActive: true }] });
const borang = labels.withNames(readBorangB('sample', { ...emptyBorangB(), userName: 'Pastor A', userId: 'sample', districtId: 'iqatSkQaKBhoOZgD0Dhn', missionId: 'sample-mission', month: '2026-11-01T00:00:00.000', membersEnd: 120, bibleStudies: 12, baptisms: 4, homeVisitations: 8, prisonVisitations: 2, tithe: 1000, offerings: 250, remarks: 'Follow up with families and new Bible study groups.' })!);
const documents = {
  Activities: activityDocument(Array.from({ length: 40 }, (_, index) => readActivity(`activity-${index}`, { activities: `Pastoral visitation ${index + 1}`, date: '2026-11-01', mileage: 12.5, location: 'Kiulu', note: 'Prayer and family follow-up' })), profile, 'November 2026', 0.5),
  'Borang B': borangBDocument(borang, profile.missionName),
  Financial: financialDocument(readFinancialReport('sample', { month: '2026-11-01T00:00:00.000', churchName: 'Kiulu SDA Church', status: 'approved', tithe: 1000, offerings: 250, specialOfferings: 100 })!, { buildingFund: 100, salaries: 75 }),
  Quarterly: quarterlyDocument(readQuarterlyReport('sample', { department: 'kanakKanak', quarter: 4, year: 2026, churchName: 'Kiulu SDA Church', kanakKanakData: { count0to2: 4, count3to5: 8, count13to14: 6 } }), "Kanak-Kanak (Children's Ministry)"),
};

function Fixture() {
  const [preview, setPreview] = useState<PrintableReport | null>(null);
  return <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
    <div><p className="text-xs text-[var(--text-secondary)]">Sabah Adventist Mission · November 2026</p><h1 className="text-2xl font-semibold mt-2">Pastoral Statistics & Reports</h1></div>
    <StatisticsCards items={[
      { label: 'Pending Todos', value: 6, icon: 'check', color: 'blue' }, { label: 'Upcoming Events', value: 3, icon: 'calendar', color: 'orange' },
      { label: 'Activities', value: 40, icon: 'activity', color: 'green' }, { label: 'Members at End', value: 120, icon: 'people', color: 'purple' },
    ]} />
    <StatisticsCards featured items={[
      { label: 'Total Activities', value: 40, icon: 'activity' }, { label: 'Total Distance', value: '500.0 km', icon: 'distance' }, { label: 'Total Cost', value: 'RM 250.00', icon: 'money' },
    ]} />
    <div className="flex flex-wrap gap-3">{Object.entries(documents).map(([name, report]) => <button key={name} onClick={() => setPreview(report)} className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2 text-sm">Preview {name}</button>)}</div>
    <ReportTables sections={documents['Borang B'].sections} />
    {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
