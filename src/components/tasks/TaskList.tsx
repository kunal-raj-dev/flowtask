import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTaskContext } from '../../context/TaskContext';
import type { Task } from '../../types/task';
import { TaskCard } from './TaskCard';
import { VirtualTaskList } from './VirtualTaskList';
import { Omnibar } from './Omnibar';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import {
  Inbox,
  Lightbulb,
  Folder,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
  Flame,
  Archive,
  Filter,
  Clock,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import { filterTasksByPredicate } from '../../utils/smartViewUtils';
import { isTaskBlocked } from '../../utils/dependencyUtils';
import { checkTaskStaleness } from '../../utils/staleTaskDetector';
import { formatLocalDate } from '../../utils/nlpParser';
import { audioEngine } from '../../utils/audioEngine';

interface TaskListProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onOpenBrainDump: () => void;
  onStartSprint?: (taskId: string) => void;
  filterInbox?: boolean;
  filterSomeday?: boolean;
  filterAll?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({
  onSelectTask,
  onStartFocus,
  onOpenBrainDump,
  onStartSprint,
  filterInbox,
  filterSomeday,
  filterAll,
}) => {
  const {
    tasks,
    activeView,
    projects,
    smartViews,
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
    batchUpdateTasks,
    batchDeleteTasks,
    showToast,
  } = useTaskContext();

  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);
  const [selectedContextTag, setSelectedContextTag] = useState<string | null>(null);
  const [dismissedSweeperView, setDismissedSweeperView] = useState<string | null>(null);

  const isInbox = filterInbox || activeView === 'inbox';
  const isSomeday = filterSomeday || activeView === 'someday';
  const isAll = filterAll || activeView === 'all';

  const { viewTitle, viewSubtitle, ViewIcon, gradientBg, filtered, completed } = React.useMemo(() => {
    let title = 'Tasks';
    let subtitle = '';
    let Icon = Folder;
    let bg = 'from-stone-700 to-stone-900';
    let fList: Task[] = [];
    let cList: Task[] = [];

    if (isInbox) {
      title = 'Inbox';
      subtitle = 'Capture thoughts quickly and organize them later';
      Icon = Inbox;
      bg = 'from-blue-500 to-indigo-600';
      fList = tasks.filter(
        (t) =>
          t.status !== 'done' &&
          !t.deletedAt &&
          !t.archivedAt &&
          t.projectId === 'inbox' &&
          !t.dueDate &&
          !t.plannedDate &&
          !t.isSomeday
      );
      cList = tasks.filter(
        (t) => t.status === 'done' && !t.deletedAt && !t.archivedAt && t.projectId === 'inbox'
      );
    } else if (isSomeday) {
      title = 'Someday / Maybe';
      subtitle = 'Ideas, low-pressure backlog, and things to consider eventually';
      Icon = Lightbulb;
      bg = 'from-amber-400 to-yellow-500';
      fList = tasks.filter(
        (t) =>
          t.status !== 'done' &&
          !t.deletedAt &&
          !t.archivedAt &&
          Boolean(t.isSomeday || (!t.dueDate && !t.plannedDate && t.projectId === 'ideas'))
      );
      cList = tasks.filter(
        (t) =>
          t.status === 'done' &&
          !t.deletedAt &&
          !t.archivedAt &&
          Boolean(t.isSomeday || t.projectId === 'ideas')
      );
    } else if (isAll) {
      title = 'All Tasks';
      subtitle = 'Complete workspace backlog and active tasks';
      Icon = CheckCircle2;
      bg = 'from-stone-700 to-stone-900';
      fList = tasks.filter((t) => t.status !== 'done' && !t.deletedAt && !t.archivedAt);
      cList = tasks.filter((t) => t.status === 'done' && !t.deletedAt && !t.archivedAt);
    } else if (activeView.startsWith('project:')) {
      const projId = activeView.split(':')[1];
      const project = projects.find((p) => p.id === projId);
      title = project ? project.name : 'Project';
      subtitle = 'Project workspace';
      Icon = Folder;
      bg = 'from-purple-500 to-indigo-600';
      fList = tasks.filter(
        (t) => t.status !== 'done' && !t.deletedAt && !t.archivedAt && t.projectId === projId
      );
      cList = tasks.filter(
        (t) => t.status === 'done' && !t.deletedAt && !t.archivedAt && t.projectId === projId
      );
    } else if (activeView.startsWith('smart:')) {
      const svId = activeView.split(':')[1];
      const smartView = smartViews.find((sv) => sv.id === svId);
      title = smartView ? smartView.name : 'Smart View';
      subtitle = 'Filtered dynamic perspective';
      if (smartView?.icon === 'zap') {
        Icon = Zap;
        bg = 'from-amber-500 to-orange-500';
      } else if (smartView?.icon === 'brain') {
        Icon = Brain;
        bg = 'from-indigo-600 to-purple-600';
      } else if (smartView?.icon === 'flame') {
        Icon = Flame;
        bg = 'from-rose-500 to-red-600';
      } else if (smartView?.icon === 'archive') {
        Icon = Archive;
        bg = 'from-blue-600 to-cyan-600';
      } else {
        Icon = Filter;
        bg = 'from-indigo-500 to-blue-600';
      }
      const matching = smartView ? filterTasksByPredicate(tasks, smartView.predicate) : [];
      fList = matching.filter((t) => t.status !== 'done' && !t.deletedAt && !t.archivedAt);
      cList = matching.filter((t) => t.status === 'done' && !t.deletedAt && !t.archivedAt);
    } else {
      title = 'All Tasks';
      subtitle = 'Active workspace tasks';
      Icon = CheckCircle2;
      bg = 'from-stone-700 to-stone-900';
      fList = tasks.filter((t) => t.status !== 'done' && !t.deletedAt && !t.archivedAt);
      cList = tasks.filter((t) => t.status === 'done' && !t.deletedAt && !t.archivedAt);
    }

    return {
      viewTitle: title,
      viewSubtitle: subtitle,
      ViewIcon: Icon,
      gradientBg: bg,
      filtered: fList,
      completed: cList,
    };
  }, [isInbox, isSomeday, isAll, tasks, activeView, projects, smartViews]);

  // Extract available context tags for this list
  const availableContextTags = React.useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t) => {
      if (t.contextTags) {
        t.contextTags.forEach((ctx) => {
          map.set(ctx, (map.get(ctx) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const displayedTasks = selectedContextTag
    ? filtered.filter((t) => t.contextTags && t.contextTags.includes(selectedContextTag))
    : filtered;

  const { focusedTaskId } = useKeyboardNavigation({
    tasks: displayedTasks,
    onSelectTask,
    onToggleStatus: toggleTaskStatus,
    onTogglePinToday: toggleTaskPinToday,
    onUpdateTask: updateTask,
    onDeleteTask: deleteTask,
    onStartFocus,
    enabled: true,
  });

  // Stale backlog tasks (>14 days untouched or overdue)
  const staleBacklogTasks = React.useMemo(() => {
    if (activeView !== 'someday' && activeView !== 'inbox') return [];
    return filtered.filter((t) => checkTaskStaleness(t).isStale);
  }, [activeView, filtered]);

  const isSweeperVisible =
    (activeView === 'someday' || activeView === 'inbox') &&
    dismissedSweeperView !== activeView &&
    staleBacklogTasks.length > 0;

  const handleArchiveStale = () => {
    const ids = staleBacklogTasks.map((t) => t.id);
    batchUpdateTasks(ids, { archivedAt: Date.now() });
    audioEngine.playClickSound();
    showToast(`Archived ${ids.length} stale tasks.`);
  };

  const handleSweepToSomeday = () => {
    const ids = staleBacklogTasks.map((t) => t.id);
    batchUpdateTasks(ids, { isSomeday: true, plannedDate: undefined });
    audioEngine.playClickSound();
    showToast(`Moved ${ids.length} tasks to Someday backlog.`);
  };

  const handlePushToToday = () => {
    const todayStr = formatLocalDate(new Date());
    const ids = staleBacklogTasks.map((t) => t.id);
    batchUpdateTasks(ids, { plannedDate: todayStr });
    audioEngine.playClickSound();
    showToast(`Scheduled ${ids.length} tasks for Today!`);
  };

  const isProjectView = activeView.startsWith('project:');
  const projId = isProjectView ? activeView.split(':')[1] : null;
  const project = isProjectView ? projects.find((p) => p.id === projId) : null;

  const totalProjectTasks = filtered.length + completed.length;
  const completionRate = totalProjectTasks > 0 ? Math.round((completed.length / totalProjectTasks) * 100) : 0;
  const totalRemainingMinutes = filtered.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
  const remainingFormatted = totalRemainingMinutes >= 60
    ? `${(totalRemainingMinutes / 60).toFixed(1)} hrs`
    : `${totalRemainingMinutes} mins`;
  const blockedTasksCount = filtered.filter((t) => isTaskBlocked(t, tasks).isBlocked).length;

  return (
    <div className="max-w-3xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className={`p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br ${gradientBg} text-white shadow-sm card-surface flex-shrink-0`}>
          <ViewIcon size={20} className="stroke-[2.2]" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
            {viewTitle}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">{viewSubtitle}</p>
        </div>
      </div>

      {/* Project Executive Cockpit Header */}
      {isProjectView && project && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-[var(--bg-surface-l2)] to-[var(--bg-surface-l1)] border border-[var(--border-hairline)] shadow-sm card-surface animate-slide-down">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full ring-2 ring-stone-900/10 dark:ring-white/20 shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Project Cockpit & Velocity
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {completed.length} of {totalProjectTasks} tasks done ({completionRate}%)
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {totalRemainingMinutes > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                  <Clock size={12} />
                  <span>{remainingFormatted} remaining</span>
                </span>
              )}

              {blockedTasksCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                  <Lock size={12} />
                  <span>{blockedTasksCount} blocked</span>
                </span>
              )}

              {completed.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    batchDeleteTasks(completed.map((t) => t.id));
                  }}
                  title="Clean completed tasks from this project workspace"
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-[var(--border-hairline)] transition-colors flex items-center gap-1 ml-auto sm:ml-0"
                >
                  <Archive size={12} />
                  <span>Clean Completed ({completed.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Project Progress Bar */}
          <div className="w-full h-2 bg-stone-200/60 dark:bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      )}

      {/* Backlog & Someday Hygiene Sweeper Banner */}
      {isSweeperVisible && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/[0.08] via-indigo-500/[0.05] to-transparent border border-amber-500/25 shadow-card card-surface animate-slide-down">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    Backlog Hygiene Sweeper
                  </h4>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    {staleBacklogTasks.length} untouched &gt;14d
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Keep your mind clear by archiving old ideas, parking them in Someday, or committing to Today.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
              <button
                type="button"
                onClick={handleArchiveStale}
                className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-[var(--bg-surface-l2)] hover:bg-rose-500/10 text-stone-700 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 border border-stone-200/80 dark:border-[var(--border-hairline)] transition-all shadow-2xs"
                title="Archive stale items as completed"
              >
                Archive ({staleBacklogTasks.length})
              </button>

              {activeView !== 'someday' && (
                <button
                  type="button"
                  onClick={handleSweepToSomeday}
                  className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-white dark:bg-[var(--bg-surface-l2)] hover:bg-amber-500/10 text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400 border border-stone-200/80 dark:border-[var(--border-hairline)] transition-all shadow-2xs"
                  title="Move to Someday backlog"
                >
                  Sweep to Someday
                </button>
              )}

              <button
                type="button"
                onClick={handlePushToToday}
                className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs"
                title="Commit these tasks to Today"
              >
                Push to Today
              </button>

              <button
                type="button"
                onClick={() => setDismissedSweeperView(activeView)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/10 transition-colors ml-1"
                title="Dismiss sweeper"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <Omnibar onOpenBrainDump={onOpenBrainDump} />

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

      {displayedTasks.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-2xl border border-[var(--border-hairline)]">
          <CheckCircle2 size={36} className="mx-auto mb-2 text-stone-300 dark:text-stone-700" />
          {selectedContextTag ? (
            <>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                No tasks matching @{selectedContextTag}
              </p>
              <button
                type="button"
                onClick={() => setSelectedContextTag(null)}
                className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 transition-all card-surface"
              >
                Clear Context Filter
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[var(--text-primary)]">No active tasks</p>
              <p className="text-xs mt-1 text-[var(--text-secondary)]">Add a task using the bar above or press 'N'.</p>
            </>
          )}
        </div>
      ) : (
        <VirtualTaskList
          tasks={displayedTasks}
          className="space-y-2.5"
          renderTask={(task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelectTask={onSelectTask}
              onStartFocus={onStartFocus}
              onStartSprint={onStartSprint}
              isKeyboardFocused={focusedTaskId === task.id}
            />
          )}
        />
      )}

      {/* Completed Accordion for this View */}
      {completed.length > 0 && (
        <div className="pt-4 border-t border-[var(--border-hairline)] mt-8">
          <button
            type="button"
            onClick={() => setIsCompletedCollapsed((prev) => !prev)}
            className="flex items-center justify-between w-full text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1 group"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500" />
              <span>Completed ({completed.length})</span>
            </span>
            <span className="text-[11px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] flex items-center gap-1 font-normal">
              {isCompletedCollapsed ? 'Show' : 'Hide'}
              {isCompletedCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </span>
          </button>

          <AnimatePresence>
            {!isCompletedCollapsed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden"
              >
                <VirtualTaskList
                  tasks={completed}
                  className="space-y-2"
                  renderTask={(task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onSelectTask={onSelectTask}
                    />
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
