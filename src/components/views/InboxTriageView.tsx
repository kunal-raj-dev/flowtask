import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  Check,
  Clock,
  Folder,
  Sparkles,
  ArrowRight,
  Sun,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { isInboxTask } from '../../utils/taskSelectors';
import { formatLocalDate } from '../../utils/nlpParser';
import { suggestSubtasks } from '../../utils/aiCopilot';
import { audioEngine } from '../../utils/audioEngine';
import celebrate from '../../utils/celebrate';
import { Badge } from '../ui';
import type { Task, Priority } from '../../types/task';
import { shouldIgnoreShortcut } from '../../services/shortcutRegistry';

interface InboxTriageViewProps {
  onSelectTask?: (id: string) => void;
  onGoToToday?: () => void;
  embedded?: boolean;
}

export const InboxTriageView: React.FC<InboxTriageViewProps> = ({
  onSelectTask,
  onGoToToday,
  embedded = false,
}) => {
  const {
    tasks,
    projects,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    undoLastAction,
    showToast,
    addSubTasks,
  } = useTaskContext();

  const todayStr = useTodayStr();
  const [snoozeMenuOpen, setSnoozeMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const hadTasksRef = useRef(false);

  // Filter inbox tasks
  const inboxTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.deletedAt && !t.archivedAt && t.status !== 'done' && isInboxTask(t, todayStr, { tasks, projects }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [tasks, projects, todayStr]);

  const currentTask: Task | undefined = inboxTasks[0];
  const remainingCount = inboxTasks.length;

  // Track transition to Inbox Zero for celebration
  useEffect(() => {
    if (inboxTasks.length > 0) {
      hadTasksRef.current = true;
    } else if (hadTasksRef.current && inboxTasks.length === 0) {
      hadTasksRef.current = false;
      celebrate({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#6366F1', '#3B82F6'],
      });
      try {
        audioEngine.playTaskComplete();
      } catch {}
    }
  }, [inboxTasks.length]);

  // Action: Mark Complete / Done
  const handleDone = useCallback(() => {
    if (!currentTask) return;
    try {
      audioEngine.playTaskComplete();
    } catch {}
    toggleTaskStatus(currentTask.id);
    showToast(`Marked "${currentTask.title}" as complete`, 'Undo', () => {
      undoLastAction();
    });
  }, [currentTask, toggleTaskStatus, showToast, undoLastAction]);

  // Action: Snooze to specific date
  const handleSnooze = useCallback(
    (offsetDays: number | 'someday') => {
      if (!currentTask) return;
      try {
        audioEngine.playClickSound();
      } catch {}

      if (offsetDays === 'someday') {
        updateTask(currentTask.id, { isSomeday: true, projectId: 'ideas' });
        showToast(`Moved to Someday`, 'Undo', () => undoLastAction());
      } else {
        const target = new Date();
        target.setDate(target.getDate() + offsetDays);
        const dateStr = formatLocalDate(target);
        updateTask(currentTask.id, { plannedDate: dateStr });
        const label = offsetDays === 0 ? 'Today' : offsetDays === 1 ? 'Tomorrow' : `in ${offsetDays} days`;
        showToast(`Scheduled for ${label}`, 'Undo', () => undoLastAction());
      }
      setSnoozeMenuOpen(false);
    },
    [currentTask, updateTask, showToast, undoLastAction]
  );

  // Action: Move to project
  const handleSetProject = useCallback(
    (projectId: string) => {
      if (!currentTask) return;
      try {
        audioEngine.playClickSound();
      } catch {}
      const proj = projects.find((p) => p.id === projectId);
      updateTask(currentTask.id, { projectId });
      showToast(`Assigned to ${proj?.name || 'Project'}`, 'Undo', () => undoLastAction());
      setProjectMenuOpen(false);
    },
    [currentTask, projects, updateTask, showToast, undoLastAction]
  );

  // Action: Set priority
  const handleSetPriority = useCallback(
    (priority: Priority) => {
      if (!currentTask) return;
      try {
        audioEngine.playClickSound();
      } catch {}
      updateTask(currentTask.id, { priority });
      showToast(`Priority set to ${priority.toUpperCase()}`);
    },
    [currentTask, updateTask, showToast]
  );

  // Action: AI Auto-Breakdown
  const handleAiBreakdown = useCallback(async () => {
    if (!currentTask || isBreakingDown) return;
    setIsBreakingDown(true);
    try {
      audioEngine.playClickSound();
    } catch {}

    const subtasks = suggestSubtasks(currentTask.title, currentTask.description);
    if (subtasks.length > 0) {
      addSubTasks(
        currentTask.id,
        subtasks.map((s) => ({ title: s.title, estimatedMinutes: s.estimatedMinutes }))
      );
      showToast(`AI broke into ${subtasks.length} actionable micro-steps!`);
    } else {
      showToast('Task is already at atomic granularity.');
    }
    setIsBreakingDown(false);
  }, [currentTask, isBreakingDown, addSubTasks, showToast]);

  // Action: Delete
  const handleDelete = useCallback(() => {
    if (!currentTask) return;
    try {
      audioEngine.playClickSound();
    } catch {}
    deleteTask(currentTask.id);
    showToast(`Deleted "${currentTask.title}"`, 'Undo', () => undoLastAction());
  }, [currentTask, deleteTask, showToast, undoLastAction]);

  // Global Keyboard shortcuts for Triage (E, S, P, 1-4, B, Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[aria-modal="true"]')) return;
      if (shouldIgnoreShortcut(e)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!currentTask) return;

      const key = e.key.toLowerCase();
      if (key === 'e') {
        e.preventDefault();
        handleDone();
      } else if (key === 's') {
        e.preventDefault();
        setSnoozeMenuOpen((prev) => !prev);
      } else if (key === 'p') {
        e.preventDefault();
        setProjectMenuOpen((prev) => !prev);
      } else if (key === 'b') {
        e.preventDefault();
        handleAiBreakdown();
      } else if (key === '1') {
        e.preventDefault();
        handleSetPriority('p1');
      } else if (key === '2') {
        e.preventDefault();
        handleSetPriority('p2');
      } else if (key === '3') {
        e.preventDefault();
        handleSetPriority('p3');
      } else if (key === '4') {
        e.preventDefault();
        handleSetPriority('p4');
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        setSnoozeMenuOpen(false);
        setProjectMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTask, handleDone, handleAiBreakdown, handleSetPriority, handleDelete]);

  return (
    <div className={embedded ? 'inbox-process-view' : 'flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)]'}>
      {/* Top Header Bar */}
      {!embedded && <header className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between shrink-0 bg-[var(--bg-surface-l1)]/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Inbox size={20} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight flex items-center gap-2">
              Superhuman Inbox Triage
              <Badge variant={remainingCount === 0 ? 'success' : 'brand'} size="xs" className="font-mono tabular-nums">
                {remainingCount} {remainingCount === 1 ? 'task' : 'tasks'}
              </Badge>
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Process incoming items with sub-100ms keyboard shortcuts.
            </p>
          </div>
        </div>

        {remainingCount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l3)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-bold">
              E
            </kbd>
            <span>Done</span>
            <span className="opacity-40">•</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l3)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-bold">
              S
            </kbd>
            <span>Snooze</span>
            <span className="opacity-40">•</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l3)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-bold">
              B
            </kbd>
            <span>Breakdown</span>
          </div>
        )}
      </header>}

      {/* Main Content Workspace */}
      <div className={embedded ? 'inbox-process-content' : 'flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center'}>
        {remainingCount === 0 ? (
          /* Inbox Zero Celebratory State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="text-center max-w-md mx-auto space-y-5"
          >
            <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shadow-cute-card">
              <Zap size={36} strokeWidth={2.5} className="animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Inbox Zero Achieved
              </h2>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                You are completely clear. Every thought has been routed, prioritized, or executed.
              </p>
            </div>
            {onGoToToday && (
              <button
                onClick={onGoToToday}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-[var(--text-on-brand)] text-sm font-semibold shadow-subtle hover:bg-[var(--color-brand-hover)] transition-all enabled:active:scale-[0.96]"
              >
                <Sun size={16} />
                Jump to Today&apos;s Focus
                <ArrowRight size={14} />
              </button>
            )}
          </motion.div>
        ) : (
          /* Active Front-of-Queue Task Card */
          <div className="w-full max-w-2xl space-y-6">
            <AnimatePresence mode="wait">
              {currentTask && (
                <motion.div
                  key={currentTask.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                  className="bg-[var(--bg-surface-l1)] border border-[var(--border-strong)] rounded-2xl p-6 sm:p-8 shadow-elevated space-y-6 relative overflow-hidden"
                >
                  {/* Priority & Project Banner */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          currentTask.priority === 'p1'
                            ? 'danger'
                            : currentTask.priority === 'p2'
                            ? 'brand'
                            : 'neutral'
                        }
                        size="sm"
                        className="font-mono font-bold uppercase"
                      >
                        {currentTask.priority.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        {currentTask.estimatedMinutes
                          ? `${currentTask.estimatedMinutes}m est.`
                          : 'No estimate'}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-[var(--text-muted)]">
                      Task 1 of {remainingCount}
                    </div>
                  </div>

                  {/* Task Title */}
                  <div className="space-y-2">
                    <h2
                      onClick={() => onSelectTask?.(currentTask.id)}
                      className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] cursor-pointer hover:text-[var(--color-brand)] transition-colors"
                    >
                      {currentTask.title}
                    </h2>
                    {currentTask.description && (
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                        {currentTask.description}
                      </p>
                    )}
                  </div>

                  {/* Subtasks Preview if any */}
                  {currentTask.subtasks && currentTask.subtasks.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-[var(--border-hairline)]">
                      <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        Actionable Steps ({currentTask.subtasks.filter((s) => s.completed).length}/
                        {currentTask.subtasks.length})
                      </div>
                      <div className="space-y-1">
                        {currentTask.subtasks.slice(0, 4).map((st) => (
                          <div
                            key={st.id}
                            className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                                st.completed
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'border-[var(--border-strong)]'
                              }`}
                            >
                              {st.completed && <Check size={10} />}
                            </span>
                            <span className={st.completed ? 'line-through opacity-60' : ''}>
                              {st.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Triage Action Halo Bar */}
                  <div className="pt-4 border-t border-[var(--border-hairline)] grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Mark Complete */}
                    <button
                      onClick={handleDone}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/30 transition-all enabled:active:scale-[0.96]"
                    >
                      <Check size={14} strokeWidth={2.5} />
                      Complete <kbd className="text-[10px] opacity-75 font-mono">[E]</kbd>
                    </button>

                    {/* Snooze / Plan */}
                    <div className="relative">
                      <button
                        onClick={() => setSnoozeMenuOpen((prev) => !prev)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-l3)] text-xs font-bold border border-[var(--border-hairline)] transition-all enabled:active:scale-[0.96]"
                      >
                        <Clock size={14} />
                        Snooze <kbd className="text-[10px] opacity-75 font-mono">[S]</kbd>
                      </button>

                      {snoozeMenuOpen && (
                        <div className="absolute bottom-full mb-2 left-0 w-44 bg-[var(--bg-surface-l1)] border border-[var(--border-strong)] rounded-xl shadow-modal p-1.5 z-30 space-y-1">
                          <button
                            onClick={() => handleSnooze(0)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-surface-l3)] flex items-center justify-between"
                          >
                            <span>Today</span>
                            <span className="text-[10px] opacity-60 font-mono">Today</span>
                          </button>
                          <button
                            onClick={() => handleSnooze(1)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-surface-l3)] flex items-center justify-between"
                          >
                            <span>Tomorrow</span>
                            <span className="text-[10px] opacity-60 font-mono">+1d</span>
                          </button>
                          <button
                            onClick={() => handleSnooze(7)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-surface-l3)] flex items-center justify-between"
                          >
                            <span>Next Week</span>
                            <span className="text-[10px] opacity-60 font-mono">+7d</span>
                          </button>
                          <button
                            onClick={() => handleSnooze('someday')}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-surface-l3)] flex items-center justify-between text-amber-500"
                          >
                            <span>Someday</span>
                            <span className="text-[10px] opacity-60 font-mono">Backlog</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Move to Project */}
                    <div className="relative">
                      <button
                        onClick={() => setProjectMenuOpen((prev) => !prev)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-l3)] text-xs font-bold border border-[var(--border-hairline)] transition-all enabled:active:scale-[0.96]"
                      >
                        <Folder size={14} />
                        Project <kbd className="text-[10px] opacity-75 font-mono">[P]</kbd>
                      </button>

                      {projectMenuOpen && (
                        <div className="absolute bottom-full mb-2 left-0 w-48 max-h-56 overflow-y-auto bg-[var(--bg-surface-l1)] border border-[var(--border-strong)] rounded-xl shadow-modal p-1.5 z-30 space-y-1">
                          {projects.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleSetProject(p.id)}
                              className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[var(--bg-surface-l3)] flex items-center gap-2 truncate"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: p.color || '#3B82F6' }}
                              />
                              <span className="truncate">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* AI Breakdown */}
                    <button
                      onClick={handleAiBreakdown}
                      disabled={isBreakingDown}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-bold border border-purple-500/30 transition-all enabled:active:scale-[0.96]"
                    >
                      <Sparkles size={14} className={isBreakingDown ? 'animate-spin' : ''} />
                      Breakdown <kbd className="text-[10px] opacity-75 font-mono">[B]</kbd>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upcoming Queue Preview */}
            {inboxTasks.length > 1 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                  Next in Queue ({inboxTasks.length - 1} remaining)
                </div>
                <div className="space-y-1.5 opacity-75">
                  {inboxTasks.slice(1, 4).map((t, idx) => (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask?.(t.id)}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-l1)]/70 border border-[var(--border-hairline)] text-xs hover:border-[var(--border-strong)] transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="font-mono text-[var(--text-muted)] w-4 text-center">
                          {idx + 2}
                        </span>
                        <span className="font-medium text-[var(--text-primary)] truncate">
                          {t.title}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
