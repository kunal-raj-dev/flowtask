import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { Omnibar } from '../tasks/Omnibar';
import { TimelineView } from './TimelineView';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  Sun,
  Star,
  CheckCircle2,
  CalendarClock,
  Zap,
  List,
  Clock,
  ChevronDown,
  ChevronUp,
  Moon,
  FileText,
  Check,
} from 'lucide-react';
import { KeyboardHaloDock } from '../tasks/KeyboardHaloDock';
import { generateDailyStandup } from '../../utils/standupGenerator';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';

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
    projects,
    overdueTasks,
    isTriageDismissed,
    bulkRescheduleOverdue,
    quickWinsOnly,
    setQuickWinsOnly,
    priorityFilter,
    setPriorityFilter,
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
    setIsEveningShutdownOpen,
    isShutdownDismissed,
    showToast,
  } = useTaskContext();

  const [copiedStandup, setCopiedStandup] = useState(false);

  const [displayMode, setDisplayMode] = useState<'list' | 'timeline'>(() => {
    return (localStorage.getItem('flowtask_today_mode') as 'list' | 'timeline') || 'list';
  });

  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('flowtask_today_completed_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('flowtask_today_mode', displayMode);
  }, [displayMode]);

  useEffect(() => {
    localStorage.setItem('flowtask_today_completed_collapsed', String(isCompletedCollapsed));
  }, [isCompletedCollapsed]);

  const [selectedContextTag, setSelectedContextTag] = useState<string | null>(null);

  const todayStr = formatLocalDate(new Date());

  // Tasks belonging to Today: dueDate === todayStr OR isPinnedToday
  const todayTasks = tasks.filter((t) => {
    const isDueToday = t.dueDate === todayStr;
    const isPinned = t.isPinnedToday;
    return isDueToday || isPinned;
  });

  // Extract available context tags for Today
  const availableContextTags = React.useMemo(() => {
    const map = new Map<string, number>();
    todayTasks.forEach((t) => {
      if (t.status !== 'done' && t.contextTags) {
        t.contextTags.forEach((ctx) => {
          map.set(ctx, (map.get(ctx) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [todayTasks]);

  // Filter tasks based on controls
  const filteredTasks = todayTasks.filter((t) => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (quickWinsOnly && (t.estimatedMinutes || 999) > 15) return false;
    if (selectedContextTag && (!t.contextTags || !t.contextTags.includes(selectedContextTag))) return false;
    return true;
  });

  const pinnedTasks = filteredTasks.filter((t) => t.isPinnedToday && t.status !== 'done');
  const otherActiveTasks = filteredTasks.filter((t) => !t.isPinnedToday && t.status !== 'done');
  const completedTodayTasks = tasks.filter(
    (t) =>
      t.status === 'done' &&
      (t.dueDate === todayStr || (t.completedAt && formatLocalDate(new Date(t.completedAt)) === todayStr))
  );

  // Active tasks array for linear keyboard traversal (j/k)
  const activeListTasks = [...pinnedTasks, ...otherActiveTasks];

  const { focusedTaskId, setFocusedIndex } = useKeyboardNavigation({
    tasks: activeListTasks,
    onSelectTask,
    onToggleStatus: toggleTaskStatus,
    onTogglePinToday: toggleTaskPinToday,
    onUpdateTask: updateTask,
    onDeleteTask: deleteTask,
    onStartFocus,
    enabled: displayMode === 'list',
  });

  const focusedTask = activeListTasks.find((t) => t.id === focusedTaskId);

  const handleCopyStandup = async () => {
    const markdown = generateDailyStandup(tasks, projects);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedStandup(true);
      audioEngine.playTaskComplete();
      confetti({
        particleCount: 35,
        spread: 55,
        origin: { y: 0.25 },
        colors: ['#6366f1', '#10b981', '#f59e0b'],
      });
      showToast('Daily Standup digest copied to clipboard!');
      setTimeout(() => setCopiedStandup(false), 2500);
    } catch {
      showToast('Failed to copy standup to clipboard');
    }
  };

  const totalTodayCount = filteredTasks.length + completedTodayTasks.length;
  const doneTodayCount = completedTodayTasks.length;
  const progressPercent = totalTodayCount > 0 ? Math.round((doneTodayCount / totalTodayCount) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      {/* View Header with Date & Progress in a Luminous Horizon Card */}
      <div className="mb-6">
        <div className="p-3.5 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/[0.08] via-rose-500/[0.04] to-indigo-500/[0.06] dark:from-white/[0.04] dark:via-white/[0.02] dark:to-transparent border border-stone-200/80 dark:border-white/10 shadow-card card-surface backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-md shadow-amber-500/25 card-surface flex-shrink-0">
              <Sun size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
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

          {/* Action Row: Standup Digest, Segmented Switcher & Dual-Gradient SVG Ring */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Standup Digest Copier Button */}
            <button
              type="button"
              onClick={handleCopyStandup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/80 dark:bg-[var(--bg-surface-l2)] border border-stone-200/80 dark:border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-400/50 shadow-subtle card-surface transition-all active:scale-95"
              title="Copy Daily Standup digest formatted for Slack / Discord / Notion"
            >
              {copiedStandup ? (
                <>
                  <Check size={13} className="text-emerald-500 stroke-[2.5]" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <FileText size={13} className="text-indigo-500" />
                  <span>Standup Digest</span>
                </>
              )}
            </button>

            {/* List vs Timeline Mode Switcher */}
            <div className="flex items-center p-1 bg-stone-200/70 dark:bg-white/[0.06] rounded-2xl border border-[var(--border-hairline)] shadow-inner">
              <button
                type="button"
                onClick={() => setDisplayMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  displayMode === 'list'
                    ? 'bg-white dark:bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-sm card-surface'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <List size={13} />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  displayMode === 'timeline'
                    ? 'bg-white dark:bg-[var(--bg-surface-l2)] text-[var(--text-primary)] shadow-sm card-surface'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Clock size={13} />
                <span>Timeline</span>
              </button>
            </div>

            {/* Daily Progress Widget with Dual-Gradient SVG Ring (Now visible on mobile too) */}
            {totalTodayCount > 0 && (
              <div className="flex items-center gap-2.5 sm:gap-3 bg-white/80 dark:bg-[var(--bg-surface-l2)] px-3 py-1.5 rounded-2xl border border-stone-200/80 dark:border-[var(--border-hairline)] shadow-subtle card-surface backdrop-blur-sm">
                <div className="text-right">
                  <div className="text-[11px] font-bold text-[var(--text-primary)] font-mono leading-tight">
                    {doneTodayCount}/{totalTodayCount}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-semibold font-mono">
                    {progressPercent}%
                  </div>
                </div>
                <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center">
                  <svg className="w-7 h-7 sm:w-8 sm:h-8 -rotate-90 transform" viewBox="0 0 36 36">
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
                  <span className="absolute text-[8px] sm:text-[9px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {progressPercent}%
                  </span>
                </div>
              </div>
            )}
          </div>
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

        {/* Symmetrical Evening Shutdown Banner */}
        {doneTodayCount > 0 && !isShutdownDismissed && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/[0.10] via-purple-500/[0.06] to-pink-500/[0.04] border border-indigo-500/25 shadow-card card-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xs flex-shrink-0">
                <Moon size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  Wrapping up for today? You&apos;ve completed {doneTodayCount} task{doneTodayCount > 1 ? 's' : ''}!
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Complete your evening shutdown ritual to close open loops and disconnect.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEveningShutdownOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
            >
              Start Shutdown Ritual
            </button>
          </div>
        )}
      </div>

      {/* Conditionally Render: Timeline View or List View */}
      {displayMode === 'timeline' ? (
        <TimelineView onSelectTask={onSelectTask} onStartFocus={onStartFocus} />
      ) : (
        <>
          {/* Omnibar Quick Capture */}
          <Omnibar onOpenBrainDump={onOpenBrainDump} />

          {/* Quick Filters */}
          {/* Quick Filters */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
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

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono">
              <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[10px]">j</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[10px]">k</kbd>
              <span>to navigate</span>
            </div>
          </div>

          {/* GTD Context Filter Rail */}
          {availableContextTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 mb-5 text-xs scrollbar-none animate-fade-in">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1 shrink-0">
                Context:
              </span>
              <button
                type="button"
                onClick={() => setSelectedContextTag(null)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  selectedContextTag === null
                    ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-xs'
                    : 'bg-stone-100 dark:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Contexts
              </button>
              {availableContextTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedContextTag(selectedContextTag === tag ? null : tag)}
                  className={`px-2.5 py-1 rounded-xl font-mono text-xs flex items-center gap-1 transition-all shrink-0 ${
                    selectedContextTag === tag
                      ? 'bg-teal-600 text-white font-bold shadow-xs'
                      : 'bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 border border-teal-500/20'
                  }`}
                >
                  <span>@{tag}</span>
                  <span className="text-[10px] opacity-75 font-sans font-semibold">({count})</span>
                </button>
              ))}
            </div>
          )}

          {/* Section 1: Rule of 3 (Top 3 Focus for Today) */}
          <div className="mb-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <div className="flex items-center gap-1.5">
                <Star size={14} className="text-amber-500 fill-amber-500 shrink-0" />
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
              otherActiveTasks.length > 0 ? (
                <div className="py-2.5 px-3 rounded-xl border border-stone-200/60 dark:border-white/[0.06] text-xs text-[var(--text-muted)] bg-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Star size={13} className="text-amber-500 shrink-0" />
                    <span>Anchor your day with up to 3 Most Important Tasks.</span>
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">
                    <span className="hidden sm:inline font-mono">Press 'f' to star</span>
                    <span className="sm:hidden">Tap ⭐ on card to pin</span>
                  </span>
                </div>
              ) : null
            ) : (
              <div className="space-y-2.5">
                {pinnedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelectTask={onSelectTask}
                    onStartFocus={onStartFocus}
                    isKeyboardFocused={focusedTaskId === task.id}
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
              <div className="text-center py-14 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-3xl border border-[var(--border-hairline)]">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">All clear for today!</p>
                <p className="text-xs mt-1 text-[var(--text-secondary)]">Take a breath, reflect, or enjoy your well-deserved free time.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {otherActiveTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelectTask={onSelectTask}
                    onStartFocus={onStartFocus}
                    isKeyboardFocused={focusedTaskId === task.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Completed Today (Collapsible Accordion) */}
          {completedTodayTasks.length > 0 && (
            <div className="pt-4 border-t border-[var(--border-hairline)] mt-6">
              <button
                type="button"
                onClick={() => setIsCompletedCollapsed((prev) => !prev)}
                className="flex items-center justify-between w-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1 group"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Completed Today ({completedTodayTasks.length})</span>
                </span>
                <span className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] flex items-center gap-1 font-normal">
                  {isCompletedCollapsed ? 'Show' : 'Hide'}
                  {isCompletedCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                </span>
              </button>

              {!isCompletedCollapsed && (
                <div className="space-y-2 mt-3 animate-slide-down">
                  {completedTodayTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onSelectTask={onSelectTask}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Keyboard Halo Action Dock for j/k spatial navigation */}
      {focusedTask && (
        <KeyboardHaloDock
          task={focusedTask}
          onSelect={() => onSelectTask(focusedTask.id)}
          onToggleStatus={() => toggleTaskStatus(focusedTask.id)}
          onStartFocus={() => onStartFocus(focusedTask.id)}
          onRescheduleToday={() => updateTask(focusedTask.id, { dueDate: todayStr })}
          onRescheduleTomorrow={() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            updateTask(focusedTask.id, { dueDate: formatLocalDate(tomorrow) });
          }}
          onRescheduleSomeday={() => updateTask(focusedTask.id, { dueDate: undefined, projectId: 'ideas' })}
          onSetPriority={(priority) => updateTask(focusedTask.id, { priority })}
          onDismiss={() => setFocusedIndex(-1)}
        />
      )}
    </div>
  );
};
