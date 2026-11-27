import { useState } from 'react';
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
import { AdminStaffUsersPage } from './pages/AdminStaffUsersPage';
import { AllBorangBPage } from './pages/AllBorangBPage';
import { AppointmentsTodosPage } from './pages/AppointmentsTodosPage';
import { BorangBPage } from './pages/BorangBPage';
import { CalendarEventsPage } from './pages/CalendarEventsPage';
import { DashboardOverview } from './pages/DashboardOverview';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { FinancialReportsPage } from './pages/FinancialReportsPage';
import { QuarterlyDepartmentsPage } from './pages/QuarterlyDepartmentsPage';
import { ResourcesSettingsPage } from './pages/ResourcesSettingsPage';

const ROUTE_META: Record<
  NavRouteId,
  { title: string; breadcrumb: string }
> = {
  overview: { title: 'Workspace Overview', breadcrumb: 'Ministry Workspace / Overview' },
  activities: { title: 'Pastoral Activities', breadcrumb: 'Ministry Workspace / Activities' },
  'borang-b': { title: 'Borang B Monthly Report', breadcrumb: 'Reporting / Borang B' },
  'all-borang-b': { title: 'Mission Borang B Browser', breadcrumb: 'Reporting / All Borang B' },
  'financial-reports': { title: 'Financial & FAM Reporting', breadcrumb: 'Reporting / Financial Ledger' },
  'quarterly-departments': { title: 'Quarterly Department Reports', breadcrumb: 'Reporting / Quarterly Departments' },
  calendar: { title: 'Events & Mission Calendar', breadcrumb: 'Schedule / Calendar' },
  'appointments-todos': { title: 'Appointments & To-Do List', breadcrumb: 'Schedule / Appointments & Tasks' },
  departments: { title: 'Church Departments', breadcrumb: 'Schedule / Departments' },
  'admin-hierarchy': { title: 'Mission & Church Hierarchy', breadcrumb: 'Administration / Hierarchy' },
  'admin-users': { title: 'Users, Roles & Staff Directory', breadcrumb: 'Administration / Users & Staff' },
  'resources-settings': { title: 'Resources, Profile & Settings', breadcrumb: 'Administration / Resources & Profile' },
};

function WorkspaceRouter() {
  const { firebaseUser, profile, loading, signOut } = useAuth();
  const [route, setRoute] = useState<NavRouteId>('overview');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-secondary)] text-sm">
        Connecting to Pastor Report workspace...
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return <AuthGate />;
  }

  if (!profile.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 space-y-4">
          <h1 className="text-lg font-display font-semibold">Account Deactivated</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Your workspace access has been deactivated by a Mission Administrator. Please contact Sabah Adventist Mission office for assistance.
          </p>
          <button
            type="button"
            onClick={signOut}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)]"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!profile.onboardingCompleted) {
    return <OnboardingWizard />;
  }

  const meta = ROUTE_META[route];

  return (
    <WorkspaceShell
      activeRoute={route}
      onNavigate={setRoute}
      pageTitle={meta.title}
      breadcrumb={meta.breadcrumb}
    >
      {route === 'overview' && <DashboardOverview onNavigate={setRoute} />}
      {route === 'activities' && <ActivitiesPage />}
      {route === 'borang-b' && <BorangBPage />}
      {route === 'all-borang-b' && <AllBorangBPage />}
      {route === 'financial-reports' && <FinancialReportsPage />}
      {route === 'quarterly-departments' && <QuarterlyDepartmentsPage />}
      {route === 'calendar' && <CalendarEventsPage />}
      {route === 'appointments-todos' && <AppointmentsTodosPage />}
      {route === 'departments' && <DepartmentsPage />}
      {route === 'admin-hierarchy' && <AdminHierarchyPage />}
      {route === 'admin-users' && <AdminStaffUsersPage />}
      {route === 'resources-settings' && <ResourcesSettingsPage />}
    </WorkspaceShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MissionProvider>
              <WorkspaceRouter />
            </MissionProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
