import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useToast } from '../components/Toast';
import type { Appointment, TodoItem } from '../types';

export function AppointmentsTodosPage() {
  const { profile } = useAuth();
  const { notify } = useToast();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [apptTab, setApptTab] = useState<'upcoming' | 'past'>('upcoming');

  // Appointment Form
  const [apptTitle, setApptTitle] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [apptLocation, setApptLocation] = useState('');
  const [dateTime, setDateTime] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  );
  const [apptNotes, setApptNotes] = useState('');

  // Todo Form
  const [todoTitle, setTodoTitle] = useState('');
  const [todoPriority, setTodoPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [todoDueDate, setTodoDueDate] = useState('');

  useEffect(() => {
    if (!profile) return;
    const unsubs = [
      onSnapshot(
        query(
          collection(db, 'appointments'),
          where('userId', '==', profile.uid),
          orderBy('dateTime', 'asc'),
        ),
        (snap) => {
          setAppointments(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<Appointment, 'id'>),
            })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'appointments'),
      ),
      onSnapshot(
        query(
          collection(db, 'todos'),
          where('userId', '==', profile.uid),
        ),
        (snap) => {
          setTodos(
            snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<TodoItem, 'id'>),
            })),
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'todos'),
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [profile]);

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !apptTitle.trim() || !contactName.trim()) return;
    try {
      await addDoc(collection(db, 'appointments'), {
        userId: profile.uid,
        title: apptTitle.trim().slice(0, 160),
        contactName: contactName.trim().slice(0, 120),
        contactPhone: contactPhone.trim().slice(0, 40),
        location: apptLocation.trim().slice(0, 160),
        dateTime: dateTime.slice(0, 40),
        status: 'scheduled',
        notes: apptNotes.trim().slice(0, 1500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setApptTitle('');
      setContactName('');
      setContactPhone('');
      setApptLocation('');
      setApptNotes('');
      notify('Appointment scheduled.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    }
  };

  const handleApptStatus = async (
    id: string,
    status: 'scheduled' | 'completed' | 'cancelled',
  ) => {
    try {
      await updateDoc(doc(db, 'appointments', id), {
        status,
        updatedAt: serverTimestamp(),
      });
      notify(`Appointment marked ${status}.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${id}`);
    }
  };

  const handleDeleteAppt = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'appointments', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `appointments/${id}`);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !todoTitle.trim()) return;
    try {
      await addDoc(collection(db, 'todos'), {
        userId: profile.uid,
        title: todoTitle.trim().slice(0, 200),
        priority: todoPriority,
        ...(todoDueDate ? { dueDate: todoDueDate } : {}),
        completed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTodoTitle('');
      setTodoDueDate('');
      notify('To-do added.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'todos');
    }
  };

  const handleToggleTodo = async (todo: TodoItem) => {
    try {
      await updateDoc(doc(db, 'todos', todo.id), {
        completed: !todo.completed,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `todos/${todo.id}`);
    }
  };

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `todos/${id}`);
    }
  };

  const visibleAppointments = appointments.filter((a) =>
    apptTab === 'upcoming' ? a.status === 'scheduled' : a.status !== 'scheduled',
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left: Pastoral Appointments */}
      <section className="lg:col-span-7 space-y-5">
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-4">
          <h2 className="text-base font-display font-semibold">
            Schedule Pastoral Appointment
          </h2>
          <form onSubmit={handleAddAppointment} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Appointment subject *"
                maxLength={160}
                value={apptTitle}
                onChange={(e) => setApptTitle(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="text"
                required
                placeholder="Contact / Member name *"
                maxLength={120}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="tel"
                placeholder="Contact phone"
                maxLength={40}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="datetime-local"
                required
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Location"
                maxLength={160}
                value={apptLocation}
                onChange={(e) => setApptLocation(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="text"
                placeholder="Notes"
                maxLength={1500}
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Appointment</span>
              </button>
            </div>
          </form>
        </div>

        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--border-hairline)] flex items-center justify-between">
            <h3 className="text-sm font-semibold">Appointments</h3>
            <div className="inline-flex p-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)]">
              <button
                type="button"
                onClick={() => setApptTab('upcoming')}
                className={`px-3 py-1 text-xs rounded-md ${
                  apptTab === 'upcoming'
                    ? 'bg-[var(--bg-surface)] font-medium'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => setApptTab('past')}
                className={`px-3 py-1 text-xs rounded-md ${
                  apptTab === 'past'
                    ? 'bg-[var(--bg-surface)] font-medium'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Past / Closed
              </button>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-hairline)]">
            {visibleAppointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No {apptTab} appointments.
              </div>
            ) : (
              visibleAppointments.map((a) => (
                <div key={a.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {a.contactName}
                      {a.contactPhone ? ` · ${a.contactPhone}` : ''}
                      {a.location ? ` · ${a.location}` : ''}
                    </div>
                    <div className="text-xs font-mono-tabular text-[var(--text-muted)]">
                      {a.dateTime.replace('T', ' ')} · <span className="capitalize">{a.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {a.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => handleApptStatus(a.id, 'completed')}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteAppt(a.id)}
                      className="p-1.5 text-red-600 dark:text-red-400"
                      aria-label="Delete appointment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Right: Personal To-Do Tracker */}
      <section className="lg:col-span-5 space-y-5">
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-4">
          <h2 className="text-base font-display font-semibold">Pastoral To-Do List</h2>
          <form onSubmit={handleAddTodo} className="space-y-3">
            <input
              type="text"
              required
              placeholder="New task or follow-up..."
              maxLength={200}
              value={todoTitle}
              onChange={(e) => setTodoTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
            />
            <div className="flex items-center gap-2">
              <select
                value={todoPriority}
                onChange={(e) =>
                  setTodoPriority(e.target.value as 'low' | 'medium' | 'high')
                }
                className="px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              <input
                type="date"
                value={todoDueDate}
                onChange={(e) => setTodoDueDate(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
              >
                Add
              </button>
            </div>
          </form>
        </div>

        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] divide-y divide-[var(--border-hairline)]">
          {todos.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--text-muted)]">
              No to-do items yet.
            </div>
          ) : (
            todos.map((todo) => (
              <div
                key={todo.id}
                className="px-5 py-3.5 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  onClick={() => handleToggleTodo(todo)}
                  className="flex items-center gap-3 text-left min-w-0 flex-1"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      todo.completed
                        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-white'
                        : 'border-[var(--border-hairline)]'
                    }`}
                  >
                    {todo.completed && <Check className="w-3 h-3" />}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`text-sm truncate ${
                        todo.completed
                          ? 'line-through text-[var(--text-muted)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {todo.title}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] capitalize">
                      {todo.priority}
                      {todo.dueDate ? ` · Due ${todo.dueDate}` : ''}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTodo(todo.id)}
                  className="p-1 text-red-600 dark:text-red-400 shrink-0"
                  aria-label="Delete to-do"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
