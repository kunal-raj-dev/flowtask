import { isTodayTask } from '../../utils/taskSelectors';
import React, { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { Omnibar } from '../tasks/Omnibar';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { formatLocalDate } from '../../utils/nlpParser';
import { useTodayStr, getTomorrowStr } from '../../hooks/useCurrentDate';
import {
  Sun,
  Moon,
  Star,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

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
  onOpenBrainDump,
  onStartSprint: _onStartSprint,
  onOpenStudySession,
}) => {
  const {
    tasks,
    quickWinsOnly,
    priorityFilter,
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    batchUpdateTasks,
    deleteTask,
    settings,
    showToast,
  } = useTaskContext();

  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('flowtask_today_completed_collapsed') !== 'false';
  });

  const [isEveningCollapsed, setIsEveningCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('flowtask_today_evening_collapsed') === 'true';
  });

  const [isCalmMode, setIsCalmMode] = useState<boolean>(() => {
    return localStorage.getItem('flowtask_today_calm_mode') === 'true';
  });

  const [isCalmModeExpanded, setIsCalmModeExpanded] = useState<boolean>(false);
  const [isOverloadDismissed, setIsOverloadDismissed] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('flowtask_today_completed_collapsed', String(isCompletedCollapsed));
  }, [isCompletedCollapsed]);

  useEffect(() => {
    localStorage.setItem('flowtask_today_evening_collapsed', String(isEveningCollapsed));
  }, [isEveningCollapsed]);

  useEffect(() => {
    localStorage.setItem('flowtask_today_calm_mode', String(isCalmMode));
  }, [isCalmMode]);

  const todayStr = useTodayStr();

  const formattedTodayDate = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }, [todayStr]);

  // Tasks planned for today or with Top 3 pin scoped to today (memoized)
  const activeTodayTasks = useMemo(
    () => tasks.filter(t => isTodayTask(t, todayStr)),
    [tasks, todayStr]
  );

  // Filter tasks based on global filters (Quick Wins & Priority)
  const filteredActiveTasks = useMemo(
    () => activeTodayTasks.filter((t) => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (quickWinsOnly && (t.estimatedMinutes || 999) > 15) return false;
      return true;
    }),
    [activeTodayTasks, priorityFilter, quickWinsOnly]
  );

  // Top 3 Focus
  const topThreeTasks = useMemo(
    () => filteredActiveTasks.filter(
      (t) => t.isPinnedToday && (t.topThreeDate === todayStr || (!t.topThreeDate && t.plannedDate === todayStr))
    ),
    [filteredActiveTasks, todayStr]
  );

  // Daytime tasks (not Top 3, not marked for evening)
  const daytimeTasks = useMemo(
    () => filteredActiveTasks.filter(
      (t) => !topThreeTasks.some((top) => top.id === t.id) && !t.isEvening
    ),
    [filteredActiveTasks, topThreeTasks]
  );

  // Things 3-style "This Evening" tasks (not Top 3, marked for evening)
  const eveningTasks = useMemo(
    () => filteredActiveTasks.filter(
      (t) => !topThreeTasks.some((top) => top.id === t.id) && Boolean(t.isEvening)
    ),
    [filteredActiveTasks, topThreeTasks]
  );

  // Completed today based on completion timestamp
  const completedTodayTasks = useMemo(
    () => tasks.filter((t) => {
      if (t.status !== 'done' || t.deletedAt) return false;
      if (!t.completedAt) {
        return t.plannedDate === todayStr || t.dueDate === todayStr;
      }
      return formatLocalDate(new Date(t.completedAt)) === todayStr;
    }),
    [tasks, todayStr]
  );

  // Linear active list for keyboard navigation (j/k)
  const activeListTasks = useMemo(
    () => [...topThreeTasks, ...daytimeTasks, ...eveningTasks],
    [topThreeTasks, daytimeTasks, eveningTasks]
  );

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

  // Progress metrics: unique IDs
  const totalPlannedCount = activeTodayTasks.length + completedTodayTasks.length;
  const doneCount = completedTodayTasks.length;
  const progressPercent = totalPlannedCount > 0 ? Math.round((doneCount / totalPlannedCount) * 100) : 0;

  // Workload Capacity Metrics & Anti-Burnout Calibration
  const targetWorkCapacityHours = settings?.targetWorkCapacityHours ?? 6.0;
  const targetWorkCapacityMinutes = targetWorkCapacityHours * 60;
  const activePlannedMinutes = activeTodayTasks.reduce(
    (acc, t) => acc + (t.estimatedMinutes || 30),
    0
  );
  const activePlannedHours = (activePlannedMinutes / 60).toFixed(1);
  const capacityPercent = Math.min(
    150,
    Math.round((activePlannedMinutes / targetWorkCapacityMinutes) * 100)
  );
  const isOverbooked = activePlannedMinutes > targetWorkCapacityMinutes;

  const handleDeferNonMitToTomorrow = () => {
    const tmrStr = getTomorrowStr();

    if (daytimeTasks.length > 0) {
      batchUpdateTasks(daytimeTasks.map(t => t.id), { plannedDate: tmrStr, isPinnedToday: false });
      showToast(`Pushed ${daytimeTasks.length} non-focus tasks to Tomorrow`);
    }
  };

  const handleMoveNonMitToEvening = () => {
    if (daytimeTasks.length > 0) {
      batchUpdateTasks(daytimeTasks.map(t => t.id), { isEvening: true });
      showToast(`Moved ${daytimeTasks.length} tasks to This Evening`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      {/* View Header: Clean Single Heading & Progress Ring */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Sun size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
                Today
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                {formattedTodayDate}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
              Focus on what moves the needle today
            </p>
          </div>
        </div>

        {/* Controls & Capacity / Progress Indicator */}
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {/* Capacity Pill & Calm Mode Toggle */}
          <div className="flex items-center gap-2">
            <div
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isOverbooked
                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                  : capacityPercent > 75
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              }`}
              title={`Workload capacity: ${activePlannedHours}h planned against ${targetWorkCapacityHours}h daily target`}
            >
              <span className="font-mono font-bold">{activePlannedHours}h</span>
              <span className="text-[10px] opacity-75">/ {targetWorkCapacityHours}h cap</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCalmMode((prev) => !prev);
                setIsCalmModeExpanded(false);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isCalmMode
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-hairline)]'
              }`}
              title={isCalmMode ? 'Calm Mode Active: Non-essential tasks hidden to reduce mental clutter' : 'Turn on Calm Mode to focus exclusively on Top 3'}
            >
              {isCalmMode ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{isCalmMode ? 'Calm Mode' : 'Calm View'}</span>
            </button>
          </div>

          {/* Progress Ring */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                {doneCount} of {totalPlannedCount} completed
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                {progressPercent}% daily progress
              </span>
            </div>
            <div className="w-10 h-10 relative flex items-center justify-center shrink-0">
              <svg className="w-10 h-10 -rotate-90 transform" viewBox="0 0 36 36">
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
      </div>

      {/* Quick Capture Omnibar with Editable Chips */}
      <Omnibar />

      {/* Overcommitment Protection Banner */}
      {isOverbooked && !isOverloadDismissed && daytimeTasks.length > 0 && (
        <div className="my-5 p-3.5 sm:p-4 rounded-xl bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Workload Capacity Exceeded ({activePlannedHours}h planned vs {targetWorkCapacityHours}h target)
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5">
                Overcommitting leads to cognitive fatigue. Consider protecting your focus by pushing non-critical tasks.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={handleDeferNonMitToTomorrow}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/30 transition-colors"
            >
              Defer to Tomorrow
            </button>
            <button
              type="button"
              onClick={handleMoveNonMitToEvening}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-stone-200/60 dark:bg-white/[0.08] hover:bg-stone-200 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
            >
              To Evening
            </button>
            <button
              type="button"
              onClick={() => setIsOverloadDismissed(true)}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded"
              title="Dismiss warning"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
            <AnimatePresence initial={false} mode="popLayout">
              {topThreeTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <TaskCard
                    task={task}
                    isKeyboardFocused={focusedTaskId === task.id}
                    onSelectTask={() => onSelectTask(task.id)}
                    onStartFocus={() => onStartFocus(task.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Daytime Tasks Section */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Daytime Tasks
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-[var(--text-secondary)] font-bold">
              {daytimeTasks.length}
            </span>
          </div>
        </div>

        {daytimeTasks.length === 0 && topThreeTasks.length === 0 && eveningTasks.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title="All clear for today"
              description="Capture your first thought above, or plan a deep study session."
              icon={<Sparkles size={28} className="text-amber-500" />}
            />
            {(onOpenBrainDump || onOpenStudySession) && (
              <div className="flex items-center justify-center gap-2.5">
                {onOpenBrainDump && (
                  <button
                    type="button"
                    onClick={onOpenBrainDump}
                    className="px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-l2)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-xs"
                  >
                    ⚡ Brain Dump
                  </button>
                )}
                {onOpenStudySession && (
                  <button
                    type="button"
                    onClick={onOpenStudySession}
                    className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300 transition-all shadow-xs"
                  >
                    🧠 Plan Study Session
                  </button>
                )}
              </div>
            )}
          </div>
        ) : daytimeTasks.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/40">
            No daytime tasks remaining. Great focus!
          </div>
        ) : isCalmMode && !isCalmModeExpanded ? (
          <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
              <EyeOff size={14} />
              <span>Calm Mode Active — {daytimeTasks.length} daytime task{daytimeTasks.length > 1 ? 's' : ''} hidden</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] max-w-md mx-auto">
              Protecting executive attention. Focus completely on your Top 3 priorities first.
            </p>
            <button
              type="button"
              onClick={() => setIsCalmModeExpanded(true)}
              className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 transition-all inline-block mt-1"
            >
              Reveal Daytime Tasks
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {isCalmMode && isCalmModeExpanded && (
              <div className="flex items-center justify-between pb-1 px-1">
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">Temporarily showing hidden tasks</span>
                <button
                  type="button"
                  onClick={() => setIsCalmModeExpanded(false)}
                  className="text-[11px] text-[var(--text-muted)] hover:text-indigo-500 flex items-center gap-1 font-semibold"
                >
                  <EyeOff size={12} /> Tuck away
                </button>
              </div>
            )}
            <AnimatePresence initial={false} mode="popLayout">
              {daytimeTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <TaskCard
                    task={task}
                    isKeyboardFocused={focusedTaskId === task.id}
                    onSelectTask={() => onSelectTask(task.id)}
                    onStartFocus={() => onStartFocus(task.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Things 3-style "This Evening" Section */}
      <div className="mb-7">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Moon size={15} className="text-indigo-500 fill-indigo-500/20" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              This Evening
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
              {eveningTasks.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsEveningCollapsed((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-1.5 py-0.5 rounded-md hover:bg-[var(--bg-surface-l1)]"
            title={isEveningCollapsed ? 'Expand This Evening' : 'Collapse This Evening'}
          >
            <span className="hidden sm:inline">
              {isEveningCollapsed ? 'Show' : 'Hide'}
            </span>
            {isEveningCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>

        {!isEveningCollapsed && (
          eveningTasks.length === 0 ? (
            <div className="p-3.5 rounded-xl border border-dashed border-indigo-500/20 dark:border-indigo-500/30 text-center text-xs text-[var(--text-muted)] bg-indigo-500/[0.03]">
              <span>🌙 No tasks slated for tonight. Set any task to &quot;This Evening&quot; to unwind or wrap up after hours.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false} mode="popLayout">
                {eveningTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <TaskCard
                      task={task}
                      isKeyboardFocused={focusedTaskId === task.id}
                      onSelectTask={() => onSelectTask(task.id)}
                      onStartFocus={() => onStartFocus(task.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )
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
              <AnimatePresence initial={false} mode="popLayout">
                {completedTodayTasks.map((task) => (
                  <motion.div
                    key={task.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <TaskCard
                      task={task}
                      isKeyboardFocused={focusedTaskId === task.id}
                      onSelectTask={() => onSelectTask(task.id)}
                      onStartFocus={() => onStartFocus(task.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
