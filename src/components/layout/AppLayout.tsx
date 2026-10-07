import { isTodayTask } from '../../utils/taskSelectors';
import { RecoveryView } from '../views/RecoveryView';
import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTaskContext } from '../../context/TaskContext';
import { Sidebar } from './Sidebar';
import { TodayView } from '../views/TodayView';
const UpcomingView = lazy(() => import('../views/UpcomingView').then(m => ({ default: m.UpcomingView })));
const TimelineView = lazy(() => import('../views/TimelineView').then(m => ({ default: m.TimelineView })));
const EisenhowerView = lazy(() => import('../views/EisenhowerView').then(m => ({ default: m.EisenhowerView })));
const KanbanView = lazy(() => import('../views/KanbanView').then(m => ({ default: m.KanbanView })));
const ProjectsView = lazy(() => import('../views/ProjectsView').then(m => ({ default: m.ProjectsView })));
const ReviewView = lazy(() => import('../views/ReviewView').then(m => ({ default: m.ReviewView })));
import { TaskList } from '../tasks/TaskList';
import { TaskDrawer } from '../tasks/TaskDrawer';
import { QuickAddModal } from '../tasks/QuickAddModal';
import { BatchActionBar } from '../tasks/BatchActionBar';
import { ModalRoot } from '../modals/ModalRoot';
import { useModal } from '../../context/ModalContext';
import { Toast } from '../ui/Toast';
import { Button, ViewSkeleton, Kbd } from '../ui';
import { MobileBottomNav } from './MobileBottomNav';
import { Menu, Search, Share2, X, Pause, Play, Plus, Timer, Settings } from 'lucide-react';
import { parseSnapshotFromUrl, type SnapshotPayload } from '../../utils/snapshotShare';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { audioEngine } from '../../utils/audioEngine';
import {
  getDiurnalPeriod,
  getDiurnalConfig,
  loadDiurnalIntensity,
  applyDiurnalToDom,
  type DiurnalPeriod,
} from '../../utils/diurnalAura';
import { useTactileAudioClicks } from '../../hooks/useTactileAudioClicks';
import { useAuth } from '../../context/AuthContext';
import confetti from 'canvas-confetti';

export const AppLayout: React.FC = () => {
  useTactileAudioClicks();
  const {
    activeView,
    setActiveView,
    selectedTaskId,
    setSelectedTaskId,
    tasks,
    projects,
    smartViews,
    isAuthModalOpen,
    isSmartFilterModalOpen,
    isEveningShutdownOpen,
    isWeeklyReviewOpen,
    addTask,
    activeTimerTaskId,
    activeTimerSeconds,
    toggleTaskTimer,
    undoLastAction,
    isQuickAddOpen,
    setIsQuickAddOpen,
    focusSession,
    focusElapsedSeconds,
    totalFocusedTodaySeconds,
    pauseFocusSession,
    resumeFocusSession,
    stopFocusSession,
    syncStatus,
    setIsAuthModalOpen,
  } = useTaskContext();

  const { user, isAnonymous } = useAuth();
  const { openModal, closeModal, isModalOpen, hasAnyModalOpen } = useModal();

  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('flowtask_sidebar_collapsed') === 'true';
  });
  const [pendingSnapshot, setPendingSnapshot] = useState<SnapshotPayload | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('snapshot=')) {
      return parseSnapshotFromUrl(window.location.hash);
    }
    return null;
  });
  const [diurnalPeriod, setDiurnalPeriod] = useState<DiurnalPeriod>(() => getDiurnalPeriod());
  const [diurnalIntensity, setDiurnalIntensity] = useState<number>(() => loadDiurnalIntensity());
  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Reset viewport scroll to top on activeView transition
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [activeView]);

  // Diurnal Ambient Shift dynamic listener & interval with DOM cascade
  useEffect(() => {
    const handleDiurnalUpdate = () => {
      const period = getDiurnalPeriod();
      const intensity = loadDiurnalIntensity();
      setDiurnalPeriod(period);
      setDiurnalIntensity(intensity);
      applyDiurnalToDom(period, intensity);
    };

    // Apply on initial mount
    handleDiurnalUpdate();

    const interval = setInterval(handleDiurnalUpdate, 5 * 60 * 1000);
    window.addEventListener('diurnal-change', handleDiurnalUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('diurnal-change', handleDiurnalUpdate);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('flowtask_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {}
  }, [isSidebarCollapsed]);

  // Global Keyboard shortcuts with strict modal isolation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      // Suspend all global single-key shortcuts while ANY modal or slide-over drawer is open
      const isAnyModalActive =
        hasAnyModalOpen ||
        isQuickAddOpen ||
        isAuthModalOpen ||
        isEveningShutdownOpen ||
        isWeeklyReviewOpen ||
        isSmartFilterModalOpen ||
        selectedTaskId !== null;

      if (isAnyModalActive) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        openModal('shortcuts');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openModal('commandPalette');
      } else if (e.key === '[' || ((e.ctrlKey || e.metaKey) && e.key === '\\')) {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        openModal('eveningShutdown');
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'W' || e.key === 'w')) {
        e.preventDefault();
        openModal('weeklyReview');
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        if (isModalOpen('scratchpad')) {
          closeModal('scratchpad');
        } else {
          openModal('scratchpad');
        }
      } else if (e.key === 'n' || e.key === 'N' || e.key === 'c') {
        e.preventDefault();
        setIsQuickAddOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        openModal('settings');
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        undoLastAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undoLastAction,
    setIsQuickAddOpen,
    isQuickAddOpen,
    isAuthModalOpen,
    isEveningShutdownOpen,
    isWeeklyReviewOpen,
    isSmartFilterModalOpen,
    selectedTaskId,
    hasAnyModalOpen,
    openModal,
    closeModal,
    isModalOpen,
  ]);

  const todayStr = useTodayStr();

  // Count active tasks for views with exact view-selector parity (memoized)
  const todayCount = useMemo(() => tasks.filter(t => isTodayTask(t, todayStr)).length, [tasks, todayStr]);

  const inboxCount = useMemo(() => tasks.filter(
    (t) =>
      t.status !== 'done' &&
      !t.deletedAt &&
      !t.archivedAt &&
      t.projectId === 'inbox' &&
      !t.dueDate &&
      !t.plannedDate &&
      !t.isSomeday
  ).length, [tasks]);

  const upcomingCount = useMemo(() => tasks.filter((t) => {
    if (t.status === 'done' || t.deletedAt || t.archivedAt) return false;
    const taskDate = t.plannedDate || t.dueDate;
    return taskDate && taskDate > todayStr;
  }).length, [tasks, todayStr]);

  const formatStopwatch = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formattedFocusedToday = useMemo(() => {
    const hours = Math.floor(totalFocusedTodaySeconds / 3600);
    const mins = Math.floor((totalFocusedTodaySeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
    }
    return `${mins}m`;
  }, [totalFocusedTodaySeconds]);

  const activeTimerTask = useMemo(
    () => (activeTimerTaskId ? tasks.find((t) => t.id === activeTimerTaskId) || null : null),
    [activeTimerTaskId, tasks]
  );

  const { totalTodayPlanned, todayDoneCount, todayPercent } = useMemo(() => {
    const list = tasks.filter((t) => {
      if (t.deletedAt || t.archivedAt) return false;
      return (
        t.plannedDate === todayStr ||
        (!t.plannedDate && t.dueDate === todayStr) ||
        t.isPinnedToday
      );
    });
    const total = list.length;
    const done = list.filter((t) => t.status === 'done').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { totalTodayPlanned: total, todayDoneCount: done, todayPercent: pct };
  }, [tasks, todayStr]);

  const getViewTitle = () => {
    switch (activeView) {
      case 'today': return 'Today';
      case 'inbox': return 'Inbox';
      case 'upcoming': return 'Upcoming';
      case 'projects': return 'Projects';
      case 'review': return 'Review';
      case 'all': return 'All Tasks';
      case 'someday': return 'Someday';
      case 'timeline': return 'Timeline';
      case 'matrix': return 'Priority Matrix';
      case 'kanban': return 'Kanban Board';
      case 'insights': return 'Insights';
      case 'logbook': return 'Logbook';
      case 'trash': return 'Trash';
      case 'archive': return 'Archive';
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
    openModal('pomodoro', { taskId });
  };

  const handleStartStudySprint = (taskId: string) => {
    openModal('studySprint', { taskId });
  };

  const renderActiveView = () => {
    if (activeView === 'trash' || activeView === 'archive') return <RecoveryView mode={activeView} />;
    if (activeView === 'today') {
      return (
        <TodayView
          onSelectTask={(id) => setSelectedTaskId(id)}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={() => openModal('brainDump')}
          onStartSprint={handleStartStudySprint}
          onOpenStudySession={() => openModal('studySession')}
        />
      );
    }
    if (activeView === 'inbox') {
      return (
        <TaskList
          filterInbox
          onSelectTask={(id) => setSelectedTaskId(id)}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={() => openModal('brainDump')}
          onStartSprint={handleStartStudySprint}
        />
      );
    }
    if (activeView === 'upcoming') {
      return (
        <UpcomingView
          onSelectTask={(id) => setSelectedTaskId(id)}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={() => openModal('brainDump')}
          onStartSprint={handleStartStudySprint}
        />
      );
    }
    if (activeView === 'projects' || activeView.startsWith('project:')) {
      const selectedProjId = activeView.startsWith('project:')
        ? activeView.split(':')[1]
        : null;
      return (
        <ProjectsView
          selectedProjectId={selectedProjId}
          onSelectProject={(projId) => {
            if (projId) {
              setActiveView(`project:${projId}`);
            } else {
              setActiveView('projects');
            }
          }}
          onSelectTask={(id) => setSelectedTaskId(id)}
          onStartFocus={handleStartFocus}
        />
      );
    }
    if (
      activeView === 'review' ||
      activeView === 'insights' ||
      activeView === 'logbook'
    ) {
      return <ReviewView key={activeView} initialTab={activeView === 'insights' ? 'insights' : 'logbook'} onSelectTask={(id) => setSelectedTaskId(id)} />;
    }
    if (activeView === 'timeline') {
      return (
        <div className="max-w-5xl mx-auto px-3.5 sm:px-4 py-4 sm:py-6">
          <TimelineView
            onSelectTask={(id) => setSelectedTaskId(id)}
            onStartFocus={handleStartFocus}
            onStartSprint={handleStartStudySprint}
            onOpenStudySession={() => openModal('studySession')}
          />
        </div>
      );
    }
    if (activeView === 'matrix') {
      return <EisenhowerView onSelectTask={(id) => setSelectedTaskId(id)} />;
    }
    if (activeView === 'kanban') {
      return <KanbanView onSelectTask={(id) => setSelectedTaskId(id)} />;
    }
    if (activeView === 'someday') {
      return (
        <TaskList
          filterSomeday
          onSelectTask={(id) => setSelectedTaskId(id)}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={() => openModal('brainDump')}
          onStartSprint={handleStartStudySprint}
        />
      );
    }
    if (activeView === 'all') {
      return (
        <TaskList
          filterAll
          onSelectTask={(id) => setSelectedTaskId(id)}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={() => openModal('brainDump')}
          onStartSprint={handleStartStudySprint}
        />
      );
    }
    return (
      <TaskList
        onSelectTask={(id) => setSelectedTaskId(id)}
        onStartFocus={handleStartFocus}
        onOpenBrainDump={() => openModal('brainDump')}
        onStartSprint={handleStartStudySprint}
      />
    );
  };

  const diurnalConfig = getDiurnalConfig(diurnalPeriod);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Skip to Main Content Link (WCAG 2.2 Level A / AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs font-bold shadow-elevated focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Ambient breathing diurnal aurora mesh glow with dynamic intensity calibration */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden select-none transition-opacity duration-700"
        style={{ opacity: diurnalIntensity }}
        aria-hidden="true"
      >
        {/* Orb 1: Horizon Prime */}
        <div className={`absolute -top-[12%] -left-[8%] w-[640px] h-[640px] rounded-full ${diurnalConfig.orb1Class} blur-[95px] animate-aurora-1 transition-all duration-700`} />
        {/* Orb 2: Ambient Luminescence */}
        <div className={`absolute top-[6%] -right-[10%] w-[580px] h-[580px] rounded-full ${diurnalConfig.orb2Class} blur-[90px] animate-aurora-2 transition-all duration-700`} />
        {/* Orb 3: Core Radial Depth */}
        <div className={`absolute top-[42%] left-[22%] w-[500px] h-[500px] rounded-full ${diurnalConfig.orb3Class} blur-[105px] animate-aurora-3 transition-all duration-700`} />
        {/* Orb 4: Baseline Earth Ground */}
        <div className={`absolute -bottom-[14%] right-[10%] w-[660px] h-[520px] rounded-full ${diurnalConfig.orb4Class} blur-[90px] animate-aurora-4 transition-all duration-700`} />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block relative z-10 transition-all duration-200">
        <Sidebar
          onOpenPomodoro={() => openModal('pomodoro')}
          onOpenShortcuts={() => openModal('shortcuts')}
          onOpenExportImport={() => openModal('exportImport')}
          onOpenBrainDump={() => openModal('brainDump')}
          onOpenAesthetics={() => openModal('settings', { initialTab: 'aesthetics' })}
          onOpenScratchpad={() => openModal('scratchpad')}
          onOpenStudySession={() => openModal('studySession')}
          onOpenSettings={() => openModal('settings')}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isSidebarOpenMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpenMobile(false)}
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="w-[min(320px,85vw)] h-full bg-[var(--bg-surface-l1)] shadow-2xl border-r border-[var(--border-hairline)]"
              onClick={(e) => e.stopPropagation()}
            >
              <Sidebar
                onItemClick={() => setIsSidebarOpenMobile(false)}
                isMobileDrawer={true}
                onOpenPomodoro={() => {
                  setIsSidebarOpenMobile(false);
                  openModal('pomodoro');
                }}
                onOpenShortcuts={() => {
                  setIsSidebarOpenMobile(false);
                  openModal('shortcuts');
                }}
                onOpenExportImport={() => {
                  setIsSidebarOpenMobile(false);
                  openModal('exportImport');
                }}
                onOpenBrainDump={() => {
                  setIsSidebarOpenMobile(false);
                  openModal('brainDump');
                }}
                onOpenAesthetics={() => {
                  setIsSidebarOpenMobile(false);
                  openModal('settings', { initialTab: 'aesthetics' });
                }}
                onOpenScratchpad={() => {
                  setIsSidebarOpenMobile(false);
                  openModal('scratchpad');
                }}
                onOpenStudySession={() => {
                  setIsSidebarOpenMobile(false);
                  openModal('studySession');
                }}
                onOpenSettings={() => {
                  setIsSidebarOpenMobile(false);
                  openModal('settings');
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col h-full overflow-hidden relative z-10 focus:outline-none">
        {/* Desktop Top Horizon Status Bar */}
        <header
          className="hidden lg:flex items-center justify-between px-6 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/75 backdrop-blur-xl sticky top-0 z-20 transition-all"
          style={{ borderBottomColor: `color-mix(in srgb, var(--diurnal-glow-1, var(--border-hairline)) 22%, var(--border-hairline))` }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Zen Sidebar Collapse/Expand Toggle */}
            <button
              type="button"
              onClick={() => {
                audioEngine.playToggleSound(isSidebarCollapsed);
                setIsSidebarCollapsed((prev) => !prev);
              }}
              title="Toggle Sidebar ([)"
              aria-label="Toggle Sidebar ([)"
              aria-expanded={!isSidebarCollapsed}
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

          {/* Center: Persistent Focus Session Mini-Player or Today Progress Ring */}
          <div className="flex items-center gap-3">
            {focusSession && (focusSession.state === 'running' || focusSession.state === 'paused') ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/35 text-amber-900 dark:text-amber-200 text-xs font-bold shadow-xs">
                <span
                  className={`w-2 h-2 rounded-full bg-amber-500 ${
                    focusSession.state === 'running' ? 'animate-ping' : ''
                  }`}
                />
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">
                  {focusSession.mode === 'pomodoro'
                    ? '🍅 Pomodoro'
                    : focusSession.mode === 'sprint'
                    ? '⚡ Sprint'
                    : '⏱️ Focus'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (focusSession.mode === 'sprint') {
                      openModal('studySprint', { taskId: focusSession.taskId });
                    } else if (focusSession.mode === 'pomodoro') {
                      openModal('pomodoro', { taskId: focusSession.taskId });
                    } else if (focusSession.taskId) {
                      setSelectedTaskId(focusSession.taskId);
                    } else {
                      openModal('pomodoro');
                    }
                  }}
                  className="hover:underline truncate max-w-[170px]"
                  title={`Focus session: "${focusSession.taskTitle}". Click to view details.`}
                >
                  {focusSession.subtaskTitle
                    ? `${focusSession.taskTitle} • ${focusSession.subtaskTitle}`
                    : focusSession.taskTitle}
                </button>
                <span className="font-mono text-[11px] bg-amber-500/25 px-1.5 py-0.5 rounded font-semibold text-amber-950 dark:text-amber-100">
                  {focusSession.targetDurationSec
                    ? formatStopwatch(
                        Math.max(
                          0,
                          focusSession.targetDurationSec - focusElapsedSeconds
                        )
                      )
                    : formatStopwatch(focusElapsedSeconds)}
                </span>
                {focusSession.state === 'running' ? (
                  <button
                    type="button"
                    onClick={pauseFocusSession}
                    title="Pause Focus Session"
                    aria-label="Pause Focus Session"
                    className="p-1 hover:bg-amber-500/20 rounded-md transition-colors"
                  >
                    <Pause size={12} className="fill-current text-amber-700 dark:text-amber-300" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={resumeFocusSession}
                    title="Resume Focus Session"
                    aria-label="Resume Focus Session"
                    className="p-1 hover:bg-amber-500/20 rounded-md transition-colors"
                  >
                    <Play size={12} className="fill-current text-amber-700 dark:text-amber-300" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={stopFocusSession}
                  title="Finish / Stop Session"
                  aria-label="Finish / Stop Session"
                  className="p-1 hover:bg-rose-500/20 hover:text-rose-500 rounded-md transition-colors text-amber-700 dark:text-amber-300"
                >
                  <X size={12} />
                </button>
              </div>
            ) : activeTimerTaskId && activeTimerTask ? (
              focusSession?.state === 'running' ? (
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
                    aria-label="Pause Timer"
                    className="p-0.5 text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white transition-colors"
                  >
                    <Pause size={12} className="fill-current" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-dashed border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500/60" />
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(activeTimerTaskId)}
                    className="hover:underline truncate max-w-[150px]"
                    title={`Focus timer paused for "${activeTimerTask.title}". Click to open.`}
                  >
                    {activeTimerTask.title}
                  </button>
                  <span className="font-mono text-[11px] bg-amber-500/20 px-1.5 py-0.5 rounded">
                    {formatStopwatch(activeTimerSeconds)}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider bg-amber-500/25 px-1 py-0.2 rounded text-amber-900 dark:text-amber-200">
                    Paused
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleTaskTimer(activeTimerTaskId)}
                    title="Resume Timer"
                    aria-label="Resume Timer"
                    className="p-0.5 text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-white transition-colors"
                  >
                    <Play size={12} className="fill-current" />
                  </button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                {totalFocusedTodaySeconds > 0 && (
                  <button
                    type="button"
                    onClick={() => openModal('pomodoro')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 transition-all shadow-2xs cursor-pointer"
                    title={`Total focused today: ${formattedFocusedToday}. Click to open Focus Mode.`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="font-mono font-bold">🎯 {formattedFocusedToday} Focused</span>
                  </button>
                )}
                {totalTodayPlanned > 0 && (
                  <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] px-3 py-1 rounded-full bg-[var(--bg-surface-l2)]/60 border border-[var(--border-hairline)]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>
                      {todayDoneCount}/{totalTodayPlanned} Today ({todayPercent}%)
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openModal('pomodoro')}
                  title="Launch Focus Mode & Pomodoro Timer"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-amber-600 dark:hover:text-amber-400 bg-[var(--bg-surface-l2)] hover:bg-amber-500/10 border border-[var(--border-hairline)] hover:border-amber-500/30 transition-all shadow-2xs active:scale-95"
                >
                  <Timer size={13} className="text-amber-500" />
                  <span>Focus</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Quick Tools */}
          <div className="flex items-center gap-1.5">
            {/* Cloud Database Sync Status Indicator */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              title={`Cloud Database Sync: ${syncStatus === 'synced' ? (user?.displayName || user?.email || 'Synced') : syncStatus}. Click for account settings.`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500 animate-spin'
                    : syncStatus === 'offline'
                    ? 'bg-amber-500'
                    : 'bg-stone-400'
                }`}
              />
              <span className="text-[11px] font-mono hidden xl:inline text-[var(--text-muted)]">
                {syncStatus === 'synced'
                  ? user && !isAnonymous
                    ? user.displayName || user.email?.split('@')[0]
                    : 'Synced'
                  : syncStatus === 'syncing'
                  ? 'Syncing'
                  : syncStatus === 'offline'
                  ? 'Offline'
                  : 'Local'}
              </span>
            </button>

            {/* New Task Summoner */}
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={13} />}
              onClick={() => setIsQuickAddOpen(true)}
              title="Quick Add Task"
            >
              New Task
            </Button>

            {/* Command Palette / Search Trigger */}
            <button
              type="button"
              onClick={() => openModal('commandPalette')}
              title="Search and commands (Ctrl+K or ⌘K)"
              aria-label="Search and commands"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-subtle cursor-pointer group"
            >
              <Search size={14} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
              <span className="hidden xl:inline text-xs text-[var(--text-muted)] font-medium">Search & jump to...</span>
              <Kbd size="xs" className="hidden lg:inline-flex opacity-85">⌘K</Kbd>
            </button>

            {/* Application Settings & Preferences */}
            <button
              type="button"
              onClick={() => openModal('settings')}
              title="Preferences & Settings (Ctrl+,)"
              aria-label="Preferences and Settings"
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {/* Mobile Top Header */}
        <header
          className="lg:hidden flex items-center justify-between px-3.5 sm:px-6 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/90 backdrop-blur-xl sticky top-0 z-20 transition-all"
          style={{ borderBottomColor: `color-mix(in srgb, var(--diurnal-glow-1, var(--border-hairline)) 22%, var(--border-hairline))` }}
        >
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
            {/* Mobile Focus Session Indicator or Quick Launcher */}
            {focusSession && (focusSession.state === 'running' || focusSession.state === 'paused') ? (
              <button
                type="button"
                onClick={() => {
                  if (focusSession.mode === 'sprint') {
                    openModal('studySprint', focusSession.taskId ? { taskId: focusSession.taskId } : undefined);
                  } else if (focusSession.mode === 'pomodoro') {
                    openModal('pomodoro', focusSession.taskId ? { taskId: focusSession.taskId } : undefined);
                  } else if (focusSession.taskId) {
                    setSelectedTaskId(focusSession.taskId);
                  } else {
                    openModal('pomodoro');
                  }
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30 shrink-0 mr-1"
                title={`Active ${focusSession.mode}: ${focusSession.taskTitle}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-amber-500 ${
                    focusSession.state === 'running' ? 'animate-ping' : ''
                  }`}
                />
                <span>
                  {focusSession.targetDurationSec
                    ? formatStopwatch(
                        Math.max(
                          0,
                          focusSession.targetDurationSec - focusElapsedSeconds
                        )
                      )
                    : formatStopwatch(focusElapsedSeconds)}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                {totalFocusedTodaySeconds > 0 && (
                  <button
                    type="button"
                    onClick={() => openModal('pomodoro')}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-mono text-[10px] font-bold shrink-0"
                    title={`Total focused today: ${formattedFocusedToday}`}
                  >
                    <span>🎯 {formattedFocusedToday}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openModal('pomodoro')}
                  title="Launch Focus Mode"
                  aria-label="Launch Focus Mode"
                  className="p-2 text-[var(--text-secondary)] hover:text-amber-500 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <Timer size={18} />
                </button>
              </div>
            )}

            {/* Mobile Sync Indicator */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              title="Cloud Sync"
              aria-label="Cloud Sync"
              className="p-2 text-[var(--text-secondary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <span
                className={`block w-2.5 h-2.5 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500 animate-spin'
                    : syncStatus === 'offline'
                    ? 'bg-amber-500'
                    : 'bg-stone-400'
                }`}
              />
            </button>

            {/* Search */}
            <button
              onClick={() => openModal('commandPalette')}
              title="Search tasks"
              aria-label="Search tasks"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Search size={18} />
            </button>

            {/* Settings */}
            <button
              onClick={() => openModal('settings')}
              title="Preferences & Settings"
              aria-label="Preferences and Settings"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* View Viewport */}
        <div ref={mainScrollRef} className="flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
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

          <Suspense fallback={<ViewSkeleton title={`Loading ${getViewTitle()}…`} />}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="h-full flex flex-col"
              >
                {renderActiveView()}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={(viewId) => setActiveView(viewId as any)}
        onQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenMenu={() => setIsSidebarOpenMobile(true)}
        todayCount={todayCount}
        inboxCount={inboxCount}
        upcomingCount={upcomingCount}
      />

      {/* Universal Quick Capture Composer Modal */}
      <QuickAddModal />

      {/* Slide-over Task Detail Drawer */}
      <AnimatePresence>
        {selectedTaskId && (
          <TaskDrawer
            key={selectedTaskId}
            taskId={selectedTaskId}
            onClose={() => setSelectedTaskId(null)}
            onStartFocus={handleStartFocus}
            onStartSprint={handleStartStudySprint}
          />
        )}
      </AnimatePresence>

      {/* Batch Actions Dock */}
      <BatchActionBar />

      {/* Centralized Modal & Slide-Over Root */}
      <ModalRoot
        onSelectTask={(id) => setSelectedTaskId(id)}
        onStartStudySprint={handleStartStudySprint}
      />

      {/* Global Toast */}
      <Toast />
    </div>
  );
};
