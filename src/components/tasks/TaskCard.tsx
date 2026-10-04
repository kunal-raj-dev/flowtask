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
  Moon,
  Sunrise,
  Coffee,
  Briefcase,
  Lightbulb,
  X,
  Zap,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';
import { getTodayStr, getTomorrowStr } from '../../hooks/useCurrentDate';
import { checkTaskStaleness } from '../../utils/staleTaskDetector';
import { isTaskBlocked } from '../../utils/dependencyUtils';
import { audioEngine } from '../../utils/audioEngine';
import { Badge } from '../ui/Badge';

interface TaskCardProps {
  task: Task;
  onSelectTask: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
  isKeyboardFocused?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onSelectTask,
  onStartFocus,
  onStartSprint,
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
    showToast,
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

  const [prevTitle, setPrevTitle] = useState(task.title);
  if (task.title !== prevTitle) {
    setPrevTitle(task.title);
    setTitleDraft(task.title);
  }

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
  const todayStr = getTodayStr();

  const isActiveTimer = activeTimerTaskId === task.id;
  const isSelected = selectedTaskIds.includes(task.id);
  const blockedInfo = isTaskBlocked(task, tasks);

  const handleToggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDone && blockedInfo.isBlocked) {
      const blockerTitles = blockedInfo.blockingTasks.map((t) => `"${t.title}"`).join(', ');
      toggleTaskStatus(task.id);
      showToast(`Completed blocked task (was blocked by ${blockerTitles})`, 'Undo', () => {
        toggleTaskStatus(task.id);
      });
      return;
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

  const formatDueDateLabel = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    if (dueDateStr === todayStr) return 'Today';
    if (dueDateStr === getTomorrowStr()) return 'Tomorrow';
    return dueDateStr;
  };

  const handleSnooze = (action: 'today' | 'tomorrow' | 'weekend' | 'next_week' | 'someday' | 'clear') => {
    setIsSnoozeOpen(false);
    audioEngine.playClickSound();

    if (action === 'today') {
      updateTask(task.id, { plannedDate: todayStr });
    } else if (action === 'tomorrow') {
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      updateTask(task.id, { plannedDate: formatLocalDate(tmrw) });
    } else if (action === 'weekend') {
      const sat = new Date();
      const day = sat.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      sat.setDate(sat.getDate() + diff);
      updateTask(task.id, { plannedDate: formatLocalDate(sat) });
    } else if (action === 'next_week') {
      const mon = new Date();
      const day = mon.getDay();
      const diff = (8 - day) % 7 || 7;
      mon.setDate(mon.getDate() + diff);
      updateTask(task.id, { plannedDate: formatLocalDate(mon) });
    } else if (action === 'someday') {
      updateTask(task.id, { isSomeday: true, plannedDate: undefined, isPinnedToday: false });
    } else if (action === 'clear') {
      updateTask(task.id, { plannedDate: undefined, dueDate: undefined, dueTime: undefined, isPinnedToday: false });
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
      className={`group relative flex items-start gap-3 p-3 sm:px-3.5 sm:py-2.5 rounded-lg border transition-all duration-150 cursor-pointer ${
        isSelected
          ? 'ring-1 ring-[var(--color-brand)] bg-[var(--color-brand-subtle)] border-[var(--color-brand-border)]'
          : isKeyboardFocused
          ? 'ring-2 ring-amber-500/80 dark:ring-amber-400 border-amber-500/40 shadow-xs'
          : ''
      } ${
        isDone
          ? 'bg-[var(--bg-surface-l1)]/40 border-[var(--border-subtle)] opacity-55 hover:opacity-75'
          : task.isPinnedToday && !isSelected
          ? 'bg-[var(--bg-surface-l1)]/80 hover:bg-[var(--bg-surface-l1)] border-[var(--border-hairline)] border-l-[3px] border-l-amber-500 dark:border-l-amber-400 shadow-subtle hover:shadow-card'
          : !isSelected
          ? 'bg-[var(--bg-surface-l2)]/90 hover:bg-[var(--bg-surface-l2)] border-[var(--border-hairline)] hover:border-[var(--border-strong)] shadow-subtle hover:shadow-card'
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
        className={`mt-0.5 w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center border transition-all duration-150 ${
          isSelected
            ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white shadow-xs'
            : selectedTaskIds.length > 0
            ? 'border-[var(--border-strong)] hover:border-[var(--color-brand)] bg-transparent'
            : 'opacity-0 group-hover:opacity-100 border-[var(--border-strong)] hover:border-[var(--color-brand)] bg-transparent'
        }`}
        aria-label={isSelected ? 'Deselect task' : 'Select task'}
      >
        {isSelected && <Check size={10} className="stroke-[3]" />}
      </button>

      {/* Tactile Micro-Spring Circular Checkbox Button (Things 3 / Linear Aesthetic) */}
      <button
        type="button"
        onClick={handleToggleStatus}
        className={`mt-0.5 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border transition-all duration-150 active:scale-85 ${
          isDone
            ? 'bg-stone-900 dark:bg-white border-stone-900 dark:border-white text-white dark:text-stone-950 shadow-xs'
            : 'border-stone-400/80 dark:border-stone-500/80 hover:border-amber-500 hover:ring-2 hover:ring-amber-500/20 bg-transparent'
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
              className={`text-sm leading-snug font-medium transition-all ${
                isDone
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {task.title}
            </span>
          )}

          {/* Priority indicator */}
          {task.priority !== 'p4' && !isDone && (
            <Badge
              variant={
                task.priority === 'p1' ? 'danger' :
                task.priority === 'p2' ? 'focus' : 'blue'
              }
              size="xs"
            >
              {task.priority.toUpperCase()}
            </Badge>
          )}

          {/* Pinned Top 3 Focus indicator */}
          {task.isPinnedToday && !isDone && (
            <Badge variant="focus" size="xs">
              <Star size={9} className="fill-amber-500 text-amber-500" />
              Top 3
            </Badge>
          )}

          {/* Things 3-style This Evening indicator */}
          {task.isEvening && !isDone && (
            <Badge variant="blue" size="xs">
              <Moon size={9} className="text-sky-500 fill-sky-500/20" />
              Evening
            </Badge>
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
                    : 'text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--bg-surface-l2)] hover:border-amber-500/30'
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
                className="opacity-0 group-hover:opacity-100 sm:inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-dashed border-[var(--border-strong)] hover:border-amber-500 text-[var(--text-muted)] hover:text-amber-500 transition-all cursor-pointer"
              >
                <Calendar size={10} />
                <span>+ Date</span>
              </button>
              {isSnoozeOpen && renderSnoozeMenu()}
            </div>
          ) : null}

          {/* Subtasks progress pill */}
          {totalSubtasks > 0 && (
            <Badge variant="neutral" size="xs">
              <ListTodo size={11} />
              {completedSubtasks}/{totalSubtasks}
            </Badge>
          )}

          {/* Study Session Indicator & Question Pacing */}
          {task.sessionMetadata?.isSession && (
            <Badge variant="teal" size="xs">
              🎯 Session {task.sessionMetadata.sessionNumber || ''}
            </Badge>
          )}
          {task.scheduledStart && !isDone && (
            <Badge variant="teal" size="xs">
              <Clock size={10} />
              {task.scheduledStart}{task.scheduledEnd ? `–${task.scheduledEnd}` : ''}
            </Badge>
          )}
          {task.sessionMetadata?.pacingMinutesPerQuestion && (
            <Badge variant="brand" size="xs">
              ⚡ {task.sessionMetadata.pacingMinutesPerQuestion}m/Q
            </Badge>
          )}

          {/* Estimated duration */}
          {task.estimatedMinutes && !isDone && (
            <Badge variant="neutral" size="xs">
              <Clock size={11} />
              {task.estimatedMinutes >= 60
                ? `${task.estimatedMinutes / 60}h`
                : `${task.estimatedMinutes}m`}
            </Badge>
          )}

          {/* Recurring badge */}
          {task.recurrence && task.recurrence !== 'none' && (
            <Badge variant="brand" size="xs">
              <Repeat size={11} />
              <span className="capitalize">
                {task.recurrence === 'custom' && task.customRecurrence
                  ? `Every ${task.customRecurrence.interval === 1 ? '' : task.customRecurrence.interval + ' '}${task.customRecurrence.unit}`
                  : task.recurrence}
              </span>
            </Badge>
          )}

          {/* Custom Hashtags / Labels */}
          {task.tags && task.tags.length > 0 && !isDone && (
            task.tags
              .filter((tag) => !project || tag.toLowerCase() !== project.name.toLowerCase())
              .map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                >
                  #{tag}
                </span>
              ))
          )}

          {/* GTD Context Tags */}
          {task.contextTags && task.contextTags.length > 0 && !isDone && (
            task.contextTags.map((ctx) => (
              <Badge key={ctx} variant="teal" size="xs">
                @{ctx}
              </Badge>
            ))
          )}

          {/* Blocked by Dependency Pill */}
          {!isDone && blockedInfo.isBlocked && (
            <Badge
              variant="danger"
              size="xs"
              title={`Blocked by: ${blockedInfo.blockingTasks.map((t) => t.title).join(', ')}`}
            >
              <Lock size={10} className="text-rose-500 shrink-0" />
              <span>Blocked ({blockedInfo.blockingTasks.length})</span>
            </Badge>
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
                const prevDueDate = task.dueDate;
                const prevPinned = task.isPinnedToday;
                updateTask(task.id, { dueDate: undefined, isPinnedToday: false });
                showToast(`Parked "${task.title}" in Someday backlog`, 'Undo', () => {
                  updateTask(task.id, { dueDate: prevDueDate, isPinnedToday: prevPinned });
                });
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
        {!isDone && task.sessionMetadata?.isSession && onStartSprint && (
          <button
            type="button"
            onClick={() => onStartSprint(task.id)}
            title="Launch Study Sprint Cockpit"
            aria-label="Launch Study Sprint Cockpit"
            className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1 active:scale-95"
          >
            <Zap size={14} className="fill-current text-emerald-500" />
            <span className="text-[10px]">Sprint</span>
          </button>
        )}

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

        {!isDone && (
          <button
            type="button"
            onClick={() => updateTask(task.id, { isEvening: !task.isEvening })}
            title={task.isEvening ? 'Move to Daytime' : 'Move to This Evening'}
            aria-label={task.isEvening ? 'Move to Daytime' : 'Move to This Evening'}
            className={`p-2 rounded-xl transition-colors ${
              task.isEvening
                ? 'text-indigo-500 bg-indigo-500/15'
                : 'text-stone-400 hover:text-indigo-500 active:bg-stone-200/50 dark:active:bg-white/[0.06]'
            }`}
          >
            <Moon size={16} className={task.isEvening ? 'fill-indigo-500/30' : ''} />
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
        className={`hidden sm:flex items-center gap-0.5 transition-opacity ${
          isActiveTimer || (task.sessionMetadata?.isSession && !isDone) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Study Sprint Cockpit Launcher */}
        {!isDone && task.sessionMetadata?.isSession && onStartSprint && (
          <button
            type="button"
            onClick={() => onStartSprint(task.id)}
            title="Launch Study Sprint Cockpit"
            className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border border-emerald-500/35 font-bold text-xs flex items-center gap-1 transition-all mr-1 shadow-xs"
          >
            <Zap size={13} className="fill-current text-emerald-500" />
            <span className="text-[11px]">Sprint</span>
          </button>
        )}

        {/* Live Stopwatch Play/Pause button */}
        {!isDone && (
          <button
            type="button"
            onClick={() => toggleTaskTimer(task.id)}
            title={isActiveTimer ? 'Pause tracking time' : 'Start live stopwatch'}
            className={`p-1.5 rounded-lg transition-all ${
              isActiveTimer
                ? 'text-amber-600 bg-amber-500/20 hover:bg-amber-500/30'
                : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-[var(--bg-surface-l2)]'
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
                : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-[var(--bg-surface-l2)]'
            }`}
          >
            <Star size={14} className={task.isPinnedToday ? 'fill-current' : ''} />
          </button>
        )}

        {/* Things 3-style This Evening Toggle button */}
        {!isDone && (
          <button
            type="button"
            onClick={() => updateTask(task.id, { isEvening: !task.isEvening })}
            title={task.isEvening ? 'Move to Daytime' : 'Move to This Evening'}
            className={`p-1.5 rounded-lg transition-colors ${
              task.isEvening
                ? 'text-indigo-500 hover:text-indigo-600 bg-indigo-500/15'
                : 'text-[var(--text-muted)] hover:text-indigo-500 hover:bg-[var(--bg-surface-l2)]'
            }`}
          >
            <Moon size={14} className={task.isEvening ? 'fill-indigo-500/30' : ''} />
          </button>
        )}

        {/* Start Focus Timer button */}
        {!isDone && onStartFocus && (
          <button
            type="button"
            onClick={() => onStartFocus(task.id)}
            title="Start Focus Timer on this task"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-indigo-500 hover:bg-[var(--bg-surface-l2)] transition-colors"
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
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] transition-colors"
        >
          <MoreHorizontal size={14} />
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => deleteTask(task.id)}
          title="Delete task"
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--bg-surface-l2)] transition-colors"
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
