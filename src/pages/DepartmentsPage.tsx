import React, { useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useToast } from '../components/Toast';
import type { Department } from '../types';

export function DepartmentsPage() {
  const { profile, capabilities } = useAuth();
  const { departments, missions, logAdminActivity } = useMission();
  const { notify } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [directorName, setDirectorName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [secondaryUrl, setSecondaryUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setDirectorName('');
    setResourceUrl('');
    setSecondaryUrl('');
    setDescription('');
    setModalOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setName(dept.name);
    setCode(dept.code || '');
    setDirectorName(dept.directorName || '');
    setResourceUrl(dept.resourceUrl || '');
    setSecondaryUrl(dept.secondaryUrl || '');
    setDescription(dept.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    setSaving(true);
    const missionId = profile.missionId || missions[0]?.id || 'sam_sabah';

    const payload = {
      missionId,
      name: name.trim().slice(0, 120),
      code: code.trim().slice(0, 32),
      directorName: directorName.trim().slice(0, 120),
      resourceUrl: resourceUrl.trim().slice(0, 500),
      secondaryUrl: secondaryUrl.trim().slice(0, 500),
      description: description.trim().slice(0, 600),
      isActive: true,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editing) {
        await updateDoc(doc(db, 'departments', editing.id), payload);
        await logAdminActivity('UPDATE_DEPARTMENT', 'departments', `Updated ${name}`, editing.id);
        notify('Department updated.', 'success');
      } else {
        const ref = await addDoc(collection(db, 'departments'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        await logAdminActivity('CREATE_DEPARTMENT', 'departments', `Created ${name}`, ref.id);
        notify('Department added.', 'success');
      }
      setModalOpen(false);
    } catch (err) {
      handleFirestoreError(
        err,
        editing ? OperationType.UPDATE : OperationType.CREATE,
        editing ? `departments/${editing.id}` : 'departments',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    try {
      await deleteDoc(doc(db, 'departments', dept.id));
      await logAdminActivity('DELETE_DEPARTMENT', 'departments', `Removed ${dept.name}`, dept.id);
      notify('Department removed.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `departments/${dept.id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Church ministry departments, leadership contacts, and official resource portals.
        </p>
        {capabilities.canManageDepartments && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white self-start"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Department</span>
          </button>
        )}
      </div>

      {departments.length === 0 ? (
        <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-10 text-center text-sm text-[var(--text-muted)]">
          No departments configured yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="text-xs text-[var(--text-muted)]">
                  {dept.code || 'DEPT'} · {dept.directorName || 'Mission Department'}
                </div>
                <h2 className="text-base font-display font-semibold">{dept.name}</h2>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {dept.description || 'Departmental resources and program guides.'}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {dept.resourceUrl && (
                    <a
                      href={dept.resourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline"
                    >
                      <span>Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {dept.secondaryUrl && (
                    <a
                      href={dept.secondaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] hover:underline"
                    >
                      <span>Guide</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {capabilities.canManageDepartments && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(dept)}
                      className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Edit
                    </button>
                    {capabilities.canManageHierarchy && (
                      <button
                        type="button"
                        onClick={() => handleDelete(dept)}
                        className="p-1 text-red-600 dark:text-red-400"
                        aria-label="Delete department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <h2 className="text-base font-display font-semibold">
                {editing ? 'Edit Department' : 'Add Department'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-[var(--text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-3.5">
              <input
                type="text"
                required
                placeholder="Department name *"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Code (e.g. SSPM)"
                  maxLength={32}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
                <input
                  type="text"
                  placeholder="Director name"
                  maxLength={120}
                  value={directorName}
                  onChange={(e) => setDirectorName(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <input
                type="url"
                placeholder="Primary Resource URL (https://...)"
                maxLength={500}
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <input
                type="url"
                placeholder="Secondary URL (optional)"
                maxLength={500}
                value={secondaryUrl}
                onChange={(e) => setSecondaryUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
              <textarea
                rows={3}
                placeholder="Description"
                maxLength={600}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
              />
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
                  {saving ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
