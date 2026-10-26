import React, { useState, useMemo, useContext } from 'react';
import type { Goal, GoalStatus } from '../../types/goal';
import type { Area } from '../../types/area';
import { areaIcon } from '../../utils/areaIcon';
import { useTaskContext } from '../../context/TaskContext';
import {
  WorkspaceStoreContext,
  useWorkspaceSelector,
} from '../../services/workspaceStore';
import {
  createGoal,
  updateGoal,
  updateGoalStatus,
  deleteGoal,
} from '../../services/lifeOrganizationService';
import {
  Target,
  Plus,
  CheckCircle2,
  Folder,
  Sparkles,
  Edit2,
  Trash2,
} from 'lucide-react';
import { audioEngine } from '../../services/audioEngine';

export const STARTER_GOALS: Goal[] = [
  {
    id: 'goal-1',
    title: 'Publish Product 2.0 Workstation Release',
    description: 'Deliver the full 10-module upgrade with sub-30ms performance and zero regression.',
    targetQuarter: '2026-Q4',
    status: 'in_progress',
    projectIds: ['work', 'inbox'],
  },
  {
    id: 'goal-2',
    title: 'Achieve Sub-25m 5k Aerobic Baseline',
    description: '3 zone-2 training sessions per week and weekly recovery reviews.',
    targetQuarter: '2026-Q4',
    status: 'active',
    projectIds: ['personal'],
  },
  {
    id: 'goal-3',
    title: 'Consolidate Whole-Life Admin & Financial Backlogs',
    description: 'Tax filings, vehicle registrations, and automated contingency buffers.',
    targetQuarter: '2027-Q1',
    status: 'not_started',
    projectIds: ['personal'],
  },
];

function getDynamicQuarters(): string[] {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const currentQ = Math.floor(month / 3) + 1;

  const quarters: string[] = [];
  let y = year;
  let q = currentQ;

  for (let i = 0; i < 4; i++) {
    quarters.push(`${y}-Q${q}`);
    q++;
    if (q > 4) {
      q = 1;
      y++;
    }
  }

  return quarters;
}

export interface GoalsViewProps {
  onSelectProject?: (projectId: string) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ onSelectProject }) => {
  const { projects, tasks, addTask } = useTaskContext();
  const store = useContext(WorkspaceStoreContext);

  const workspaceGoals = useWorkspaceSelector((s) => s?.record?.goals);
  const workspaceAreas = useWorkspaceSelector((s) => s?.record?.areas);

  // Fallback for tests running outside WorkspaceStoreContext
  const [localGoals, setLocalGoals] = useState<Goal[]>(() => (store ? [] : STARTER_GOALS));

  const goals: Goal[] = useMemo(() => {
    if (store) {
      return ((workspaceGoals as Goal[]) || []).filter((g) => !g.archivedAt);
    }
    return localGoals.filter((g) => !g.archivedAt);
  }, [store, workspaceGoals, localGoals]);

  const areas: Area[] = useMemo(() => {
    if (store && workspaceAreas) {
      return (workspaceAreas as Area[]).filter((a) => !a.archivedAt);
    }
    return [];
  }, [store, workspaceAreas]);

  const goalMetrics = useMemo(() => {
    const map: Record<string, { totalTasks: number; completedTasks: number; progressPercent: number }> = {};
    goals.forEach((g) => {
      const projectSet = new Set(g.projectIds || []);
      const linked = (tasks || []).filter(
        (t) => !t.deletedAt && !t.archivedAt && (t.goalId === g.id || (t.projectId && projectSet.has(t.projectId)))
      );
      const done = linked.filter((t) => t.status === 'done');
      map[g.id] = {
        totalTasks: linked.length,
        completedTasks: done.length,
        progressPercent: linked.length > 0 ? Math.round((done.length / linked.length) * 100) : 0,
      };
    });
    return map;
  }, [goals, tasks]);

  const dynamicQuarters = useMemo(() => {
    const quarters = getDynamicQuarters();
    // Add any quarter present on existing goals
    goals.forEach((g) => {
      if (g.targetQuarter && !quarters.includes(g.targetQuarter)) {
        quarters.push(g.targetQuarter);
      }
    });
    return quarters;
  }, [goals]);

  const [activeQuarterFilter, setActiveQuarterFilter] = useState<string>('all');
  const [isCreatingGoal, setIsCreatingGoal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newQuarter, setNewQuarter] = useState<string>(() => getDynamicQuarters()[0]);
  const [newDescription, setNewDescription] = useState<string>('');
  const [newAreaId, setNewAreaId] = useState<string>('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [newTargetDate, setNewTargetDate] = useState<string>('');
  const [newGoalTaskTitles, setNewGoalTaskTitles] = useState<Record<string, string>>({});

  // Editing state
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  const filteredGoals = useMemo(() => {
    if (activeQuarterFilter === 'all') return goals;
    return goals.filter((g) => g.targetQuarter === activeQuarterFilter);
  }, [goals, activeQuarterFilter]);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    if (store) {
      createGoal(store, newTitle.trim(), {
        description: newDescription.trim() || undefined,
        targetQuarter: newQuarter,
        targetDate: newTargetDate || undefined,
        areaId: newAreaId || undefined,
        projectIds: selectedProjectIds,
        status: 'in_progress',
      });
    } else {
      const created: Goal = {
        id: `goal-${Date.now()}`,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        targetQuarter: newQuarter,
        targetDate: newTargetDate || undefined,
        areaId: newAreaId || undefined,
        projectIds: selectedProjectIds,
        status: 'in_progress',
      };
      setLocalGoals((prev) => [created, ...prev]);
    }

    setNewTitle('');
    setNewDescription('');
    setNewTargetDate('');
    setNewAreaId('');
    setSelectedProjectIds([]);
    setIsCreatingGoal(false);
    setActiveQuarterFilter('all');
    audioEngine.playTaskComplete();
  };

  const handleUpdateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !editingGoal.title.trim()) return;

    if (store) {
      updateGoal(store, editingGoal.id, {
        title: editingGoal.title.trim(),
        description: editingGoal.description,
        targetQuarter: editingGoal.targetQuarter,
        targetDate: editingGoal.targetDate,
        areaId: editingGoal.areaId,
        projectIds: editingGoal.projectIds,
        status: editingGoal.status,
      });
    } else {
      setLocalGoals((prev) =>
        prev.map((g) => (g.id === editingGoal.id ? editingGoal : g))
      );
    }

    setEditingGoal(null);
    audioEngine.playTaskComplete();
  };

  const toggleGoalStatus = (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const nextStatus: GoalStatus = goal.status === 'achieved' ? 'in_progress' : 'achieved';
    if (nextStatus === 'achieved') audioEngine.playTaskComplete();
    else audioEngine.playMagneticSnap();

    if (store) {
      updateGoalStatus(store, goalId, nextStatus);
    } else {
      setLocalGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, status: nextStatus } : g))
      );
    }
  };

  const handleDeleteGoal = (goalId: string) => {
    if (store) {
      deleteGoal(store, goalId);
    } else {
      setLocalGoals((prev) => prev.filter((g) => g.id !== goalId));
    }
    setEditingGoal(null);
    audioEngine.playMagneticSnap();
  };

  const handleLoadStarters = () => {
    if (store) {
      STARTER_GOALS.forEach((g) => {
        createGoal(store, g.title, {
          description: g.description,
          targetQuarter: g.targetQuarter,
          status: g.status,
          projectIds: g.projectIds,
        });
      });
      audioEngine.playTaskComplete();
    } else {
      setLocalGoals(STARTER_GOALS);
      audioEngine.playTaskComplete();
    }
  };

  return (
    <div className="desk-view p-4 sm:p-6 max-w-5xl mx-auto space-y-8 animate-fadeIn" data-testid="goals-view">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-brand)] uppercase tracking-wider">
            <Target size={14} />
            <span>Make room for what matters</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Vision & Quarterly Goals</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
            Choose an outcome, connect your projects, and take one step at a time.
          </p>
        </div>

        <button
          onClick={() => { setEditingGoal(null); setIsCreatingGoal(true); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] shadow transition-transform active:scale-95 min-h-[44px]"
          data-testid="create-goal-button"
        >
          <Plus size={15} />
          <span>New Goal</span>
        </button>
      </div>

      {/* Quarter Filters */}
      <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
        <button
          onClick={() => setActiveQuarterFilter('all')}
          aria-pressed={activeQuarterFilter === 'all'}
          className={`px-3 py-1.5 rounded-lg border font-medium min-h-[38px] flex-shrink-0 ${
            activeQuarterFilter === 'all'
              ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
              : 'border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          All Quarters
        </button>
        {dynamicQuarters.map((q) => (
          <button
            key={q}
            onClick={() => setActiveQuarterFilter(q)}
            aria-pressed={activeQuarterFilter === q}
            className={`px-3 py-1.5 rounded-lg border font-medium min-h-[38px] flex-shrink-0 ${
              activeQuarterFilter === q
                ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                : 'border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {q}
          </button>
        ))}
      </div>

      {/* New Goal Form */}
      {isCreatingGoal && (
        <form
          onSubmit={handleCreateGoal}
          className="p-5 rounded-2xl border border-[var(--color-brand)] bg-[var(--bg-surface-l1)] space-y-4 animate-fadeIn"
          data-testid="new-goal-form"
        >
          <h3 className="text-sm font-bold">New goal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Goal Title
              </label>
              <input
                type="text"
                aria-label="Goal title"
                required
                maxLength={200}
                placeholder="What significant outcome will you achieve?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Target Quarter
              </label>
              <select
                aria-label="Target quarter"
                value={newQuarter}
                onChange={(e) => setNewQuarter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
              >
                {dynamicQuarters.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Target Date (Optional)
              </label>
              <input
                type="date"
                aria-label="Target date"
                value={newTargetDate}
                onChange={(e) => setNewTargetDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
              />
            </div>
            {areas.length > 0 && (
              <div>
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                  Life Area
                </label>
                <select
                  aria-label="Life area"
                  value={newAreaId}
                  onChange={(e) => setNewAreaId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
                >
                  <option value="">No Life Area</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {areaIcon(a.icon)} {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
              Rationale & Description
            </label>
            <input
              type="text"
              aria-label="Goal description"
              placeholder="Why does this matter? Key measurable results..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>

          <GoalProjects projects={projects} selected={selectedProjectIds} onChange={setSelectedProjectIds} />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingGoal(false)}
              className="px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] min-h-[44px]"
            >
              Save Goal
            </button>
          </div>
        </form>
      )}

      {/* Edit Goal Form */}
      {editingGoal && (
        <form
          onSubmit={handleUpdateGoal}
          className="p-5 rounded-2xl border border-[var(--color-brand)] bg-[var(--bg-surface-l1)] space-y-4 animate-fadeIn"
          data-testid="edit-goal-form"
        >
          <h3 className="text-sm font-bold">Edit goal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Goal Title
              </label>
              <input
                type="text"
                aria-label="Goal title"
                required
                maxLength={200}
                value={editingGoal.title}
                onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Target Quarter
              </label>
              <select
                aria-label="Target quarter"
                value={editingGoal.targetQuarter || ''}
                onChange={(e) => setEditingGoal({ ...editingGoal, targetQuarter: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
              >
                <option value="">No quarter</option>
                {dynamicQuarters.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs space-y-1">Target date
              <input aria-label="Target date" type="date" value={editingGoal.targetDate || ''} onChange={e => setEditingGoal({ ...editingGoal, targetDate: e.target.value || undefined })} className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)]" />
            </label>
            <label className="text-xs space-y-1">Life area
              <select aria-label="Life area" value={editingGoal.areaId || ''} onChange={e => setEditingGoal({ ...editingGoal, areaId: e.target.value || undefined })} className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)]">
                <option value="">No life area</option>
                {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
          </div>
          <GoalProjects projects={projects} selected={editingGoal.projectIds || []} onChange={projectIds => setEditingGoal({ ...editingGoal, projectIds })} />
          <label className="block text-xs space-y-1">Status
            <select aria-label="Goal status" value={editingGoal.status} onChange={e => setEditingGoal({ ...editingGoal, status: e.target.value as GoalStatus })} className="block w-full px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)]">
              <option value="not_started">Not started</option><option value="active">Active</option><option value="in_progress">In progress</option><option value="paused">Paused</option><option value="deferred">Deferred</option><option value="achieved">Achieved</option>
            </select>
          </label>

          <div>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
              Description
            </label>
            <input
              type="text"
              aria-label="Goal description"
              value={editingGoal.description || ''}
              onChange={(e) => setEditingGoal({ ...editingGoal, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => handleDeleteGoal(editingGoal.id)}
              className="px-3 py-2 text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 min-h-[44px]"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="px-3 py-2 text-xs text-[var(--text-secondary)] min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold min-h-[44px]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Empty State */}
      {filteredGoals.length === 0 && !isCreatingGoal && !editingGoal && (
        <div className="p-8 text-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface-l1)] space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center mx-auto">
            <Target size={24} />
          </div>
          <div>
            <h2 className="text-base font-bold">
              {goals.length === 0 ? 'No quarterly goals defined yet' : 'No Goals Found'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              {goals.length === 0
                ? 'Define measurable quarterly milestones to give your daily tasks clarity and purpose.'
                : 'No goals match the selected quarter filter.'}
            </p>
          </div>
          {activeQuarterFilter !== 'all' && (
            <button type="button" className="desk-button" onClick={() => setActiveQuarterFilter('all')}>
              Show all goals
            </button>
          )}
          {goals.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsCreatingGoal(true)}
                className="px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] shadow transition min-h-[44px]"
                data-testid="create-first-goal-button"
              >
                Create First Goal
              </button>
              <button
                onClick={handleLoadStarters}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] text-xs font-semibold hover:border-[var(--color-brand)] transition min-h-[44px]"
                data-testid="load-starter-goals-button"
              >
                <Sparkles size={14} className="text-[var(--color-brand)]" />
                <span>Load Starter Templates</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.map((goal) => {
          const isAchieved = goal.status === 'achieved';
          const connectedProjectsList = projects.filter((p) =>
            (goal.projectIds || []).includes(p.id)
          );
          const goalArea = areas.find((a) => a.id === goal.areaId);
          const metric = goalMetrics[goal.id] || { totalTasks: 0, completedTasks: 0, progressPercent: 0 };

          return (
            <div
              key={goal.id}
              className={`p-4 sm:p-5 rounded-2xl border bg-[var(--bg-surface-l1)] shadow-sm transition-all ${
                isAchieved
                  ? 'border-emerald-500/30 opacity-80'
                  : 'border-[var(--border-color)] hover:border-[var(--color-brand)]'
              }`}
              data-testid={`goal-card-${goal.id}`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => toggleGoalStatus(goal.id)}
                    className={`mt-0.5 w-7 h-7 min-w-[28px] min-h-[28px] rounded-lg border flex items-center justify-center transition-colors flex-shrink-0 ${
                      isAchieved
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-[var(--border-color)] hover:border-[var(--color-brand)]'
                    }`}
                    title={isAchieved ? 'Mark In Progress' : 'Mark Achieved'}
                    aria-label={isAchieved ? 'Mark In Progress' : 'Mark Achieved'}
                  >
                    {isAchieved && <CheckCircle2 size={16} />}
                  </button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={`text-base font-bold break-words ${
                          isAchieved ? 'line-through text-[var(--text-secondary)]' : ''
                        }`}
                      >
                        {goal.title}
                      </h2>
                      {goal.targetQuarter && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--bg-surface-l2)] border border-[var(--border-color)] text-[var(--text-secondary)] flex-shrink-0">
                          {goal.targetQuarter}
                        </span>
                      )}
                      {goalArea && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--bg-surface-l2)] border border-[var(--border-color)] text-[var(--text-secondary)] flex items-center gap-1 flex-shrink-0">
                          <span>{areaIcon(goalArea.icon)}</span>
                          <span>{goalArea.name}</span>
                        </span>
                      )}
                    </div>
                    {goal.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1 break-words">
                        {goal.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      isAchieved
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {({ achieved: 'Achieved', in_progress: 'In Progress', active: 'Active', not_started: 'Not Started', paused: 'Paused', deferred: 'Deferred' })[goal.status]}
                  </span>
                  <button
                    onClick={() => { setIsCreatingGoal(false); setEditingGoal(goal); }}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)]"
                    title="Edit Goal"
                    aria-label="Edit Goal"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>

              {/* Progress bar / denominator */}
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                  <span>{metric.totalTasks > 0 ? `${metric.completedTasks} / ${metric.totalTasks} tasks completed` : '0 tasks tracked'}</span>
                  <span>{metric.totalTasks > 0 ? `${metric.progressPercent}%` : '—'}</span>
                </div>
                <div className="w-full bg-[var(--border-color)]/30 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${metric.totalTasks > 0 ? metric.progressPercent : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Quick Add Next Action for Goal */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const title = newGoalTaskTitles[goal.id]?.trim();
                  if (!title) return;
                  addTask(title, {
                    goalId: goal.id,
                    areaId: goal.areaId,
                    projectId: goal.projectIds?.[0] || 'inbox',
                  });
                  setNewGoalTaskTitles((prev) => ({ ...prev, [goal.id]: '' }));
                  audioEngine.playTaskComplete();
                }}
                className="mt-3 flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Add next action for this goal..."
                  value={newGoalTaskTitles[goal.id] || ''}
                  onChange={(e) => setNewGoalTaskTitles((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)] min-h-[36px]"
                />
                <button
                  type="submit"
                  disabled={!newGoalTaskTitles[goal.id]?.trim()}
                  className="px-3 py-1.5 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] disabled:opacity-50 transition min-h-[36px] flex items-center gap-1 shrink-0"
                >
                  <Plus size={13} />
                  <span>Add</span>
                </button>
              </form>

              {/* Connected Projects cascade */}
              {connectedProjectsList.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[var(--border-color)]/60 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Connected Projects:
                  </span>
                  {connectedProjectsList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelectProject?.(p.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[var(--bg-surface-l2)] border border-[var(--border-color)] hover:border-[var(--color-brand)] font-medium min-h-[32px]"
                    >
                      <Folder size={11} className="text-[var(--text-muted)]" />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function GoalProjects({ projects, selected, onChange }: { projects: import('../../types/task').Project[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const available = projects.filter(project => (project.id !== 'inbox' || selected.includes(project.id)) && (!project.isArchived || selected.includes(project.id)));
  if (!available.length) return null;
  return <fieldset className="space-y-2"><legend className="text-xs font-semibold">Connected projects</legend><div className="flex flex-wrap gap-3">
    {available.map(project => <label key={project.id} className="flex items-center gap-2 text-xs min-h-[36px]">
      <input type="checkbox" checked={selected.includes(project.id)} onChange={e => onChange(e.target.checked ? [...selected, project.id] : selected.filter(id => id !== project.id))} />{project.name}
    </label>)}
  </div></fieldset>;
}
