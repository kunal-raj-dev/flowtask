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
import { DailyShutdownModal } from '../modals/DailyShutdownModal';
import { AestheticsModal } from '../modals/AestheticsModal';
import { AuthModal } from '../modals/AuthModal';
import { Toast } from '../ui/Toast';
import { Menu, Search } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const {
    activeView,
    selectedTaskId,
    setSelectedTaskId,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isDailyShutdownOpen,
    setIsDailyShutdownOpen,
  } = useTaskContext();

  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isBrainDumpOpen, setIsBrainDumpOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isAestheticsOpen, setIsAestheticsOpen] = useState(false);
  const [pomodoroTaskId, setPomodoroTaskId] = useState<string | null>(null);
  const [isPomodoroOpen, setIsPomodoroOpen] = useState(false);

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
      } else if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsDailyShutdownOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Ambient breathing aurora mesh glow (Delicate Morning Light in Light Mode, Deep Cosmic Nebula in Dark Mode) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        {/* Orb 1: Serene Iris / Periwinkle */}
        <div className="absolute -top-[12%] -left-[8%] w-[580px] h-[580px] rounded-full bg-indigo-400/[0.18] dark:bg-indigo-600/[0.14] blur-[110px] animate-aurora-1" />
        {/* Orb 2: Honey Amber / Sunrise Peach */}
        <div className="absolute top-[8%] -right-[10%] w-[540px] h-[540px] rounded-full bg-amber-400/[0.17] dark:bg-amber-500/[0.09] blur-[100px] animate-aurora-2" />
        {/* Orb 3: Rose Quartz / Sunset Orchid */}
        <div className="absolute top-[45%] left-[25%] w-[460px] h-[460px] rounded-full bg-rose-400/[0.10] dark:bg-rose-600/[0.05] blur-[120px] animate-aurora-3" />
        {/* Orb 4: Seafoam Mint / Soft Cyan */}
        <div className="absolute -bottom-[15%] left-[10%] w-[620px] h-[500px] rounded-full bg-teal-300/[0.14] dark:bg-teal-500/[0.04] blur-[100px] animate-aurora-4" />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block relative z-10">
        <Sidebar
          onOpenPomodoro={() => {
            setPomodoroTaskId(null);
            setIsPomodoroOpen(true);
          }}
          onOpenShortcuts={() => setIsShortcutsOpen(true)}
          onOpenExportImport={() => setIsExportImportOpen(true)}
          onOpenBrainDump={() => setIsBrainDumpOpen(true)}
          onOpenDailyShutdown={() => setIsDailyShutdownOpen(true)}
          onOpenAesthetics={() => setIsAestheticsOpen(true)}
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
              onOpenDailyShutdown={() => {
                setIsSidebarOpenMobile(false);
                setIsDailyShutdownOpen(true);
              }}
              onOpenAesthetics={() => {
                setIsSidebarOpenMobile(false);
                setIsAestheticsOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Mobile Top Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/80 backdrop-blur-md">
          <button
            onClick={() => setIsSidebarOpenMobile(true)}
            className="p-1.5 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-200/50 dark:hover:bg-stone-800/50"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-sm tracking-tight">FlowTask</span>
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="p-1.5 text-stone-600 dark:text-stone-300 rounded-lg hover:bg-stone-200/50 dark:hover:bg-stone-800/50"
          >
            <Search size={18} />
          </button>
        </div>

        {/* View Viewport */}
        <div className="flex-1 overflow-y-auto">
          {renderActiveView()}
        </div>
      </main>

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
        onOpenDailyShutdown={() => {
          setIsCommandPaletteOpen(false);
          setIsDailyShutdownOpen(true);
        }}
        onOpenAesthetics={() => {
          setIsCommandPaletteOpen(false);
          setIsAestheticsOpen(true);
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

      {/* Global Daily Shutdown Modal */}
      <DailyShutdownModal
        isOpen={isDailyShutdownOpen}
        onClose={() => setIsDailyShutdownOpen(false)}
      />

      {/* Aesthetics & Themes Customization Modal */}
      <AestheticsModal
        isOpen={isAestheticsOpen}
        onClose={() => setIsAestheticsOpen(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Global Toast */}
      <Toast />
    </div>
  );
};
