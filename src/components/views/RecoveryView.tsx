import React, { useState, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import {
  Trash2,
  Archive,
  RotateCcw,
  Download,
  Search,
  X,
  Folder,
  Layers,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

interface RecoveryViewProps {
  mode: 'trash' | 'archive';
}

const priorityBadges: Record<string, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' },
  high: { label: 'High', className: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
  medium: { label: 'Medium', className: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20' },
  low: { label: 'Low', className: 'text-stone-500 bg-stone-500/10 border-stone-500/20' },
};

function formatDate(timestamp?: number): string | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export const RecoveryView: React.FC<RecoveryViewProps> = ({ mode }) => {
  const {
    tasks,
    projects,
    restoreTask,
    permanentDeleteTask,
    updateProject,
    downloadWorkspaceBackup,
    showToast,
  } = useTaskContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPurgeAllOpen, setIsPurgeAllOpen] = useState(false);

  // Filter tasks based on mode
  const rawItems = useMemo(() => {
    return tasks.filter((t) =>
      mode === 'trash' ? !!t.deletedAt : !!t.archivedAt && !t.deletedAt
    );
  }, [tasks, mode]);

  // Filter archived projects
  const archivedProjects = useMemo(() => {
    return mode === 'archive' ? projects.filter((p) => p.isArchived) : [];
  }, [projects, mode]);

  // Apply search query and project filter
  const filteredItems = useMemo(() => {
    return rawItems.filter((t) => {
      // 1. Project filter
      if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) {
        return false;
      }

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchTags = t.tags?.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchTags) return false;
      }

      return true;
    });
  }, [rawItems, selectedProjectId, searchQuery]);

  const taskToDelete = useMemo(() => {
    return pendingDeleteId ? rawItems.find((t) => t.id === pendingDeleteId) : null;
  }, [pendingDeleteId, rawItems]);

  const handleRestoreTask = (id: string, title: string) => {
    restoreTask(id);
    showToast(`Restored "${title}"`);
  };

  const handleRestoreAll = () => {
    if (filteredItems.length === 0) return;
    filteredItems.forEach((t) => restoreTask(t.id));
    showToast(`Restored ${filteredItems.length} task${filteredItems.length === 1 ? '' : 's'}`);
  };

  const handlePurgeAll = () => {
    rawItems.forEach((t) => permanentDeleteTask(t.id));
    setIsPurgeAllOpen(false);
    showToast('Trash emptied permanently');
  };

  const handlePermanentDeleteSingle = () => {
    if (pendingDeleteId) {
      permanentDeleteTask(pendingDeleteId);
      setPendingDeleteId(null);
      showToast('Task permanently deleted');
    }
  };

  const handleRestoreProject = (projectId: string, projectName: string) => {
    updateProject(projectId, { isArchived: false, archivedAt: undefined });
    showToast(`Restored project "${projectName}"`);
  };

  const isTrash = mode === 'trash';
  const totalCount = rawItems.length + (isTrash ? 0 : archivedProjects.length);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
        <div className="flex items-center gap-3.5">
          <div
            className={`p-2.5 rounded-xl border shadow-xs flex-shrink-0 ${
              isTrash
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                : 'bg-[var(--color-brand)]/10 text-[var(--color-brand)] border-[var(--color-brand)]/20'
            }`}
          >
            {isTrash ? <Trash2 size={24} className="stroke-[2.2]" /> : <Archive size={24} className="stroke-[2.2]" />}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              {isTrash ? 'Trash & Recovery' : 'Workspace Archive'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
              {isTrash
                ? `${rawItems.length} deleted task${rawItems.length === 1 ? '' : 's'} · Items can be restored or purged forever.`
                : `${rawItems.length} archived task${rawItems.length === 1 ? '' : 's'}${
                    archivedProjects.length > 0 ? `, ${archivedProjects.length} archived project${archivedProjects.length === 1 ? '' : 's'}` : ''
                  } preserved for reference.`}
            </p>
          </div>
        </div>

        {/* Global Banner Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download size={13} />}
            onClick={downloadWorkspaceBackup}
            title="Download complete JSON backup before purging"
          >
            Backup Workspace
          </Button>

          {rawItems.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw size={13} />}
              onClick={handleRestoreAll}
              title="Restore all displayed items"
            >
              Restore {searchQuery || selectedProjectId !== 'all' ? 'Filtered' : 'All'}
            </Button>
          )}

          {isTrash && rawItems.length > 0 && (
            <Button
              variant="destructive-subtle"
              size="sm"
              leftIcon={<Trash2 size={13} />}
              onClick={() => setIsPurgeAllOpen(true)}
              title="Permanently remove all tasks from trash"
            >
              Empty Trash
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)]">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isTrash ? 'Search deleted tasks...' : 'Search archived tasks...'}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded transition-colors"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Project Filter Select */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] bg-white dark:bg-[var(--bg-surface-l2)] text-xs text-[var(--text-secondary)]">
              <Folder size={13} className="text-[var(--text-muted)] shrink-0" />
              <select
                aria-label="Filter by project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-transparent text-xs text-[var(--text-primary)] font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Projects</option>
                <option value="inbox">Inbox</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || selectedProjectId !== 'all') && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProjectId('all');
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Archived Projects Section (Mode === 'archive') */}
      {!isTrash && archivedProjects.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={13} />
            Archived Projects ({archivedProjects.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {archivedProjects.map((project) => (
              <div
                key={project.id}
                className="p-4 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-xs card-surface flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: project.color || 'var(--color-brand)' }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {project.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Archived Project
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  leftIcon={<RotateCcw size={12} />}
                  onClick={() => handleRestoreProject(project.id, project.name)}
                  aria-label={`Restore project ${project.name}`}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks List Section */}
      <div className="space-y-3">
        {totalCount > 0 && filteredItems.length > 0 && (
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium px-1">
            <span>
              {isTrash ? 'Deleted Tasks' : 'Archived Tasks'} ({filteredItems.length})
            </span>
            {(searchQuery || selectedProjectId !== 'all') && (
              <span>
                Filtered from {rawItems.length} total
              </span>
            )}
          </div>
        )}

        {filteredItems.length > 0 ? (
          <ul className="space-y-2.5" role="list">
            {filteredItems.map((task) => {
              const project = projects.find((p) => p.id === task.projectId);
              const projectName = project?.name || (task.projectId === 'inbox' ? 'Inbox' : 'Workspace');
              const priorityInfo = task.priority ? priorityBadges[task.priority] : null;
              const dateTimestamp = isTrash ? task.deletedAt : task.archivedAt;
              const formattedDate = formatDate(dateTimestamp);

              return (
                <li
                  key={task.id}
                  className="group p-4 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] hover:border-stone-300 dark:hover:border-stone-700 shadow-xs card-surface transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Task details */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--text-primary)] break-words">
                        {task.title}
                      </span>
                      {priorityInfo && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${priorityInfo.className}`}
                        >
                          {priorityInfo.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] flex-wrap">
                      {/* Project badge */}
                      <span className="inline-flex items-center gap-1 font-medium">
                        <span
                          className="w-2 h-2 rounded-full inline-block shrink-0"
                          style={{ backgroundColor: project?.color || '#94a3b8' }}
                        />
                        {projectName}
                      </span>

                      {/* Timestamp */}
                      {formattedDate && (
                        <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                          <Calendar size={12} className="shrink-0" />
                          {isTrash ? 'Deleted' : 'Archived'} {formattedDate}
                        </span>
                      )}

                      {/* Subtasks count */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="text-[var(--text-muted)]">
                          {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<RotateCcw size={13} />}
                      onClick={() => handleRestoreTask(task.id, task.title)}
                      aria-label={`Restore task "${task.title}"`}
                    >
                      Restore
                    </Button>

                    {isTrash && (
                      <Button
                        variant="destructive-subtle"
                        size="sm"
                        leftIcon={<Trash2 size={13} />}
                        onClick={() => setPendingDeleteId(task.id)}
                        aria-label={`Permanently delete "${task.title}"`}
                      >
                        Delete forever
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : totalCount === 0 ? (
          /* Zero Total Items Empty State */
          <EmptyState
            icon={isTrash ? <Trash2 size={24} /> : <Archive size={24} />}
            title={isTrash ? 'Trash is empty' : 'Archive is empty'}
            description={
              isTrash
                ? 'No deleted tasks in this workspace. Deleted tasks remain here until permanently cleared.'
                : 'No archived tasks or projects. You can archive completed projects or tasks to keep views uncluttered.'
            }
          />
        ) : (
          /* Filtered Results Empty State */
          <EmptyState
            icon={<Search size={24} />}
            title="No matching items found"
            description={`No items match "${searchQuery || selectedProjectId}". Try adjusting your search query or project filter.`}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProjectId('all');
                }}
              >
                Clear all filters
              </Button>
            }
          />
        )}
      </div>

      {/* Dialog: Single Task Permanent Deletion */}
      <Dialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        title={
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle size={18} />
            <span>Permanently delete task?</span>
          </div>
        }
        description={
          taskToDelete
            ? `Are you sure you want to permanently delete "${taskToDelete.title}"? This cannot be undone.`
            : 'Are you sure you want to permanently delete this task? This cannot be undone.'
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<Trash2 size={13} />}
              onClick={handlePermanentDeleteSingle}
            >
              Delete forever
            </Button>
          </>
        }
      >
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          The task will be purged from your workspace storage and synced cloud devices. If you may need this information later, download a workspace backup first.
        </p>
      </Dialog>

      {/* Dialog: Empty All Trash Confirmation */}
      <Dialog
        isOpen={isPurgeAllOpen}
        onClose={() => setIsPurgeAllOpen(false)}
        title={
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle size={18} />
            <span>Empty entire trash?</span>
          </div>
        }
        description={`This will permanently remove all ${rawItems.length} task${
          rawItems.length === 1 ? '' : 's'
        } from the trash. This action is irreversible.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsPurgeAllOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<Trash2 size={13} />}
              onClick={handlePurgeAll}
            >
              Empty Trash Forever
            </Button>
          </>
        }
      >
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          All deleted items will be purged immediately across all synced devices.
        </p>
      </Dialog>
    </div>
  );
};
