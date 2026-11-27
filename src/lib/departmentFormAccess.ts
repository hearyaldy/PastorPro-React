import type { UserProfile } from '../types';
import { validateTemplate, type DepartmentTemplate } from './departmentReports';
export interface DepartmentFormAccess {
  profile: UserProfile | null; churchId?: string; churchCount: number; districtAssigned: boolean;
  busy?: boolean; templatesLoading?: boolean; reportsLoading?: boolean; templateError?: string; reportError?: string; template?: DepartmentTemplate;
}
export function departmentFormBlocker(access: DepartmentFormAccess): { code: string; message: string } | null {
  if (!access.profile?.isActive) return { code: 'account', message: 'An active, approved account is required to fill a report.' };
  if (!['super_admin', 'admin', 'district_pastor'].includes(access.profile.userRole)) return { code: 'role', message: 'Your account can review reports. District Pastors, Admins and Super Admins can fill church reports.' };
  if (access.busy) return { code: 'busy', message: 'Opening the saved response…' };
  if (access.templateError) return { code: 'templates', message: access.templateError };
  if (access.reportError) return { code: 'responses', message: access.reportError };
  if (access.templatesLoading || access.reportsLoading) return { code: 'loading', message: 'Loading forms and saved responses before you can fill a report…' };
  if (access.profile.userRole === 'district_pastor' && !access.districtAssigned) return { code: 'district', message: 'Your account has no matching district assignment. Ask an administrator to assign your district.' };
  if (!access.churchCount) return { code: 'no_churches', message: 'No churches are available in this scope. Check the mission and district filters or ask an administrator to check your church assignments.' };
  if (!access.churchId) return { code: 'church', message: 'Choose a church above to enable Fill report. Each response belongs to one church and reporting quarter.' };
  if (access.template && !access.template.isActive) return { code: 'closed', message: 'This form is closed and is not accepting responses.' };
  const errors = access.template ? validateTemplate(access.template) : [];
  if (errors.length) return { code: 'definition', message: `This form needs an administrator’s review: ${errors[0]}` };
  return null;
}
