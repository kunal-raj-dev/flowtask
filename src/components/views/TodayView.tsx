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
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SegmentedControl } from '../ui/SegmentedControl';
import { EmptyState } from '../ui/EmptyState';
import { KeyboardHaloDock } from '../tasks/KeyboardHaloDock';
import { generateDailyStandup } from '../../utils/standupGenerator';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';

interface TodayViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onOpenBrainDump: () => void;
  onStartSprint?: (taskId: string) => void;
  onOpenStudySession?: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
  onSelectTask,
  onStartFocus,
  onOpenBrainDump,
  onStartSprint,
  onOpenStudySession,
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

  const [isBriefingCollapsed, setIsBriefingCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('flowtask_today_briefing_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('flowtask_today_briefing_collapsed', String(isBriefingCollapsed));
  }, [isBriefingCollapsed]);

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
      {/* View Header with Date & Progress in a Crisp Enterprise Card */}
      <div className="mb-6">
        <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Sun size={20} className="stroke-[2.2]" />
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

          {/* Action Row: Standup Digest, Segmented Switcher & Circular Ring */}
          <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap sm:flex-nowrap">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyStandup}
              leftIcon={
                copiedStandup ? (
                  <Check size={13} className="text-emerald-500 stroke-[2.5]" />
                ) : (
                  <FileText size={13} className="text-indigo-500" />
                )
              }
              title="Copy Daily Standup digest formatted for Slack / Discord / Notion"
            >
              {copiedStandup ? 'Copied!' : 'Standup'}
            </Button>

            {/* List vs Timeline Mode Segmented Control */}
            <SegmentedControl<'list' | 'timeline'>
              items={[
                { id: 'list', label: 'List', icon: <List size={13} /> },
                { id: 'timeline', label: 'Timeline', icon: <Clock size={13} /> },
              ]}
              value={displayMode}
              onChange={(mode) => setDisplayMode(mode)}
              size="sm"
            />

            {/* Daily Progress Ring */}
            {totalTodayCount > 0 && (
              <div className="flex items-center gap-2.5 bg-[var(--bg-surface-l2)] px-2.5 py-1.5 rounded-lg border border-[var(--border-hairline)] shadow-subtle">
                <div className="text-right">
                  <div className="text-[11px] font-bold text-[var(--text-primary)] font-mono leading-tight">
                    {doneTodayCount}/{totalTodayCount}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-semibold font-mono">
                    {progressPercent}%
                  </div>
                </div>
                <div className="relative w-7 h-7 flex items-center justify-center">
                  <svg className="w-7 h-7 -rotate-90 transform" viewBox="0 0 36 36">
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
                  <span className="absolute text-[8px] font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {progressPercent}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Unified Daily Briefing Ribbon */}
        {(overdueTasks.length > 0 && !isTriageDismissed) || (doneTodayCount > 0 && !isShutdownDismissed) ? (
          <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-l1)] shadow-subtle overflow-hidden transition-all animate-slide-down">
            {/* Briefing Summary Header */}
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-[var(--bg-surface-l2)]/60 border-b border-[var(--border-hairline)]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  Daily Briefing
                </span>
                {overdueTasks.length > 0 && !isTriageDismissed && (
                  <Badge variant="danger" dot size="xs">
                    {overdueTasks.length} overdue
                  </Badge>
                )}
                {doneTodayCount > 0 && !isShutdownDismissed && (
                  <Badge variant="brand" dot size="xs">
                    {doneTodayCount} completed
                  </Badge>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsBriefingCollapsed(!isBriefingCollapsed)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <span>{isBriefingCollapsed ? 'Expand Actions' : 'Collapse'}</span>
                {isBriefingCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              </button>
            </div>

            {/* Briefing Action Body */}
            {!isBriefingCollapsed && (
              <div className="p-3.5 sm:p-4 space-y-3 divide-y divide-[var(--border-hairline)] text-xs">
                {/* Overdue Section */}
                {overdueTasks.length > 0 && !isTriageDismissed && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                        <CalendarClock size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">
                          {overdueTasks.length} uncompleted task{overdueTasks.length > 1 ? 's' : ''} from earlier.
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Keep your board clean with 1-click triage:
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        type="button"
                        variant="primary"
                        size="xs"
                        onClick={() => bulkRescheduleOverdue('today')}
                      >
                        Push to Today
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => bulkRescheduleOverdue('someday')}
                      >
                        Move to Someday
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => bulkRescheduleOverdue('dismiss')}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                {/* Evening Shutdown Section */}
                {doneTodayCount > 0 && !isShutdownDismissed && (
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${overdueTasks.length > 0 && !isTriageDismissed ? 'pt-3' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                        <Moon size={16} />
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">
                          Wrapping up? You completed {doneTodayCount} task{doneTodayCount > 1 ? 's' : ''} today.
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Review progress and disconnect with your evening ritual.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="brand"
                      size="xs"
                      onClick={() => setIsEveningShutdownOpen(true)}
                    >
                      Start Shutdown Ritual
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Conditionally Render: Timeline View or List View */}
      {displayMode === 'timeline' ? (
        <TimelineView
          onSelectTask={onSelectTask}
          onStartFocus={onStartFocus}
          onStartSprint={onStartSprint}
          onOpenStudySession={onOpenStudySession}
        />
      ) : (
        <>
          {/* Omnibar Quick Capture */}
          <Omnibar onOpenBrainDump={onOpenBrainDump} />

          {/* Quick Filters */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {onOpenStudySession && (
                <button
                  type="button"
                  onClick={onOpenStudySession}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 transition-all shadow-xs active:scale-95"
                  title="Plan Study & Deep Work Sessions (DSA, LeetCode, Web Dev)"
                >
                  <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Study Sessions</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setQuickWinsOnly(!quickWinsOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  quickWinsOnly
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-l2)]'
                }`}
              >
                <Zap size={13} className={quickWinsOnly ? 'text-amber-500 fill-amber-500' : ''} />
                Quick Wins (≤15m)
              </button>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="text-xs bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 outline-none transition-colors cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="p1">P1 Urgent only</option>
                <option value="p2">P2 High only</option>
                <option value="p3">P3 Medium only</option>
              </select>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[10px]">j</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[10px]">k</kbd>
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
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  selectedContextTag === null
                    ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-xs'
                    : 'bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Contexts
              </button>
              {availableContextTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedContextTag(selectedContextTag === tag ? null : tag)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs flex items-center gap-1 transition-all shrink-0 ${
                    selectedContextTag === tag
                      ? 'bg-teal-600 text-white font-semibold shadow-xs'
                      : 'bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 border border-teal-500/20'
                  }`}
                >
                  <span>@{tag}</span>
                  <span className="text-[10px] opacity-75 font-sans font-medium">({count})</span>
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
                <div className="py-2.5 px-3.5 rounded-xl border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
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
                    onStartSprint={onStartSprint}
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
              <EmptyState
                icon={<CheckCircle2 size={24} className="text-emerald-500" />}
                title="All clear for today!"
                description="Take a breath, reflect, or enjoy your well-deserved free time."
                action={
                  <Button variant="secondary" size="sm" onClick={onOpenBrainDump}>
                    Open Brain Dump
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {otherActiveTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelectTask={onSelectTask}
                    onStartFocus={onStartFocus}
                    onStartSprint={onStartSprint}
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
