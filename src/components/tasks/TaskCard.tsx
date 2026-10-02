import React, { useState, useRef, useEffect } from 'react';
import type { Task } from '../../types/task';
import { useTaskContext } from '../../context/TaskContext';
import { TaskContextMenu } from './TaskContextMenu';
import {
  Check,
  Calendar,
  Clock,
  Repeat,
  Star,
  Timer,
  Trash2,
  ListTodo,
  MoreHorizontal,
  Play,
  Pause,
  Lock,
  Sun,
  Sunrise,
  Coffee,
  Briefcase,
  Lightbulb,
  X,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';
import { checkTaskStaleness } from '../../utils/staleTaskDetector';
import { isTaskBlocked } from '../../utils/dependencyUtils';
import { audioEngine } from '../../utils/audioEngine';

interface TaskCardProps {
  task: Task;
  onSelectTask: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
  isKeyboardFocused?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onSelectTask,
  onStartFocus,
  isKeyboardFocused = false,
}) => {
  const {
    tasks,
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
    projects,
    activeTimerTaskId,
    activeTimerSeconds,
    toggleTaskTimer,
    selectedTaskIds,
    toggleTaskSelection,
  } = useTaskContext();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const snoozeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSnoozeOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (snoozeRef.current && !snoozeRef.current.contains(e.target as Node)) {
        setIsSnoozeOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isSnoozeOpen]);

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== task.title) {
      updateTask(task.id, { title: titleDraft.trim() });
    } else {
      setTitleDraft(task.title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitleDraft(task.title);
      setIsEditingTitle(false);
    }
  };

  const isDone = task.status === 'done';
  const todayStr = formatLocalDate(new Date());

  const isActiveTimer = activeTimerTaskId === task.id;
  const isSelected = selectedTaskIds.includes(task.id);
  const blockedInfo = isTaskBlocked(task, tasks);

  const handleToggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDone && blockedInfo.isBlocked) {
      const blockerTitles = blockedInfo.blockingTasks.map((t) => `"${t.title}"`).join(', ');
      const proceed = window.confirm(
        `This task is blocked by ${blockerTitles}.\n\nMark it as complete anyway?`
      );
      if (!proceed) return;
    }
    toggleTaskStatus(task.id);
  };

  const formatStopwatch = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine due date state
  const isOverdue = task.dueDate && task.dueDate < todayStr && !isDone;
  const isToday = task.dueDate === todayStr;
  const staleInfo = checkTaskStaleness(task);

  const project = projects.find((p) => p.id === task.projectId);

  // Subtask progress
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'p1':
        return 'text-rose-600 dark:text-rose-400 bg-gradient-to-r from-rose-500/15 to-red-500/10 border-rose-500/30';
      case 'p2':
        return 'text-amber-600 dark:text-amber-400 bg-gradient-to-r from-amber-500/15 to-orange-500/10 border-amber-500/30';
      case 'p3':
        return 'text-sky-600 dark:text-sky-400 bg-gradient-to-r from-sky-500/15 to-blue-500/10 border-sky-500/30';
      default:
        return 'text-[var(--text-muted)] bg-stone-500/10 border-stone-500/20';
    }
  };

  const formatDueDateLabel = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    if (dueDateStr === todayStr) return 'Today';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dueDateStr === formatLocalDate(tomorrow)) return 'Tomorrow';
    return dueDateStr;
  };

  const handleSnooze = (action: 'today' | 'tomorrow' | 'weekend' | 'next_week' | 'someday' | 'clear') => {
    setIsSnoozeOpen(false);
    audioEngine.playClickSound();

    if (action === 'today') {
      updateTask(task.id, { dueDate: todayStr });
    } else if (action === 'tomorrow') {
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      updateTask(task.id, { dueDate: formatLocalDate(tmrw) });
    } else if (action === 'weekend') {
      const sat = new Date();
      const day = sat.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      sat.setDate(sat.getDate() + diff);
      updateTask(task.id, { dueDate: formatLocalDate(sat) });
    } else if (action === 'next_week') {
      const mon = new Date();
      const day = mon.getDay();
      const diff = (8 - day) % 7 || 7;
      mon.setDate(mon.getDate() + diff);
      updateTask(task.id, { dueDate: formatLocalDate(mon) });
    } else if (action === 'someday') {
      updateTask(task.id, { dueDate: undefined, projectId: 'ideas', isPinnedToday: false });
    } else if (action === 'clear') {
      updateTask(task.id, { dueDate: undefined, dueTime: undefined, isPinnedToday: false });
    }
  };

  const renderSnoozeMenu = () => (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute left-0 top-full mt-1.5 z-40 w-44 p-1.5 rounded-2xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-xl backdrop-blur-xl card-surface text-xs space-y-0.5 animate-slide-down"
    >
      <div className="px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Quick Reschedule
      </div>
      <button
        type="button"
        onClick={() => handleSnooze('today')}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] text-[var(--text-primary)] transition-colors text-left"
      >
        <Sun size={13} className="text-amber-500" />
        <span>Today</span>
      </button>
      <button
        type="button"
        onClick={() => handleSnooze('tomorrow')}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] text-[var(--text-primary)] transition-colors text-left"
      >
        <Sunrise size={13} className="text-orange-500" />
        <span>Tomorrow</span>
      </button>
      <button
        type="button"
        onClick={() => handleSnooze('weekend')}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] text-[var(--text-primary)] transition-colors text-left"
      >
        <Coffee size={13} className="text-emerald-500" />
        <span>This Weekend</span>
      </button>
      <button
        type="button"
        onClick={() => handleSnooze('next_week')}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] text-[var(--text-primary)] transition-colors text-left"
      >
        <Briefcase size={13} className="text-indigo-500" />
        <span>Next Week (Mon)</span>
      </button>
      <button
        type="button"
        onClick={() => handleSnooze('someday')}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] text-amber-600 dark:text-amber-400 transition-colors text-left"
      >
        <Lightbulb size={13} />
        <span>Someday / Backlog</span>
      </button>
      {task.dueDate && (
        <button
          type="button"
          onClick={() => handleSnooze('clear')}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-rose-500/10 text-rose-500 transition-colors text-left pt-1 border-t border-[var(--border-subtle)]"
        >
          <X size={13} />
          <span>Clear Due Date</span>
        </button>
      )}
    </div>
  );

  return (
    <div
      id={`task-${task.id}`}
      onClick={(e) => {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          e.preventDefault();
          toggleTaskSelection(task.id);
          return;
        }
        if (selectedTaskIds.length > 0) {
          toggleTaskSelection(task.id);
          return;
        }
        onSelectTask(task.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      className={`group relative flex items-start gap-2.5 p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'ring-2 ring-indigo-500/80 dark:ring-indigo-400 bg-indigo-500/[0.07] dark:bg-indigo-500/[0.14] border-indigo-400/60 dark:border-indigo-400/40 shadow-sm'
          : isKeyboardFocused
          ? 'ring-2 ring-amber-500/80 dark:ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.22)] -translate-y-[1px]'
          : ''
      } ${
        isDone
          ? 'bg-[var(--bg-surface-l1)]/60 border-[var(--border-hairline)] opacity-60'
          : task.isPinnedToday && !isSelected
          ? 'bg-gradient-to-r from-amber-500/[0.10] via-orange-400/[0.05] to-indigo-500/[0.03] dark:from-amber-500/[0.08] dark:via-amber-500/[0.03] dark:to-transparent border-amber-400/60 dark:border-amber-500/40 shadow-[0_4px_22px_-2px_rgba(245,158,11,0.18)] dark:shadow-glow-amber card-surface hover:border-amber-500/80 hover:-translate-y-[1px]'
          : !isSelected
          ? 'bg-white dark:bg-[var(--bg-surface-l2)] border-stone-200/80 dark:border-[var(--border-hairline)] shadow-card hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-elevated hover:-translate-y-[1px] card-surface'
          : ''
      }`}
    >
      {/* Multi-Select Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleTaskSelection(task.id);
        }}
        title="Select task for batch actions"
        className={`mt-0.5 w-4 h-4 rounded-[5px] flex-shrink-0 flex items-center justify-center border transition-all duration-150 ${
          isSelected
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
            : selectedTaskIds.length > 0
            ? 'border-stone-300 dark:border-stone-600 hover:border-indigo-500 bg-white dark:bg-stone-800'
            : 'opacity-0 group-hover:opacity-100 border-stone-300 dark:border-stone-600 hover:border-indigo-500 bg-white dark:bg-stone-800'
        }`}
        aria-label={isSelected ? 'Deselect task' : 'Select task'}
      >
        {isSelected && <Check size={10} className="stroke-[3]" />}
      </button>

      {/* Tactile Micro-Spring Checkbox Button */}
      <button
        type="button"
        onClick={handleToggleStatus}
        className={`mt-0.5 w-5 h-5 rounded-[7px] flex-shrink-0 flex items-center justify-center border active:scale-90 transition-all duration-150 ${
          isDone
            ? 'bg-gradient-to-br from-stone-900 to-stone-800 dark:from-white dark:to-stone-200 border-stone-800 dark:border-white text-white dark:text-stone-950 shadow-xs'
            : 'border-stone-300 dark:border-stone-600 hover:border-amber-500 dark:hover:border-amber-400 hover:ring-4 hover:ring-amber-500/15 dark:hover:ring-amber-400/20 group-hover:scale-105 bg-[var(--bg-surface-l2)]'
        }`}
        aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isDone && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3 h-3 animate-check-spring"
          >
            <polyline
              points="20 6 9 17 4 12"
              className="animate-check-draw"
            />
          </svg>
        )}
      </button>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none border-b-2 border-amber-500 pb-0.5"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!isDone) setIsEditingTitle(true);
              }}
              title="Double-click to edit title"
              className={`text-sm leading-snug font-semibold transition-all ${
                isDone
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {task.title}
            </span>
          )}

          {/* Priority pip */}
          {task.priority !== 'p4' && !isDone && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shadow-xs shrink-0 ${getPriorityStyle(
                task.priority
              )}`}
            >
              {task.priority}
            </span>
          )}

          {/* Pinned Top 3 indicator */}
          {task.isPinnedToday && !isDone && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35 uppercase tracking-wider shadow-xs shrink-0">
              <Star size={10} className="fill-amber-500 text-amber-500" />
              Focus
            </span>
          )}
        </div>

        {/* Task description preview if present */}
        {task.description && !isDone && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-1 font-normal">
            {task.description}
          </p>
        )}

        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {/* Project tag */}
          {project && project.id !== 'inbox' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-stone-900/10 dark:ring-white/20"
                style={{ backgroundColor: project.color }}
              />
              {project.name}
            </span>
          )}

          {/* Due date badge with Quick Snooze Popover */}
          {task.dueDate ? (
            <div className="relative inline-block" ref={snoozeRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSnoozeOpen((prev) => !prev);
                }}
                title="Click to quickly reschedule due date"
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border transition-all hover:scale-[1.02] cursor-pointer ${
                  isOverdue
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:border-rose-500/40'
                    : isToday
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 font-semibold hover:border-amber-500/40'
                    : 'text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--bg-surface-l1)]/50 hover:border-amber-500/30'
                }`}
              >
                <Calendar size={11} />
                <span>{formatDueDateLabel(task.dueDate)}</span>
                {task.dueTime ? ` @ ${task.dueTime}` : ''}
              </button>
              {isSnoozeOpen && renderSnoozeMenu()}
            </div>
          ) : !isDone ? (
            <div className="relative inline-block" ref={snoozeRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSnoozeOpen((prev) => !prev);
                }}
                title="Quick schedule due date"
                className="opacity-0 group-hover:opacity-100 sm:inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-dashed border-stone-300 dark:border-stone-700 hover:border-amber-500 text-[var(--text-muted)] hover:text-amber-500 transition-all cursor-pointer"
              >
                <Calendar size={10} />
                <span>+ Date</span>
              </button>
              {isSnoozeOpen && renderSnoozeMenu()}
            </div>
          ) : null}

          {/* Subtasks progress pill */}
          {totalSubtasks > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              <ListTodo size={11} />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}

          {/* Estimated duration */}
          {task.estimatedMinutes && !isDone && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
              <Clock size={11} />
              {task.estimatedMinutes >= 60
                ? `${task.estimatedMinutes / 60}h`
                : `${task.estimatedMinutes}m`}
            </span>
          )}

          {/* Recurring badge */}
          {task.recurrence && task.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
              <Repeat size={11} />
              <span className="capitalize">
                {task.recurrence === 'custom' && task.customRecurrence
                  ? `Every ${task.customRecurrence.interval === 1 ? '' : task.customRecurrence.interval + ' '}${task.customRecurrence.unit}`
                  : task.recurrence}
              </span>
            </span>
          )}

          {/* Custom Hashtags / Labels */}
          {task.tags && task.tags.length > 0 && !isDone && (
            task.tags
              .filter((tag) => !project || tag.toLowerCase() !== project.name.toLowerCase())
              .map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-stone-500/10 text-stone-600 dark:text-stone-300 border border-stone-500/20"
                >
                  #{tag}
                </span>
              ))
          )}

          {/* GTD Context Tags */}
          {task.contextTags && task.contextTags.length > 0 && !isDone && (
            task.contextTags.map((ctx) => (
              <span
                key={ctx}
                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20"
              >
                @{ctx}
              </span>
            ))
          )}

          {/* Blocked by Dependency Pill */}
          {!isDone && blockedInfo.isBlocked && (
            <span
              title={`Blocked by: ${blockedInfo.blockingTasks.map((t) => t.title).join(', ')}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25"
            >
              <Lock size={11} className="text-rose-500 shrink-0" />
              <span>Blocked ({blockedInfo.blockingTasks.length})</span>
            </span>
          )}

          {/* Active Live Stopwatch pill */}
          {isActiveTimer && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35 animate-pulse shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              ⏱️ {formatStopwatch(activeTimerSeconds)}
            </span>
          )}

          {/* Time spent logged previously */}
          {task.timeSpentMinutes && task.timeSpentMinutes > 0 && !isActiveTimer && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              <Clock size={11} />
              {task.timeSpentMinutes}m spent
            </span>
          )}

          {/* Compassionate Stale / Avoidance Fatigue Pill */}
          {staleInfo.isStale && !isDone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const choice = window.confirm(
                  `"${task.title}" has been postponed repeatedly.\n\nClick OK to park in Someday without guilt, or Cancel to keep working on it.`
                );
                if (choice) {
                  updateTask(task.id, { dueDate: undefined, isPinnedToday: false });
                }
              }}
              title="Postponed repeatedly. Click to park in Someday guilt-free or de-escalate."
              className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/25 cursor-pointer transition-colors"
            >
              <span>💤</span>
              <span>Needs Momentum</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile action tools (always visible and touch-accessible) */}
      <div
        className="flex sm:hidden items-center gap-0.5 shrink-0 ml-1"
        onClick={(e) => e.stopPropagation()}
      >
        {!isDone && (
          <button
            type="button"
            onClick={() => toggleTaskTimer(task.id)}
            title={isActiveTimer ? 'Pause tracking time' : 'Start live stopwatch'}
            aria-label={isActiveTimer ? 'Pause tracking time' : 'Start live stopwatch'}
            className={`p-2 rounded-xl transition-all ${
              isActiveTimer
                ? 'text-amber-600 bg-amber-500/20 animate-pulse'
                : 'text-stone-400 hover:text-amber-500 active:bg-stone-200/50 dark:active:bg-white/[0.06]'
            }`}
          >
            {isActiveTimer ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
          </button>
        )}

        {!isDone && (
          <button
            type="button"
            onClick={() => toggleTaskPinToday(task.id)}
            title={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus'}
            aria-label={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus'}
            className={`p-2 rounded-xl transition-colors ${
              task.isPinnedToday
                ? 'text-amber-500 bg-amber-500/10'
                : 'text-stone-400 hover:text-amber-500 active:bg-stone-200/50 dark:active:bg-white/[0.06]'
            }`}
          >
            <Star size={16} className={task.isPinnedToday ? 'fill-amber-500' : ''} />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setContextMenu({ x: Math.min(rect.right, window.innerWidth - 180), y: rect.bottom + 4 });
          }}
          title="More options"
          aria-label="More options"
          className="p-2 rounded-xl text-stone-400 hover:text-[var(--text-primary)] active:bg-stone-200/50 dark:active:bg-white/[0.06] transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Desktop hover action tools */}
      <div
        className={`hidden sm:flex items-center gap-1 transition-opacity ${
          isActiveTimer ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Live Stopwatch Play/Pause button */}
        {!isDone && (
          <button
            type="button"
            onClick={() => toggleTaskTimer(task.id)}
            title={isActiveTimer ? 'Pause tracking time' : 'Start live stopwatch'}
            className={`p-1.5 rounded-lg transition-all ${
              isActiveTimer
                ? 'text-amber-600 bg-amber-500/20 hover:bg-amber-500/30'
                : 'text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            {isActiveTimer ? (
              <Pause size={14} className="fill-current" />
            ) : (
              <Play size={14} className="fill-current" />
            )}
          </button>
        )}

        {/* Rule of 3 Today Pin button */}
        {!isDone && (
          <button
            type="button"
            onClick={() => toggleTaskPinToday(task.id)}
            title={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus for Today'}
            className={`p-1.5 rounded-lg transition-colors ${
              task.isPinnedToday
                ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10'
                : 'text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Star size={14} className={task.isPinnedToday ? 'fill-current' : ''} />
          </button>
        )}

        {/* Start Focus Timer button */}
        {!isDone && onStartFocus && (
          <button
            type="button"
            onClick={() => onStartFocus(task.id)}
            title="Start Focus Timer on this task"
            className="p-1.5 rounded-lg text-stone-400 hover:text-indigo-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <Timer size={14} />
          </button>
        )}

        {/* Context Menu Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setContextMenu({ x: rect.right, y: rect.bottom });
          }}
          title="More options (or right click)"
          className="p-1.5 rounded-lg text-stone-400 hover:text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <MoreHorizontal size={14} />
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => deleteTask(task.id)}
          title="Delete task"
          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <TaskContextMenu
          task={task}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onStartFocus={onStartFocus}
          onEditTitle={() => setIsEditingTitle(true)}
        />
      )}
    </div>
  );
};
