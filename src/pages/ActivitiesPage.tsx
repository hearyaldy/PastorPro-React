import React, { useEffect, useMemo, useState } from 'react';
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
import { Download, Edit3, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  exportToCsv,
  exportToExcel,
  formatIsoDate,
  triggerPrintPdf,
} from '../lib/exportUtils';
import { useToast } from '../components/Toast';
import type { ActivityCategory, PastoralActivity } from '../types';

const CATEGORIES: { value: ActivityCategory; label: string }[] = [
  { value: 'visitation', label: 'Home / Hospital Visitation' },
  { value: 'evangelism', label: 'Evangelism & Bible Studies' },
  { value: 'worship', label: 'Worship & Preaching' },
  { value: 'counseling', label: 'Pastoral Counseling' },
  { value: 'meeting', label: 'Church Board / Committee' },
  { value: 'training', label: 'Leadership Training' },
  { value: 'administration', label: 'District Administration' },
];

export function ActivitiesPage() {
  const { profile } = useAuth();
  const { churches } = useMission();
  const { notify } = useToast();

  const [activities, setActivities] = useState<PastoralActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('visitation');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [participants, setParticipants] = useState(2);
  const [churchId, setChurchId] = useState(profile?.churchId || '');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const q = query(
      collection(db, 'activities'),
      where('userId', '==', profile.uid),
      orderBy('date', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setActivities(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PastoralActivity, 'id'>),
          })),
        );
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'activities');
      },
    );
    return () => unsub();
  }, [profile]);

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        return (
          a.title.toLowerCase().includes(s) ||
          (a.churchName || '').toLowerCase().includes(s) ||
          (a.location || '').toLowerCase().includes(s) ||
          (a.notes || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [activities, categoryFilter, searchTerm]);

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setCategory('visitation');
    setDate(new Date().toISOString().slice(0, 10));
    setDurationMinutes(60);
    setParticipants(2);
    setChurchId(profile?.churchId || '');
    setLocation('');
    setNotes('');
    setModalOpen(true);
  };

  const openEdit = (act: PastoralActivity) => {
    setEditingId(act.id);
    setTitle(act.title);
    setCategory(act.category);
    setDate(act.date);
    setDurationMinutes(act.durationMinutes);
    setParticipants(act.participants ?? 1);
    setChurchId(act.churchId || '');
    setLocation(act.location || '');
    setNotes(act.notes || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !title.trim()) return;
    setSaving(true);
    const selectedChurch = churches.find((c) => c.id === churchId);
    const missionId = profile.missionId || selectedChurch?.missionId || 'sam_sabah';

    const payload = {
      userId: profile.uid,
      missionId,
      ...(profile.districtId ? { districtId: profile.districtId } : {}),
      ...(selectedChurch ? { churchId: selectedChurch.id, churchName: selectedChurch.name } : {}),
      title: title.trim().slice(0, 160),
      category,
      date: date.slice(0, 32),
      durationMinutes: Math.max(0, Math.min(10080, Number(durationMinutes) || 0)),
      participants: Math.max(0, Math.min(50000, Number(participants) || 0)),
      location: location.trim().slice(0, 160),
      notes: notes.trim().slice(0, 2000),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'activities', editingId), payload);
        notify('Pastoral activity updated.', 'success');
      } else {
        await addDoc(collection(db, 'activities'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        notify('Pastoral activity logged.', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      handleFirestoreError(
        err,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        editingId ? `activities/${editingId}` : 'activities',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'activities', id));
      notify('Activity removed.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `activities/${id}`);
    }
  };

  const handleExport = (type: 'csv' | 'xlsx') => {
    const rows = filtered.map((a) => ({
      Date: a.date,
      Title: a.title,
      Category: a.category,
      Church: a.churchName || '',
      Location: a.location || '',
      DurationMinutes: a.durationMinutes,
      Participants: a.participants ?? 0,
      Notes: a.notes || '',
    }));
    if (type === 'csv') {
      exportToCsv(`pastoral_activities_${new Date().toISOString().slice(0, 10)}`, rows);
    } else {
      exportToExcel(`pastoral_activities_${new Date().toISOString().slice(0, 10)}`, [
        { name: 'Pastoral Activities', rows },
      ]);
    }
    notify(`Exported ${rows.length} activities.`, 'success');
  };

  const totalMinutes = filtered.reduce((acc, a) => acc + (a.durationMinutes || 0), 0);
  const totalParticipants = filtered.reduce((acc, a) => acc + (a.participants || 0), 0);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title, church, or notes..."
              className="pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] w-64 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={triggerPrintPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print PDF</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Activity</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] divide-x divide-[var(--border-hairline)]">
        <div className="px-5 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">Matching Entries</div>
          <div className="text-lg font-mono-tabular font-semibold mt-0.5">
            {filtered.length}
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">Total Ministry Time</div>
          <div className="text-lg font-mono-tabular font-semibold mt-0.5">
            {(totalMinutes / 60).toFixed(1)} hrs
          </div>
        </div>
        <div className="px-5 py-3.5">
          <div className="text-xs text-[var(--text-muted)]">People Reached</div>
          <div className="text-lg font-mono-tabular font-semibold mt-0.5">
            {totalParticipants.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Hairline Table */}
      <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden print-sheet">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 rounded bg-[var(--bg-subtle)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="text-sm font-medium">No activities match your current filter</div>
            <p className="text-xs text-[var(--text-secondary)]">
              Log pastoral visits, evangelism contacts, or board meetings to build your monthly record.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white"
            >
              Log Activity
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Title & Notes</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Church / Location</th>
                  <th className="py-3 px-4 font-medium text-right">Duration</th>
                  <th className="py-3 px-4 font-medium text-right">Reach</th>
                  <th className="py-3 px-4 font-medium text-right no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {filtered.map((act) => (
                  <tr
                    key={act.id}
                    className="hover:bg-[var(--bg-subtle)]/60 transition-colors"
                  >
                    <td className="py-3 px-4 text-xs font-mono-tabular whitespace-nowrap text-[var(--text-secondary)]">
                      {formatIsoDate(act.date)}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-[var(--text-primary)]">{act.title}</div>
                      {act.notes && (
                        <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                          {act.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-secondary)] capitalize whitespace-nowrap">
                      {act.category}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                      {act.churchName || act.location || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-tabular text-right whitespace-nowrap">
                      {act.durationMinutes} min
                    </td>
                    <td className="py-3 px-4 text-xs font-mono-tabular text-right whitespace-nowrap">
                      {act.participants ?? 0}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap no-print">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(act)}
                          className="p-1.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                          aria-label="Edit activity"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(act.id)}
                          className="p-1.5 rounded hover:bg-[var(--bg-subtle)] text-red-600 dark:text-red-400"
                          aria-label="Delete activity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 no-print">
          <div className="max-w-lg w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <h2 className="text-base font-display font-semibold">
                {editingId ? 'Edit Pastoral Activity' : 'Log Pastoral Activity'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Activity Title *
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sabbath Visitation at Kg. Kiulu"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10080}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Participants / Reached
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50000}
                    value={participants}
                    onChange={(e) => setParticipants(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] font-mono-tabular"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Church (Optional)
                  </label>
                  <select
                    value={churchId}
                    onChange={(e) => setChurchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  >
                    <option value="">General / District-wide</option>
                    {churches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
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
                    placeholder="e.g. Hospital Queen Elizabeth"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Field Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Prayer requests, follow-ups, or outcomes..."
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
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Save Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
