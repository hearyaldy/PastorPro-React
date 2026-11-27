import { appPath, currentAppPage } from './lib/appPaths';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { AccountDeletionPage } from './pages/AccountDeletionPage';
import type { MissionReportContext } from './components/MissionReportingDashboard';
import { useEffect, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ToastProvider } from './components/Toast';
import { WorkspaceShell, type NavRouteId } from './components/WorkspaceShell';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MissionProvider } from './contexts/MissionContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { AdminHierarchyPage } from './pages/AdminHierarchyPage';
import { AdminManagementPage } from './pages/AdminManagementPage';
import { AdminStaffUsersPage } from './pages/AdminStaffUsersPage';
import { AllBorangBPage } from './pages/AllBorangBPage';
import { AppointmentsTodosPage } from './pages/AppointmentsTodosPage';
import { BorangBPage } from './pages/BorangBPage';
import { CalendarEventsPage } from './pages/CalendarEventsPage';
import { DashboardOverview } from './pages/DashboardOverview';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { FinancialReportsPage } from './pages/FinancialReportsPage';
import { MyMinistryPage } from './pages/MyMinistryPage';
import { MyMissionPage } from './pages/MyMissionPage';
import { ProfilePage } from './pages/ProfilePage';
import { QuarterlyDepartmentsPage } from './pages/QuarterlyDepartmentsPage';
import { ResourcesSettingsPage } from './pages/ResourcesSettingsPage';
import { SettingsPage } from './pages/SettingsPage';

const ROUTE_META: Record<
  NavRouteId,
  { title: string; breadcrumb: string }
> = {
  overview: { title: 'Workspace Overview', breadcrumb: 'Ministry Workspace / Overview' },
  'my-mission': { title: 'My Mission', breadcrumb: 'Ministry Workspace / My Mission' },
  'my-ministry': { title: 'My Ministry', breadcrumb: 'Ministry Workspace / My Ministry' },
  activities: { title: 'Pastoral Activities', breadcrumb: 'Ministry Workspace / Activities' },
  'borang-b': { title: 'Borang B Monthly Report', breadcrumb: 'Reporting / Borang B' },
  'all-borang-b': { title: 'Mission Borang B Browser', breadcrumb: 'Reporting / All Borang B' },
  'financial-reports': { title: 'Financial & FAM Reporting', breadcrumb: 'Reporting / Financial Ledger' },
  'quarterly-departments': { title: 'Quarterly Department Reports', breadcrumb: 'Reporting / Quarterly Departments' },
  calendar: { title: 'Events & Mission Calendar', breadcrumb: 'Schedule / Calendar' },
  'appointments-todos': { title: 'Appointments & To-Do List', breadcrumb: 'Schedule / Appointments & Tasks' },
  departments: { title: 'Church Departments', breadcrumb: 'Schedule / Departments' },
  'resources-settings': { title: 'Mission Resource Library', breadcrumb: 'Schedule & Resources / Library' },
  'admin-department-forms': { title: 'Department Report Forms', breadcrumb: 'Administration / Report Form Builder' },
  'admin-console': { title: 'Admin Console & Hierarchy', breadcrumb: 'Administration / Admin Console' },
  'admin-hierarchy': { title: 'Mission & Church Hierarchy', breadcrumb: 'Administration / Hierarchy' },
  'admin-users': { title: 'Staff Directory, Requests & Audit', breadcrumb: 'Administration / Staff & Audit' },
  profile: { title: 'My Profile', breadcrumb: 'Account / Profile' },
  settings: { title: 'Workspace Settings', breadcrumb: 'Account / Settings' },
};

const SIDEBAR_MODE_KEY = 'pastor_report_sidebar_compact';

function WorkspaceRouter() {
  const { firebaseUser, profile, loading, authError, signOut } = useAuth();
  const [reportContext, setReportContext] = useState<MissionReportContext | undefined>();
  const [route, setRoute] = useState<NavRouteId>('overview');
  const navigate = (next: NavRouteId, context?: MissionReportContext) => {
    if (next === route) return;
    if (window.dispatchEvent(new CustomEvent('pastorpro:before-navigate', { cancelable: true }))) { setReportContext(context); setRoute(next); }
  };
  const [sidebarCompact, setSidebarCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleSetSidebarCompact = (compact: boolean) => {
    setSidebarCompact(compact);
    try {
      localStorage.setItem(SIDEBAR_MODE_KEY, String(compact));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const scale = localStorage.getItem('pastor_report_font_scale');
      if (scale === 'compact') {
        document.documentElement.style.fontSize = '14.5px';
      } else if (scale === 'comfortable') {
        document.documentElement.style.fontSize = '17px';
      }
    } catch {
      // ignore
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-secondary)] text-sm">
        Connecting to PastorPro workspace...
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return <AuthGate />;
  }

  const isSuperAdmin = profile.userRole === 'super_admin';

  if (profile.deletionPending) return <div className="min-h-screen flex items-center justify-center p-6"><div className="max-w-md space-y-4"><h1 className="text-xl font-semibold">Account deletion is processing</h1><p>Your workspace access is closed while your deletion request is processed.</p><a href={appPath('account-deletion')} className="underline">Account deletion information</a><button className="block underline" onClick={signOut}>Sign out</button></div></div>;

  if (profile.approvalStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <div className="max-w-lg w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 space-y-5">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Pending Administrator Login Approval
            </div>
            <h1 className="text-xl font-display font-semibold">
              Your account is awaiting approval
            </h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Signed in as <span className="font-medium text-[var(--text-primary)]">{profile.displayName}</span> ({profile.email}). A Mission or Super Administrator must approve your login before you can enter the reporting workspace.
          </p>
          <div className="p-4 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-xs text-[var(--text-secondary)]">
            Once an administrator approves your account in the Admin Console, this screen will unlock automatically.
          </div>
          <a href={appPath('account-deletion')} className="text-xs underline">Privacy and account deletion</a>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={signOut}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (profile.approvalStatus === 'rejected' || !profile.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 space-y-4">
          <div className="text-xs font-medium text-red-600 dark:text-red-400">
            Access Not Active
          </div>
          <h1 className="text-lg font-display font-semibold">
            {profile.approvalStatus === 'rejected'
              ? 'Login Request Declined'
              : 'Account Deactivated'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Your workspace access is currently inactive. Please contact your Mission Administrator or Ministerial Secretary for assistance.
          </p>
          {profile.approvalNote && (
            <div className="p-3.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-xs text-[var(--text-secondary)]">
              Note: {profile.approvalNote}
            </div>
          )}
          <a href={appPath('account-deletion')} className="block text-xs underline">Privacy and account deletion</a>
          <button
            type="button"
            onClick={signOut}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const bypassOnboarding =
    isSuperAdmin ||
    profile.userRole === 'admin' ||
    Boolean(profile.isAdmin);

  if (!bypassOnboarding && !profile.onboardingCompleted) {
    return <OnboardingWizard />;
  }

  const meta = ROUTE_META[route];

  return (
    <WorkspaceShell
      activeRoute={route}
      onNavigate={navigate}
      pageTitle={meta.title}
      breadcrumb={meta.breadcrumb}
      sidebarCompact={sidebarCompact}
      onToggleSidebarCompact={() => handleSetSidebarCompact(!sidebarCompact)}
    >
      {authError && (
        <div className="mb-6 p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200">
          {authError}
        </div>
      )}
      {route === 'overview' && <DashboardOverview onNavigate={navigate} />}
      {route === 'my-mission' && <MyMissionPage onNavigate={navigate} onReportNavigate={(next, context) => { navigate(next, context); }} />}
      {route === 'my-ministry' && <MyMinistryPage onNavigate={navigate} />}
      {route === 'activities' && <ActivitiesPage />}
      {route === 'borang-b' && <BorangBPage initialContext={reportContext} />}
      {route === 'all-borang-b' && <AllBorangBPage />}
      {route === 'financial-reports' && <FinancialReportsPage initialContext={reportContext} />}
      {route === 'quarterly-departments' && <QuarterlyDepartmentsPage onManage={() => navigate('admin-department-forms')} />}
      {route === 'calendar' && <CalendarEventsPage />}
      {route === 'appointments-todos' && <AppointmentsTodosPage />}
      {route === 'departments' && <DepartmentsPage />}
      {route === 'resources-settings' && <ResourcesSettingsPage />}
      {route === 'admin-console' && <AdminManagementPage onManageDepartmentForms={() => navigate('admin-department-forms')} />}
      {route === 'admin-department-forms' && <QuarterlyDepartmentsPage adminMode />}
      {route === 'admin-hierarchy' && <AdminHierarchyPage />}
      {route === 'admin-users' && <AdminStaffUsersPage />}
      {route === 'profile' && <ProfilePage />}
      {route === 'settings' && (
        <SettingsPage
          sidebarCompact={sidebarCompact}
          onSetSidebarCompact={handleSetSidebarCompact}
        />
      )}
    </WorkspaceShell>
  );
}

export default function App() {
  const path = currentAppPage();
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          {path === '/privacy-policy' ? <PrivacyPolicyPage /> : <AuthProvider>
            {path === '/account-deletion' ? <AccountDeletionPage /> : <MissionProvider><WorkspaceRouter /></MissionProvider>}
          </AuthProvider>}
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
