import { StatisticsCards } from '../components/StatisticsCards';
import { ReportPreview } from '../components/ReportPreview';
import type { PrintableReport } from '../lib/pdfReport';
import React, { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { ExternalLink, FileText, FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMission } from '../contexts/MissionContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useToast } from '../components/Toast';

export function ResourcesSettingsPage() {
  const { profile, capabilities } = useAuth();
  const { resources, missions, logAdminActivity } = useMission();
  const { notify } = useToast();

  // Library filters
  const [preview, setPreview] = useState<PrintableReport | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Resource creation (Admin/Editor)
  const [resTitle, setResTitle] = useState('');
  const [resCategory, setResCategory] = useState('Ministerial Manual');
  const [resUrl, setResUrl] = useState('');
  const [resDesc, setResDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const categories = useMemo(() => {
    const set = new Set<string>();
    resources.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [resources]);

  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      if (categoryFilter !== 'all' && res.category !== categoryFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          res.title.toLowerCase().includes(s) ||
          res.category.toLowerCase().includes(s) ||
          (res.description || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [resources, categoryFilter, search]);

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !resTitle.trim() || !resUrl.trim()) return;
    const missionId = profile.missionId || missions[0]?.id || 'sam_sabah';
    setSubmitting(true);
    try {
      const ref = await addDoc(collection(db, 'resources'), {
        missionId,
        title: resTitle.trim().slice(0, 160),
        category: resCategory.trim().slice(0, 64),
        description: resDesc.trim().slice(0, 1000),
        url: resUrl.trim().slice(0, 500),
        fileType: 'Link / PDF',
        isActive: true,
        uploadedBy: profile.uid,
        userId: profile.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminActivity('ADD_RESOURCE', 'resources', `Published resource ${resTitle}`, ref.id);
      setResTitle('');
      setResUrl('');
      setResDesc('');
      notify('Resource published.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'resources');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResource = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'resources', id));
      notify('Resource removed.', 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `resources/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <StatisticsCards items={[
        { label: 'Published Documents', value: resources.length, icon: 'activity', color: 'blue' },
        { label: 'Resource Categories', value: categories.length, icon: 'people', color: 'purple' },
        { label: 'Matching Library Items', value: filteredResources.length, icon: 'check', color: 'green' },
      ]} />
      <button className="no-print text-xs border border-[var(--border-hairline)] rounded-lg px-3 py-2" onClick={() => setPreview({
        title: 'Mission Resource Library', subtitle: `${filteredResources.length} matching documents`, filename: 'Mission_Resource_Library',
        sections: [{ title: 'Resource Directory', columns: ['Title', 'Category', 'URL'], rows: filteredResources.map(resource => [resource.title, resource.category, resource.url]) }],
      })}>Preview / Print Resource List</button>
      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Resource Library Browser */}
        <section className={`${capabilities.canManageResources ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search manuals, forms, or guidelines..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
            >
              <option value="all">All Categories ({resources.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[var(--accent-primary)]" />
                <h2 className="text-sm font-semibold">Mission Resource Library</h2>
              </div>
              <span className="text-xs font-mono-tabular text-[var(--text-muted)]">
                {filteredResources.length} items
              </span>
            </div>
            {filteredResources.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <FileText className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
                <div className="text-sm font-medium">No resources found</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {resources.length === 0
                    ? 'No shared mission manuals or templates have been published yet.'
                    : 'Adjust your category filter or search query.'}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {filteredResources.map((res) => (
                  <div
                    key={res.id}
                    className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-[var(--bg-subtle)]/40 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{res.title}</span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]">
                          {res.category}
                        </span>
                      </div>
                      {res.description && (
                        <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                          {res.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)] whitespace-nowrap shrink-0"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {capabilities.canManageHierarchy && (
                        <button
                          type="button"
                          onClick={() => handleDeleteResource(res.id)}
                          className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-[var(--bg-subtle)]"
                          aria-label="Delete resource"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: Publish Form (Editors / Admins) */}
        {capabilities.canManageResources && (
          <section className="lg:col-span-5 xl:col-span-4 border border-[var(--border-hairline)] rounded-xl bg-[var(--bg-surface)] p-5 space-y-4">
            <div>
              <h2 className="text-base font-display font-semibold">
                Publish Shared Resource
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Share manuals, Borang B templates, policies, and sermon guides with field pastors.
              </p>
            </div>
            <form onSubmit={handleAddResource} className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Minister's Handbook 2026"
                  maxLength={160}
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ministerial Manual"
                  maxLength={64}
                  value={resCategory}
                  onChange={(e) => setResCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Document or External URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  maxLength={500}
                  value={resUrl}
                  onChange={(e) => setResUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Summary (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief note explaining when pastors should use this resource..."
                  maxLength={1000}
                  value={resDesc}
                  onChange={(e) => setResDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)]"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--accent-primary)] text-white whitespace-nowrap shrink-0 disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Publishing...' : 'Publish Resource'}</span>
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
