import React, { useState, useEffect, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Priority } from '../../types/task';
import {
  Grid2X2,
  Plus,
  ArrowUpRight,
  Flame,
  Target,
  Zap,
  Coffee,
  Calendar,
  Archive,
  Sparkles,
  CheckCheck,
  ArrowDownUp,
} from 'lucide-react';
import { useTodayStr, getTomorrowStr } from '../../hooks/useCurrentDate';
import { calculateTaskPriorityScore } from '../../utils/priorityScoring';
import { Badge } from '../ui';

interface EisenhowerViewProps {
  onSelectTask: (taskId: string) => void;
  projectId?: string;
}

export const EisenhowerView: React.FC<EisenhowerViewProps> = ({
  onSelectTask,
  projectId,
}) => {
  const { tasks: allTasks, updateTask, batchUpdateTasks, addTask, toggleTaskStatus, showToast } = useTaskContext();
  const tasks = projectId ? allTasks.filter((t) => t.projectId === projectId) : allTasks;
  const [mobileQuadrant, setMobileQuadrant] = useState<Priority>('p1');
  const [addingToPriority, setAddingToPriority] = useState<Priority | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [dragOverQuadrant, setDragOverQuadrant] = useState<Priority | null>(null);

  // Multi-Factor Prioritization settings
  const [scoringMode, setScoringMode] = useState<'manual' | 'smart'>(() => {
    try {
      return (localStorage.getItem('flowtask_eisenhower_mode') as 'manual' | 'smart') || 'manual';
    } catch {
      return 'manual';
    }
  });

  const [sortByScore, setSortByScore] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flowtask_eisenhower_sort_score') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('flowtask_eisenhower_mode', scoringMode);
    } catch {
      // safe fallback
    }
  }, [scoringMode]);

  useEffect(() => {
    try {
      localStorage.setItem('flowtask_eisenhower_sort_score', String(sortByScore));
    } catch {
      // safe fallback
    }
  }, [sortByScore]);

  // Hotkey navigation: '1', '2', '3', '4' or ArrowLeft / ArrowRight to switch quadrants
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"], [data-overlay-open="true"]')) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === '1') {
        setMobileQuadrant('p1');
      } else if (e.key === '2') {
        setMobileQuadrant('p2');
      } else if (e.key === '3') {
        setMobileQuadrant('p3');
      } else if (e.key === '4') {
        setMobileQuadrant('p4');
      } else if (e.key === 'ArrowLeft') {
        setMobileQuadrant((prev) => {
          if (prev === 'p4') return 'p3';
          if (prev === 'p3') return 'p2';
          if (prev === 'p2') return 'p1';
          return prev;
        });
      } else if (e.key === 'ArrowRight') {
        setMobileQuadrant((prev) => {
          if (prev === 'p1') return 'p2';
          if (prev === 'p2') return 'p3';
          if (prev === 'p3') return 'p4';
          return prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeTasks = useMemo(() => tasks.filter((t) => !t.deletedAt && !t.archivedAt && t.status !== 'done'), [tasks]);
  const todayStr = useTodayStr();
  const tomorrowStr = getTomorrowStr();

  // Compute multi-factor priority scores
  const taskScores = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateTaskPriorityScore>>();
    activeTasks.forEach((t) => {
      map.set(t.id, calculateTaskPriorityScore(t, allTasks));
    });
    return map;
  }, [activeTasks, allTasks]);

  const quadrants: {
    priority: Priority;
    title: string;
    subtitle: string;
    icon: React.ElementType;
    color: string;
    badgeColor: string;
    bgAccent: string;
  }[] = [
    {
      priority: 'p1',
      title: 'P1: Urgent & Critical (Do First)',
      subtitle: 'Immediate deadlines, emergencies, top priorities',
      icon: Flame,
      color: 'text-rose-500',
      badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      bgAccent: 'border-rose-500/20',
    },
    {
      priority: 'p2',
      title: 'P2: Important & Planned (Schedule)',
      subtitle: 'Strategic work, major milestones, deep focus',
      icon: Target,
      color: 'text-amber-500',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      bgAccent: 'border-amber-500/20',
    },
    {
      priority: 'p3',
      title: 'P3: Quick Wins (Low Effort)',
      subtitle: 'Fast administrative tasks, small follow-ups',
      icon: Zap,
      color: 'text-blue-500',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      bgAccent: 'border-blue-500/20',
    },
    {
      priority: 'p4',
      title: 'P4: Backlog (Someday)',
      subtitle: 'Ideas to review later, low priority backlog',
      icon: Coffee,
      color: 'text-stone-400',
      badgeColor: 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20',
      bgAccent: 'border-stone-500/20',
    },
  ];

  const handleDrop = (e: React.DragEvent, priority: Priority) => {
    e.preventDefault();
    setDragOverQuadrant(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTask(taskId, { priority });
    }
  };

  const handleDragOver = (e: React.DragEvent, priority: Priority) => {
    e.preventDefault();
    if (dragOverQuadrant !== priority) {
      setDragOverQuadrant(priority);
    }
  };

  const handleDragLeave = () => {
    setDragOverQuadrant(null);
  };

  const handleQuickAdd = (priority: Priority) => {
    setAddingToPriority(priority);
    setQuickTitle('');
  };

  // Auto-align all tasks to their multi-factor suggested quadrants
  const handleAutoAlignAll = () => {
    const updates: { id: string; priority: Priority }[] = [];
    activeTasks.forEach((t) => {
      const score = taskScores.get(t.id);
      if (score && score.suggestedQuadrant !== t.priority) {
        updates.push({ id: t.id, priority: score.suggestedQuadrant });
      }
    });

    if (updates.length > 0) {
      const byPriority: Record<Priority, string[]> = { p1: [], p2: [], p3: [], p4: [] };
      updates.forEach((u) => byPriority[u.priority].push(u.id));
      (Object.keys(byPriority) as Priority[]).forEach((p) => {
        if (byPriority[p].length > 0) {
          batchUpdateTasks(byPriority[p], { priority: p });
        }
      });
      showToast(`Auto-aligned ${updates.length} task${updates.length === 1 ? '' : 's'} to multi-factor priority quadrants`);
    } else {
      showToast('All tasks already aligned with optimal quadrants');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8 h-full flex flex-col">
      {/* Top Header & Multi-Factor Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs flex-shrink-0">
            <Grid2X2 size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <span>Priority Matrix</span>
              {scoringMode === 'smart' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/30">
                  ⚡ Smart Mode
                </span>
              )}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              {scoringMode === 'smart'
                ? 'Algorithmic grouping by deadline urgency & impact importance'
                : 'Manual quadrant organization by urgency and importance'}
            </p>
          </div>
        </div>

        {/* View Controls & Action Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Toggle: Manual vs Multi-Factor Smart */}
          <div className="flex items-center p-0.5 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-xs">
            <button
              type="button"
              onClick={() => setScoringMode('manual')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                scoringMode === 'manual'
                  ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Manual quadrant assignment based on task priority"
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setScoringMode('smart')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                scoringMode === 'smart'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Smart multi-factor scoring (urgency + importance + blockers)"
            >
              <Sparkles size={12} />
              <span>Smart Score</span>
            </button>
          </div>

          {/* Sort by Score Toggle */}
          <button
            type="button"
            onClick={() => setSortByScore((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              sortByScore
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                : 'bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-hairline)]'
            }`}
            title="Sort tasks within quadrants by composite priority score"
          >
            <ArrowDownUp size={12} />
            <span className="hidden sm:inline">Rank by Score</span>
          </button>

          {/* Auto-Align All Button */}
          <button
            type="button"
            onClick={handleAutoAlignAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shadow-xs transition-all active:scale-95"
            title="Auto-align tasks to match their multi-factor suggested quadrants"
          >
            <CheckCheck size={13} />
            <span className="hidden sm:inline">Align Quadrants</span>
          </button>
        </div>
      </div>

      {/* Smart Scoring Hint Banner */}
      {scoringMode === 'smart' && (
        <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-500 shrink-0" />
            <span>
              <strong>Smart Scoring Active:</strong> Tasks are positioned according to composite deadline urgency, strategic impact, and dependency constraints.
            </span>
          </div>
          <button
            type="button"
            onClick={handleAutoAlignAll}
            className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shrink-0"
          >
            Commit to Tasks
          </button>
        </div>
      )}

      {/* Mobile Quadrant Switcher */}
      <div className="md:hidden flex items-center p-1 bg-stone-200/70 dark:bg-white/[0.06] rounded-xl border border-[var(--border-hairline)] mb-4 shadow-inner">
        {quadrants.map((q) => {
          const quadTasks = activeTasks.filter((t) => {
            if (scoringMode === 'smart') {
              return taskScores.get(t.id)?.suggestedQuadrant === q.priority;
            }
            return t.priority === q.priority;
          });
          const isActive = mobileQuadrant === q.priority;
          const shortTitle =
            q.priority === 'p1'
              ? 'Do First'
              : q.priority === 'p2'
              ? 'Schedule'
              : q.priority === 'p3'
              ? 'Delegate'
              : 'Backlog';
          return (
            <button
              key={q.priority}
              type="button"
              onClick={() => setMobileQuadrant(q.priority)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white dark:bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-sm card-surface'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{shortTitle}</span>
              <span className="text-[10px] font-mono font-bold opacity-75">({quadTasks.length})</span>
            </button>
          );
        })}
      </div>

      {/* Cartesian 2D Coordinate Axis Banners (Desktop) */}
      <div className="hidden md:grid grid-cols-2 gap-4 mb-2 text-center text-[11px] font-bold tracking-wider uppercase text-[var(--text-muted)] select-none">
        <div className="flex items-center justify-center gap-1.5 py-1 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)]">
          <span>⚡ High Urgency (Immediate Action)</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-1 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)]">
          <span>🕒 Low Urgency (Strategic / Planned)</span>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {quadrants.map((q) => {
          const Icon = q.icon;

          // Filter tasks based on mode
          let quadTasks = activeTasks.filter((t) => {
            if (scoringMode === 'smart') {
              return taskScores.get(t.id)?.suggestedQuadrant === q.priority;
            }
            return t.priority === q.priority;
          });

          // Sort by composite score if enabled
          if (sortByScore) {
            quadTasks = [...quadTasks].sort((a, b) => {
              const scoreA = taskScores.get(a.id)?.compositeScore ?? 0;
              const scoreB = taskScores.get(b.id)?.compositeScore ?? 0;
              return scoreB - scoreA;
            });
          }

          const isVisibleOnMobile = mobileQuadrant === q.priority;
          const isOver = dragOverQuadrant === q.priority;

          return (
            <div
              key={q.priority}
              onDrop={(e) => handleDrop(e, q.priority)}
              onDragOver={(e) => handleDragOver(e, q.priority)}
              onDragLeave={handleDragLeave}
              className={`${
                isVisibleOnMobile ? 'flex' : 'hidden md:flex'
              } bg-[var(--bg-surface-l2)] rounded-xl border ${
                isOver
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/[0.02]'
                  : 'border-[var(--border-hairline)]'
              } p-4 sm:p-5 flex-col shadow-card card-surface min-h-[260px] md:min-h-[280px] transition-all`}
            >
              {/* Quadrant Header */}
              <div className="flex items-start justify-between pb-3 mb-3 border-b border-[var(--border-hairline)]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-xl bg-[var(--bg-surface-l1)]">
                    <Icon size={16} className={q.color} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      {q.title}
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                      {q.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge variant={q.priority} size="xs" className="font-mono">
                    {quadTasks.length}
                  </Badge>
                  <button
                    onClick={() => handleQuickAdd(q.priority)}
                    className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                    title="Add task to this quadrant"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Quadrant Batch Action Toolbar */}
              {quadTasks.length > 0 && (
                <div className="flex items-center justify-between pb-2 mb-2 text-[11px] border-b border-[var(--border-hairline)]/70">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Batch Action
                  </span>
                  {q.priority === 'p1' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (quadTasks.length > 0) batchUpdateTasks(quadTasks.map((t) => t.id), { plannedDate: todayStr });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-[11px] transition-colors"
                      title="Schedule all P1 tasks for Today"
                    >
                      <Calendar size={11} className="stroke-[2.2]" />
                      <span>All to Today</span>
                    </button>
                  )}
                  {q.priority === 'p2' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (quadTasks.length > 0) batchUpdateTasks(quadTasks.map((t) => t.id), { plannedDate: tomorrowStr });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold text-[11px] transition-colors"
                      title="Schedule all P2 tasks for Tomorrow"
                    >
                      <Calendar size={11} className="stroke-[2.2]" />
                      <span>All for Tomorrow</span>
                    </button>
                  )}
                  {q.priority === 'p3' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (quadTasks.length > 0) batchUpdateTasks(quadTasks.map((t) => t.id), { plannedDate: todayStr });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[11px] transition-colors"
                      title="Batch focus P3 tasks for Today"
                    >
                      <Zap size={11} className="stroke-[2.2]" />
                      <span>All to Today</span>
                    </button>
                  )}
                  {q.priority === 'p4' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (quadTasks.length > 0) {
                          batchUpdateTasks(quadTasks.map((t) => t.id), { isSomeday: true, plannedDate: undefined, isPinnedToday: false });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-500/10 hover:bg-stone-500/20 text-stone-600 dark:text-stone-400 font-semibold text-[11px] transition-colors"
                      title="Park all in Someday backlog"
                    >
                      <Archive size={11} className="stroke-[2.2]" />
                      <span>Park in Someday</span>
                    </button>
                  )}
                </div>
              )}

              {/* Quadrant Task List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {addingToPriority === q.priority && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (quickTitle.trim()) {
                        addTask(quickTitle.trim(), { priority: q.priority });
                        setQuickTitle('');
                        setAddingToPriority(null);
                      }
                    }}
                    className="p-3 bg-[var(--bg-surface-l2)] rounded-lg border border-[var(--color-brand)]/50 shadow-md space-y-2 mb-2 animate-fade-in"
                  >
                    <input
                      autoFocus
                      id="quick-add-eisenhower-input"
                      name="quickAddTitle"
                      aria-label={`Add task to ${q.title}`}
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setAddingToPriority(null);
                          setQuickTitle('');
                        }
                      }}
                      placeholder={`Add task to ${q.title}...`}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingToPriority(null);
                          setQuickTitle('');
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!quickTitle.trim()}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                {quadTasks.length === 0 && addingToPriority !== q.priority ? (
                  <div className="h-32 flex items-center justify-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)] rounded-lg bg-[var(--bg-surface-l1)]/20">
                    Drop tasks here
                  </div>
                ) : (
                  quadTasks.map((task) => {
                    const score = taskScores.get(task.id);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                        onClick={() => onSelectTask(task.id)}
                        className="group p-2.5 sm:p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/50 hover:bg-[var(--bg-surface-l2)] shadow-subtle cursor-grab active:cursor-grabbing transition-all flex items-center justify-between gap-2.5 card-surface hover:-translate-y-[0.5px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <button
                            type="button"
                            aria-label={`Mark "${task.title}" as complete`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskStatus(task.id);
                            }}
                            className="w-4 h-4 rounded-[5px] border border-stone-300 dark:border-stone-600 hover:border-amber-500 flex-shrink-0 transition-colors"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-[var(--text-primary)] truncate block">
                              {task.title}
                            </span>
                            {score && (
                              <span className="text-[10px] text-[var(--text-muted)] truncate block sm:hidden">
                                {score.urgencyReason}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Composite Score & Direct Quadrant Switcher */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {score && (
                            <span
                              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              title={`Priority Score: ${score.compositeScore}/100\nUrgency: ${score.urgencyScore}/50 (${score.urgencyReason})\nImportance: ${score.importanceScore}/50 (${score.importanceReason})`}
                            >
                              ⚡{score.compositeScore}
                            </span>
                          )}

                          <div
                            className="flex items-center bg-stone-200/70 dark:bg-white/[0.08] p-0.5 rounded-lg gap-0.5"
                            title="Move to quadrant"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(['p1', 'p2', 'p3', 'p4'] as const).map((p, idx) => (
                              <button
                                key={p}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (task.priority !== p) {
                                    updateTask(task.id, { priority: p });
                                  }
                                }}
                                title={`Move to Q${idx + 1}`}
                                aria-label={`Move to Q${idx + 1}`}
                                className={`w-4 h-4 text-[9px] font-bold rounded flex items-center justify-center transition-all ${
                                  task.priority === p
                                    ? 'bg-white dark:bg-stone-700 text-[var(--text-primary)] shadow-xs scale-105'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-300/40 dark:hover:bg-white/10'
                                }`}
                              >
                                {idx + 1}
                              </button>
                            ))}
                          </div>

                          {task.dueDate !== todayStr && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTask(task.id, { dueDate: todayStr });
                              }}
                              title="Move to Today"
                              aria-label="Move to Today"
                              className="p-1 text-[var(--text-muted)] hover:text-amber-500 rounded-md hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                            >
                              <ArrowUpRight size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
