import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { Sidebar } from './Sidebar';
import { TodayView } from '../views/TodayView';
import { UpcomingView } from '../views/UpcomingView';
import { EisenhowerView } from '../views/EisenhowerView';
import { KanbanView } from '../views/KanbanView';
import { LogbookView } from '../views/LogbookView';
import { InsightsView } from '../views/InsightsView';
import { TaskList } from '../tasks/TaskList';
import { TaskDrawer } from '../tasks/TaskDrawer';
import { PomodoroModal } from '../focus/PomodoroModal';
import { CommandPalette } from '../modals/CommandPalette';
import { ShortcutsModal } from '../modals/ShortcutsModal';
import { BrainDumpModal } from '../modals/BrainDumpModal';
import { ExportImportModal } from '../modals/ExportImportModal';
import { AestheticsModal } from '../modals/AestheticsModal';
import { AuthModal } from '../modals/AuthModal';
import { EveningShutdownModal } from '../modals/EveningShutdownModal';
import { InterruptionModal } from '../modals/InterruptionModal';
import { SmartFilterModal } from '../modals/SmartFilterModal';
import { ScratchpadModal } from '../modals/ScratchpadModal';
import { TemplatePickerModal } from '../modals/TemplatePickerModal';
import { WeeklyReviewModal } from '../modals/WeeklyReviewModal';
import { BatchActionBar } from '../tasks/BatchActionBar';
import { Toast } from '../ui/Toast';
import { MobileBottomNav } from './MobileBottomNav';
import { Menu, Search, Sun, Moon, Palette, Share2, X, FileEdit, Pause, Plus } from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';
import { parseSnapshotFromUrl, type SnapshotPayload } from '../../utils/snapshotShare';
import { audioEngine } from '../../utils/audioEngine';
import { getDiurnalPeriod, getDiurnalConfig, type DiurnalPeriod } from '../../utils/diurnalAura';
import confetti from 'canvas-confetti';

export const AppLayout: React.FC = () => {
  const {
    activeView,
    setActiveView,
    selectedTaskId,
    setSelectedTaskId,
    isAuthModalOpen,
    setIsAuthModalOpen,
    theme,
    toggleTheme,
    tasks,
    projects,
    smartViews,
    isSmartFilterModalOpen,
    setIsSmartFilterModalOpen,
    isEveningShutdownOpen,
    setIsEveningShutdownOpen,
    isWeeklyReviewOpen,
    setIsWeeklyReviewOpen,
    addTask,
    activeTimerTaskId,
    activeTimerSeconds,
    toggleTaskTimer,
  } = useTaskContext();

  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('flowtask_sidebar_collapsed') === 'true';
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isBrainDumpOpen, setIsBrainDumpOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isAestheticsOpen, setIsAestheticsOpen] = useState(false);
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [pomodoroTaskId, setPomodoroTaskId] = useState<string | null>(null);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<SnapshotPayload | null>(null);
  const [diurnalPeriod, setDiurnalPeriod] = useState<DiurnalPeriod>(() => getDiurnalPeriod());

  // Diurnal Ambient Shift dynamic listener & interval
  useEffect(() => {
    const handleDiurnalUpdate = () => {
      setDiurnalPeriod(getDiurnalPeriod());
    };
    const interval = setInterval(handleDiurnalUpdate, 5 * 60 * 1000);
    window.addEventListener('diurnal-change', handleDiurnalUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('diurnal-change', handleDiurnalUpdate);
    };
  }, []);

  // Check for incoming shared snapshot in URL hash
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('snapshot=')) {
      const parsed = parseSnapshotFromUrl(window.location.hash);
      if (parsed) {
        setPendingSnapshot(parsed);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('flowtask_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
      } else if (e.key === '[' || ((e.ctrlKey || e.metaKey) && e.key === '\\')) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsEveningShutdownOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'W' || e.key === 'w')) {
        e.preventDefault();
        setIsWeeklyReviewOpen(true);
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setIsScratchpadOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const todayStr = formatLocalDate(new Date());
  const todayCount = tasks.filter(
    (t) => t.status !== 'done' && (t.dueDate === todayStr || t.isPinnedToday)
  ).length;
  const upcomingCount = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate > todayStr
  ).length;

  const formatStopwatch = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeTimerTask = activeTimerTaskId ? tasks.find((t) => t.id === activeTimerTaskId) : null;

  const todayTasksList = tasks.filter(
    (t) => t.dueDate === todayStr || t.isPinnedToday
  );
  const totalTodayPlanned = todayTasksList.length;
  const todayDoneCount = todayTasksList.filter((t) => t.status === 'done').length;
  const todayPercent = totalTodayPlanned > 0 ? Math.round((todayDoneCount / totalTodayPlanned) * 100) : 0;

  const getViewTitle = () => {
    switch (activeView) {
      case 'today': return 'My Day';
      case 'inbox': return 'Inbox';
      case 'upcoming': return 'Upcoming';
      case 'matrix': return 'Priority Matrix';
      case 'kanban': return 'Kanban Board';
      case 'insights': return 'Insights';
      case 'someday': return 'Someday';
      case 'logbook': return 'Logbook';
      default:
        if (activeView.startsWith('project:')) {
          const p = projects.find((proj) => proj.id === activeView.split(':')[1]);
          return p ? p.name : 'Project';
        }
        if (activeView.startsWith('smart:')) {
          const sv = smartViews.find((s) => s.id === activeView.split(':')[1]);
          return sv ? sv.name : 'Smart View';
        }
        return 'FlowTask';
    }
  };

  const handleStartFocus = (taskId: string) => {
    setPomodoroTaskId(taskId);
    setIsPomodoroOpen(true);
  };

  const renderActiveView = () => {
    if (activeView === 'today') {
      return (
        <TodayView
          onSelectTask={(id) => setSelectedTaskId(id)}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={() => setIsBrainDumpOpen(true)}
        />
      );
    }
    if (activeView === 'upcoming') {
      return (
        <UpcomingView
          onSelectTask={(id) => setSelectedTaskId(id)}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={() => setIsBrainDumpOpen(true)}
        />
      );
    }
    if (activeView === 'matrix') {
      return (
        <EisenhowerView
          onSelectTask={(id) => setSelectedTaskId(id)}
        />
      );
    }
    if (activeView === 'kanban') {
      return (
        <KanbanView
          onSelectTask={(id) => setSelectedTaskId(id)}
        />
      );
    }
    if (activeView === 'insights') {
      return <InsightsView onSelectTask={(id) => setSelectedTaskId(id)} />;
    }
    if (activeView === 'logbook') {
      return <LogbookView onSelectTask={(id) => setSelectedTaskId(id)} />;
    }
    return (
      <TaskList
        onSelectTask={(id) => setSelectedTaskId(id)}
        onStartFocus={handleStartFocus}
        onOpenBrainDump={() => setIsBrainDumpOpen(true)}
      />
    );
  };

  const diurnalConfig = getDiurnalConfig(diurnalPeriod);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Ambient breathing diurnal aurora mesh glow (Morning amber/rose, Midday indigo/sky, Evening cosmic obsidian/violet) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none transition-all duration-1000">
        {/* Orb 1: Horizon Prime */}
        <div className={`absolute -top-[12%] -left-[8%] w-[580px] h-[580px] rounded-full ${diurnalConfig.orb1Class} blur-[110px] animate-aurora-1 transition-colors duration-1000`} />
        {/* Orb 2: Ambient Luminescence */}
        <div className={`absolute top-[8%] -right-[10%] w-[540px] h-[540px] rounded-full ${diurnalConfig.orb2Class} blur-[100px] animate-aurora-2 transition-colors duration-1000`} />
        {/* Orb 3: Core Radial Depth */}
        <div className={`absolute top-[45%] left-[25%] w-[460px] h-[460px] rounded-full ${diurnalConfig.orb3Class} blur-[120px] animate-aurora-3 transition-colors duration-1000`} />
        {/* Orb 4: Baseline Earth Ground */}
        <div className={`absolute -bottom-[15%] left-[10%] w-[620px] h-[500px] rounded-full ${diurnalConfig.orb4Class} blur-[100px] animate-aurora-4 transition-colors duration-1000`} />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block relative z-10 transition-all duration-200">
        <Sidebar
          onOpenPomodoro={() => {
            setPomodoroTaskId(null);
            setIsPomodoroOpen(true);
          }}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenExportImport={() => setIsExportImportOpen(true)}
          onOpenBrainDump={() => setIsBrainDumpOpen(true)}
          onOpenAesthetics={() => setIsAestheticsOpen(true)}
          onOpenScratchpad={() => setIsScratchpadOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      {isSidebarOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpenMobile(false)}
        >
          <div
            className="w-64 h-full bg-[var(--bg-surface-l1)] shadow-2xl animate-slide-down border-r border-[var(--border-hairline)]"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              onItemClick={() => setIsSidebarOpenMobile(false)}
              isMobileDrawer={true}
              onOpenPomodoro={() => {
                setIsSidebarOpenMobile(false);
                setPomodoroTaskId(null);
                setIsPomodoroOpen(true);
              }}
              onOpenShortcuts={() => {
                setIsSidebarOpenMobile(false);
                setIsShortcutsOpen(true);
              }}
              onOpenExportImport={() => {
                setIsSidebarOpenMobile(false);
                setIsExportImportOpen(true);
              }}
              onOpenBrainDump={() => {
                setIsSidebarOpenMobile(false);
                setIsBrainDumpOpen(true);
              }}
              onOpenAesthetics={() => {
                setIsSidebarOpenMobile(false);
                setIsAestheticsOpen(true);
              }}
              onOpenScratchpad={() => {
                setIsSidebarOpenMobile(false);
                setIsScratchpadOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Desktop Top Horizon Status Bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/75 backdrop-blur-xl sticky top-0 z-20 transition-all">
          <div className="flex items-center gap-3 min-w-0">
            {/* Zen Sidebar Collapse/Expand Toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              title="Toggle Sidebar ([)"
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Menu size={17} />
            </button>

            {/* Breadcrumb Title */}
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-semibold text-[var(--text-muted)] tracking-wider uppercase">
                FlowTask
              </span>
              <span className="text-xs text-[var(--text-muted)]">/</span>
              <span className="font-bold text-sm tracking-tight text-[var(--text-primary)] truncate">
                {getViewTitle()}
              </span>
            </div>
          </div>

          {/* Center: Active Focus Pill / Today Progress Ring */}
          <div className="flex items-center gap-3">
            {activeTimerTaskId && activeTimerTask ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/35 text-amber-800 dark:text-amber-300 text-xs font-bold shadow-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(activeTimerTaskId)}
                  className="hover:underline truncate max-w-[150px]"
                  title={`Focus timer running for "${activeTimerTask.title}". Click to open.`}
                >
                  {activeTimerTask.title}
                </button>
                <span className="font-mono text-[11px] bg-amber-500/20 px-1.5 py-0.5 rounded">
                  {formatStopwatch(activeTimerSeconds)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleTaskTimer(activeTimerTaskId)}
                  title="Pause Timer"
                  className="p-0.5 text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white transition-colors"
                >
                  <Pause size={12} className="fill-current" />
                </button>
              </div>
            ) : totalTodayPlanned > 0 ? (
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] px-3 py-1 rounded-full bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  {todayDoneCount}/{totalTodayPlanned} Today ({todayPercent}%)
                </span>
              </div>
            ) : null}
          </div>

          {/* Right: Quick Tools */}
          <div className="flex items-center gap-1.5">
            {/* New Task Omnibar Summoner */}
            <button
              type="button"
              onClick={() => {
                const omnibarInput = document.querySelector(
                  'input[placeholder*="task"], input[placeholder*="Task"]'
                ) as HTMLInputElement | null;
                if (omnibarInput) {
                  omnibarInput.focus();
                  omnibarInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                  setIsBrainDumpOpen(true);
                }
              }}
              title="Add Task (N)"
              className="px-2.5 py-1 text-xs font-semibold bg-stone-900 dark:bg-white text-white dark:text-stone-950 rounded-xl hover:opacity-90 shadow-xs transition-all flex items-center gap-1 active:scale-95"
            >
              <Plus size={13} />
              <span>New Task</span>
              <kbd className="hidden lg:inline text-[9px] opacity-75 font-mono ml-0.5">N</kbd>
            </button>

            {/* Quick Sticky Scratchpad */}
            <button
              type="button"
              onClick={() => setIsScratchpadOpen(true)}
              title="Sticky Scratchpad (Alt+N)"
              className="p-1.5 text-[var(--text-secondary)] hover:text-amber-500 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <FileEdit size={16} />
            </button>

            {/* Quick Aesthetics / Ambient Audio */}
            <button
              type="button"
              onClick={() => setIsAestheticsOpen(true)}
              title="Aesthetics & Ambient Noise"
              className="p-1.5 text-[var(--text-secondary)] hover:text-purple-500 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Palette size={16} />
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
            </button>

            {/* Command Palette */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Command Palette (Ctrl+K)"
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Search size={16} />
            </button>
          </div>
        </header>

        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/90 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setIsSidebarOpenMobile(true)}
              aria-label="Open navigation menu"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-sm tracking-tight text-[var(--text-primary)] truncate">
                {getViewTitle()}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-stone-200/80 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 font-semibold border border-[var(--border-subtle)] shrink-0">
                Zen
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Theme Toggle directly in header */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
              aria-label="Toggle theme"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>

            {/* Quick Aesthetics / Sounds */}
            <button
              onClick={() => setIsAestheticsOpen(true)}
              title="Aesthetics & Sounds"
              aria-label="Aesthetics & Sounds"
              className="p-2 text-[var(--text-secondary)] hover:text-purple-500 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Palette size={18} />
            </button>

            {/* Quick Sticky Scratchpad */}
            <button
              onClick={() => setIsScratchpadOpen(true)}
              title="Sticky Scratchpad (Alt+N)"
              aria-label="Sticky Scratchpad"
              className="p-2 text-[var(--text-secondary)] hover:text-amber-500 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <FileEdit size={18} />
            </button>

            {/* Search */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Search tasks"
              aria-label="Search tasks"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Search size={18} />
            </button>
          </div>
        </header>

        {/* View Viewport */}
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
          {/* Incoming Shared Task Snapshot Banner */}
          {pendingSnapshot && (
            <div className="mx-4 sm:mx-6 mt-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/15 via-teal-500/15 to-emerald-500/15 border border-indigo-500/30 shadow-card card-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
                  <Share2 size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)]">
                    Shared Task Snapshot: "{pendingSnapshot.title}"
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Contains {pendingSnapshot.tasks.length} task{pendingSnapshot.tasks.length === 1 ? '' : 's'} shared via zero-auth client link.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    pendingSnapshot.tasks.forEach((t) => {
                      addTask(t.title, {
                        priority: t.priority,
                        estimatedMinutes: t.estimatedMinutes,
                        dueDate: t.dueDate,
                        description: t.description,
                        subtasks: t.subtasks,
                      });
                    });
                    audioEngine.playCompletionChime();
                    confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
                    setPendingSnapshot(null);
                    if (typeof window !== 'undefined' && window.history) {
                      window.history.replaceState(null, '', window.location.pathname);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>Import {pendingSnapshot.tasks.length} Tasks</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingSnapshot(null);
                    if (typeof window !== 'undefined' && window.history) {
                      window.history.replaceState(null, '', window.location.pathname);
                    }
                  }}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06]"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {renderActiveView()}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={(viewId) => setActiveView(viewId as any)}
        onQuickAdd={() => {
          if (activeView !== 'today') {
            setActiveView('today');
          }
          setTimeout(() => {
            const omnibarInput = document.querySelector('input[placeholder*="task"], input[placeholder*="Task"]') as HTMLInputElement | null;
            if (omnibarInput) {
              omnibarInput.focus();
              omnibarInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              setIsBrainDumpOpen(true);
            }
          }, 50);
        }}
        onOpenMenu={() => setIsSidebarOpenMobile(true)}
        todayCount={todayCount}
        upcomingCount={upcomingCount}
      />

      {/* Slide-over Task Detail Drawer */}
      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onStartFocus={handleStartFocus}
        />
      )}

      {/* Modals */}
      {isPomodoroOpen && (
        <PomodoroModal
          taskId={pomodoroTaskId}
          onClose={() => setIsPomodoroOpen(false)}
        />
      )}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTask={(id) => setSelectedTaskId(id)}
        onOpenPomodoro={() => {
          setPomodoroTaskId(null);
          setIsPomodoroOpen(true);
        }}
        onOpenBrainDump={() => setIsBrainDumpOpen(true)}
        onOpenExportImport={() => setIsExportImportOpen(true)}
        onOpenAesthetics={() => {
          setIsCommandPaletteOpen(false);
          setIsAestheticsOpen(true);
        }}
        onOpenScratchpad={() => {
          setIsCommandPaletteOpen(false);
          setIsScratchpadOpen(true);
        }}
      />

      {isShortcutsOpen && (
        <ShortcutsModal onClose={() => setIsShortcutsOpen(false)} />
      )}

      {isBrainDumpOpen && (
        <BrainDumpModal onClose={() => setIsBrainDumpOpen(false)} />
      )}

      {isExportImportOpen && (
        <ExportImportModal onClose={() => setIsExportImportOpen(false)} />
      )}

      {/* Aesthetics & Themes Customization Modal */}
      <AestheticsModal
        isOpen={isAestheticsOpen}
        onClose={() => setIsAestheticsOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {isEveningShutdownOpen && (
        <EveningShutdownModal onClose={() => setIsEveningShutdownOpen(false)} />
      )}

      {/* Batch Actions Dock */}
      <BatchActionBar />

      {/* Interruption Stash & Scratchpad Modal */}
      <InterruptionModal />

      {/* Sticky Scratchpad Modal */}
      <ScratchpadModal
        isOpen={isScratchpadOpen}
        onClose={() => setIsScratchpadOpen(false)}
      />

      {/* Smart Filter View Creator Modal */}
      <SmartFilterModal
        isOpen={isSmartFilterModalOpen}
        onClose={() => setIsSmartFilterModalOpen(false)}
      />

      {/* Workflow Blueprints Template Modal */}
      <TemplatePickerModal />

      {/* Weekly Review & Retrospective Modal */}
      <WeeklyReviewModal
        isOpen={isWeeklyReviewOpen}
        onClose={() => setIsWeeklyReviewOpen(false)}
        onOpenTask={(id) => setSelectedTaskId(id)}
      />

      {/* Global Quick-Action Floating Button (FAB) */}
      <div className="fixed bottom-20 md:bottom-6 right-5 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            const omnibarInput = document.querySelector(
              'input[placeholder*="task"], input[placeholder*="Task"]'
            ) as HTMLInputElement | null;
            if (omnibarInput) {
              omnibarInput.focus();
              omnibarInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              setIsBrainDumpOpen(true);
            }
          }}
          title="Quick Add Task (N)"
          className="w-11 h-11 rounded-2xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 flex items-center justify-center shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all card-surface border border-[var(--border-subtle)]"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Global Toast */}
      <Toast />
    </div>
  );
};
