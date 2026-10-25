import React, { useState, useMemo } from 'react';
import type { Goal } from '../../types/goal';
import { useTaskContext } from '../../context/TaskContext';
import {
  Target,
  Plus,
  CheckCircle2,
  Folder,
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

export interface GoalsViewProps {
  onSelectProject?: (projectId: string) => void;
}

export const GoalsView: React.FC<GoalsViewProps> = ({ onSelectProject }) => {
  const { projects } = useTaskContext();
  const [goals, setGoals] = useState<Goal[]>(STARTER_GOALS);
  const [activeQuarterFilter, setActiveQuarterFilter] = useState<string>('all');
  const [isCreatingGoal, setIsCreatingGoal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newQuarter, setNewQuarter] = useState<string>('2026-Q4');
  const [newDescription, setNewDescription] = useState<string>('');

  const filteredGoals = useMemo(() => {
    if (activeQuarterFilter === 'all') return goals;
    return goals.filter((g) => g.targetQuarter === activeQuarterFilter);
  }, [goals, activeQuarterFilter]);

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created: Goal = {
      id: `goal-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      targetQuarter: newQuarter,
      status: 'in_progress',
      projectIds: [],
    };

    setGoals((prev) => [created, ...prev]);
    setNewTitle('');
    setNewDescription('');
    setIsCreatingGoal(false);
    audioEngine.playTaskComplete();
  };

  const toggleGoalStatus = (goalId: string) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const nextStatus = g.status === 'achieved' ? 'in_progress' : 'achieved';
        if (nextStatus === 'achieved') audioEngine.playTaskComplete();
        else audioEngine.playMagneticSnap();
        return { ...g, status: nextStatus };
      })
    );
  };

  return (
    <div className="desk-view p-6 max-w-5xl mx-auto space-y-8 animate-fadeIn" data-testid="goals-view">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-brand)] uppercase tracking-wider">
            <Target size={14} />
            <span>Whole-Life Architecture</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Vision & Quarterly Goals</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-lg">
            Connect high-level aspirations to tangible quarterly outcomes, projects, and daily
            milestones.
          </p>
        </div>

        <button
          onClick={() => setIsCreatingGoal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)] shadow transition-transform active:scale-95"
          data-testid="create-goal-button"
        >
          <Plus size={15} />
          <span>New Goal</span>
        </button>
      </div>

      {/* Quarter Filters */}
      <div className="flex items-center gap-2 text-xs">
        {['all', '2026-Q4', '2027-Q1', '2027-Q2'].map((q) => (
          <button
            key={q}
            onClick={() => setActiveQuarterFilter(q)}
            className={`px-3 py-1.5 rounded-lg border font-medium ${
              activeQuarterFilter === q
                ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white'
                : 'border-[var(--border-color)] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {q === 'all' ? 'All Quarters' : q}
          </button>
        ))}
      </div>

      {/* New Goal Modal/Form */}
      {isCreatingGoal && (
        <form
          onSubmit={handleCreateGoal}
          className="p-5 rounded-2xl border border-[var(--color-brand)] bg-[var(--bg-surface-l1)] space-y-4 animate-fadeIn"
          data-testid="new-goal-form"
        >
          <h3 className="text-sm font-bold">Define Quarterly Objective</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Goal Title
              </label>
              <input
                type="text"
                placeholder="What significant outcome will you achieve?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Target Quarter
              </label>
              <select
                value={newQuarter}
                onChange={(e) => setNewQuarter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
              >
                <option value="2026-Q4">2026-Q4</option>
                <option value="2027-Q1">2027-Q1</option>
                <option value="2027-Q2">2027-Q2</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
              Rationale & Description
            </label>
            <input
              type="text"
              placeholder="Why does this matter? Key measurable results..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingGoal(false)}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[var(--color-brand)] text-white text-xs font-semibold hover:bg-[var(--color-brand-hover)]"
            >
              Save Goal
            </button>
          </div>
        </form>
      )}

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.map((goal) => {
          const isAchieved = goal.status === 'achieved';
          const connectedProjectsList = projects.filter((p) =>
            (goal.projectIds || []).includes(p.id)
          );

          return (
            <div
              key={goal.id}
              className={`p-5 rounded-2xl border bg-[var(--bg-surface-l1)] shadow-sm transition-all ${
                isAchieved
                  ? 'border-emerald-500/30 opacity-75'
                  : 'border-[var(--border-color)] hover:border-[var(--color-brand)]'
              }`}
              data-testid={`goal-card-${goal.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleGoalStatus(goal.id)}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isAchieved
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-[var(--border-color)] hover:border-[var(--color-brand)]'
                    }`}
                    title={isAchieved ? 'Mark In Progress' : 'Mark Achieved'}
                  >
                    {isAchieved && <CheckCircle2 size={14} />}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2
                        className={`text-base font-bold ${
                          isAchieved ? 'line-through text-[var(--text-secondary)]' : ''
                        }`}
                      >
                        {goal.title}
                      </h2>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--bg-surface-l2)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                        {goal.targetQuarter}
                      </span>
                    </div>
                    {goal.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {goal.description}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                    isAchieved
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isAchieved ? 'Achieved' : 'In Progress'}
                </span>
              </div>

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
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[var(--bg-surface-l2)] border border-[var(--border-color)] hover:border-[var(--color-brand)] font-medium"
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
