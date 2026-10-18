import { canonicalWorkspaceUrl, resolveStartView } from '../../utils/entryRoute';
import { isTodayTask } from '../../utils/taskSelectors';
import { RecoveryView } from '../views/RecoveryView';
import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
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
const StudyView = lazy(() => import('../views/StudyView').then(m => ({ default: m.StudyView })));
import { TaskList } from '../tasks/TaskList';
import { TaskDrawer } from '../tasks/TaskDrawer';
import { QuickAddModal } from '../tasks/QuickAddModal';
import { BatchActionBar } from '../tasks/BatchActionBar';
import { ModalRoot } from '../modals/ModalRoot';
import { useModal } from '../../context/ModalContext';
import { Toast } from '../ui/Toast';
import { Button, ViewSkeleton, Kbd } from '../ui';
import { MobileBottomNav } from './MobileBottomNav';
import { FocusMiniPlayer } from '../focus/FocusMiniPlayer';
import { FocusPipPortal } from '../focus/FocusPipPortal';
import { transitionView } from '../../utils/viewTransitions';
import { FeatureBoundary } from '../ui/FeatureBoundary';
import { Menu, Search, Share2, X, Plus, Timer, Settings, Cloud } from 'lucide-react';
import { parseSnapshotFromUrl, type SnapshotPayload } from '../../utils/snapshotShare';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { audioEngine } from '../../utils/audioEngine';
import { useTactileAudioClicks } from '../../hooks/useTactileAudioClicks';
import { useAuth } from '../../context/AuthContext';
import confetti from 'canvas-confetti';

export const AppLayout: React.FC = () => {
  const clickPreferences = useTaskContext().workspacePreferences?.appearance as { keyboardSounds?: boolean; mode?: 'manual' | 'system' | 'schedule' } | undefined;
  useTactileAudioClicks(true, Boolean(clickPreferences?.keyboardSounds));
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
    undoLastAction,
    redoLastAction,
    isQuickAddOpen,
    setIsQuickAddOpen,
    syncStatus,
    setIsAuthModalOpen,
    settings,
  } = useTaskContext();

  const todayStr = useTodayStr();

  const { user, isAnonymous } = useAuth();
  const { openModal, closeModal, isModalOpen, hasAnyModalOpen } = useModal();

  let needsOnboarding = false;
  try {
    const legacyCompleted = localStorage.getItem('flowtask_onboarding_completed') === 'true';
    needsOnboarding = !settings?.onboardingCompleted && !legacyCompleted && tasks.length === 0;
  } catch { /* Preserve the existing no-storage fallback. */ }
  useEffect(() => {
    if (needsOnboarding && syncStatus !== 'syncing') openModal('onboarding');
  }, [needsOnboarding, syncStatus, openModal]);

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
  const dismissSnapshot = () => {
    setPendingSnapshot(null);
    const url = canonicalWorkspaceUrl(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
  };
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const startViewApplied = useRef(false);
  useEffect(() => {
    if (startViewApplied.current) return;
    startViewApplied.current = true;
    // Saved preferences must never replace an explicit view or a shared snapshot destination.
    if (new URLSearchParams(window.location.search).has('view') || window.location.hash.startsWith('#snapshot=')) return;
    const view = resolveStartView(settings.defaultLandingView);
    if (view !== activeView) setActiveView(view);
  }, [settings.defaultLandingView, activeView, setActiveView]);
  const pendingQuickAdd = useRef(new URLSearchParams(window.location.search).get('action') === 'quickadd');
  useEffect(() => {
    if (!pendingQuickAdd.current || needsOnboarding || syncStatus === 'syncing' || hasAnyModalOpen || isQuickAddOpen || isAuthModalOpen || isSmartFilterModalOpen || isEveningShutdownOpen || isWeeklyReviewOpen || selectedTaskId || pendingSnapshot) return;
    pendingQuickAdd.current = false;
    const url = canonicalWorkspaceUrl(window.location.href);
    if (url.searchParams.get('action') === 'quickadd') {
      url.searchParams.delete('action');
      window.history.replaceState(window.history.state, '', url);
    }
    setIsQuickAddOpen(true);
  }, [needsOnboarding, syncStatus, hasAnyModalOpen, isQuickAddOpen, isAuthModalOpen, isSmartFilterModalOpen, isEveningShutdownOpen, isWeeklyReviewOpen, selectedTaskId, pendingSnapshot, setIsQuickAddOpen]);


  // Reset viewport scroll to top on activeView transition
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [activeView]);

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

      // Suspend all global single-key shortcuts while ANY modal dialog is open
      const isAnyModalActive =
        hasAnyModalOpen ||
        isQuickAddOpen ||
        isAuthModalOpen ||
        isEveningShutdownOpen ||
        isWeeklyReviewOpen ||
        isSmartFilterModalOpen;

      if (isAnyModalActive) return;

      // Suspend single-letter hotkeys while task drawer is open, but allow Cmd/Ctrl combos
      if (selectedTaskId !== null && !e.ctrlKey && !e.metaKey && !e.altKey) {
        return;
      }

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
      } else if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y'))
      ) {
        e.preventDefault();
        redoLastAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undoLastAction,
    redoLastAction,
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



  const getViewTitle = () => {
    switch (activeView) {
      case 'today': return 'Today';
      case 'inbox': return 'Inbox';
      case 'upcoming': return 'Upcoming';
      case 'projects': return 'Projects';
      case 'review': return 'Review';
      case 'all': return 'All Tasks';
      case 'someday': return 'Someday';
      case 'timeline': return 'Plan';
      case 'study': return 'Study Hub';
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

  const handleStartFocus = useCallback((taskId: string) => {
    openModal('pomodoro', { taskId });
  }, [openModal]);

  const handleStartStudySprint = useCallback((taskId: string) => {
    openModal('studySprint', { taskId });
  }, [openModal]);

  const handleCloseDrawer = useCallback(() => {
    setSelectedTaskId(null);
  }, [setSelectedTaskId]);

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
    if (activeView === 'study') {
      return (
        <StudyView
          onStartSprint={handleStartStudySprint}
          onSelectTask={(id) => setSelectedTaskId(id)}
        />
      );
    }
    if (activeView === 'timeline') {
      return (
          <TimelineView
            onSelectTask={(id) => setSelectedTaskId(id)}
            onStartFocus={handleStartFocus}
            onStartSprint={handleStartStudySprint}
            onOpenStudySession={() => openModal('studySession')}
          />
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


  return (
    <div className="flowtask-workspace relative flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Skip to Main Content Link (WCAG 2.2 Level A / AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 px-4 py-2 rounded-lg bg-[var(--color-brand)] text-white text-xs font-bold shadow-elevated focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      <div className="workspace-aurora pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true"
        style={{ opacity: 'var(--diurnal-intensity, 0)', display: isModalOpen('pomodoro') ? 'none' : undefined }}>
        <div className="workspace-atmosphere-edge" />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block relative z-30 transition-all duration-200">
        <Sidebar
          onOpenPomodoro={() => void transitionView(() => openModal('pomodoro'))}
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
                  void transitionView(() => openModal('pomodoro'));
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
          style={{ borderBottomColor: `color-mix(in srgb, var(--color-brand) 12%, var(--border-hairline))` }}
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
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Menu size={17} strokeWidth={1.75} />
            </button>

            {/* Breadcrumb Title */}
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs font-semibold text-[var(--text-muted)] tracking-wider uppercase shrink-0">
                FlowTask
              </span>
              <span className="text-xs text-[var(--text-muted)] shrink-0">/</span>
              <span className="font-bold text-sm tracking-tight text-[var(--text-primary)] truncate">
                {getViewTitle()}
              </span>
            </div>
          </div>

          {/* Center: Persistent Focus Session Mini-Player or Today Progress Ring */}
          <div className="flex items-center gap-3">
            <FocusMiniPlayer variant="desktop" />
            <button
              type="button"
              onClick={() => void transitionView(() => openModal('pomodoro'))}
              title="Launch Focus Mode & Pomodoro Timer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-amber-600 dark:hover:text-amber-400 bg-[var(--bg-surface-l2)] hover:bg-amber-500/10 border border-[var(--border-hairline)] hover:border-amber-500/30 transition-all shadow-2xs active:scale-95"
            >
              <Timer size={13} strokeWidth={1.75} className="text-amber-500" />
              <span>Focus</span>
            </button>
          </div>

          {/* Right: Quick Tools */}
          <div className="flex items-center gap-1.5">
            {/* Authoritative User Account & Cloud Sync Capsule */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              title={
                user && !isAnonymous
                  ? `Signed in as ${user.displayName || user.email} (${syncStatus === 'synced' ? 'Cloud Synced' : syncStatus}). Click for account & sync.`
                  : `Local Mode (${syncStatus}). Click to sign in and enable cloud sync.`
              }
              aria-label={
                user && !isAnonymous
                  ? `User Account: ${user.displayName || user.email}, Cloud status: ${syncStatus}`
                  : 'Sign in to enable cloud sync'
              }
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] hover:border-amber-500/30 transition-all shadow-2xs cursor-pointer group active:scale-95"
            >
              {user && !isAnonymous ? (
                <div className="relative shrink-0 flex items-center justify-center">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-5 h-5 rounded-full object-cover ring-1 ring-[var(--border-hairline)]"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                      {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1.5 ring-[var(--bg-surface-l1)] ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-500 ring-emerald-500/20'
                        : syncStatus === 'syncing'
                        ? 'bg-amber-500 animate-spin'
                        : syncStatus === 'offline'
                        ? 'bg-amber-500'
                        : 'bg-stone-400'
                    }`}
                  />
                </div>
              ) : (
                <div className="relative shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-stone-200/80 dark:bg-stone-800 text-[var(--text-secondary)]">
                  <Cloud size={11} strokeWidth={2} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-[var(--bg-surface-l1)] ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-500'
                        : syncStatus === 'syncing'
                        ? 'bg-amber-500 animate-spin'
                        : syncStatus === 'offline'
                        ? 'bg-amber-500'
                        : 'bg-stone-400'
                    }`}
                  />
                </div>
              )}

              <span className="text-[11px] font-medium truncate max-w-[110px] xl:max-w-[150px]">
                {user && !isAnonymous
                  ? user.displayName || user.email?.split('@')[0]
                  : 'Sync'}
              </span>

              {/* Status indicator dot or badge */}
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border hidden sm:inline-flex items-center gap-1 ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : syncStatus === 'offline'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-stone-500/10 text-[var(--text-secondary)] border-stone-500/20'
                }`}
              >
                {syncStatus === 'synced'
                  ? 'Cloud'
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
              leftIcon={<Plus size={13} strokeWidth={1.75} />}
              onClick={() => setIsQuickAddOpen(true)}
              title="Quick Add Task"
              aria-label="New Task"
            >
              New Task
            </Button>

            {/* Command Palette / Search Trigger */}
            <button
              type="button"
              onClick={() => openModal('commandPalette')}
              title="Search and commands (Ctrl+K or ⌘K)"
              aria-label="Search and commands"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shadow-subtle cursor-pointer group active:scale-95"
            >
              <Search size={14} strokeWidth={1.75} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
              <span className="hidden xl:inline text-xs text-[var(--text-muted)] font-medium">Search & jump to...</span>
              <Kbd size="xs" className="hidden lg:inline-flex opacity-85">⌘K</Kbd>
            </button>

            {/* Application Settings & Preferences */}
            <button
              type="button"
              onClick={() => openModal('settings')}
              title="Preferences & Settings (Ctrl+,)"
              aria-label="Preferences and Settings"
              className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Settings size={16} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        {/* Mobile Top Header */}
        <header
          className="lg:hidden flex items-center justify-between px-3.5 sm:px-6 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/90 backdrop-blur-xl sticky top-0 z-20 transition-all"
          style={{ borderBottomColor: `color-mix(in srgb, var(--color-brand) 12%, var(--border-hairline))` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setIsSidebarOpenMobile(true)}
              aria-label="Open navigation menu"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Menu size={20} strokeWidth={1.75} />
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
            <FocusMiniPlayer variant="mobile" />

            {/* Mobile User & Cloud Sync Capsule */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              title={
                user && !isAnonymous
                  ? `Account: ${user.displayName || user.email}`
                  : 'Cloud Sync & Account'
              }
              aria-label="Cloud Sync and Account Settings"
              className="p-1.5 text-[var(--text-secondary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95 flex items-center justify-center"
            >
              {user && !isAnonymous ? (
                <div className="relative shrink-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-6 h-6 rounded-full object-cover ring-1 ring-[var(--border-hairline)]"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
                      {(user.displayName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1.5 ring-[var(--bg-surface-l1)] ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-500 ring-emerald-500/20'
                        : syncStatus === 'syncing'
                        ? 'bg-amber-500 animate-spin'
                        : syncStatus === 'offline'
                        ? 'bg-amber-500'
                        : 'bg-stone-400'
                    }`}
                  />
                </div>
              ) : (
                <div className="relative shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)]">
                  <Cloud size={13} strokeWidth={1.75} />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1.5 ring-[var(--bg-surface-l1)] ${
                      syncStatus === 'synced'
                        ? 'bg-emerald-500'
                        : syncStatus === 'syncing'
                        ? 'bg-amber-500 animate-spin'
                        : syncStatus === 'offline'
                        ? 'bg-amber-500'
                        : 'bg-stone-400'
                    }`}
                  />
                </div>
              )}
            </button>

            {/* Search */}
            <button
              onClick={() => openModal('commandPalette')}
              title="Search tasks"
              aria-label="Search tasks"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Search size={18} strokeWidth={1.75} />
            </button>

            {/* Settings */}
            <button
              onClick={() => openModal('settings')}
              title="Preferences & Settings"
              aria-label="Preferences and Settings"
              className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
            >
              <Settings size={18} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        {/* View Viewport */}
        <div ref={mainScrollRef} className="desk-view-host flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
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
                    dismissSnapshot();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>Import {pendingSnapshot.tasks.length} Tasks</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dismissSnapshot();
                  }}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06]"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          <FeatureBoundary key={activeView} title={getViewTitle()} onBack={() => setActiveView('today')}>
          <Suspense fallback={<ViewSkeleton title={`Loading ${getViewTitle()}…`} />}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="desk-view h-full flex flex-col"
                data-workspace-view={activeView}
              >
                {renderActiveView()}
              </motion.div>
            </AnimatePresence>
          </Suspense>
          </FeatureBoundary>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={(viewId) => void transitionView(() => setActiveView(viewId as any))}
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
            key="slide-over-task-drawer"
            taskId={selectedTaskId}
            onClose={handleCloseDrawer}
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

      {/* Document Picture-in-Picture Floating HUD */}
      <FocusPipPortal />

      {/* Global Toast */}
      <Toast />
    </div>
  );
};
