import type { BorangBForm } from '../lib/borangB';

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'mission_admin'
  | 'ministerial_secretary'
  | 'director'
  | 'officer'
  | 'editor'
  | 'district_pastor'
  | 'church_treasurer'
  | 'user';

export const ROLE_META: Record<
  UserRole,
  { label: string; level: number; summary: string }
> = {
  super_admin: {
    label: 'Super Admin',
    level: 5,
    summary: 'Full platform access including Super Admin assignment',
  },
  admin: {
    label: 'Admin',
    level: 4,
    summary: 'Manage users, missions, hierarchy, and bulk imports',
  },
  mission_admin: {
    label: 'Mission Admin',
    level: 3,
    summary: 'Manage staff, hierarchy, and users within assigned mission',
  },
  ministerial_secretary: {
    label: 'Ministerial Secretary',
    level: 3,
    summary: 'Review all Borang B and pastoral reports mission-wide',
  },
  director: {
    label: 'Director',
    level: 3,
    summary: 'Mission-level read/write oversight across reports',
  },
  officer: {
    label: 'Officer',
    level: 3,
    summary: 'Mission-level read-only oversight across all ledgers',
  },
  editor: {
    label: 'Editor',
    level: 2,
    summary: 'Manage departments, global events, and mission resources',
  },
  district_pastor: {
    label: 'District Pastor',
    level: 2,
    summary: 'Manage district ministry and submit quarterly church reports',
  },
  church_treasurer: {
    label: 'Church Treasurer',
    level: 1,
    summary: 'Submit and review assigned church financial & FAM reports',
  },
  user: {
    label: 'Pastor / User',
    level: 1,
    summary: 'Submit personal activities, Borang B, appointments, and to-dos',
  },
};

export type UserApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  deletionPending?: boolean;
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  userRole: UserRole;
  role?: string;
  roleTitle?: string;
  isAdmin?: boolean;
  level: number;
  unionId?: string;
  unionName?: string;
  missionId?: string;
  missionName?: string;
  regionId?: string;
  regionName?: string;
  districtId?: string;
  districtName?: string;
  churchId?: string;
  churchName?: string;
  isPremium?: boolean;
  isActive: boolean;
  approvalStatus?: UserApprovalStatus;
  approvedBy?: string;
  approvalNote?: string;
  onboardingCompleted: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoleCapabilities {
  canManageUsers: boolean;
  canManageUnions: boolean;
  canManageMissions: boolean;
  canManageHierarchy: boolean;
  canManageStaff: boolean;
  canManageGlobalEvents: boolean;
  canManageResources: boolean;
  canManageDepartments: boolean;
  canAccessAllBorangB: boolean;
  canAccessAllFinancialReports: boolean;
  canSubmitFinancialReports: boolean;
  canAccessDepartmentReports: boolean;
  canSubmitDepartmentReports: boolean;
  isReadOnlyOfficer: boolean;
}

function resolveSingleRoleCandidate(value: unknown): UserRole | null {
  const candidate = String(value || '').toLowerCase().trim();
  if (!candidate) return null;
  if (Object.hasOwn(ROLE_META, candidate)) {
    return candidate as UserRole;
  }
  const compact = candidate.replace(/[\s_-]+/g, '');
  if (compact === 'superadmin') return 'super_admin';
  if (compact === 'missionadmin' || compact === 'missionpresident') return 'mission_admin';
  if (compact === 'ministerialsecretary') return 'ministerial_secretary';
  if (compact === 'districtpastor') return 'district_pastor';
  if (compact === 'churchtreasurer') return 'church_treasurer';
  return null;
}

// Only the authoritative field grants capabilities. Display titles and flags are metadata.
export function normalizeUserRole(raw: Record<string, unknown>): UserRole {
  return resolveSingleRoleCandidate(raw.userRole) || 'user';
}

/** Flutter's UserRole.name encoding, used for all new role writes. */
export function storedUserRole(role: UserRole): string {
  const names: Partial<Record<UserRole, string>> = {
    super_admin: 'superAdmin',
    mission_admin: 'missionAdmin',
    ministerial_secretary: 'ministerialSecretary',
    district_pastor: 'districtPastor',
    church_treasurer: 'churchTreasurer',
  };
  return names[role] || role;
}

export function getCapabilities(user: UserProfile | null): RoleCapabilities {
  if (!user || !user.isActive || user.approvalStatus === 'pending' || user.approvalStatus === 'rejected') {
    return {
      canManageUsers: false,
      canManageUnions: false,
      canManageMissions: false,
      canManageHierarchy: false,
      canManageStaff: false,
      canManageGlobalEvents: false,
      canManageResources: false,
      canManageDepartments: false,
      canAccessAllBorangB: false,
      canAccessAllFinancialReports: false,
      canSubmitFinancialReports: false,
      canAccessDepartmentReports: false,
      canSubmitDepartmentReports: false,
      isReadOnlyOfficer: false,
    };
  }

  const r = user.userRole;
  const isSuperOrAdmin = r === 'super_admin' || r === 'admin';
  const isMissionAdmin = r === 'mission_admin';
  const isLeadership =
    isSuperOrAdmin ||
    isMissionAdmin ||
    r === 'ministerial_secretary' ||
    r === 'director' ||
    r === 'officer';

  return {
    canManageUsers: isSuperOrAdmin || isMissionAdmin,
    canManageUnions: isSuperOrAdmin,
    canManageMissions: isSuperOrAdmin,
    canManageHierarchy: isSuperOrAdmin || isMissionAdmin,
    canManageStaff: isSuperOrAdmin || isMissionAdmin,
    canManageGlobalEvents: isSuperOrAdmin || isMissionAdmin || r === 'editor',
    canManageResources: isSuperOrAdmin || isMissionAdmin || r === 'editor',
    canManageDepartments: isSuperOrAdmin || isMissionAdmin || r === 'editor',
    canAccessAllBorangB: isLeadership,
    canAccessAllFinancialReports: isLeadership,
    canSubmitFinancialReports:
      isSuperOrAdmin || isMissionAdmin || r === 'church_treasurer',
    canAccessDepartmentReports: isLeadership || r === 'district_pastor',
    canSubmitDepartmentReports:
      isSuperOrAdmin || isMissionAdmin || r === 'district_pastor',
    isReadOnlyOfficer: r === 'officer',
  };
}

export interface Union {
  id: string;
  name: string;
  code: string;
  country?: string;
  headquarters?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Mission {
  id: string;
  unionId?: string;
  unionName?: string;
  name: string;
  code: string;
  country?: string;
  headquarters?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Region {
  id: string;
  missionId: string;
  name: string;
  code?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface District {
  id: string;
  missionId: string;
  regionId: string;
  name: string;
  districtPastorId?: string;
  districtPastorName?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Church {
  id: string;
  missionId: string;
  regionId: string;
  districtId: string;
  name: string;
  churchCode?: string;
  treasurerId?: string;
  treasurerName?: string;
  memberCount?: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffMember {
  id: string;
  missionId: string;
  regionId?: string;
  districtId?: string;
  fullName: string;
  position: string;
  email?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'transferred';
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Department {
  id: string;
  missionId: string;
  name: string;
  code?: string;
  description?: string;
  directorName?: string;
  resourceUrl?: string;
  secondaryUrl?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ActivityCategory =
  | 'visitation'
  | 'evangelism'
  | 'meeting'
  | 'worship'
  | 'counseling'
  | 'training'
  | 'administration';

export interface PastoralActivity {
  id: string;
  userId: string;
  missionId: string;
  districtId?: string;
  churchId?: string;
  churchName?: string;
  title: string;
  category: ActivityCategory;
  date: string;
  durationMinutes: number;
  mileage: number;
  participants?: number;
  location?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BorangBReport extends BorangBForm {
  id: string;
  userId: string;
  pastorName: string;
  missionId: string;
  regionId?: string;
  districtId: string;
  districtName?: string;
  churchId?: string;
  sourceData?: Record<string, unknown>;
  revision?: string;
  year: number;
  month: number;
  status: 'draft' | 'submitted';
  sermonsPreached: number;
  bibleStudiesGiven: number;
  homeVisitations: number;
  hospitalVisitations: number;
  counselingSessions: number;
  evangelisticMeetings: number;
  baptisms: number;
  professionsOfFaith: number;
  boardMeetings: number;
  communionServices: number;
  anointings?: number;
  weddings: number;
  funerals: number;
  childDedications?: number;
  titheFaithfulnessNotes?: string;
  challengesAndPrayer?: string;
  nextMonthGoals?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FinancialReportHistory {
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  changes?: string;
}

export interface FinancialReport {
  sourceData?: Record<string, unknown>;
  offerings?: number;
  specialOfferings?: number;
  customFinanceTypes?: { name?: string; amount?: number }[];
  id: string;
  missionId: string;
  regionId: string;
  districtId: string;
  churchId: string;
  churchName: string;
  submittedBy: string;
  submittedByName?: string;
  year: number;
  month: number;
  tithe: number;
  combinedBudget: number;
  missionOffering: number;
  localChurchOffering: number;
  specialOffering: number;
  totalIncome: number;
  totalExpense: number;
  status: 'draft' | 'submitted' | 'verified';
  notes?: string;
  famId?: string;
  history?: FinancialReportHistory[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FamLineItem {
  name: string;
  category: string;
  amount: number;
}

export interface FamData {
  id: string;
  reportId: string;
  missionId: string;
  districtId: string;
  churchId: string;
  submittedBy: string;
  year: number;
  month: number;
  openingBalance: number;
  closingBalance: number;
  funds: FamLineItem[];
  expenses: FamLineItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DepartmentType = 'kanak_kanak' | 'penatalayanan' | 'sspm' | 'wanita';

export interface KanakKanakPayload {
  age0to4: number;
  age5to6: number;
  age7to9: number;
  age10to12: number;
  aptaFamilies: number;
  kidEnrolled: number;
  regularFamilyWorship: number;
  vbsHeld: number;
}

export interface PenatalayananPayload {
  borangApMonth1Tithe: number;
  borangApMonth1Offering: number;
  borangApMonth2Tithe: number;
  borangApMonth2Offering: number;
  borangApMonth3Tithe: number;
  borangApMonth3Offering: number;
  stewardshipLeaders: number;
  employedMembers: number;
  selfEmployedMembers: number;
  retiredOrStudentMembers: number;
  stewardshipSeminars: number;
  faithfulnessVisitations: number;
}

export interface SspmPayload {
  sabbathSchoolAdultAttendance: number;
  sabbathSchoolYouthAttendance: number;
  sabbathSchoolChildrenAttendance: number;
  activeBibleStudyGroups: number;
  smallGroupOutreachContacts: number;
  literatureDistributed: number;
  baptismalInterests: number;
  communityBibleStudies: number;
}

export interface WanitaPayload {
  activeWomenMembers: number;
  regularFellowshipAttendance: number;
  prayerGroupMeetings: number;
  communityWelfarePrograms: number;
  leadershipWorkshops: number;
  devotionalRetreats: number;
  familiesAssisted: number;
}

export interface QuarterlyDepartmentReport {
  sourceData?: Record<string, unknown>;
  id: string;
  missionId: string;
  regionId: string;
  districtId: string;
  churchId: string;
  churchName: string;
  districtName?: string;
  department: string;
  templateId?: string;
  departmentKey?: string;
  departmentName?: string;
  values?: Record<string, unknown>;
  submittedAt?: unknown;
  editedBy?: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  submittedBy: string;
  submittedByName?: string;
  status: 'draft' | 'submitted';
  payload: Record<string, number>;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Appointment {
  id: string;
  userId: string;
  title: string;
  contactName: string;
  contactPhone?: string;
  location?: string;
  dateTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TodoItem {
  id: string;
  userId: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  completed: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  missionId?: string;
  districtId?: string;
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  location?: string;
  description?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GlobalEvent {
  id: string;
  missionId: string;
  title: string;
  category: string;
  startDate: string;
  endDate: string;
  location?: string;
  description?: string;
  isSpecialEvent?: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MissionResource {
  id: string;
  missionId: string;
  title: string;
  category: string;
  description?: string;
  url: string;
  fileType?: string;
  isActive: boolean;
  uploadedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LocationRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  missionName?: string;
  regionName?: string;
  districtName?: string;
  churchName: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminActivityLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId?: string;
  summary: string;
  createdAt?: unknown;
}

export interface AppSettings {
  id: string;
  key: string;
  allowedDomains?: string[];
  appVersion?: string;
  maintenanceMode?: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface MinistryTeamMember {
  id: string;
  userId: string;
  missionId: string;
  districtId?: string;
  churchId?: string;
  churchName?: string;
  fullName: string;
  role: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}
