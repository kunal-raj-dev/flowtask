import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { TaskStatus } from '../../types/task';
import { Kanban, Plus, Circle, Clock, CheckCircle2, Keyboard } from 'lucide-react';
import { audioEngine } from '../../utils/audioEngine';

interface KanbanViewProps {
  onSelectTask: (taskId: string) => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  onSelectTask,
}) => {
  const { tasks, updateTask, addTask } = useTaskContext();
  const [mobileColumn, setMobileColumn] = useState<TaskStatus>('todo');
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [addingToStatus, setAddingToStatus] = useState<TaskStatus | null>(null);
  const [quickTitle, setQuickTitle] = useState('');

  // Hotkey navigation: '1', '2', '3' or 'h', 'j', 'k', 'l' or Arrow keys
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
        setMobileColumn('todo');
      } else if (e.key === '2') {
        setMobileColumn('in_progress');
      } else if (e.key === '3') {
        setMobileColumn('done');
      } else if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'H') {
        setMobileColumn((prev) => {
          if (prev === 'done') return 'in_progress';
          if (prev === 'in_progress') return 'todo';
          return prev;
        });
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        setMobileColumn((prev) => {
          if (prev === 'todo') return 'in_progress';
          if (prev === 'in_progress') return 'done';
          return prev;
        });
      } else if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        const colTasks = tasks.filter((t) => t.status === mobileColumn);
        if (colTasks.length > 0) {
          const currentIndex = colTasks.findIndex((t) => t.id === focusedCardId);
          if (currentIndex === -1 || currentIndex >= colTasks.length - 1) {
            setFocusedCardId(colTasks[0].id);
          } else {
            setFocusedCardId(colTasks[currentIndex + 1].id);
          }
        }
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        const colTasks = tasks.filter((t) => t.status === mobileColumn);
        if (colTasks.length > 0) {
          const currentIndex = colTasks.findIndex((t) => t.id === focusedCardId);
          if (currentIndex <= 0) {
            setFocusedCardId(colTasks[colTasks.length - 1].id);
          } else {
            setFocusedCardId(colTasks[currentIndex - 1].id);
          }
        }
      } else if (e.key === 'Enter') {
        if (focusedCardId) {
          e.preventDefault();
          onSelectTask(focusedCardId);
        }
      } else if (e.key === ' ') {
        if (focusedCardId) {
          e.preventDefault();
          const current = tasks.find((t) => t.id === focusedCardId);
          if (current) {
            const nextStatus: TaskStatus =
              current.status === 'todo'
                ? 'in_progress'
                : current.status === 'in_progress'
                ? 'done'
                : 'todo';
            updateTask(current.id, {
              status: nextStatus,
              completedAt: nextStatus === 'done' ? Date.now() : undefined,
            });
            audioEngine.playCompletionChime();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileColumn, tasks, focusedCardId, onSelectTask, updateTask]);

  const columns: {
    status: TaskStatus;
    title: string;
    icon: React.ElementType;
    color: string;
    badgeBg: string;
  }[] = [
    {
      status: 'todo',
      title: 'To Do',
      icon: Circle,
      color: 'text-stone-500',
      badgeBg: 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300',
    },
    {
      status: 'in_progress',
      title: 'In Progress',
      icon: Clock,
      color: 'text-amber-500',
      badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
    },
    {
      status: 'done',
      title: 'Completed',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
    },
  ];

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTask(taskId, {
        status,
        completedAt: status === 'done' ? Date.now() : undefined,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAddTaskToColumn = (status: TaskStatus) => {
    setAddingToStatus(status);
    setQuickTitle('');
  };

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-sm card-surface flex-shrink-0">
            <Kanban size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Kanban Board
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Manage workflow stages and team velocity
            </p>
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)]">
          <Keyboard size={13} className="text-indigo-500" />
          <span>Vim / Nav:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold text-[var(--text-primary)]">h j k l</kbd>
          <span>or</span>
          <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono text-[10px] font-bold text-[var(--text-primary)]">1-3</kbd>
          <span>• Space advance</span>
        </div>
      </div>

      {/* Mobile Column Tab Switcher */}
      <div className="md:hidden flex items-center p-1 bg-stone-200/70 dark:bg-white/[0.06] rounded-2xl border border-[var(--border-hairline)] mb-4 shadow-inner">
        {columns.map((col) => {
          const count = tasks.filter((t) => t.status === col.status).length;
          const isActive = mobileColumn === col.status;
          return (
            <button
              key={col.status}
              type="button"
              onClick={() => setMobileColumn(col.status)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white dark:bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-sm card-surface'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span>{col.title}</span>
              <span className="text-[10px] font-mono font-bold opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 flex-1 items-start">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.status);
          const ColIcon = col.icon;

          const isVisibleOnMobile = mobileColumn === col.status;
          return (
            <div
              key={col.status}
              onDrop={(e) => handleDrop(e, col.status)}
              onDragOver={handleDragOver}
              className={`${
                isVisibleOnMobile ? 'flex' : 'hidden md:flex'
              } bg-[var(--bg-surface-l1)]/60 rounded-3xl p-3.5 sm:p-4 border border-[var(--border-hairline)] flex-col min-h-[360px] md:min-h-[520px] backdrop-blur-xs shadow-xs`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3.5 px-1">
                <div className="flex items-center gap-2">
                  <ColIcon size={16} className={col.color} />
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {col.title}
                  </h3>
                  <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border border-[var(--border-subtle)] shadow-xs ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>

                <button
                  onClick={() => handleAddTaskToColumn(col.status)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
                  title={`Add to ${col.title}`}
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Tasks List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {addingToStatus === col.status && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (quickTitle.trim()) {
                        addTask(quickTitle.trim(), { status: col.status });
                        setQuickTitle('');
                        setAddingToStatus(null);
                      }
                    }}
                    className="p-3 bg-[var(--bg-surface-l2)] rounded-2xl border border-indigo-500/50 shadow-md space-y-2 animate-fade-in"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setAddingToStatus(null);
                          setQuickTitle('');
                        }
                      }}
                      placeholder={`Add card to ${col.title}...`}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingToStatus(null);
                          setQuickTitle('');
                        }}
                        className="px-2 py-1 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!quickTitle.trim()}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}
                {colTasks.length === 0 && addingToStatus !== col.status ? (
                  <div className="h-32 flex items-center justify-center text-xs text-[var(--text-muted)] border border-dashed border-stone-200 dark:border-stone-800 rounded-2xl bg-[var(--bg-surface-l2)]/30">
                    Drop cards here
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                      onClick={() => {
                        setFocusedCardId(task.id);
                        onSelectTask(task.id);
                      }}
                      className={`group p-3.5 bg-[var(--bg-surface-l2)] rounded-2xl border transition-all space-y-2 card-surface cursor-grab active:cursor-grabbing hover:-translate-y-[1px] ${
                        focusedCardId === task.id
                          ? 'border-indigo-500 ring-2 ring-indigo-500/40 shadow-elevated'
                          : 'border-[var(--border-hairline)] shadow-card hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-[var(--text-primary)] leading-snug">
                          {task.title}
                        </span>
                        {task.priority !== 'p4' && (
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border shadow-xs shrink-0 ${
                              task.priority === 'p1'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                : task.priority === 'p2'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30'
                            }`}
                          >
                            {task.priority}
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1.5 border-t border-[var(--border-hairline)]">
                        <span>{task.dueDate || 'No date'}</span>
                        {task.subtasks && task.subtasks.length > 0 && (
                          <span>
                            {task.subtasks.filter((s) => s.completed).length}/
                            {task.subtasks.length} subtasks
                          </span>
                        )}
                      </div>

                      {/* Quick status advance buttons (always visible on mobile, hover on desktop) */}
                      <div
                        className="flex items-center justify-end gap-1.5 pt-2 border-t border-[var(--border-hairline)] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {col.status !== 'todo' && (
                          <button
                            type="button"
                            onClick={() => updateTask(task.id, { status: 'todo' })}
                            className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface-l1)] text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
                            title="Move back to To Do"
                          >
                            ← To Do
                          </button>
                        )}
                        {col.status !== 'in_progress' && (
                          <button
                            type="button"
                            onClick={() => updateTask(task.id, { status: 'in_progress' })}
                            className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                            title={col.status === 'todo' ? 'Start Task' : 'Move to In Progress'}
                          >
                            {col.status === 'todo' ? 'Start →' : '← In Prog'}
                          </button>
                        )}
                        {col.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => updateTask(task.id, { status: 'done', completedAt: Date.now() })}
                            className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            title="Mark Completed"
                          >
                            ✓ Done
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
