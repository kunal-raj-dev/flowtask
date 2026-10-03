import React, { useState, useEffect, useRef } from 'react';
import { useTaskContext } from '../../context/TaskContext';
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
} from 'lucide-react';
import { generateDailyStandup } from '../../utils/standupGenerator';
import { formatLocalDate } from '../../utils/nlpParser';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';
import { parseSearchDSL } from '../../utils/searchDSL';

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
    setActiveView,
    toggleTheme,
    theme,
    setIsAuthModalOpen,
    setIsEveningShutdownOpen,
    setIsSmartFilterModalOpen,
    setIsWeeklyReviewOpen,
    undoLastAction,
  } = useTaskContext();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const todayStr = formatLocalDate(new Date());
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

  // Filter tasks based on Query DSL
  const matchedTasks = hasFilterActive
    ? tasks
        .filter((t) => {
          if (dsl.priority && t.priority !== dsl.priority) return false;
          if (dsl.contextTag) {
            const hasCtx = t.contextTags && t.contextTags.some((ctx) => ctx.toLowerCase().includes(dsl.contextTag!));
            if (!hasCtx) return false;
          }
          if (dsl.tag) {
            const hasTag = t.tags && t.tags.some((tag) => tag.toLowerCase().includes(dsl.tag!));
            if (!hasTag) return false;
          }
          if (dsl.status) {
            if (t.status !== dsl.status) return false;
          }
          if (dsl.isOverdue) {
            if (t.status === 'done' || !t.dueDate || t.dueDate >= todayStr) return false;
          }
          if (dsl.isPinned) {
            if (!t.isPinnedToday) return false;
          }
          if (dsl.isRecurring) {
            if (!t.recurrence && !t.customRecurrence) return false;
          }
          if (dsl.text) {
            const matchTitle = t.title.toLowerCase().includes(dsl.text.toLowerCase());
            const matchDesc = t.description?.toLowerCase().includes(dsl.text.toLowerCase());
            if (!matchTitle && !matchDesc) return false;
          }
          return true;
        })
        .slice(0, 8)
    : [];

  const handleAppendQueryToken = (token: string) => {
    setQuery((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${token}` : token;
    });
    inputRef.current?.focus();
  };

  const actions = [
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
      title: 'Go to Today (My Day)',
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
      title: 'Theme & Sound Aesthetics (5 Colorways, Tactile Chimes)',
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
  ];

  const filteredActions = dsl.text
    ? actions.filter((a) => a.title.toLowerCase().includes(dsl.text.toLowerCase()))
    : actions;

  const dslChips = [
    { label: 'p:p1', desc: 'Priority P1' },
    { label: 'status:todo', desc: 'Incomplete' },
    { label: 'is:overdue', desc: 'Overdue' },
    { label: '@focus', desc: 'Context' },
    { label: '#work', desc: 'Tag' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-start justify-center pt-20 p-4 animate-slide-down"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface-l2)] rounded-xl border border-[var(--border-hairline)] shadow-modal overflow-hidden card-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
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

        {/* Query DSL Chips Bar */}
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

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2.5 space-y-1">
          {/* Matched Tasks Section */}
          {matchedTasks.length > 0 && (
            <div className="mb-2.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2.5 py-1">
                <span>Matched Tasks ({matchedTasks.length})</span>
                {dsl.priority && <span className="font-mono text-amber-500">priority:{dsl.priority}</span>}
              </div>
              {matchedTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    onSelectTask(task.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {task.status === 'done' ? (
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    ) : task.priority === 'p1' ? (
                      <AlertCircle size={13} className="text-rose-500 shrink-0" />
                    ) : (
                      <Circle size={13} className="text-[var(--text-muted)] shrink-0" />
                    )}
                    <span className={`font-medium truncate ${task.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
                      {task.title}
                    </span>
                    {task.contextTags && task.contextTags.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono shrink-0">
                        @{task.contextTags[0]}
                      </span>
                    )}
                    {task.tags && task.tags.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono shrink-0 hidden sm:inline">
                        #{task.tags[0]}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono shrink-0">
                    {task.dueDate || 'No date'}
                  </span>
                </button>
              ))}
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
            {filteredActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                >
                  <div className="p-1 rounded-md bg-[var(--bg-surface-l1)]">
                    <Icon size={15} className="text-[var(--text-muted)]" />
                  </div>
                  <span className="font-medium">{action.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
