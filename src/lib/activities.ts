import type { ActivityCategory, PastoralActivity } from '../types';

const categories = new Set<ActivityCategory>([
  'visitation', 'evangelism', 'meeting', 'worship', 'counseling', 'training', 'administration',
]);

function nonNegative(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function dateString(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 10);
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString().slice(0, 10);
  }
  return '';
}

/** Prefer Flutter's canonical fields: Flutter edits do not update React aliases. */
export function readActivity(id: string, data: Record<string, unknown>): PastoralActivity {
  return {
    ...data,
    id,
    userId: String(data.userId || ''),
    missionId: String(data.missionId || ''),
    title: String(data.activities ?? data.title ?? ''),
    notes: String(data.note ?? data.notes ?? ''),
    location: String(data.location || ''),
    category: categories.has(data.category as ActivityCategory) ? data.category as ActivityCategory : 'administration',
    date: dateString(data.date),
    mileage: nonNegative(data.mileage),
    durationMinutes: nonNegative(data.durationMinutes),
    participants: nonNegative(data.participants),
  };
}

/** A mergeable patch; callers preserve createdAt and unknown existing fields. */
export function writeActivity(activity: PastoralActivity): Record<string, unknown> {
  return {
    id: activity.id,
    userId: activity.userId,
    ...(activity.missionId ? { missionId: activity.missionId } : {}),
    ...(activity.districtId ? { districtId: activity.districtId } : {}),
    ...(activity.churchId ? { churchId: activity.churchId } : {}),
    ...(activity.churchName ? { churchName: activity.churchName } : {}),
    activities: activity.title.trim(),
    title: activity.title.trim(),
    note: activity.notes || '',
    notes: activity.notes || '',
    date: `${activity.date.slice(0, 10)}T00:00:00.000`,
    mileage: nonNegative(activity.mileage),
    location: activity.location || '',
    category: activity.category,
    durationMinutes: Math.round(nonNegative(activity.durationMinutes)),
    participants: Math.round(nonNegative(activity.participants)),
  };
}
