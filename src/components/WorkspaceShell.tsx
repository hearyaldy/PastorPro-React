import React, { useState } from 'react';
import {
  Activity,
  BookOpen,
  Building2,
  CalendarDays,
  CheckSquare,
  Compass,
  FileCheck2,
  FileSpreadsheet,
  FolderKanban,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { LIGHT_THEME_PRESETS, useTheme } from '../contexts/ThemeContext';
import { ROLE_META } from '../types';

export type NavRouteId =
  | 'overview'
  | 'my-mission'
  | 'my-ministry'
  | 'activities'
  | 'borang-b'
  | 'all-borang-b'
  | 'financial-reports'
  | 'quarterly-departments'
  | 'calendar'
  | 'appointments-todos'
  | 'departments'
  | 'admin-console'
  | 'admin-hierarchy'
  | 'admin-users'
  | 'resources-settings'
  | 'profile'
  | 'settings';

interface NavGroup {
  label: string;
  items: {
    id: NavRouteId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    visible: boolean;
  }[];
}

interface WorkspaceShellProps {
  activeRoute: NavRouteId;
  onNavigate: (route: NavRouteId) => void;
  pageTitle: string;
  breadcrumb: string;
  sidebarCompact?: boolean;
  onToggleSidebarCompact?: () => void;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function WorkspaceShell({
  activeRoute,
  onNavigate,
  pageTitle,
  breadcrumb,
  sidebarCompact = false,
  onToggleSidebarCompact,
  headerAction,
  children,
}: WorkspaceShellProps) {
  const { profile, capabilities, signOut } = useAuth();
  const { theme, lightTheme, setLightTheme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navGroups: NavGroup[] = [
    {
      label: 'Ministry Workspace',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard, visible: true },
        { id: 'my-mission', label: 'My Mission', icon: Compass, visible: true },
        { id: 'my-ministry', label: 'My Ministry', icon: HeartHandshake, visible: true },
        { id: 'activities', label: 'Pastoral Activities', icon: Activity, visible: true },
      ],
    },
    {
      label: 'Reporting & Ledgers',
      items: [
        { id: 'borang-b', label: 'Borang B Monthly', icon: BookOpen, visible: true },
        {
          id: 'all-borang-b',
          label: 'All Borang B',
          icon: FileCheck2,
          visible: capabilities.canAccessAllBorangB,
        },
        {
          id: 'financial-reports',
          label: 'Financial & FAM',
          icon: FileSpreadsheet,
          visible:
            capabilities.canSubmitFinancialReports ||
            capabilities.canAccessAllFinancialReports,
        },
        {
          id: 'quarterly-departments',
          label: 'Quarterly Depts',
          icon: FolderKanban,
          visible:
            capabilities.canAccessDepartmentReports ||
            capabilities.canSubmitDepartmentReports,
        },
      ],
    },
    {
      label: 'Schedule & Resources',
      items: [
        { id: 'calendar', label: 'Events & Calendar', icon: CalendarDays, visible: true },
        {
          id: 'appointments-todos',
          label: 'Appointments & To-Do',
          icon: CheckSquare,
          visible: true,
        },
        { id: 'departments', label: 'Departments', icon: Building2, visible: true },
        {
          id: 'resources-settings',
          label: 'Mission Resources',
          icon: FolderKanban,
          visible: true,
        },
      ],
    },
    {
      label: 'Administration',
      items: [
        {
          id: 'admin-console',
          label: 'Admin Console',
          icon: ShieldCheck,
          visible:
            capabilities.canManageUsers ||
            capabilities.canManageHierarchy ||
            capabilities.canManageMissions,
        },
        {
          id: 'admin-users',
          label: 'Staff, Requests & Audit',
          icon: Users,
          visible: capabilities.canManageUsers || capabilities.canManageStaff,
        },
        {
          id: 'admin-hierarchy',
          label: 'Quick Hierarchy',
          icon: Shield,
          visible: false,
        },
      ],
    },
    {
      label: 'Account',
      items: [
        {
          id: 'profile',
          label: 'My Profile',
          icon: UserCircle2,
          visible: true,
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          visible: true,
        },
      ],
    },
  ];

  const handleSelect = (id: NavRouteId) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const renderSidebarContent = (compact: boolean) => (
    <div className="flex flex-col h-full bg-[var(--bg-sidebar)] border-r border-[var(--border-hairline)] transition-colors duration-200">
      <div
        className={`py-4 border-b border-[var(--border-hairline)] flex items-center ${
          compact ? 'px-3 justify-center' : 'px-5 justify-between'
        }`}
      >
        {!compact ? (
          <div className="min-w-0">
            <div className="text-base font-display font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap">
              PastorPro
            </div>
            <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[165px]">
              {profile?.missionName || 'Multi-Mission Workspace'}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleSidebarCompact}
            title="Expand side menu"
            aria-label="Expand side menu"
            className="w-9 h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-1">
          {!compact && onToggleSidebarCompact && (
            <button
              type="button"
              onClick={onToggleSidebarCompact}
              title="Collapse side menu"
              aria-label="Collapse side menu"
              className="hidden lg:inline-flex p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/70"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto py-4 space-y-6 ${compact ? 'px-2' : 'px-3'}`}>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((i) => i.visible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label}>
              {!compact && (
                <div className="px-2.5 mb-2 text-[11px] font-medium text-[var(--text-muted)]">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeRoute === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={compact ? item.label : undefined}
                      aria-label={item.label}
                      onClick={() => handleSelect(item.id)}
                      className={`w-full flex items-center rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        compact ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-2.5 py-2 text-sm'
                      } ${
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold border border-[var(--accent-primary)]/15'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]/70 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!compact && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={`border-t border-[var(--border-hairline)] space-y-3 ${compact ? 'p-2.5' : 'p-4'}`}>
        <button
          type="button"
          onClick={() => handleSelect('profile')}
          className={`w-full flex items-center text-left rounded-lg hover:bg-[var(--bg-surface)]/70 transition-colors ${
            compact ? 'justify-center p-1' : 'gap-3 p-1 -m-1'
          }`}
          title="Open Profile"
        >
          {profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt={profile.displayName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover border border-[var(--border-hairline)] shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-hairline)] flex items-center justify-center text-xs font-semibold shrink-0">
              {(profile?.displayName || 'P').slice(0, 2).toUpperCase()}
            </div>
          )}
          {!compact && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                {profile?.displayName}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">
                {profile ? ROLE_META[profile.userRole].label : 'User'}
              </div>
            </div>
          )}
        </button>

        {!compact && (
          <div className="flex items-center justify-between gap-1.5 pt-1">
            <span className="text-[11px] text-[var(--text-muted)]">Light theme</span>
            <div className="flex items-center gap-1.5">
              {LIGHT_THEME_PRESETS.map((preset) => {
                const selected = theme === 'light' && lightTheme === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    aria-label={`Select ${preset.label} light theme`}
                    onClick={() => setLightTheme(preset.id)}
                    className={`w-4 h-4 rounded-sm border overflow-hidden flex transition-transform ${
                      selected
                        ? 'ring-2 ring-[var(--text-primary)] ring-offset-1 ring-offset-[var(--bg-sidebar)] scale-105'
                        : 'border-[var(--border-hairline)] hover:scale-105'
                    }`}
                  >
                    <span className="w-1/2 h-full" style={{ backgroundColor: preset.sidebar }} />
                    <span className="w-1/2 h-full" style={{ backgroundColor: preset.accent }} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={`flex items-center gap-2 pt-1 ${compact ? 'flex-col' : 'justify-between'}`}>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            className={`${
              compact ? 'w-full p-2' : 'flex-1 px-2.5 py-1.5'
            } inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap`}
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5" />
                {!compact && <span>Dark</span>}
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5" />
                {!compact && <span>Light</span>}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            aria-label="Sign out"
            className={`${
              compact ? 'w-full p-2' : 'flex-1 px-2.5 py-1.5'
            } inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-md border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-red-600 dark:hover:text-red-400 transition-colors whitespace-nowrap`}
          >
            <LogOut className="w-3.5 h-3.5" />
            {!compact && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 sticky top-0 h-screen no-print transition-[width] duration-200 ${
          sidebarCompact ? 'w-[74px]' : 'w-64'
        }`}
      >
        {renderSidebarContent(sidebarCompact)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">
            {renderSidebarContent(false)}
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-[var(--bg-header)]/95 backdrop-blur-sm border-b border-[var(--border-hairline)] px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 no-print transition-colors duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)]"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="text-xs text-[var(--text-muted)] truncate">
                {breadcrumb}
              </div>
              <h1 className="text-base md:text-lg font-display font-semibold text-[var(--text-primary)] truncate">
                {pageTitle}
              </h1>
            </div>
          </div>

          {headerAction && (
            <div className="flex items-center gap-2 shrink-0">{headerAction}</div>
          )}
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
