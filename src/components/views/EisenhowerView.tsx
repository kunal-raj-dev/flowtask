import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Priority } from '../../types/task';
import { Grid2X2, Plus, ArrowUpRight, Flame, Target, Zap, Coffee, Keyboard, Calendar, Archive } from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';

interface EisenhowerViewProps {
  onSelectTask: (taskId: string) => void;
  projectId?: string;
}

export const EisenhowerView: React.FC<EisenhowerViewProps> = ({
  onSelectTask,
  projectId,
}) => {
  const { tasks: allTasks, updateTask, addTask, toggleTaskStatus } = useTaskContext();
  const tasks = projectId ? allTasks.filter((t) => t.projectId === projectId) : allTasks;
  const [mobileQuadrant, setMobileQuadrant] = useState<Priority>('p1');
  const [addingToPriority, setAddingToPriority] = useState<Priority | null>(null);
  const [quickTitle, setQuickTitle] = useState('');

  // Hotkey navigation: '1', '2', '3', '4' or ArrowLeft / ArrowRight to switch quadrants
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const todayStr = formatLocalDate(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrowDate);

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
      title: 'Do First (Urgent & Important)',
      subtitle: 'Crises, immediate deadlines, pressing problems',
      icon: Flame,
      color: 'text-red-500',
      badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      bgAccent: 'border-red-500/20',
    },
    {
      priority: 'p2',
      title: 'Schedule (Important, Not Urgent)',
      subtitle: 'Strategic goals, deep work, health, relationships',
      icon: Target,
      color: 'text-amber-500',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      bgAccent: 'border-amber-500/20',
    },
    {
      priority: 'p3',
      title: 'Delegate / Quick Wins (Urgent, Not Important)',
      subtitle: 'Interruptive requests, quick administrative tasks',
      icon: Zap,
      color: 'text-blue-500',
      badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      bgAccent: 'border-blue-500/20',
    },
    {
      priority: 'p4',
      title: 'Don\'t Do / Someday (Neither)',
      subtitle: 'Time wasters, low-yield ideas, backlog items',
      icon: Coffee,
      color: 'text-stone-400',
      badgeColor: 'bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20',
      bgAccent: 'border-stone-500/20',
    },
  ];

  const handleDrop = (e: React.DragEvent, priority: Priority) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTask(taskId, { priority });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleQuickAdd = (priority: Priority) => {
    setAddingToPriority(priority);
    setQuickTitle('');
  };

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs flex-shrink-0">
            <Grid2X2 size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Eisenhower Priority Matrix
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Categorize and focus by urgency and importance
            </p>
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)]">
          <Keyboard size={13} className="text-amber-500" />
          <span>Matrix Nav:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold text-[var(--text-primary)]">1</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold text-[var(--text-primary)]">2</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold text-[var(--text-primary)]">3</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold text-[var(--text-primary)]">4</kbd>
          <span>or</span>
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold text-[var(--text-primary)]">←</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold text-[var(--text-primary)]">→</kbd>
        </div>
      </div>

      {/* Mobile Quadrant Switcher */}
      <div className="md:hidden flex items-center p-1 bg-stone-200/70 dark:bg-white/[0.06] rounded-xl border border-[var(--border-hairline)] mb-4 shadow-inner">
        {quadrants.map((q) => {
          const count = activeTasks.filter((t) => t.priority === q.priority).length;
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
              <span className="text-[10px] font-mono font-bold opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
        {quadrants.map((q) => {
          const Icon = q.icon;
          const quadTasks = activeTasks.filter((t) => t.priority === q.priority);

          const isVisibleOnMobile = mobileQuadrant === q.priority;
          return (
            <div
              key={q.priority}
              onDrop={(e) => handleDrop(e, q.priority)}
              onDragOver={handleDragOver}
              className={`${
                isVisibleOnMobile ? 'flex' : 'hidden md:flex'
              } bg-[var(--bg-surface-l2)] rounded-xl border border-[var(--border-hairline)] p-4 sm:p-5 flex-col shadow-card card-surface min-h-[260px] md:min-h-[280px] transition-all`}
            >
              {/* Quadrant Header */}
              <div className="flex items-start justify-between pb-3.5 mb-3.5 border-b border-[var(--border-hairline)]">
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
                  <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border shadow-xs ${q.badgeColor}`}>
                    {quadTasks.length}
                  </span>
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
                <div className="flex items-center justify-between pb-2.5 mb-2.5 text-[11px] border-b border-[var(--border-hairline)]/70">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Batch Action
                  </span>
                  {q.priority === 'p1' && (
                    <button
                      type="button"
                      onClick={() => {
                        quadTasks.forEach((t) => updateTask(t.id, { plannedDate: todayStr }));
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold text-[11px] transition-colors"
                      title="Schedule all Q1 tasks for Today"
                    >
                      <Calendar size={11} className="stroke-[2.2]" />
                      <span>All to Today</span>
                    </button>
                  )}
                  {q.priority === 'p2' && (
                    <button
                      type="button"
                      onClick={() => {
                        quadTasks.forEach((t) => updateTask(t.id, { plannedDate: tomorrowStr }));
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold text-[11px] transition-colors"
                      title="Schedule all Q2 tasks for Tomorrow"
                    >
                      <Calendar size={11} className="stroke-[2.2]" />
                      <span>All for Tomorrow</span>
                    </button>
                  )}
                  {q.priority === 'p3' && (
                    <button
                      type="button"
                      onClick={() => {
                        quadTasks.forEach((t) => updateTask(t.id, { plannedDate: todayStr }));
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold text-[11px] transition-colors"
                      title="Batch focus Q3 tasks for Today"
                    >
                      <Zap size={11} className="stroke-[2.2]" />
                      <span>All to Today</span>
                    </button>
                  )}
                  {q.priority === 'p4' && (
                    <button
                      type="button"
                      onClick={() => {
                        quadTasks.forEach((t) => updateTask(t.id, { isSomeday: true, plannedDate: undefined, isPinnedToday: false }));
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
                  quadTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                      onClick={() => onSelectTask(task.id)}
                      className="group p-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/50 hover:bg-[var(--bg-surface-l2)] shadow-subtle cursor-grab active:cursor-grabbing transition-all flex items-center justify-between gap-2.5 card-surface hover:-translate-y-[0.5px]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTaskStatus(task.id);
                          }}
                          className="w-4 h-4 rounded-[5px] border border-stone-300 dark:border-stone-600 hover:border-amber-500 flex-shrink-0 transition-colors"
                        />
                        <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {task.title}
                        </span>
                      </div>

                      {/* Direct Quadrant Switcher and Quick Actions */}
                      <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
