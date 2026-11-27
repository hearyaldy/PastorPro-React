import type { Church, District, Mission, Region, StaffMember } from '../types';
import { numberValue } from './borangB';

export function readChurch(id: string, raw: Record<string, unknown>): Church {
  return { ...raw, id, name: String(raw.churchName ?? raw.name ?? ''), missionId: String(raw.missionId || ''),
    regionId: String(raw.regionId || ''), districtId: String(raw.districtId || ''), memberCount: numberValue(raw.memberCount), isActive: raw.isActive !== false };
}
export function readStaff(id: string, raw: Record<string, unknown>): StaffMember {
  return { ...raw, id, fullName: String(raw.name ?? raw.fullName ?? ''), position: String(raw.role ?? raw.position ?? ''),
    missionId: String(raw.missionId ?? raw.mission ?? ''), regionId: String(raw.regionId ?? raw.region ?? ''),
    districtId: String(raw.districtId ?? raw.district ?? ''), isActive: raw.isActive !== false,
    status: raw.status === 'inactive' || raw.status === 'transferred' ? raw.status : 'active' };
}
export function readDistrict(id: string, raw: Record<string, unknown>): District {
  return { ...raw, id, name: String(raw.name || ''), missionId: String(raw.missionId || ''), regionId: String(raw.regionId || ''),
    districtPastorId: String(raw.pastorId ?? raw.districtPastorId ?? ''), isActive: raw.isActive !== false };
}
export function readRegion(id: string, raw: Record<string, unknown>): Region {
  return { ...raw, id, name: String(raw.name || ''), missionId: String(raw.missionId || ''), isActive: raw.isActive !== false };
}
export function readMission(id: string, raw: Record<string, unknown>): Mission {
  return { ...raw, id, name: String(raw.name || ''), code: String(raw.code || ''), isActive: raw.isActive !== false };
}
