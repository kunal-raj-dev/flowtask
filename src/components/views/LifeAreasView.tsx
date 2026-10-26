import React, { useState, useMemo, useContext } from 'react';
import type { Area } from '../../types/area';
import { areaIcon } from '../../utils/areaIcon';
import type { Goal } from '../../types/goal';
import type { Note } from '../../types/note';
import { useTaskContext } from '../../context/TaskContext';
import {
  WorkspaceStoreContext,
  useWorkspaceSelector,
} from '../../services/workspaceStore';
import {
  createArea,
  updateArea,
  archiveArea,
  deleteArea,
  seedDefaultAreasIfEmpty,
  createGoal,
} from '../../services/lifeOrganizationService';
import {
  Compass,
  Plus,
  Folder,
  CheckCircle2,
  ListTodo,
  ArrowLeft,
  Target,
  Edit2,
  Trash2,
  Archive,
  FileText,
  Clock,
} from 'lucide-react';
import { audioEngine } from '../../services/audioEngine';

export const DEFAULT_LIFE_AREAS: Area[] = [
  { id: 'area-career', name: 'Career & Work', icon: '💼', color: '#3B82F6', sortOrder: 1 },
  { id: 'area-health', name: 'Health & Vitality', icon: '🏃', color: '#10B981', sortOrder: 2 },
  { id: 'area-finance', name: 'Wealth & Finance', icon: '💰', color: '#F59E0B', sortOrder: 3 },
  { id: 'area-home', name: 'Home & Family', icon: '🏡', color: '#8B5CF6', sortOrder: 4 },
  { id: 'area-learning', name: 'Learning & Growth', icon: '🎨', color: '#EC4899', sortOrder: 5 },
];

export interface LifeAreasViewProps {
  onSelectProject?: (projectId: string) => void;
  onSelectTask?: (taskId: string) => void;
  onNavigateToGoals?: () => void;
}

export const LifeAreasView: React.FC<LifeAreasViewProps> = ({
  onSelectProject,
  onSelectTask,
  onNavigateToGoals: _onNavigateToGoals,
}) => {
  const { projects, tasks, addTask } = useTaskContext();
  const store = useContext(WorkspaceStoreContext);

  const workspaceAreas = useWorkspaceSelector((s) => s?.record?.areas);
  const workspaceGoals = useWorkspaceSelector((s) => s?.record?.goals);
  const workspaceNotes = useWorkspaceSelector((s) => s?.record?.notes);

  // Local fallback for unit test environments that do not provide WorkspaceStoreContext
  const [localAreas, setLocalAreas] = useState<Area[]>(() => (store ? [] : DEFAULT_LIFE_AREAS));

  const areas: Area[] = useMemo(() => {
    if (store) {
      return ((workspaceAreas as Area[]) || []).filter((a) => !a.archivedAt);
    }
    return localAreas.filter((a) => !a.archivedAt);
  }, [store, workspaceAreas, localAreas]);

  const goals: Goal[] = useMemo(() => {
    if (store && workspaceGoals) {
      return (workspaceGoals as Goal[]).filter((g) => !g.archivedAt);
    }
    return [];
  }, [store, workspaceGoals]);

  const notes: Note[] = useMemo(() => {
    if (store && workspaceNotes) {
      return (workspaceNotes as Note[]).filter((n) => !n.archivedAt && !n.deletedAt);
    }
    return [];
  }, [store, workspaceNotes]);

  // Selected Area for Detail View
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  // Create Area Form state
  const [isCreatingArea, setIsCreatingArea] = useState<boolean>(false);
  const [newAreaName, setNewAreaName] = useState<string>('');
  const [newAreaIcon, setNewAreaIcon] = useState<string>('⭐');
  const [newAreaColor, setNewAreaColor] = useState<string>('#3B82F6');
  const [newAreaDescription, setNewAreaDescription] = useState<string>('');
  const [newAreaTaskTitle, setNewAreaTaskTitle] = useState<string>('');

  // Edit Area Modal state
  const [editingArea, setEditingArea] = useState<Area | null>(null);

  // Create Goal inside Area Detail state
  const [isCreatingGoalForArea, setIsCreatingGoalForArea] = useState<boolean>(false);
  const [newGoalTitle, setNewGoalTitle] = useState<string>('');

  // Area metrics computation
  const areaMetrics = useMemo(() => {
    return areas.map((area) => {
      const connectedProjects = projects.filter(
        (p) => !p.isArchived && p.areaId === area.id
      );

      const projectIds = new Set(connectedProjects.map((p) => p.id));
      const areaTasks = tasks.filter(
        (t) => !t.deletedAt && !t.archivedAt && (projectIds.has(t.projectId) || (t as any).areaId === area.id)
      );

      const completedTasks = areaTasks.filter((t) => t.status === 'done');
      const progressPercent =
        areaTasks.length > 0 ? Math.round((completedTasks.length / areaTasks.length) * 100) : 0;

      const areaGoals = goals.filter((g) => g.areaId === area.id);

      return {
        area,
        projects: connectedProjects,
        goals: areaGoals,
        totalTasks: areaTasks.length,
        completedTasks: completedTasks.length,
        progressPercent,
      };
    });
  }, [areas, projects, tasks, goals]);

  const selectedAreaDetail = useMemo(() => {
    if (!selectedAreaId) return null;
    return areaMetrics.find((m) => m.area.id === selectedAreaId) || null;
  }, [selectedAreaId, areaMetrics]);

  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;

    if (store) {
      createArea(store, newAreaName.trim(), newAreaColor, newAreaIcon, newAreaDescription);
    } else {
      const created: Area = {
        id: `area-${Date.now()}`,
        name: newAreaName.trim(),
        icon: newAreaIcon,
        color: newAreaColor,
        description: newAreaDescription || undefined,
        sortOrder: areas.length + 1,
      };
      setLocalAreas((prev) => [...prev, created]);
    }

    setNewAreaName('');
    setNewAreaDescription('');
    setIsCreatingArea(false);
    audioEngine.playTaskComplete();
  };

  const handleUpdateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea || !editingArea.name.trim()) return;

    if (store) {
      updateArea(store, editingArea.id, {
        name: editingArea.name.trim(),
        icon: editingArea.icon,
        color: editingArea.color,
        description: editingArea.description,
      });
    } else {
      setLocalAreas((prev) =>
        prev.map((a) => (a.id === editingArea.id ? editingArea : a))
      );
    }

    setEditingArea(null);
    audioEngine.playTaskComplete();
  };

  const handleArchiveArea = (areaId: string) => {
    if (store) {
      archiveArea(store, areaId);
    } else {
      setLocalAreas((prev) => prev.filter((a) => a.id !== areaId));
    }
    if (selectedAreaId === areaId) setSelectedAreaId(null);
    audioEngine.playMagneticSnap();
  };

  const handleDeleteArea = (areaId: string) => {
    if (store) {
      deleteArea(store, areaId);
    } else {
      setLocalAreas((prev) => prev.filter((a) => a.id !== areaId));
    }
    if (selectedAreaId === areaId) setSelectedAreaId(null);
    audioEngine.playMagneticSnap();
  };

  const handleCreateGoalInArea = (e: React.FormEvent, areaId: string) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    if (store) {
      createGoal(store, newGoalTitle.trim(), { areaId });
    }
    setNewGoalTitle('');
    setIsCreatingGoalForArea(false);
    audioEngine.playTaskComplete();
  };

  // ----------------------------------------------------
  // AREA DETAIL VIEW (F12)
  // ----------------------------------------------------
  if (selectedAreaDetail) {
    const { area, projects: areaProjects, goals: areaGoals, totalTasks, completedTasks, progressPercent } = selectedAreaDetail;
    const projectIds = new Set(areaProjects.map((p) => p.id));
    const areaTasks = tasks.filter(
      (t) => !t.deletedAt && !t.archivedAt && (projectIds.has(t.projectId) || (t as any).areaId === area.id)
    );
    const areaNotes = notes.filter(
      (n) => (n as unknown as { areaId?: string }).areaId === area.id || (n.projectId && projectIds.has(n.projectId))
    );

    return (
      <div className="desk-view p-4 sm:p-6 max-w-5xl mx-auto space-y-6 animate-fadeIn" data-testid="area-detail-view">
        {/* Top Navigation */}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
          <button
            onClick={() => setSelectedAreaId(null)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition active:scale-95 min-h-[36px]"
            data-testid="back-to-areas-button"
          >
            <ArrowLeft size={14} />
            <span>Back to Life Areas</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditingArea(area)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-xs font-semibold hover:border-[var(--color-brand)] transition min-h-[36px]"
            >
              <Edit2 size={13} />
              <span>Edit Area</span>
            </button>
            <button
              onClick={() => handleArchiveArea(area.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition min-h-[36px]"
            >
              <Archive size={13} />
              <span>Archive</span>
            </button>
            <button
              onClick={() => handleDeleteArea(area.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-500/10 transition min-h-[36px]"
              aria-label="Delete Area"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Area Header Card */}
        <div className="p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{areaIcon(area.icon)}</span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">{area.name}</h1>
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: area.color || 'var(--color-brand)' }}
                  />
                </div>
                {area.description && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{area.description}</p>
                )}
              </div>
            </div>

            <div className="text-right">
              {totalTasks > 0 ? (
                <>
                  <span className="text-xs font-bold text-[var(--color-brand)]">{completedTasks} / {totalTasks} tasks completed</span>
                  <span className="block text-[11px] text-[var(--text-secondary)]">{progressPercent}% completion</span>
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold text-[var(--text-muted)]">0 tasks tracked</span>
                  <span className="block text-[11px] text-[var(--text-muted)]">No linked tasks</span>
                </>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[var(--border-color)]/30 h-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${totalTasks > 0 ? progressPercent : 0}%`,
                backgroundColor: area.color || 'var(--color-brand)',
              }}
            />
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-color)]/50">
              <span className="text-[11px] text-[var(--text-secondary)] block">Goals</span>
              <span className="font-bold text-sm">{areaGoals.length}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-color)]/50">
              <span className="text-[11px] text-[var(--text-secondary)] block">Projects</span>
              <span className="font-bold text-sm">{areaProjects.length}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-color)]/50">
              <span className="text-[11px] text-[var(--text-secondary)] block">Actionable Tasks</span>
              <span className="font-bold text-sm">{totalTasks - completedTasks}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-color)]/50">
              <span className="text-[11px] text-[var(--text-secondary)] block">Completed Tasks</span>
              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{completedTasks}</span>
            </div>
          </div>
        </div>

        {/* Section 1: Linked Goals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Target size={14} className="text-rose-500" />
              <span>Linked Objectives & Goals ({areaGoals.length})</span>
            </div>
            <button
              onClick={() => setIsCreatingGoalForArea((v) => !v)}
              className="text-xs font-semibold text-[var(--color-brand)] hover:underline flex items-center gap-1"
            >
              <Plus size={13} />
              <span>Add Goal</span>
            </button>
          </div>

          {isCreatingGoalForArea && (
            <form
              onSubmit={(e) => handleCreateGoalInArea(e, area.id)}
              className="p-3 rounded-xl border border-[var(--color-brand)] bg-[var(--bg-surface-l1)] flex gap-2"
            >
              <input
                type="text"
                placeholder="New goal title..."
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold"
              >
                Save
              </button>
            </form>
          )}

          {areaGoals.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic p-4 rounded-xl border border-[var(--border-color)]/50 bg-[var(--bg-surface-l1)]">
              No active goals linked to this area. Connect quarterly goals to anchor daily work.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {areaGoals.map((g) => (
                <div
                  key={g.id}
                  className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] flex items-start justify-between gap-3"
                >
                  <div>
                    <h2 className="text-xs font-bold">{g.title}</h2>
                    {g.targetQuarter && (
                      <span className="text-[10px] font-mono font-semibold text-[var(--text-secondary)]">
                        {g.targetQuarter}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    g.status === 'achieved'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-amber-500/10 text-amber-600'
                  }`}>
                    {g.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Connected Projects */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <Folder size={14} className="text-indigo-500" />
              <span>Connected Projects ({areaProjects.length})</span>
            </div>
          </div>

          {areaProjects.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic p-4 rounded-xl border border-[var(--border-color)]/50 bg-[var(--bg-surface-l1)]">
              No projects assigned to this area. Set an area on any project in Projects view.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {areaProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProject?.(p.id)}
                  className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] hover:border-[var(--color-brand)] text-left transition flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color || '#3B82F6' }} />
                    <span className="text-xs font-semibold truncate">{p.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Actionable Tasks */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            <ListTodo size={14} className="text-blue-500" />
            <span>Actionable Tasks ({areaTasks.filter((t) => t.status !== 'done').length})</span>
          </div>

          {areaTasks.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic p-4 rounded-xl border border-[var(--border-color)]/50 bg-[var(--bg-surface-l1)]">
              No tasks currently linked to this area or its projects.
            </p>
          ) : (
            <div className="space-y-2">
              {areaTasks.slice(0, 10).map((t) => {
                const isDone = t.status === 'done';
                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask?.(t.id)}
                    className="p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] hover:border-[var(--color-brand)] cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[var(--border-color)]'
                      }`}>
                        {isDone && <CheckCircle2 size={10} />}
                      </span>
                      <span className={`truncate ${isDone ? 'line-through text-[var(--text-muted)]' : 'font-medium'}`}>
                        {t.title}
                      </span>
                    </div>
                    {t.dueDate && (
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono flex items-center gap-1 flex-shrink-0">
                        <Clock size={10} />
                        <span>{t.dueDate}</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Add Task to Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newAreaTaskTitle.trim()) return;
              addTask(newAreaTaskTitle.trim(), { areaId: area.id });
              setNewAreaTaskTitle('');
              audioEngine.playTaskComplete();
            }}
            className="flex items-center gap-2 pt-1"
          >
            <input
              type="text"
              placeholder={`Add next action to ${area.name}...`}
              value={newAreaTaskTitle}
              onChange={(e) => setNewAreaTaskTitle(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] focus:outline-none focus:border-[var(--color-brand)] min-h-[36px]"
            />
            <button
              type="submit"
              disabled={!newAreaTaskTitle.trim()}
              className="px-3.5 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] disabled:opacity-50 transition min-h-[36px] flex items-center gap-1 shrink-0"
            >
              <Plus size={14} />
              <span>Add Task</span>
            </button>
          </form>
        </div>

        {/* Section 4: Associated Notes */}
        {areaNotes.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              <FileText size={14} className="text-amber-500" />
              <span>Area Notes ({areaNotes.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {areaNotes.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-xs space-y-1"
                >
                  <h2 className="font-bold truncate">{n.title || 'Untitled Note'}</h2>
                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">{n.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // LIFE AREAS MAIN GRID VIEW
  // ----------------------------------------------------
  return (
    <div className="desk-view p-4 sm:p-6 max-w-5xl mx-auto space-y-8 animate-fadeIn" data-testid="life-areas-view">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-brand)] uppercase tracking-wider">
            <Compass size={14} />
            <span>Make room for what matters</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Life Areas</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
            Group your projects and goals around work, health, home, and the things you care about.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingArea(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] shadow transition-transform active:scale-95 min-h-[44px]"
          data-testid="create-area-button"
        >
          <Plus size={15} />
          <span>New Life Area</span>
        </button>
      </div>

      {/* New Area Creation Form */}
      {isCreatingArea && (
        <form
          onSubmit={handleCreateArea}
          className="p-5 rounded-2xl border border-[var(--color-brand)] bg-[var(--bg-surface-l1)] space-y-4 animate-fadeIn"
          data-testid="new-area-form"
        >
          <h3 className="text-sm font-bold">Create New Life Area</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Area Name
              </label>
              <input
                type="text"
                placeholder="e.g. Creative Projects, Spirituality..."
                aria-label="Area name" required maxLength={100} value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Icon (Emoji)
              </label>
              <input
                type="text"
                aria-label="Area icon" value={newAreaIcon}
                onChange={(e) => setNewAreaIcon(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)] text-center"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Color
              </label>
              <input
                type="color"
                aria-label="Area color" value={newAreaColor}
                onChange={(e) => setNewAreaColor(e.target.value)}
                className="w-full h-[32px] p-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
              Description / Rationale
            </label>
            <input
              type="text"
              placeholder="What does flourishing look like in this area?"
              aria-label="Area description" value={newAreaDescription}
              onChange={(e) => setNewAreaDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingArea(false)}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] min-h-[44px]"
            >
              Save Area
            </button>
          </div>
        </form>
      )}

      {/* Edit Area Form */}
      {editingArea && (
        <form
          onSubmit={handleUpdateArea}
          className="p-5 rounded-2xl border border-[var(--color-brand)] bg-[var(--bg-surface-l1)] space-y-4 animate-fadeIn"
          data-testid="edit-area-form"
        >
          <h3 className="text-sm font-bold">Edit Life Area</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Area Name
              </label>
              <input
                type="text"
                aria-label="Area name" required maxLength={100} value={editingArea.name}
                onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Icon (Emoji)
              </label>
              <input
                type="text"
                aria-label="Area icon" value={areaIcon(editingArea.icon)}
                onChange={(e) => setEditingArea({ ...editingArea, icon: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)] text-center"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
              Description
            </label>
            <input
              type="text"
              aria-label="Area description" value={editingArea.description || ''}
              onChange={(e) => setEditingArea({ ...editingArea, description: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>
          <label className="block text-xs space-y-1">Area color
            <input aria-label="Area color" type="color" value={editingArea.color || '#6366f1'} onChange={e => setEditingArea({ ...editingArea, color: e.target.value })} className="block h-9 w-16 rounded-lg cursor-pointer" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingArea(null)}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] min-h-[44px]"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Calm Empty State */}
      {areas.length === 0 && !isCreatingArea && (
        <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface-l1)]/60 text-center max-w-lg mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center mx-auto">
            <Compass size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              No life areas defined yet
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
              Organize your projects, goals, and daily focus around meaningful life domains like Health, Career, or Personal Growth.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setIsCreatingArea(true)}
              className="px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] shadow transition min-h-[44px]"
              data-testid="add-first-area-button"
            >
              Add First Area
            </button>
            <button
              onClick={() => {
                if (store) {
                  seedDefaultAreasIfEmpty(store);
                } else {
                  setLocalAreas(DEFAULT_LIFE_AREAS);
                }
              }}
              className="px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition min-h-[44px]"
              data-testid="load-default-areas-button"
            >
              Load Recommended Domains
            </button>
          </div>
        </div>
      )}

      {/* Life Areas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {areaMetrics.map(({ area, projects: areaProjects, totalTasks, completedTasks, progressPercent }) => (
          <div
            key={area.id}
            className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] shadow-sm hover:shadow transition-all space-y-4 flex flex-col justify-between cursor-pointer group"
            data-testid={`area-card-${area.id}`}
            onClick={() => setSelectedAreaId(area.id)}
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-2xl">{areaIcon(area.icon)}</span>
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: area.color || 'var(--color-brand)' }}
                />
              </div>

              <h2 className="text-base font-bold tracking-tight mt-3 group-hover:text-[var(--color-brand)] transition-colors">
                <button type="button" aria-label={`Open ${area.name} area`} className="text-left">{area.name}</button>
              </h2>

              {area.description && (
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-1">{area.description}</p>
              )}

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                  <span>{totalTasks > 0 ? `${completedTasks} / ${totalTasks} tasks completed` : '0 tasks tracked'}</span>
                  <span>{totalTasks > 0 ? `${progressPercent}%` : '—'}</span>
                </div>
                <div className="w-full bg-[var(--border-color)]/30 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalTasks > 0 ? progressPercent : 0}%`,
                      backgroundColor: area.color || 'var(--color-brand)',
                    }}
                  />
                </div>
              </div>

              {/* Connected Projects */}
              <div className="mt-4 space-y-1.5">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider block">
                  Active Projects ({areaProjects.length})
                </span>
                {areaProjects.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-muted)] italic">
                    No active projects assigned.
                  </p>
                ) : (
                  areaProjects.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject?.(p.id);
                      }}
                      className="w-full flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-[var(--bg-surface-l2)] text-left truncate group min-h-[36px]"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Folder size={12} className="text-[var(--text-muted)] flex-shrink-0" />
                        <span className="truncate group-hover:text-[var(--color-brand)] font-medium">
                          {p.name}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Bottom Meta */}
            <div className="pt-3 border-t border-[var(--border-color)]/60 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
              <span className="flex items-center gap-1">
                <ListTodo size={12} />
                <span>{totalTasks} total tasks</span>
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 size={12} />
                <span>{completedTasks} done</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
