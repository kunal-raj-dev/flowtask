import React, { useState, useMemo, useContext } from 'react';
import type { Routine, RoutineRun } from '../../types/routine';
import {
  WorkspaceStoreContext,
  useWorkspaceSelector,
} from '../../services/workspaceStore';
import {
  createRoutine,
  updateRoutine,
  deleteRoutine,
} from '../../services/lifeOrganizationService';
import { RoutineRunner } from '../workflow/RoutineRunner';
import { Dialog } from '../ui/Dialog';
import {
  Repeat,
  Plus,
  Play,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  Sun,
  Moon,
  Briefcase,
  Calendar,
  Sparkles,
  History,
  FastForward,
} from 'lucide-react';
import { audioEngine } from '../../services/audioEngine';

export const STARTER_ROUTINES: Array<Omit<Routine, 'id' | 'createdAt' | 'updatedAt' | 'revision'>> = [
  {
    title: 'Morning Launch',
    cadence: 'morning',
    steps: [
      { id: 'm-1', title: 'Hydrate & 5 deep breaths', durationMinutes: 2 },
      { id: 'm-2', title: 'Review Top 3 focus priorities', durationMinutes: 3 },
      { id: 'm-3', title: 'Clear clutter & set water bottle', durationMinutes: 5 },
    ],
  },
  {
    title: 'Workday Startup',
    cadence: 'workday_start',
    steps: [
      { id: 'w-1', title: 'Zero inbox & quick triage', durationMinutes: 5 },
      { id: 'w-2', title: 'Confirm today schedule & calendar conflicts', durationMinutes: 5 },
      { id: 'w-3', title: 'Launch first focus session', durationMinutes: 2 },
    ],
  },
  {
    title: 'Evening Shutdown',
    cadence: 'evening',
    steps: [
      { id: 'e-1', title: 'Log completed focus & celebrate wins', durationMinutes: 3 },
      { id: 'e-2', title: 'Triage unfinished items to tomorrow or someday', durationMinutes: 5 },
      { id: 'e-3', title: 'Close workstation & sign off', durationMinutes: 2 },
    ],
  },
  {
    title: 'Weekly Calibration',
    cadence: 'weekly',
    steps: [
      { id: 'k-1', title: 'Review completed goals and projects', durationMinutes: 10 },
      { id: 'k-2', title: 'Reflect on time allocation and energy', durationMinutes: 5 },
      { id: 'k-3', title: 'Map upcoming milestone commitments', durationMinutes: 10 },
    ],
  },
];

const CADENCE_METADATA = {
  morning: { label: 'Morning Launch', icon: Sun, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
  workday_start: { label: 'Workday Startup', icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/20' },
  evening: { label: 'Evening Shutdown', icon: Moon, color: 'text-indigo-500', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  weekly: { label: 'Weekly Calibration', icon: Calendar, color: 'text-teal-500', bg: 'bg-teal-500/10 border-teal-500/20' },
};

export interface RoutinesViewProps {
  onSelectTask?: (taskId: string) => void;
}

export const RoutinesView: React.FC<RoutinesViewProps> = () => {
  const store = useContext(WorkspaceStoreContext);
  const workspaceRoutines = useWorkspaceSelector((s) => s?.record?.routines);
  const workspaceRuns = useWorkspaceSelector((s) => s?.record?.routineRuns);

  // Local fallback for environments without WorkspaceStoreContext
  const [localRoutines, setLocalRoutines] = useState<Routine[]>(() => {
    return STARTER_ROUTINES.map((r, i) => ({
      ...r,
      id: `local-routine-${i + 1}`,
      steps: r.steps.map((s, si) => ({ ...s, id: `local-step-${i}-${si}` })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  });

  const routines: Routine[] = useMemo(() => {
    if (store && workspaceRoutines) {
      return (workspaceRoutines as Routine[]).filter((r) => !r.archivedAt);
    }
    return localRoutines.filter((r) => !r.archivedAt);
  }, [store, workspaceRoutines, localRoutines]);

  const routineRuns: RoutineRun[] = useMemo(() => {
    if (store && workspaceRuns) {
      return [...(workspaceRuns as RoutineRun[])].sort((a, b) => b.completedAt - a.completedAt);
    }
    return [];
  }, [store, workspaceRuns]);

  const [activeTab, setActiveTab] = useState<'library' | 'history'>('library');
  const [activeRoutineToRun, setActiveRoutineToRun] = useState<Routine | null>(null);

  // Create / Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCadence, setFormCadence] = useState<'morning' | 'evening' | 'workday_start' | 'weekly'>('morning');
  const [formSteps, setFormSteps] = useState<Array<{ id: string; title: string; durationMinutes?: number }>>([
    { id: '1', title: '', durationMinutes: 2 },
  ]);

  const handleOpenCreate = () => {
    setEditingRoutineId(null);
    setFormTitle('');
    setFormCadence('morning');
    setFormSteps([{ id: '1', title: '', durationMinutes: 2 }]);
    setIsEditing(true);
  };

  const handleOpenEdit = (routine: Routine) => {
    setEditingRoutineId(routine.id);
    setFormTitle(routine.title);
    setFormCadence(routine.cadence);
    setFormSteps(
      routine.steps?.length
        ? routine.steps.map((s) => ({ ...s }))
        : [{ id: '1', title: '', durationMinutes: 2 }]
    );
    setIsEditing(true);
  };

  const handleAddStep = () => {
    setFormSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID?.() || String(Date.now()), title: '', durationMinutes: 3 },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setFormSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepTitleChange = (index: number, title: string) => {
    setFormSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, title } : s))
    );
  };

  const handleStepDurationChange = (index: number, minutes: number) => {
    setFormSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, durationMinutes: Math.min(120, Math.max(1, minutes)) } : s))
    );
  };

  const handleSaveRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const validSteps = formSteps
      .filter((s) => s.title.trim().length > 0)
      .map((s) => ({
        id: s.id || crypto.randomUUID?.() || String(Date.now()),
        title: s.title.trim(),
        durationMinutes: s.durationMinutes || 2,
      }));

    if (validSteps.length === 0) return;

    if (store) {
      if (editingRoutineId) {
        updateRoutine(store, editingRoutineId, {
          title: formTitle.trim(),
          cadence: formCadence,
          steps: validSteps,
        });
      } else {
        createRoutine(store, formTitle.trim(), formCadence, validSteps);
      }
    } else {
      // Local fallback
      if (editingRoutineId) {
        setLocalRoutines((prev) =>
          prev.map((r) =>
            r.id === editingRoutineId
              ? { ...r, title: formTitle.trim(), cadence: formCadence, steps: validSteps, updatedAt: Date.now() }
              : r
          )
        );
      } else {
        const newR: Routine = {
          id: `local-r-${Date.now()}`,
          title: formTitle.trim(),
          cadence: formCadence,
          steps: validSteps,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setLocalRoutines((prev) => [...prev, newR]);
      }
    }

    setIsEditing(false);
  };

  const handleDeleteRoutine = (routineId: string) => {
    if (store) {
      deleteRoutine(store, routineId);
    } else {
      setLocalRoutines((prev) => prev.filter((r) => r.id !== routineId));
    }
  };

  const handleSeedStarters = () => {
    if (store) {
      for (const starter of STARTER_ROUTINES) {
        createRoutine(store, starter.title, starter.cadence, starter.steps);
      }
    } else {
      const seeded = STARTER_ROUTINES.map((r, i) => ({
        ...r,
        id: `seeded-${Date.now()}-${i}`,
        steps: r.steps.map((s, si) => ({ ...s, id: `step-${Date.now()}-${si}` })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
      setLocalRoutines((prev) => [...prev, ...seeded]);
    }
    audioEngine.playTaskComplete();
  };

  const getRoutineDuration = (routine: Routine) => {
    return (routine.steps || []).reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[var(--bg-main)] select-none animate-fadeIn" data-testid="routines-view">
      {/* Top Header */}
      <div className="p-4 sm:p-6 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                <Repeat size={18} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Routines & Rituals
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Small steps to start your day, begin work, and wind down.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Tab Selector */}
            <div className="flex items-center bg-[var(--bg-surface-l2)] p-1 rounded-xl border border-[var(--border-hairline)] text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('library')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors min-h-[36px] flex items-center gap-1.5 ${
                  activeTab === 'library'
                    ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Repeat size={14} />
                <span>Library</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors min-h-[36px] flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-[var(--bg-surface-l1)] text-[var(--text-primary)] shadow-xs font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <History size={14} />
                <span>History</span>
                {routineRuns.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-stone-200 dark:bg-stone-800 rounded-full">
                    {routineRuns.length}
                  </span>
                )}
              </button>
            </div>

            {/* New Routine Button */}
            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--color-brand)] text-white hover:brightness-105 active:scale-95 transition-all text-xs font-medium shadow-xs min-h-[40px]"
            >
              <Plus size={15} />
              <span>New Routine</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full flex-1">
        {activeTab === 'library' && (
          <div>
            {routines.length === 0 ? (
              <div className="text-center py-16 px-4 border border-dashed border-[var(--border-hairline)] rounded-2xl bg-[var(--bg-surface-l1)]">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-3">
                  <Sparkles size={24} />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  No routines defined yet
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
                  Build calm momentum through repeatable routines. Start with our proven launch, startup, and shutdown templates.
                </p>
                <button
                  type="button"
                  onClick={handleSeedStarters}
                  className="mt-4 px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-medium hover:brightness-105 active:scale-95 transition-all min-h-[44px]"
                >
                  Add Starter Routines
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {(['morning', 'workday_start', 'evening', 'weekly'] as const).map((cadenceKey) => {
                  const cadenceRoutines = routines.filter((r) => r.cadence === cadenceKey);
                  if (cadenceRoutines.length === 0) return null;

                  const meta = CADENCE_METADATA[cadenceKey];
                  const Icon = meta.icon;

                  return (
                    <div key={cadenceKey} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className={meta.color} />
                        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          {meta.label}
                        </h2>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          ({cadenceRoutines.length})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {cadenceRoutines.map((routine) => {
                          const totalMinutes = getRoutineDuration(routine);
                          return (
                            <div
                              key={routine.id}
                              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4 card-surface group"
                              data-testid={`routine-card-${routine.id}`}
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-semibold text-sm text-[var(--text-primary)] leading-snug">
                                    {routine.title}
                                  </h3>
                                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color} shrink-0`}>
                                    {meta.label.split(' ')[0]}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
                                  <span className="flex items-center gap-1">
                                    <Clock size={12} />
                                    <span>{totalMinutes > 0 ? `${totalMinutes}m` : 'Self-paced'}</span>
                                  </span>
                                  <span>·</span>
                                  <span>{(routine.steps || []).length} steps</span>
                                </div>

                                {/* Steps preview */}
                                <div className="space-y-1.5 pt-1 border-t border-[var(--border-hairline)]/50">
                                  {(routine.steps || []).map((step, idx) => (
                                    <div
                                      key={step.id || idx}
                                      className="flex items-center justify-between text-xs text-[var(--text-secondary)] gap-2 py-0.5"
                                    >
                                      <span className="truncate flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]/60 shrink-0" />
                                        <span className="truncate">{step.title}</span>
                                      </span>
                                      {step.durationMinutes && (
                                        <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                                          {step.durationMinutes}m
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Card Actions */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-hairline)]">
                                <button
                                  type="button"
                                  onClick={() => setActiveRoutineToRun(routine)}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[var(--color-brand)] text-white hover:brightness-105 active:scale-95 transition-all text-xs font-semibold shadow-xs min-h-[40px]"
                                  aria-label={`Start routine ${routine.title}`}
                                >
                                  <Play size={13} fill="currentColor" />
                                  <span>Start Routine</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(routine)}
                                  aria-label={`Edit ${routine.title}`}
                                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-surface-l2)] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                                >
                                  <Edit2 size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteRoutine(routine.id)}
                                  aria-label={`Delete ${routine.title}`}
                                  className="p-2 text-rose-500 hover:text-rose-600 rounded-xl hover:bg-rose-500/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {routineRuns.length === 0 ? (
              <div className="text-center py-16 px-4 border border-dashed border-[var(--border-hairline)] rounded-2xl bg-[var(--bg-surface-l1)]">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-500 mb-3">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  No routine runs recorded yet
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
                  When you complete a routine, your execution time and steps will be durably archived here.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] divide-y divide-[var(--border-hairline)] overflow-hidden shadow-xs">
                {routineRuns.map((run) => {
                  const dateStr = new Date(run.completedAt).toLocaleString();
                  const durationMinutes = Math.round(run.totalDurationSeconds / 60);
                  const routine = routines.find((r) => r.id === run.routineId);
                  const title = routine?.title || 'Routine Run';

                  const status = run.status || 'completed';
                  const isCompleted = status === 'completed';
                  const isPartial = status === 'partial';
                  const isSkipped = status === 'skipped';

                  const statusConfig = isCompleted
                    ? {
                        icon: CheckCircle2,
                        label: 'Completed',
                        bgColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                        iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                      }
                    : isPartial
                    ? {
                        icon: Clock,
                        label: 'Partial',
                        bgColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                        iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                      }
                    : isSkipped
                    ? {
                        icon: FastForward,
                        label: 'Skipped',
                        bgColor: 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border border-stone-500/20',
                        iconBg: 'bg-stone-500/10 text-stone-600 dark:text-stone-400',
                      }
                    : {
                        icon: Play,
                        label: 'Started',
                        bgColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
                        iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                      };

                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={run.id}
                      className="p-3.5 sm:px-5 flex items-center justify-between gap-4 hover:bg-[var(--bg-surface-l2)]/50 transition-colors"
                      data-testid={`routine-run-${run.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl ${statusConfig.iconBg} flex items-center justify-center shrink-0`}>
                          <StatusIcon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[var(--text-primary)] truncate">
                              {title}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig.bgColor}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                            {dateStr}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                        <span className="text-[var(--text-secondary)]">
                          {run.completedStepsCount} / {run.totalStepsCount} steps
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-stone-200/60 dark:bg-stone-800/60 text-[var(--text-primary)]">
                          {durationMinutes > 0 ? `${durationMinutes}m` : `${run.totalDurationSeconds}s`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RoutineRunner Modal */}
      {activeRoutineToRun && (
        <RoutineRunner
          isOpen={true}
          routine={activeRoutineToRun}
          onClose={() => setActiveRoutineToRun(null)}
          onCompleteRoutine={() => {
            setActiveRoutineToRun(null);
            audioEngine.playTaskComplete();
          }}
        />
      )}

      {/* Create / Edit Routine Dialog */}
      {isEditing && (
        <Dialog isOpen onClose={() => setIsEditing(false)} title={editingRoutineId ? 'Edit Routine' : 'Create Routine'} description="Give your routine a name and a few small steps." size="md">
            <form onSubmit={handleSaveRoutine} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="routine-title-input" className="text-xs font-medium text-[var(--text-secondary)]">
                  Routine Title
                </label>
                <input
                  id="routine-title-input"
                  type="text"
                  required
                  maxLength={200}
                  data-autofocus
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Morning Launch"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] min-h-[40px]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="routine-cadence-select" className="text-xs font-medium text-[var(--text-secondary)]">
                  Cadence
                </label>
                <select
                  id="routine-cadence-select"
                  value={formCadence}
                  onChange={(e) => setFormCadence(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] min-h-[40px]"
                >
                  <option value="morning">Morning Launch</option>
                  <option value="workday_start">Workday Startup</option>
                  <option value="evening">Evening Shutdown</option>
                  <option value="weekly">Weekly Calibration</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    Steps
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="text-xs text-[var(--color-brand)] hover:underline flex items-center gap-1 font-medium min-h-[32px]"
                  >
                    <Plus size={13} />
                    <span>Add Step</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {formSteps.map((step, idx) => (
                    <div key={step.id || idx} className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono w-4 shrink-0 text-center">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        aria-label={`Step ${idx + 1} title`}
                        maxLength={200}
                        value={step.title}
                        onChange={(e) => handleStepTitleChange(idx, e.target.value)}
                        placeholder={`Step ${idx + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] min-h-[36px]"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={step.durationMinutes || 2}
                          onChange={(e) => handleStepDurationChange(idx, parseInt(e.target.value, 10) || 1)}
                          className="w-14 px-1.5 py-1.5 text-xs text-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-l2)] text-[var(--text-primary)] font-mono min-h-[36px]"
                          aria-label={`Step ${idx + 1} duration in minutes`}
                        />
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">m</span>
                      </div>
                      {formSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="p-1 text-rose-500 hover:text-rose-600 rounded-lg hover:bg-rose-500/10 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          aria-label={`Remove step ${idx + 1}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-2 rounded-xl border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-surface-l2)] transition-colors min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formTitle.trim() || formSteps.some(step => !step.title.trim())}
                  className="px-4 py-2 rounded-xl bg-[var(--color-brand)] text-white text-xs font-semibold hover:brightness-105 active:scale-95 transition-all shadow-xs min-h-[40px]"
                >
                  Save Routine
                </button>
              </div>
            </form>
        </Dialog>
      )}
    </div>
  );
};
