import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useUIStore } from '../../store/useUIStore';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  Search,
  Sun,
  Inbox,
  Calendar,
  Grid2X2,
  Kanban,
  Moon,
  Timer,
  Sparkles,
  DownloadCloud,
  Cloud,
  TrendingUp,
  Palette,
  Filter,
  MessageSquare,
  Share2,
  Printer,
  FileEdit,
  Compass,
  CheckCircle2,
  Circle,
  AlertCircle,
  Undo2,
  Redo2,
  Trash2,
  Star,
  Sunrise,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { generateDailyStandup } from '../../utils/standupGenerator';
import { audioEngine } from '../../utils/audioEngine';
import confetti from '../../utils/celebrate';
import { parseSearchDSL } from '../../utils/searchDSL';
import { searchTasksFuzzy, calculateFuzzyScore } from '../../utils/fuzzySearch';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  onOpenPomodoro: () => void;
  onOpenBrainDump: () => void;
  onOpenExportImport: () => void;
  onOpenAesthetics?: () => void;
  onOpenScratchpad?: () => void;
  onOpenStudySession?: () => void;
}

type PaletteLevel = 'root' | 'task_actions';

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTask,
  onOpenPomodoro,
  onOpenBrainDump,
  onOpenExportImport,
  onOpenAesthetics,
  onOpenScratchpad,
  onOpenStudySession,
}) => {
  const {
    tasks,
    projects,
    updateTask,
    deleteTask,
    toggleTaskPinToday,
    startFocusSession,
    setActiveView,
    toggleTheme,
    theme,
    setIsAuthModalOpen,
    setIsEveningShutdownOpen,
    setIsSmartFilterModalOpen,
    setIsWeeklyReviewOpen,
    undoLastAction,
    redoLastAction,
  } = useTaskContext();

  const setIsMorningKickoffOpen = useUIStore((s) => s.setIsMorningKickoffOpen);

  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<PaletteLevel>('root');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const [prevQuery, setPrevQuery] = useState(query);
  const [prevLevel, setPrevLevel] = useState(level);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (query !== prevQuery || level !== prevLevel) {
    setPrevQuery(query);
    setPrevLevel(level);
    setSelectedIndex(0);
  }

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setQuery('');
    setLevel('root');
    setActiveTaskId(null);
    setSelectedIndex(0);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const todayStr = useTodayStr();
  const dsl = parseSearchDSL(query);
  const hasFilterActive = Boolean(
    dsl.text ||
    dsl.priority ||
    dsl.contextTag ||
    dsl.tag ||
    dsl.status ||
    dsl.isOverdue ||
    dsl.isPinned ||
    dsl.isRecurring
  );

  // Filter and rank tasks using Query DSL + Fuzzy Search Engine
  const matchedTasks = useMemo(() => {
    if (!hasFilterActive && !query.trim()) return [];

    let pool = tasks.filter((t) => !t.deletedAt);
    if (dsl.priority) pool = pool.filter((t) => t.priority === dsl.priority);
    if (dsl.status) pool = pool.filter((t) => t.status === dsl.status);
    if (dsl.isOverdue) pool = pool.filter((t) => t.status !== 'done' && Boolean(t.dueDate && t.dueDate < todayStr));
    if (dsl.isPinned) pool = pool.filter((t) => Boolean(t.isPinnedToday));
    if (dsl.isRecurring) pool = pool.filter((t) => Boolean((t.recurrence && t.recurrence !== 'none') || t.customRecurrence));
    if (dsl.contextTag) {
      pool = pool.filter((t) => t.contextTags && t.contextTags.some((c) => c.toLowerCase().includes(dsl.contextTag!)));
    }
    if (dsl.tag) {
      pool = pool.filter((t) => t.tags && t.tags.some((tag) => tag.toLowerCase().includes(dsl.tag!)));
    }

    if (dsl.text) {
      const fuzzyMatches = searchTasksFuzzy(pool, dsl.text, projects, 10);
      return fuzzyMatches.map((res) => ({
        ...res.task,
        matchedField: res.matchedField,
        projectName: res.projectName,
      }));
    }

    return pool.slice(0, 10).map((t) => {
      const proj = projects.find((p) => p.id === t.projectId);
      return {
        ...t,
        matchedField: undefined as string | undefined,
        projectName: proj?.name,
      };
    });
  }, [tasks, projects, dsl, hasFilterActive, query, todayStr]);

  const handleAppendQueryToken = (token: string) => {
    setQuery((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${token}` : token;
    });
    inputRef.current?.focus();
  };

  const actions = useMemo(() => [
    {
      id: 'morning-kickoff',
      title: 'Start Morning Kickoff Ritual (<45s)',
      icon: Sunrise,
      run: () => {
        onClose();
        setIsMorningKickoffOpen(true);
      },
    },
    {
      id: 'study-sessions',
      title: 'Plan Study & Deep Work Sessions (DSA, LeetCode, Web Dev)',
      icon: Sparkles,
      run: () => {
        onClose();
        onOpenStudySession?.();
      },
    },
    {
      id: 'weekly-review',
      title: 'Weekly Review & Retrospective Wizard (Ctrl+Shift+W)',
      icon: Compass,
      run: () => setIsWeeklyReviewOpen(true),
    },
    {
      id: 'today',
      title: 'Go to Today',
      icon: Sun,
      run: () => setActiveView('today'),
    },
    {
      id: 'inbox',
      title: 'Go to Inbox',
      icon: Inbox,
      run: () => setActiveView('inbox'),
    },
    {
      id: 'upcoming',
      title: 'Go to Upcoming',
      icon: Calendar,
      run: () => setActiveView('upcoming'),
    },
    {
      id: 'matrix',
      title: 'Go to Priority Matrix',
      icon: Grid2X2,
      run: () => setActiveView('matrix'),
    },
    {
      id: 'kanban',
      title: 'Go to Kanban Board',
      icon: Kanban,
      run: () => setActiveView('kanban'),
    },
    {
      id: 'insights',
      title: 'Go to Productivity Insights & Stats',
      icon: TrendingUp,
      run: () => setActiveView('insights'),
    },
    {
      id: 'timer',
      title: 'Start Focus Timer & Pomodoro',
      icon: Timer,
      run: () => onOpenPomodoro(),
    },
    {
      id: 'braindump',
      title: 'Open Multi-line Brain Dump',
      icon: Sparkles,
      run: () => onOpenBrainDump(),
    },
    {
      id: 'scratchpad',
      title: 'Open Sticky Scratchpad (Alt+N)',
      icon: FileEdit,
      run: () => {
        onClose();
        onOpenScratchpad?.();
      },
    },
    {
      id: 'undo',
      title: 'Undo Last Action (Ctrl+Z)',
      icon: Undo2,
      run: () => {
        onClose();
        undoLastAction();
      },
    },
    {
      id: 'redo',
      title: 'Redo Last Action (Ctrl+Shift+Z / Ctrl+Y)',
      icon: Redo2,
      run: () => {
        onClose();
        redoLastAction();
      },
    },
    {
      id: 'standup',
      title: 'Copy Daily Standup & Digest (Slack / Markdown)',
      icon: MessageSquare,
      run: () => {
        const text = generateDailyStandup(tasks, projects, { format: 'slack' });
        navigator.clipboard.writeText(text);
        audioEngine.playCompletionChime();
        confetti({ particleCount: 30, spread: 60, origin: { y: 0.6 } });
        onClose();
      },
    },
    {
      id: 'share-snapshot',
      title: 'Share Tasks via Zero-Auth Snapshot Link',
      icon: Share2,
      run: () => onOpenExportImport(),
    },
    {
      id: 'export',
      title: 'Workday Portability, Backups & CSV Export',
      icon: DownloadCloud,
      run: () => onOpenExportImport(),
    },
    {
      id: 'cloud-sync',
      title: 'Cloud Synchronization & Account Settings',
      icon: Cloud,
      run: () => setIsAuthModalOpen(true),
    },
    {
      id: 'aesthetics',
      title: 'Theme & Sound Aesthetics (8 Colorways, 8 Audio Profiles & Ambient Focus)',
      icon: Palette,
      run: () => onOpenAesthetics && onOpenAesthetics(),
    },
    {
      id: 'evening-shutdown',
      title: 'Daily Evening Shutdown Ritual (Ctrl+Shift+D)',
      icon: Moon,
      run: () => setIsEveningShutdownOpen(true),
    },
    {
      id: 'create-smart-view',
      title: 'Create Smart Filter View',
      icon: Filter,
      run: () => setIsSmartFilterModalOpen(true),
    },
    {
      id: 'theme',
      title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      icon: theme === 'dark' ? Sun : Moon,
      run: () => toggleTheme(),
    },
    {
      id: 'print-agenda',
      title: "Print Today's Agenda / Save as PDF",
      icon: Printer,
      run: () => {
        onClose();
        setTimeout(() => window.print(), 200);
      },
    },
  ], [
    onClose,
    setIsMorningKickoffOpen,
    onOpenStudySession,
    setIsWeeklyReviewOpen,
    setActiveView,
    onOpenPomodoro,
    onOpenBrainDump,
    onOpenScratchpad,
    undoLastAction,
    redoLastAction,
    onOpenExportImport,
    setIsAuthModalOpen,
    onOpenAesthetics,
    setIsEveningShutdownOpen,
    setIsSmartFilterModalOpen,
    theme,
    toggleTheme,
    tasks,
    projects,
  ]);

  const filteredActions = useMemo(() => {
    if (!dsl.text) return actions;
    return actions
      .map((a) => ({ action: a, match: calculateFuzzyScore(dsl.text, a.title) }))
      .filter(({ match }) => match.isMatch)
      .sort((a, b) => b.match.score - a.match.score)
      .map(({ action }) => action);
  }, [actions, dsl.text]);

  // Sub-palette active task and its contextual actions
  const activeTask = useMemo(
    () => (activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null),
    [tasks, activeTaskId]
  );

  const tomorrowStr = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, (d || 1) + 1, 12, 0, 0);
    return formatLocalDate(dt);
  }, [todayStr]);

  const taskSubActions = useMemo(() => {
    if (!activeTask) return [];
    const today = todayStr;

    return [
      {
        id: 'p1',
        keyHint: '1',
        title: 'Priority 1: Urgent & Important (P1)',
        icon: AlertCircle,
        run: () => {
          updateTask(activeTask.id, { priority: 'p1' });
          onClose();
        },
      },
      {
        id: 'p2',
        keyHint: '2',
        title: 'Priority 2: High Priority (P2)',
        icon: Circle,
        run: () => {
          updateTask(activeTask.id, { priority: 'p2' });
          onClose();
        },
      },
      {
        id: 'p3',
        keyHint: '3',
        title: 'Priority 3: Medium Priority (P3)',
        icon: Circle,
        run: () => {
          updateTask(activeTask.id, { priority: 'p3' });
          onClose();
        },
      },
      {
        id: 'p4',
        keyHint: '4',
        title: 'Priority 4: Low Priority (P4)',
        icon: Circle,
        run: () => {
          updateTask(activeTask.id, { priority: 'p4' });
          onClose();
        },
      },
      {
        id: 'today',
        keyHint: 'T',
        title: 'Schedule for Today',
        icon: Sun,
        run: () => {
          updateTask(activeTask.id, { plannedDate: today, isSomeday: false });
          onClose();
        },
      },
      {
        id: 'tomorrow',
        keyHint: 'M',
        title: 'Schedule for Tomorrow',
        icon: Calendar,
        run: () => {
          updateTask(activeTask.id, { plannedDate: tomorrowStr, isSomeday: false });
          onClose();
        },
      },
      {
        id: 'someday',
        keyHint: 'S',
        title: 'Move to Someday (Defer indefinitely)',
        icon: Clock,
        run: () => {
          updateTask(activeTask.id, { isSomeday: true, plannedDate: undefined, isPinnedToday: false });
          onClose();
        },
      },
      {
        id: 'focus',
        keyHint: 'F',
        title: activeTask.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Designate as Top 3 Focus',
        icon: Star,
        run: () => {
          toggleTaskPinToday(activeTask.id);
          onClose();
        },
      },
      {
        id: 'timer',
        keyHint: 'P',
        title: 'Start Deep Work Timer (Zen HUD)',
        icon: Timer,
        run: () => {
          onClose();
          startFocusSession('pomodoro', activeTask.id, activeTask.title);
        },
      },
      {
        id: 'trash',
        keyHint: 'D',
        title: 'Move to Trash',
        icon: Trash2,
        run: () => {
          deleteTask(activeTask.id);
          onClose();
        },
      },
    ];
  }, [activeTask, updateTask, toggleTaskPinToday, startFocusSession, deleteTask, onClose, todayStr, tomorrowStr]);

  // Auto-scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedIndex, level]);

  // Keyboard navigation & execution state machine
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (level === 'task_actions') {
          setLevel('root');
          setSelectedIndex(0);
        } else {
          onClose();
        }
        return;
      }

      const totalItems = level === 'root' ? matchedTasks.length + filteredActions.length : taskSubActions.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (totalItems > 0) {
          setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (totalItems > 0) {
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        }
        return;
      }

      if (e.key === 'Tab' || e.key === 'ArrowRight') {
        if (level === 'root' && selectedIndex < matchedTasks.length) {
          e.preventDefault();
          setActiveTaskId(matchedTasks[selectedIndex].id);
          setLevel('task_actions');
          setSelectedIndex(0);
          return;
        }
      }

      if (level === 'task_actions' && (e.key === 'ArrowLeft' || e.key === 'Backspace')) {
        e.preventDefault();
        setLevel('root');
        setSelectedIndex(0);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (level === 'root') {
          if (selectedIndex < matchedTasks.length) {
            const task = matchedTasks[selectedIndex];
            onSelectTask(task.id);
            onClose();
          } else {
            const actionIdx = selectedIndex - matchedTasks.length;
            const action = filteredActions[actionIdx];
            if (action) {
              action.run();
              onClose();
            }
          }
        } else if (level === 'task_actions') {
          const action = taskSubActions[selectedIndex];
          if (action) {
            action.run();
          }
        }
        return;
      }

      // Single-key sub-palette accelerators (1-4, T, M, S, F, P, D)
      if (level === 'task_actions') {
        const keyUpper = e.key.toUpperCase();
        const subMatch = taskSubActions.find((a) => a.keyHint.toUpperCase() === keyUpper);
        if (subMatch) {
          e.preventDefault();
          subMatch.run();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    level,
    selectedIndex,
    matchedTasks,
    filteredActions,
    taskSubActions,
    query,
    onClose,
    onSelectTask,
  ]);

  const dslChips = [
    { label: 'p:p1', desc: 'Priority P1' },
    { label: 'status:todo', desc: 'Incomplete' },
    { label: 'is:overdue', desc: 'Overdue' },
    { label: '@focus', desc: 'Context' },
    { label: '#work', desc: 'Tag' },
  ];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-start justify-center pt-20 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface-l2)] rounded-xl border border-[var(--border-hairline)] shadow-modal overflow-hidden card-surface animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar or Sub-Palette Breadcrumb */}
        {level === 'root' ? (
          <div className="flex items-center px-4 py-3.5 border-b border-[var(--border-hairline)]">
            <Search size={18} className="text-[var(--text-muted)] mr-3 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              id="command-palette-input"
              name="commandPaletteQuery"
              aria-label="Command palette query"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command, task title, or DSL: p:p1, @focus, #tag, is:overdue..."
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
            />
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-surface-l1)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              ESC
            </kbd>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/60">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setLevel('root');
                  setSelectedIndex(0);
                }}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Tasks</span>
                <ChevronRight size={12} />
              </button>
              <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                {activeTask?.title || 'Task Actions'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
              Esc / ← Back
            </span>
          </div>
        )}

        {/* Query DSL Chips Bar (Only in root level) */}
        {level === 'root' && (
          <div className="px-4 py-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/40 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-[var(--text-muted)] font-medium text-[10px] uppercase tracking-wider shrink-0 mr-1">
              DSL:
            </span>
            {dslChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => handleAppendQueryToken(chip.label)}
                className="px-2 py-0.5 rounded-md bg-[var(--bg-surface-l2)] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 border border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono text-[10px] transition-colors shrink-0"
                title={`Append ${chip.label} (${chip.desc})`}
              >
                {chip.label}
              </button>
            ))}
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="ml-auto text-[10px] text-[var(--text-muted)] hover:text-rose-500 transition-colors shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2.5 space-y-1">
          {level === 'root' ? (
            <>
              {/* Matched Tasks Section */}
              {matchedTasks.length > 0 && (
                <div className="mb-2.5">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2.5 py-1">
                    <span>Matched Tasks ({matchedTasks.length})</span>
                    <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-normal">
                      Press Tab or → for actions
                    </span>
                  </div>
                  {matchedTasks.map((task, idx) => {
                    const isSelected = selectedIndex === idx;
                    return (
                      <button
                        key={task.id}
                        ref={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        onClick={() => {
                          onSelectTask(task.id);
                          onClose();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors gap-2 ${
                          isSelected
                            ? 'bg-amber-500/15 text-[var(--text-primary)] ring-1 ring-amber-500/30 font-semibold'
                            : 'hover:bg-stone-200/50 dark:hover:bg-white/[0.06] text-[var(--text-secondary)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {task.status === 'done' ? (
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          ) : task.priority === 'p1' ? (
                            <AlertCircle size={13} className="text-rose-500 shrink-0" />
                          ) : (
                            <Circle size={13} className="text-[var(--text-muted)] shrink-0" />
                          )}
                          <span className={`truncate ${task.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                            {task.title}
                          </span>
                          {task.projectName && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium shrink-0 hidden sm:inline">
                              {task.projectName}
                            </span>
                          )}
                          {task.contextTags && task.contextTags.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono shrink-0">
                              @{task.contextTags[0]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            {task.plannedDate || task.dueDate || 'No date'}
                          </span>
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[var(--bg-surface-l1)] text-[var(--text-muted)] hidden sm:inline">
                            Tab →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {hasFilterActive && matchedTasks.length === 0 && dsl.text && (
                <div className="text-center py-4 text-xs text-[var(--text-muted)]">
                  No tasks matched query &ldquo;{query}&rdquo;
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2.5 py-1">
                  Navigation & Actions
                </div>
                {filteredActions.map((action, actionIdx) => {
                  const globalIdx = matchedTasks.length + actionIdx;
                  const isSelected = selectedIndex === globalIdx;
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      ref={(el) => {
                        itemRefs.current[globalIdx] = el;
                      }}
                      onClick={() => {
                        action.run();
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors text-left ${
                        isSelected
                          ? 'bg-amber-500/15 text-[var(--text-primary)] ring-1 ring-amber-500/30 font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1 rounded-md bg-[var(--bg-surface-l1)]">
                          <Icon size={15} className={isSelected ? 'text-amber-500' : 'text-[var(--text-muted)]'} />
                        </div>
                        <span className="font-medium">{action.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">↵</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Sub-palette: Task Actions */
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2.5 py-1">
                Actions for &ldquo;{activeTask?.title}&rdquo;
              </div>
              {taskSubActions.map((action, idx) => {
                const isSelected = selectedIndex === idx;
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    onClick={() => action.run()}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-amber-500/15 text-[var(--text-primary)] ring-1 ring-amber-500/30 font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1 rounded-md bg-[var(--bg-surface-l1)]">
                        <Icon size={15} className={isSelected ? 'text-amber-500' : 'text-[var(--text-muted)]'} />
                      </div>
                      <span className="font-medium">{action.title}</span>
                    </div>
                    <kbd className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-surface-l1)] text-[var(--text-muted)] border border-[var(--border-hairline)] font-bold">
                      {action.keyHint}
                    </kbd>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Footer Bar */}
        <div className="px-4 py-2.5 bg-[var(--bg-surface-l1)]/90 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-muted)] select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] font-mono text-[10px] font-semibold text-[var(--text-secondary)] shadow-xs">↵</kbd>
              <span>{level === 'root' ? 'Select / Run' : 'Execute'}</span>
            </span>
            {level === 'root' ? (
              <span className="flex items-center gap-1.5 hidden sm:inline-flex">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] font-mono text-[10px] font-semibold text-[var(--text-secondary)] shadow-xs">Tab / →</kbd>
                <span>Task Sub-Palette</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] font-mono text-[10px] font-semibold text-[var(--text-secondary)] shadow-xs">← / Esc</kbd>
                <span>Back to List</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] font-mono text-[10px] font-semibold text-[var(--text-secondary)] shadow-xs">↑↓</kbd>
              <span>Navigate</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
