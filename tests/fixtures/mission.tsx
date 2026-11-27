import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { MissionReportSummary } from '../../src/components/MissionReportingDashboard';
import { readUserProfile } from '../../src/lib/userProfiles';
import { readFinancialReport } from '../../src/lib/reportViews';
import { readBorangB } from '../../src/lib/borangB';
import type { Church, District, Mission } from '../../src/types';
const mission: Mission = { id: 'm', name: 'Sample Mission', code: 'SM', isActive: true };
const districts: District[] = [{ id: 'd', missionId: 'm', regionId: 'r', name: 'North District', isActive: true }, { id: 'e', missionId: 'm', regionId: 'r', name: 'South District', isActive: true }];
const churches: Church[] = [{ id: 'c', missionId: 'm', districtId: 'd', regionId: 'r', name: 'North Church', isActive: true }, { id: 'c2', missionId: 'm', districtId: 'e', regionId: 'r', name: 'South Church', isActive: true }];
const profile = readUserProfile('sample', { userRole: 'missionAdmin', mission: 'm', isActive: true, isApproved: true });
const finance = [readFinancialReport('f', { month: 11, year: 2026, missionId: 'm', districtId: 'd', churchId: 'c', tithe: 100, offerings: 20, submittedBy: 'sample' })!];
const borang = [readBorangB('b', { month: 11, year: 2026, missionId: 'm', districtId: 'd', userId: 'pastor', tithe: 100, offerings: 20, baptisms: 3, membersEnd: 120 })!];
function Fixture() {
  const [partial, setPartial] = useState(false);
  const [context, setContext] = useState('');
  return <main className="max-w-6xl mx-auto p-4 space-y-5"><h1>My Mission Reporting Fixture</h1><button onClick={() => setPartial(value => !value)}>Toggle Partial Access</button>
    <MissionReportSummary profile={profile} mission={mission} districts={districts} churches={churches} scope={{ mission, level: 'mission' }} year={2026} month={11}
      finance={{ records: finance, state: partial ? 'partial' : 'ready', cached: false }} borang={{ records: borang, state: 'ready', cached: false }}
      onFinance={value => setContext(JSON.stringify(value))} onBorang={value => setContext(JSON.stringify(value))} />
    <output aria-label="Navigation context">{context}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
