import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Globe, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType, reportListenerError } from '../lib/firebase';
import { formatIsoDate, MONTHS } from '../lib/exportUtils';
import { useToast } from '../components/Toast';
import type { Appointment, CalendarEvent } from '../types';

export function CalendarEventsPage() {
  const { profile, capabilities } = useAuth();
  const { globalEvents, logAdminActivity } = useMission();
  const { notify } = useToast();

  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [viewDate, setViewDate] = useState(() => new Date());

  // Event modal
  const [modalOpen, setModalOpen] = useState(false);
  const [eventScope, setEventScope] = useState<'local' | 'global'>('local');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Pastoral');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const unsubs = [
      onSnapshot(
        query(
          collection(db, 'events'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as Omit<CalendarEvent, 'id'>),
            }))
            .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
          setLocalEvents(items);
        },
        (err) => {
          reportListenerError(err, OperationType.LIST, 'events');
        },
      ),
      onSnapshot(
        query(
          collection(db, 'appointments'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          const items = snap.docs
            .map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Appointment, 'id'>),
            }))
            .sort((a, b) => String(a.dateTime || '').localeCompare(String(b.dateTime || '')));
          setAppointments(items);
        },
        (err) => {
          reportListenerError(err, OperationType.LIST, 'appointments');
        },
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [profile]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month]);

  const combinedItems = useMemo(() => {
    const items: {
      id: string;
      date: string;
      title: string;
      kind: 'global' | 'local' | 'appointment';
      location?: string;
    }[] = [];

    globalEvents.forEach((g) => {
      items.push({
        id: g.id,
        date: g.startDate.slice(0, 10),
        title: g.title,
        kind: 'global',
        location: g.location,
      });
    });

    localEvents.forEach((l) => {
      items.push({
        id: l.id,
        date: l.startDate.slice(0, 10),
        title: l.title,
        kind: 'local',
        location: l.location,
      });
    });

    appointments.forEach((a) => {
      items.push({
        id: a.id,
        date: a.dateTime.slice(0, 10),
        title: `Appt: ${a.title} (${a.contactName})`,
        kind: 'appointment',
        location: a.location,
      });
    });

    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [globalEvents, localEvents, appointments]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !title.trim()) return;
    setSaving(true);
    try {
      if (eventScope === 'global' && capabilities.canManageGlobalEvents) {
        const ref = await addDoc(collection(db, 'global_events'), {
          missionId: profile.missionId || 'sam_sabah',
          title: title.trim().slice(0, 160),
          category: category.trim().slice(0, 64),
          startDate,
          endDate: endDate || startDate,
          location: location.trim().slice(0, 160),
          description: description.trim().slice(0, 2000),
          isSpecialEvent: false,
          isActive: true,
          createdBy: profile.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await logAdminActivity(
          'CREATE_GLOBAL_EVENT',
          'global_events',
          `Added mission event "${title.trim()}"`,
          ref.id,
        );
        notify('Mission global event published.', 'success');
      } else {
        await addDoc(collection(db, 'events'), {
          userId: profile.uid,
          ...(profile.missionId ? { missionId: profile.missionId } : {}),
          ...(profile.districtId ? { districtId: profile.districtId } : {}),
          title: title.trim().slice(0, 160),
          category: category.trim().slice(0, 64),
          startDate,
          endDate: endDate || startDate,
          location: location.trim().slice(0, 160),
          description: description.trim().slice(0, 2000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notify('Local event added to your calendar.', 'success');
      }
      setModalOpen(false);
      setTitle('');
      setLocation('');
      setDescription('');
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        eventScope === 'global' ? 'global_events' : 'events',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'events', id));
      notify('Local event removed.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${id}`);
    }
  };

  const handleDeleteGlobal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'global_events', id));
      notify('Global event removed.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `global_events/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-display font-semibold min-w-[170px] text-center">
            {MONTHS[month]} {year}
          </h2>
          <button
            type="button"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Event</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Month Grid */}
        <div className="xl:col-span-8 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2.5 px-2 text-center font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-hairline)]">
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty_${idx}`} className="min-h-[88px] bg-[var(--bg-subtle)]/40" />;
              }
              const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayItems = combinedItems.filter((i) => i.date === iso);
              return (
                <div key={iso} className="min-h-[88px] p-2 space-y-1">
                  <div className="text-xs font-mono-tabular text-[var(--text-secondary)]">
                    {day}
                  </div>
                  {dayItems.slice(0, 3).map((item) => (
                    <div
                      key={`${item.kind}_${item.id}`}
                      title={item.title}
                      className={`text-[11px] px-1.5 py-0.5 rounded truncate ${
                        item.kind === 'global'
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-medium'
                          : item.kind === 'appointment'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                      }`}
                    >
                      {item.title}
                    </div>
                  ))}
                  {dayItems.length > 3 && (
                    <div className="text-[10px] text-[var(--text-muted)]">
                      +{dayItems.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda Sidebar */}
        <div className="xl:col-span-4 space-y-6">
          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border-hairline)] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--accent-primary)]" />
              <h3 className="text-sm font-semibold">Mission Global & Special Events</h3>
            </div>
            <div className="divide-y divide-[var(--border-hairline)] max-h-72 overflow-y-auto">
              {globalEvents.length === 0 ? (
                <div className="p-5 text-xs text-[var(--text-muted)] text-center">
                  No mission global events yet.
                </div>
              ) : (
                globalEvents.map((g) => (
                  <div key={g.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{g.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {formatIsoDate(g.startDate)} · {g.location || 'Mission-wide'}
                      </div>
                    </div>
                    {capabilities.canManageGlobalEvents && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGlobal(g.id)}
                        className="p-1 text-red-600 dark:text-red-400 shrink-0"
                        aria-label="Delete global event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border-hairline)]">
              <h3 className="text-sm font-semibold">Your Personal / Local Events</h3>
            </div>
            <div className="divide-y divide-[var(--border-hairline)] max-h-72 overflow-y-auto">
              {localEvents.length === 0 ? (
                <div className="p-5 text-xs text-[var(--text-muted)] text-center">
                  No local events scheduled.
                </div>
              ) : (
                localEvents.map((ev) => (
                  <div key={ev.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{ev.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {formatIsoDate(ev.startDate)} · {ev.category}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteLocal(ev.id)}
                      className="p-1 text-red-600 dark:text-red-400 shrink-0"
                      aria-label="Delete local event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <h2 className="text-base font-display font-semibold">Schedule Calendar Event</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              {capabilities.canManageGlobalEvents && (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Visibility Scope
                  </label>
                  <select
                    value={eventScope}
                    onChange={(e) => setEventScope(e.target.value as 'local' | 'global')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  >
                    <option value="local">Personal / District Event</option>
                    <option value="global">Mission-Wide Global Event</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    maxLength={64}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    maxLength={160}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
                >
                  {saving ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
