import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Project } from '../../types/task';
import { TaskCard } from '../tasks/TaskCard';
import { Omnibar } from '../tasks/Omnibar';
import { KanbanView } from './KanbanView';
import { EisenhowerView } from './EisenhowerView';
import {
  Folder,
  Plus,
  ArrowLeft,
  List,
  Kanban,
  Grid2X2,
  Trash2,
  Edit2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { SegmentedControl } from '../ui/SegmentedControl';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

interface ProjectsViewProps {
  selectedProjectId?: string | null;
  onSelectProject: (projectId: string | null) => void;
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  selectedProjectId,
  onSelectProject,
  onSelectTask,
  onStartFocus,
}) => {
  const {
    tasks,
    projects,
    addProject,
    updateProject,
    deleteProject,
  } = useTaskContext();

  const [presentation, setPresentation] = useState<'list' | 'board' | 'matrix'>('list');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#3B82F6');

  // Project editing modal / dialog state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Delete project with reassignment dialog state
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState('inbox');

  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);

  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#EF4444', // Red
    '#64748B', // Slate
  ];

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    addProject(newProjectName.trim(), newProjectColor);
    setNewProjectName('');
    setIsAddingProject(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;
    updateProject(editingProject.id, { name: editName.trim(), color: editColor });
    setEditingProject(null);
  };

  const handleConfirmDelete = () => {
    if (!deletingProject) return;
    deleteProject(deletingProject.id, reassignTargetId);
    setDeletingProject(null);
    if (selectedProjectId === deletingProject.id) {
      onSelectProject(null);
    }
  };

  // If a project is selected, render the Project Workspace
  if (selectedProjectId && currentProject) {
    const projectTasks = tasks.filter(
      (t) => t.projectId === selectedProjectId && !t.deletedAt && !t.archivedAt
    );
    const activeTasks = projectTasks.filter((t) => t.status !== 'done');
    const doneTasks = projectTasks.filter((t) => t.status === 'done');

    return (
      <div className="max-w-5xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
        {/* Workspace Top Horizon Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSelectProject(null)}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
              title="Back to Projects"
            >
              <ArrowLeft size={18} />
            </button>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold"
              style={{ backgroundColor: currentProject.color }}
            >
              <Folder size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Project Workspace
                </span>
                {currentProject.isArchived && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-200 dark:bg-stone-800 text-[var(--text-muted)]">
                    Archived
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                {currentProject.name}
              </h1>
            </div>
          </div>

          {/* Presentation Switcher: List | Board | Matrix */}
          <SegmentedControl<'list' | 'board' | 'matrix'>
            items={[
              { id: 'list', label: 'List', icon: <List size={14} /> },
              { id: 'board', label: 'Board', icon: <Kanban size={14} /> },
              { id: 'matrix', label: 'Matrix', icon: <Grid2X2 size={14} /> },
            ]}
            value={presentation}
            onChange={(p) => setPresentation(p)}
          />
        </div>

        {/* Presentation Body */}
        {presentation === 'board' ? (
          <KanbanView projectId={selectedProjectId} onSelectTask={onSelectTask} />
        ) : presentation === 'matrix' ? (
          <EisenhowerView projectId={selectedProjectId} onSelectTask={onSelectTask} />
        ) : (
          <div>
            {/* Quick Capture for this project */}
            <Omnibar />

            {/* Active Tasks in Project */}
            <div className="space-y-2 mb-6">
              {activeTasks.length === 0 ? (
                <EmptyState
                  title="No active tasks in this project"
                  description="Use the capture bar above to add tasks to this project."
                  icon={<Folder size={28} style={{ color: currentProject.color }} />}
                />
              ) : (
                activeTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelectTask={() => onSelectTask(task.id)}
                    onStartFocus={() => onStartFocus(task.id)}
                  />
                ))
              )}
            </div>

            {/* Collapsible Completed Section */}
            {doneTasks.length > 0 && (
              <div className="pt-4 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setIsCompletedCollapsed((prev) => !prev)}
                  className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-[var(--bg-surface-l1)] text-xs font-semibold text-[var(--text-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-500" />
                    <span>Completed ({doneTasks.length})</span>
                  </div>
                  {isCompletedCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                </button>

                {!isCompletedCollapsed && (
                  <div className="mt-2 space-y-2 opacity-80">
                    {doneTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onSelectTask={() => onSelectTask(task.id)}
                        onStartFocus={() => onStartFocus(task.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Otherwise, render the Project Directory / List
  return (
    <div className="max-w-5xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Folder size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Projects
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Manage work streams and dedicated workspaces
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setIsAddingProject(true)}
        >
          New Project
        </Button>
      </div>

      {/* Inline Create Project Form */}
      {isAddingProject && (
        <form
          onSubmit={handleCreateProject}
          className="mb-6 p-4 rounded-2xl bg-[var(--bg-surface-l1)] border border-blue-500/40 shadow-elevated animate-fade-in"
        >
          <h3 className="text-xs font-bold text-[var(--text-primary)] mb-3">Create New Project</h3>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project Name (e.g. 'Website Redesign', 'Research')"
              className="flex-1 w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              autoFocus
            />
            <div className="flex items-center gap-1.5 self-start sm:self-center">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewProjectColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    newProjectColor === c ? 'scale-125 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingProject(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={!newProjectName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {projects.map((project) => {
          const projectTasks = tasks.filter(
            (t) => t.projectId === project.id && !t.deletedAt && !t.archivedAt
          );
          const activeCount = projectTasks.filter((t) => t.status !== 'done').length;
          const doneCount = projectTasks.filter((t) => t.status === 'done').length;

          return (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="group p-4 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] hover:border-[var(--border-hairline)] shadow-subtle hover:shadow-card cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm"
                    style={{ backgroundColor: project.color }}
                  >
                    <Folder size={18} />
                  </div>
                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProject(project);
                        setEditName(project.name);
                        setEditColor(project.color);
                      }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06]"
                      title="Edit Project"
                    >
                      <Edit2 size={13} />
                    </button>
                    {!['inbox', 'work', 'personal'].includes(project.id) && (
                      <button
                        type="button"
                        onClick={() => setDeletingProject(project)}
                        className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06]"
                        title="Delete Project"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-blue-500 transition-colors">
                  {project.name}
                </h3>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                <span>{activeCount} active task{activeCount === 1 ? '' : 's'}</span>
                {doneCount > 0 && <span className="text-[var(--text-muted)]">{doneCount} done</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Project Dialog */}
      {editingProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setEditingProject(null)}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Edit Project</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1 block">
                    Color
                  </label>
                  <div className="flex items-center gap-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          editColor === c ? 'scale-125 ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingProject(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign & Delete Project Dialog */}
      {deletingProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setDeletingProject(null)}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-surface-l1)] border border-rose-500/30 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3 text-rose-500">
              <AlertTriangle size={22} />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Delete Project "{deletingProject.name}"
              </h3>
            </div>

            <p className="text-xs text-[var(--text-secondary)] mb-4">
              To prevent tasks from being orphaned, choose which project remaining tasks will be reassigned to:
            </p>

            <div className="mb-6">
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
                Reassign Tasks To:
              </label>
              <select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] focus:outline-none"
              >
                {projects
                  .filter((p) => p.id !== deletingProject.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeletingProject(null)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleConfirmDelete}>
                Delete & Reassign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
