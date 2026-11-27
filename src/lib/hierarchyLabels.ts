import type { Church, District, Mission, Region, Union } from '../types';

export interface HierarchyDirectory { unions: Union[]; missions: Mission[]; regions: Region[]; districts: District[]; churches: Church[] }
type Kind = 'union' | 'mission' | 'region' | 'district' | 'church';
type HierarchyNames = Record<`${Kind}Name`, string>;
type NamedEntity = { id: string; name: string; code?: string; churchCode?: string };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const key = (value: string) => value.toLocaleLowerCase();
// A saved label can itself contain a Firestore auto-ID or a UUID in legacy data.
export function readableName(value: unknown): string {
  const name = text(value);
  return /^[a-zA-Z0-9]{20}$/.test(name) || /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(name) ? '' : name;
}

/** Display-only resolution. Never replace stored assignment IDs or source data. */
export function createHierarchyLabels(directory: HierarchyDirectory) {
  const collections: Record<Kind, NamedEntity[]> = { union: directory.unions, mission: directory.missions, region: directory.regions, district: directory.districts, church: directory.churches };
  const resolve = (kind: Kind, reference?: unknown, savedName?: unknown, fallback?: string): string => {
    const ref = text(reference), saved = text(savedName), entities = collections[kind];
    const exact = entities.find(entity => entity.id === (ref || saved));
    if (exact && readableName(exact.name)) return exact.name;
    const matches = entities.filter(entity => [entity.name, entity.code, entity.churchCode].some(alias => alias && key(alias) === key(ref || saved)));
    if ((ref || saved) && matches.length === 1 && readableName(matches[0].name)) return matches[0].name;
    // Never display an unresolved reference as the name. A separate saved name
    // remains useful when a directory record is deleted or inaccessible.
    if (saved && saved !== ref && readableName(saved) && !entities.some(entity => entity.id === saved)) return saved;
    const title = kind[0].toUpperCase() + kind.slice(1);
    return fallback ?? (ref || saved ? `${title} name unavailable` : `${title} not assigned`);
  };
  const withNames = <T extends object,>(record: T): T & HierarchyNames => {
    const data = record as Record<string, unknown>;
    return { ...record, ...Object.fromEntries((['union', 'mission', 'region', 'district', 'church'] as const).map(kind => [`${kind}Name`, resolve(kind, data[`${kind}Id`], data[`${kind}Name`])])) } as T & HierarchyNames;
  };
  return { union: (id?: unknown, name?: unknown, fallback?: string) => resolve('union', id, name, fallback),
    mission: (id?: unknown, name?: unknown, fallback?: string) => resolve('mission', id, name, fallback),
    region: (id?: unknown, name?: unknown, fallback?: string) => resolve('region', id, name, fallback),
    district: (id?: unknown, name?: unknown, fallback?: string) => resolve('district', id, name, fallback),
    church: (id?: unknown, name?: unknown, fallback?: string) => resolve('church', id, name, fallback), withNames };
}
