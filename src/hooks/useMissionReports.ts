import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { readBorangB } from '../lib/borangB';
import { readFinancialReport } from '../lib/reportViews';
import { reportingAccess, reportQuerySpecs, type ReportingScope, type ReportQuerySpec } from '../lib/missionReporting';
import type { BorangBReport, Church, District, FinancialReport, UserProfile } from '../types';

export type SourceState = 'loading' | 'ready' | 'partial' | 'error';
export interface ReportSource<T> { records: T[]; state: SourceState; cached: boolean }
export function useMissionReports(profile: UserProfile, scope: ReportingScope, districts: District[], churches: Church[]) {
  const [refreshId, setRefreshId] = useState(0);
  const specs = reportQuerySpecs(profile, scope, districts, churches);
  const key = JSON.stringify([profile.uid, profile.userRole, profile.isActive, profile.approvalStatus, scope.mission.id, specs, refreshId]);
  const [data, setData] = useState<{ key: string; finance: ReportSource<FinancialReport>; borang: ReportSource<BorangBReport> } | null>(null);
  useEffect(() => {
    let live = true;
    const stops: (() => void)[] = [];
    const start = <T extends { id: string },>(name: string, queries: ReportQuerySpec[], read: (id: string, raw: Record<string, unknown>) => T | null, field: 'finance' | 'borang') => {
      const slots = queries.map(() => ({ records: [] as T[], state: 'loading' as 'loading' | 'ready' | 'error', cached: false }));
      const publish = () => {
        if (!live) return;
        const ready = slots.filter(slot => slot.state === 'ready');
        const limited = !reportingAccess(profile, scope.mission, districts, churches).canCompare && (field === 'borang' || profile.userRole !== 'church_treasurer');
        const state: SourceState = slots.some(slot => slot.state === 'loading') ? 'loading'
          : !ready.length ? 'error' : ready.length !== slots.length || limited ? 'partial' : 'ready';
        const records = [...new Map(ready.flatMap(slot => slot.records).map(record => [record.id, record])).values()];
        setData(previous => ({ ...(previous?.key === key ? previous : { key, finance: { records: [], state: 'loading', cached: false }, borang: { records: [], state: 'loading', cached: false } }),
          [field]: { records, state, cached: ready.some(slot => slot.cached) } }));
      };
      queries.forEach((spec, index) => {
        stops.push(onSnapshot(query(collection(db, name), where(spec.field, spec.operator || '==', spec.value)), { includeMetadataChanges: true }, snapshot => {
          slots[index] = { state: 'ready', records: snapshot.docs.map(item => read(item.id, item.data())).filter((item): item is T => item !== null), cached: snapshot.metadata.fromCache };
          publish();
        }, () => { slots[index] = { state: 'error', records: [], cached: false }; publish(); }));
      });
    };
    start('financial_reports', specs.finance, readFinancialReport, 'finance');
    start('borang_b_reports', specs.borang, readBorangB, 'borang');
    return () => { live = false; stops.forEach(stop => stop()); };
  }, [key]);
  return { finance: data?.key === key ? data.finance : { records: [], state: 'loading' as const, cached: false },
    borang: data?.key === key ? data.borang : { records: [], state: 'loading' as const, cached: false }, refresh: () => setRefreshId(value => value + 1) };
}
