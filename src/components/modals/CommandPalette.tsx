import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  onOpenPomodoro: () => void;
  onOpenBrainDump: () => void;
  onOpenExportImport: () => void;
  onOpenDailyShutdown?: () => void;
  onOpenAesthetics?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTask,
  onOpenPomodoro,
  onOpenBrainDump,
  onOpenExportImport,
  onOpenDailyShutdown,
  onOpenAesthetics,
}) => {
  const {
    tasks,
    setActiveView,
    toggleTheme,
    theme,
    setIsAuthModalOpen,
  } = useTaskContext();

  const [query, setQuery] = useState('');

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

  // Filter tasks based on query
  const matchedTasks = query.trim()
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.description?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const actions = [
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
      title: 'Start Focus Timer',
      icon: Timer,
      run: () => onOpenPomodoro(),
    },
    {
      id: 'daily-shutdown',
      title: 'Evening Daily Shutdown (Shift+D)',
      icon: Moon,
      run: () => onOpenDailyShutdown && onOpenDailyShutdown(),
    },
    {
      id: 'braindump',
      title: 'Open Multi-line Brain Dump',
      icon: Sparkles,
      run: () => onOpenBrainDump(),
    },
    {
      id: 'export',
      title: 'Export / Backup Data',
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
      id: 'theme',
      title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      icon: theme === 'dark' ? Sun : Moon,
      run: () => toggleTheme(),
    },
  ];

  const filteredActions = query.trim()
    ? actions.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))
    : actions;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-start justify-center pt-24 p-4 animate-slide-down"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface-l2)] rounded-3xl border border-[var(--border-hairline)] shadow-modal overflow-hidden card-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-4 border-b border-[var(--border-hairline)]">
          <Search size={18} className="text-[var(--text-muted)] mr-3 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search tasks..."
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2.5 space-y-1">
          {/* Matched Tasks Section */}
          {matchedTasks.length > 0 && (
            <div className="mb-2.5">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2.5 py-1">
                Tasks
              </div>
              {matchedTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => {
                    onSelectTask(task.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <span className="font-medium text-[var(--text-primary)] truncate">
                    {task.title}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono flex-shrink-0">
                    {task.dueDate || 'No date'}
                  </span>
                </button>
              ))}
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                >
                  <div className="p-1 rounded-lg bg-[var(--bg-surface-l1)]">
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
