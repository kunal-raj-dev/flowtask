import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { Omnibar } from '../tasks/Omnibar';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  Sun,
  Star,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { KeyboardHaloDock } from '../tasks/KeyboardHaloDock';

interface TodayViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onOpenBrainDump?: () => void;
  onStartSprint?: (taskId: string) => void;
  onOpenStudySession?: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  onSelectTask,
  onStartFocus,
}) => {
  const {
    tasks,
    quickWinsOnly,
    priorityFilter,
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
  } = useTaskContext();

  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('flowtask_today_completed_collapsed') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('flowtask_today_completed_collapsed', String(isCompletedCollapsed));
  }, [isCompletedCollapsed]);

  const todayStr = formatLocalDate(new Date());

  // Tasks planned for today or with Top 3 pin scoped to today
  const activeTodayTasks = tasks.filter((t) => {
    if (t.status === 'done' || t.deletedAt || t.archivedAt) return false;
    const isPlannedToday = t.plannedDate === todayStr;
    const isPinnedForToday = t.isPinnedToday && (t.topThreeDate === todayStr || (!t.topThreeDate && isPlannedToday));
    // Backwards compatibility: fallback to dueDate === todayStr if plannedDate not set
    const isLegacyDueToday = !t.plannedDate && t.dueDate === todayStr;
    return isPlannedToday || isPinnedForToday || isLegacyDueToday;
  });

  // Filter tasks based on global filters (Quick Wins & Priority)
  const filteredActiveTasks = activeTodayTasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (quickWinsOnly && (t.estimatedMinutes || 999) > 15) return false;
    return true;
  });

  // Top 3 Focus
  const topThreeTasks = filteredActiveTasks.filter(
    (t) => t.isPinnedToday && (t.topThreeDate === todayStr || (!t.topThreeDate && t.plannedDate === todayStr))
  );

  // Remaining active tasks for today
  const remainingTasks = filteredActiveTasks.filter(
    (t) => !topThreeTasks.some((top) => top.id === t.id)
  );

  // Completed today based on completion timestamp
  const completedTodayTasks = tasks.filter((t) => {
    if (t.status !== 'done' || t.deletedAt) return false;
    if (!t.completedAt) {
      return t.plannedDate === todayStr || t.dueDate === todayStr;
    }
    return formatLocalDate(new Date(t.completedAt)) === todayStr;
  });

  // Linear active list for keyboard navigation (j/k)
  const activeListTasks = [...topThreeTasks, ...remainingTasks];

  const { focusedTaskId } = useKeyboardNavigation({
    tasks: activeListTasks,
    onSelectTask,
    onToggleStatus: toggleTaskStatus,
    onTogglePinToday: toggleTaskPinToday,
    onUpdateTask: updateTask,
    onDeleteTask: deleteTask,
    onStartFocus,
    enabled: true,
  });

  const focusedTask = activeListTasks.find((t) => t.id === focusedTaskId);

  // Progress metrics: unique IDs
  const totalPlannedCount = activeTodayTasks.length + completedTodayTasks.length;
  const doneCount = completedTodayTasks.length;
  const progressPercent = totalPlannedCount > 0 ? Math.round((doneCount / totalPlannedCount) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      {/* View Header: Clean Single Heading & Progress Ring */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Sun size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Today
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {doneCount} of {totalPlannedCount} completed
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              {progressPercent}% daily progress
            </span>
          </div>
          <div className="w-12 h-12 relative flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 36 36">
              <path
                className="text-[var(--border-hairline)]"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-amber-500 transition-all duration-500 ease-out"
                strokeDasharray={`${progressPercent}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-[var(--text-primary)]">
              {progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Quick Capture Omnibar with Editable Chips */}
      <Omnibar />

      {/* Top 3 Focus Section */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Star size={15} className="text-amber-500 fill-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Top 3 Focus
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
              {topThreeTasks.length}/3
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">
            Star up to 3 high-impact tasks
          </span>
        </div>

        {topThreeTasks.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/40">
            Click the star on any task to choose your Top 3 for today
          </div>
        ) : (
          <div className="space-y-2">
            {topThreeTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isKeyboardFocused={focusedTaskId === task.id}
                onSelectTask={() => onSelectTask(task.id)}
                onStartFocus={() => onStartFocus(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Remaining Tasks Section */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Remaining Tasks
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-[var(--text-secondary)] font-bold">
              {remainingTasks.length}
            </span>
          </div>
        </div>

        {remainingTasks.length === 0 && topThreeTasks.length === 0 ? (
          <EmptyState
            title="All clear for today"
            description="Add your first task above, or pull tasks from your Inbox."
            icon={<Sparkles size={28} className="text-amber-500" />}
          />
        ) : remainingTasks.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/40">
            No other tasks planned for today. Great focus!
          </div>
        ) : (
          <div className="space-y-2">
            {remainingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isKeyboardFocused={focusedTaskId === task.id}
                onSelectTask={() => onSelectTask(task.id)}
                onStartFocus={() => onStartFocus(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Collapsed Completed Section */}
      {completedTodayTasks.length > 0 && (
        <div className="pt-4 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={() => setIsCompletedCollapsed((prev) => !prev)}
            className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-[var(--bg-surface-l1)] text-xs font-semibold text-[var(--text-secondary)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-500" />
              <span>Completed Today ({completedTodayTasks.length})</span>
            </div>
            {isCompletedCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>

          {!isCompletedCollapsed && (
            <div className="mt-2 space-y-2 opacity-80">
              {completedTodayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isKeyboardFocused={focusedTaskId === task.id}
                  onSelectTask={() => onSelectTask(task.id)}
                  onStartFocus={() => onStartFocus(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcut Halo Dock */}
      {focusedTask && (
        <KeyboardHaloDock
          task={focusedTask}
          onSelect={() => onSelectTask(focusedTask.id)}
          onToggleStatus={() => toggleTaskStatus(focusedTask.id)}
          onStartFocus={() => onStartFocus(focusedTask.id)}
          onRescheduleToday={() => updateTask(focusedTask.id, { plannedDate: todayStr })}
          onRescheduleTomorrow={() => {
            const tmr = new Date();
            tmr.setDate(tmr.getDate() + 1);
            updateTask(focusedTask.id, { plannedDate: formatLocalDate(tmr) });
          }}
          onRescheduleSomeday={() => updateTask(focusedTask.id, { isSomeday: true, plannedDate: undefined })}
          onSetPriority={(p) => updateTask(focusedTask.id, { priority: p })}
          onDismiss={() => {}}
        />
      )}
    </div>
  );
};
