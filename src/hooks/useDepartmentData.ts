import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { readDepartmentTemplate, type DepartmentTemplate } from '../lib/departmentReports';
import { readQuarterlyReport } from '../lib/reportViews';
import type { QuarterlyDepartmentReport, UserProfile } from '../types';
export function useDepartmentData(profile: UserProfile | null, refreshId: number) {
  const key = JSON.stringify([profile?.uid, profile?.userRole, profile?.missionId, profile?.districtId, profile?.isActive, refreshId]);
  const [state, setState] = useState<{ key: string; templates: DepartmentTemplate[]; reports: QuarterlyDepartmentReport[]; templateError: string; reportError: string; templatesLoading: boolean; reportsLoading: boolean; cached: boolean } | null>(null);
  useEffect(() => {
    if (!profile?.isActive) return;
    let live = true;
    const update = (patch: Partial<NonNullable<typeof state>>) => { if (live) setState(previous => ({ ...(previous?.key === key ? previous : { key, templates: [], reports: [], templateError: '', reportError: '', templatesLoading: true, reportsLoading: true, cached: false }), ...patch })); };
    const admin = ['super_admin', 'admin', 'union_maum'].includes(profile.userRole), leadership = ['mission_admin', 'director', 'officer', 'ministerial_secretary'].includes(profile.userRole);
    const reports = query(collection(db, 'quarterly_department_reports'), ...(admin ? [] : [where(leadership ? 'missionId' : profile.userRole === 'district_pastor' && profile.districtId ? 'districtId' : 'submittedBy', '==', leadership ? profile.missionId || '__unassigned__' : profile.userRole === 'district_pastor' && profile.districtId ? profile.districtId : profile.uid)]));
    const stops = [onSnapshot(collection(db, 'department_report_templates'), snapshot => update({ templates: snapshot.docs.map(item => readDepartmentTemplate(item.id, item.data())).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)), templatesLoading: false, templateError: '' }), () => update({ templates: [], templatesLoading: false, templateError: 'Unable to load report forms. Check your connection and template permissions.' })),
      onSnapshot(reports, { includeMetadataChanges: true }, snapshot => update({ reports: snapshot.docs.map(item => readQuarterlyReport(item.id, item.data())), reportsLoading: false, reportError: '', cached: snapshot.metadata.fromCache }), () => update({ reports: [], reportsLoading: false, reportError: 'Unable to load responses. Check your connection and reporting permissions.' }))];
    return () => { live = false; stops.forEach(stop => stop()); };
  }, [key]);
  return state?.key === key ? state : { templates: [], reports: [], templateError: '', reportError: '', templatesLoading: true, reportsLoading: true, cached: false };
}
