import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { Omnibar } from '../tasks/Omnibar';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  Sun,
  Star,
  CheckCircle2,
  CalendarClock,
  Zap,
} from 'lucide-react';

interface TodayViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onOpenBrainDump: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  onSelectTask,
  onStartFocus,
  onOpenBrainDump,
}) => {
  const {
    tasks,
    overdueTasks,
    isTriageDismissed,
    bulkRescheduleOverdue,
    quickWinsOnly,
    setQuickWinsOnly,
    priorityFilter,
    setPriorityFilter,
  } = useTaskContext();

  const todayStr = formatLocalDate(new Date());

  // Tasks belonging to Today: dueDate === todayStr OR isPinnedToday
  const todayTasks = tasks.filter((t) => {
    const isDueToday = t.dueDate === todayStr;
    const isPinned = t.isPinnedToday;
    return isDueToday || isPinned;
  });

  // Filter tasks based on controls
  const filteredTasks = todayTasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (quickWinsOnly && (t.estimatedMinutes || 999) > 15) return false;
    return true;
  });

  const pinnedTasks = filteredTasks.filter((t) => t.isPinnedToday && t.status !== 'done');
  const otherActiveTasks = filteredTasks.filter((t) => !t.isPinnedToday && t.status !== 'done');
  const completedTodayTasks = tasks.filter(
    (t) =>
      t.status === 'done' &&
      (t.dueDate === todayStr || (t.completedAt && formatLocalDate(new Date(t.completedAt)) === todayStr))
  );

  const totalTodayCount = filteredTasks.length + completedTodayTasks.length;
  const doneTodayCount = completedTodayTasks.length;
  const progressPercent = totalTodayCount > 0 ? Math.round((doneTodayCount / totalTodayCount) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* View Header with Date & Progress in a Luminous Horizon Card */}
      <div className="mb-6">
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/[0.08] via-rose-500/[0.04] to-indigo-500/[0.06] dark:from-white/[0.04] dark:via-white/[0.02] dark:to-transparent border border-stone-200/80 dark:border-white/10 shadow-card card-surface backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-md shadow-amber-500/25 card-surface flex-shrink-0">
              <Sun size={24} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                My Day
              </h2>
              <p className="text-xs text-[var(--text-secondary)] font-medium">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Daily Progress Widget with Dual-Gradient SVG Ring */}
          {totalTodayCount > 0 && (
            <div className="flex items-center gap-3.5 bg-white/80 dark:bg-[var(--bg-surface-l2)] px-4 py-2 rounded-2xl border border-stone-200/80 dark:border-[var(--border-hairline)] shadow-subtle card-surface backdrop-blur-sm">
              <div className="text-right">
                <div className="text-xs font-bold text-[var(--text-primary)] font-mono">
                  {doneTodayCount} of {totalTodayCount} done
                </div>
                <div className="text-[10px] text-[var(--text-muted)] font-semibold font-mono">{progressPercent}% complete</div>
              </div>
              <div className="relative w-9 h-9 flex items-center justify-center">
                <svg className="w-9 h-9 -rotate-90 transform" viewBox="0 0 36 36">
                  <defs>
                    <linearGradient id="todayProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    className="stroke-stone-200/80 dark:stroke-stone-800"
                    strokeWidth="3.2"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="url(#todayProgressGrad)"
                    className="transition-all duration-500 ease-out"
                    strokeWidth="3.2"
                    strokeDasharray={88}
                    strokeDashoffset={88 - (88 * progressPercent) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                  {progressPercent}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Gentle Clean-Slate Overdue Triage Banner */}
        {overdueTasks.length > 0 && !isTriageDismissed && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.04] to-transparent border border-amber-500/25 shadow-card card-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex-shrink-0">
                <CalendarClock size={18} />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  You have <span className="font-bold">{overdueTasks.length}</span> uncompleted tasks from earlier.
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  No stress. Keep your board clean with one click:
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => bulkRescheduleOverdue('today')}
                className="px-3 py-1.5 text-xs font-semibold bg-stone-900 dark:bg-white text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-stone-100 rounded-xl shadow-xs transition-all active:scale-95 card-surface"
              >
                Push to Today
              </button>
              <button
                onClick={() => bulkRescheduleOverdue('someday')}
                className="px-3 py-1.5 text-xs font-medium bg-[var(--bg-surface-l2)] text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-white/[0.06] border border-[var(--border-hairline)] rounded-xl transition-all card-surface"
              >
                Move to Someday
              </button>
              <button
                onClick={() => bulkRescheduleOverdue('dismiss')}
                className="px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Omnibar Quick Capture */}
      <Omnibar onOpenBrainDump={onOpenBrainDump} />

      {/* Quick Filters */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQuickWinsOnly(!quickWinsOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              quickWinsOnly
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent hover:bg-stone-200/50 dark:hover:bg-white/[0.04]'
            }`}
          >
            <Zap size={13} className={quickWinsOnly ? 'text-amber-500 fill-amber-500' : ''} />
            Quick Wins (≤15m)
          </button>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
            className="text-xs bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-2.5 py-1.5 outline-none transition-colors card-surface cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="p1">P1 Urgent only</option>
            <option value="p2">P2 High only</option>
            <option value="p3">P3 Medium only</option>
          </select>
        </div>
      </div>

      {/* Section 1: Rule of 3 (Top 3 Focus for Today) */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Star size={14} className="text-amber-500 fill-amber-500" />
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Top 3 Focus (Rule of 3)
            </h3>
            <span className="text-[11px] font-mono text-[var(--text-muted)] font-semibold">
              ({pinnedTasks.length}/3)
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            Star up to 3 tasks to guard your focus
          </span>
        </div>

        {pinnedTasks.length === 0 ? (
          <div className="p-5 rounded-2xl border border-dashed border-stone-300/80 dark:border-stone-800 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/40 backdrop-blur-xs">
            No top focus items selected yet. Click the <Star size={12} className="inline mx-0.5 text-amber-500" /> star on any task below to anchor your day.
          </div>
        ) : (
          <div className="space-y-2.5">
            {pinnedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelectTask={onSelectTask}
                onStartFocus={onStartFocus}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Other Tasks for Today */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Tasks for Today {otherActiveTasks.length > 0 && `(${otherActiveTasks.length})`}
          </h3>
        </div>

        {otherActiveTasks.length === 0 && pinnedTasks.length === 0 ? (
          <div className="text-center py-14 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-2xl border border-[var(--border-hairline)]">
            <CheckCircle2 size={36} className="mx-auto mb-2.5 text-stone-300 dark:text-stone-700" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">All clear for today!</p>
            <p className="text-xs mt-1 text-[var(--text-secondary)]">Add a new task above or enjoy your free time.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {otherActiveTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelectTask={onSelectTask}
                onStartFocus={onStartFocus}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Completed Today */}
      {completedTodayTasks.length > 0 && (
        <div className="pt-5 border-t border-[var(--border-hairline)]">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            Completed Today ({completedTodayTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTodayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onSelectTask={onSelectTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
