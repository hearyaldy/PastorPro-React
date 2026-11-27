import { useHierarchyLabels } from '../hooks/useHierarchyLabels';
import { StatisticsCards } from '../components/StatisticsCards';
import { ReportPreview } from '../components/ReportPreview';
import type { PrintableReport } from '../lib/pdfReport';
import { readAppointment, readTodo } from '../lib/scheduleViews';
import { readBorangB } from '../lib/borangB';
import { readActivity } from '../lib/activities';
import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, OperationType, reportListenerError } from '../lib/firebase';
import { MONTHS, formatIsoDate } from '../lib/exportUtils';
import { bootstrapSabahMissionBaseline } from '../lib/seedData';
import { useToast } from '../components/Toast';
import type { NavRouteId } from '../components/WorkspaceShell';
import {
  ROLE_META,
  type Appointment,
  type BorangBReport,
  type PastoralActivity,
  type TodoItem,
} from '../types';

export function DashboardOverview({
  onNavigate,
}: {
  onNavigate: (route: NavRouteId) => void;
}) {
  const labels = useHierarchyLabels();
  const { profile, capabilities } = useAuth();
  const { missions, churches, districts, globalEvents, loadingHierarchy } =
    useMission();
  const { notify } = useToast();

  const [preview, setPreview] = useState<PrintableReport | null>(null);
  const [localEvents, setLocalEvents] = useState<{ title: string; startDate: string }[]>([]);
  const [recentActivities, setRecentActivities] = useState<PastoralActivity[]>([]);
  const [borangBList, setBorangBList] = useState<BorangBReport[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  useEffect(() => {
    if (!profile) return;
    setLoadingData(true);

    const unsubs = [
      onSnapshot(query(collection(db, 'events'), where('userId', '==', profile.uid)), snap => setLocalEvents(snap.docs.map(d => ({ title: String(d.data().title || ''), startDate: String(d.data().startDate || '') }))), err => reportListenerError(err, OperationType.LIST, 'events')),
      onSnapshot(
        query(
          collection(db, 'activities'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          const items = snap.docs
            .map((d) => readActivity(d.id, d.data()))
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
          setRecentActivities(items);
          setLoadingData(false);
        },
        (err) => {
          setLoadingData(false);
          reportListenerError(err, OperationType.LIST, 'activities');
        },
      ),
      onSnapshot(
        query(
          collection(db, 'borang_b_reports'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          const items = snap.docs
            .map((d) => readBorangB(d.id, d.data()))
            .filter((item): item is BorangBReport => item !== null)
            .sort((a, b) => (b.year - a.year) || (b.month - a.month));
          setBorangBList(items);
        },
        (err) => {
          reportListenerError(err, OperationType.LIST, 'borang_b_reports');
        },
      ),
      onSnapshot(
        query(
          collection(db, 'appointments'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          const items = snap.docs
            .map((d) => readAppointment(d.id, d.data()))
            .sort((a, b) => String(a.dateTime || '').localeCompare(String(b.dateTime || '')));
          setAppointments(items);
        },
        (err) => {
          reportListenerError(err, OperationType.LIST, 'appointments');
        },
      ),
      onSnapshot(
        query(
          collection(db, 'todos'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          setTodos(
            snap.docs.map((d) => readTodo(d.id, d.data())),
          );
        },
        (err) => {
          reportListenerError(err, OperationType.LIST, 'todos');
        },
      ),
    ];

    return () => unsubs.forEach((u) => u());
  }, [profile]);

  const currentBorangB = borangBList.find(
    (b) => b.year === currentYear && b.month === currentMonth,
  );
  const openTodos = todos.filter((t) => !t.completed);
  const scheduledAppointments = appointments.filter(
    (a) => a.status === 'scheduled' && new Date(a.dateTime).getTime() > Date.now(),
  );
  const upcomingEventCount = localEvents.filter(event => new Date(event.startDate).getTime() > Date.now()).length + scheduledAppointments.length;
  const totalMinutesLogged = recentActivities.reduce(
    (acc, a) => acc + (a.durationMinutes || 0),
    0,
  );

  const handleBootstrap = async () => {
    if (!profile) return;
    setBootstrapping(true);
    try {
      await bootstrapSabahMissionBaseline(profile.uid, profile.displayName);
      notify('Sabah Adventist Mission baseline data created.', 'success');
    } catch {
      notify('Failed to initialize baseline hierarchy.', 'error');
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Editorial Intro Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[var(--border-hairline)]">
        <div>
          <div className="text-xs text-[var(--text-muted)]">
            {profile ? ROLE_META[profile.userRole].label : 'User'}
            {(profile?.districtId || profile?.districtName) ? ` · ${labels.district(profile?.districtId, profile?.districtName)}` : ''}
            {(profile?.churchId || profile?.churchName) ? ` · ${labels.church(profile?.churchId, profile?.churchName)}` : ''}
          </div>
          <h2 className="text-2xl font-display font-semibold tracking-tight mt-1">
            Welcome back, {profile?.displayName}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('activities')}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors whitespace-nowrap"
          >
            Log Activity
          </button>
          <button
            type="button"
            onClick={() => onNavigate('borang-b')}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap"
          >
            Open {MONTHS[currentMonth - 1]} Borang B
          </button>
        </div>
      </div>

      {/* Empty Hierarchy Prompt for Admins */}
      {!loadingHierarchy && missions.length === 0 && capabilities.canManageHierarchy && (
        <div className="p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">Sabah Mission Directory Empty</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Populate starter Regions, Districts, Churches, Departments, and 2026 Special Events so pastors and treasurers can complete onboarding immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBootstrap}
            disabled={bootstrapping}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{bootstrapping ? 'Creating...' : 'Initialize SAM Baseline'}</span>
          </button>
        </div>
      )}

      <StatisticsCards items={[
        { label: 'Pending Todos', value: openTodos.length, icon: 'check', color: 'blue' },
        { label: 'Upcoming Events & Appointments', value: upcomingEventCount, icon: 'calendar', color: 'orange' },
        { label: 'Activities', value: recentActivities.length, icon: 'activity', color: 'green' },
        { label: `${MONTHS[currentMonth - 1]} Borang B`, value: currentBorangB ? currentBorangB.status === 'submitted' ? 'Submitted' : 'Draft Saved' : 'Not Started', icon: 'check', color: 'purple' },
      ]} />
      <button className="no-print text-xs border border-[var(--border-hairline)] rounded-lg px-3 py-2" onClick={() => setPreview({
        title: 'Ministry Statistics Overview', subtitle: profile?.displayName || '', filename: 'Ministry_Statistics',
        summary: [['Pending Todos', openTodos.length], ['Upcoming Events', upcomingEventCount], ['Activities', recentActivities.length]],
        sections: [{ title: 'Pastoral Activities', columns: ['Date', 'Activities', 'KM'], rows: recentActivities.map(item => [item.date, item.title, item.mileage]) },
          { title: 'Upcoming Appointments', columns: ['Date', 'Title'], rows: scheduledAppointments.map(item => [item.dateTime, item.title]) },
          { title: 'Upcoming Events', columns: ['Date', 'Title'], rows: localEvents.filter(item => new Date(item.startDate).getTime() > Date.now()).map(item => [item.startDate, item.title]) },
          { title: 'Pending Todos', rows: openTodos.map(item => [item.title, item.priority]) }],
      })}>Preview / Print Statistics</button>
      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}

      {/* Role-Specific Quick Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('borang-b')}
          className="text-left p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors flex items-start justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Monthly Borang B</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
              Enter sermons, visitations, baptisms, and pastoral reflections with live auto-save and PDF export.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
        </button>

        {(capabilities.canSubmitFinancialReports ||
          capabilities.canAccessAllFinancialReports) && (
          <button
            type="button"
            onClick={() => onNavigate('financial-reports')}
            className="text-left p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors flex items-start justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FileSpreadsheet className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Financial & FAM Ledger</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                Record monthly church tithe, offerings, 1:1 FAM fund breakdowns, and export Excel workbooks.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
          </button>
        )}

        {(capabilities.canAccessDepartmentReports ||
          capabilities.canSubmitDepartmentReports) && (
          <button
            type="button"
            onClick={() => onNavigate('quarterly-departments')}
            className="text-left p-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] transition-colors flex items-start justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FolderKanban className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Quarterly Dept Reports</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                Submit Kanak-Kanak, Penatalayanan, SSPM, and Wanita metrics or browse district submissions.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
          </button>
        )}
      </div>

      {/* Main Split: Recent Activity Table + Mission Schedule & To-Dos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Pastoral Activities</h3>
            <button
              type="button"
              onClick={() => onNavigate('activities')}
              className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
            >
              View all logs
            </button>
          </div>
          {loadingData ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-9 rounded bg-[var(--bg-subtle)] animate-pulse"
                />
              ))}
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <ClipboardList className="w-7 h-7 text-[var(--text-muted)] mx-auto" />
              <div className="text-sm font-medium">No pastoral activities logged yet</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Start tracking home visitations, Bible studies, evangelistic meetings, and counseling sessions.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('activities')}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
              >
                Log First Activity
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="py-2.5 px-4 font-medium">Date</th>
                    <th className="py-2.5 px-4 font-medium">Activity</th>
                    <th className="py-2.5 px-4 font-medium">Category</th>
                    <th className="py-2.5 px-4 font-medium text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {recentActivities.slice(0, 5).map((act) => (
                    <tr
                      key={act.id}
                      className="hover:bg-[var(--bg-subtle)]/60 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-xs font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap">
                        {formatIsoDate(act.date)}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-[var(--text-primary)]">
                        {act.title}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-[var(--text-secondary)] capitalize">
                        {act.category}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono-tabular text-right text-[var(--text-secondary)] whitespace-nowrap">
                        {act.durationMinutes} min
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="lg:col-span-5 space-y-6">
          {/* Upcoming Global & Special Events */}
          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[var(--accent-primary)]" />
                <h3 className="text-sm font-semibold">Mission Global Calendar</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('calendar')}
                className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
              >
                Open calendar
              </button>
            </div>
            {globalEvents.length === 0 ? (
              <div className="p-6 text-xs text-[var(--text-muted)] text-center">
                No mission-wide events scheduled yet.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {globalEvents.slice(0, 4).map((ev) => (
                  <div key={ev.id} className="px-5 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{ev.title}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {ev.category} · {ev.location || 'Mission-wide'}
                      </div>
                    </div>
                    <span className="text-xs font-mono-tabular text-[var(--text-secondary)] whitespace-nowrap shrink-0">
                      {formatIsoDate(ev.startDate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open To-Dos */}
          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--accent-primary)]" />
                <h3 className="text-sm font-semibold">Pending Pastoral To-Dos</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('appointments-todos')}
                className="text-xs font-medium text-[var(--accent-primary)] hover:underline"
              >
                Open list
              </button>
            </div>
            {openTodos.length === 0 ? (
              <div className="p-6 text-xs text-[var(--text-muted)] text-center">
                All personal to-do items are clear.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {openTodos.slice(0, 4).map((todo) => (
                  <div key={todo.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <span className="text-sm truncate">{todo.title}</span>
                    <span className="text-xs text-[var(--text-muted)] capitalize shrink-0">
                      {todo.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
