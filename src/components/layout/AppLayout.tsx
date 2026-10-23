import { canonicalWorkspaceUrl, resolveStartView } from '../../utils/entryRoute';
import { shouldIgnoreShortcut } from '../../services/shortcutRegistry';
import { isTodayTask } from '../../utils/taskSelectors';
import { RecoveryView } from '../views/RecoveryView';
import React, { useState, useEffect, useRef, useMemo, useCallback, lazy } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TodayView } from '../views/TodayView';
const UpcomingView = lazy(() => import('../views/UpcomingView').then((m) => ({ default: m.UpcomingView })));
const TimelineView = lazy(() => import('../views/TimelineView').then((m) => ({ default: m.TimelineView })));
const EisenhowerView = lazy(() => import('../views/EisenhowerView').then((m) => ({ default: m.EisenhowerView })));
const KanbanView = lazy(() => import('../views/KanbanView').then((m) => ({ default: m.KanbanView })));
const ProjectsView = lazy(() => import('../views/ProjectsView').then((m) => ({ default: m.ProjectsView })));
const ReviewView = lazy(() => import('../views/ReviewView').then((m) => ({ default: m.ReviewView })));
const StudyView = lazy(() => import('../views/StudyView').then((m) => ({ default: m.StudyView })));
import { TaskList } from '../tasks/TaskList';
import { AppShell } from './AppShell';
import { DesktopHeader } from './DesktopHeader';
import { ViewContainer } from './ViewContainer';
import { useModal } from '../../context/ModalContext';
import { transitionView } from '../../utils/viewTransitions';
import { Menu, Search, Settings, Cloud, Sparkles } from 'lucide-react';
import { parseSnapshotFromUrl, type SnapshotPayload } from '../../utils/snapshotShare';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { audioEngine } from '../../utils/audioEngine';
import { useTactileAudioClicks } from '../../hooks/useTactileAudioClicks';
import { useAuth } from '../../context/AuthContext';
import { useStudioPreferences } from '../../hooks/useStudio';
import confetti from '../../utils/celebrate';
import { FocusMiniPlayer } from '../focus/FocusMiniPlayer';

export const AppLayout: React.FC = () => {
  const clickPreferences = useTaskContext().workspacePreferences?.appearance as
    | { keyboardSounds?: boolean; mode?: 'manual' | 'system' | 'schedule' }
    | undefined;
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
    focusSession,
    startFocusSession,
    updateFocusSession,
    resumeFocusSession,
  } = useTaskContext();

  const { preferences: studioPreferences } = useStudioPreferences();
  const todayStr = useTodayStr();
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

  const dismissSnapshot = () => {
    setPendingSnapshot(null);
    const url = canonicalWorkspaceUrl(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', url);
  };

  const startViewApplied = useRef(false);
  useEffect(() => {
    if (startViewApplied.current) return;
    if (new URLSearchParams(window.location.search).has('view') || window.location.hash.startsWith('#snapshot=')) {
      startViewApplied.current = true;
      return;
    }
    const view = resolveStartView(settings.defaultLandingView);
    if (view !== activeView) setActiveView(view);
    if (settings.defaultLandingView) {
      startViewApplied.current = true;
    }
  }, [settings.defaultLandingView, activeView, setActiveView]);

  const pendingQuickAdd = useRef(new URLSearchParams(window.location.search).get('action') === 'quickadd');
  useEffect(() => {
    if (
      !pendingQuickAdd.current ||
      syncStatus === 'syncing' ||
      hasAnyModalOpen ||
      isQuickAddOpen ||
      isAuthModalOpen ||
      isSmartFilterModalOpen ||
      isEveningShutdownOpen ||
      isWeeklyReviewOpen ||
      selectedTaskId ||
      pendingSnapshot
    )
      return;
    pendingQuickAdd.current = false;
    const url = canonicalWorkspaceUrl(window.location.href);
    if (url.searchParams.get('action') === 'quickadd') {
      url.searchParams.delete('action');
      window.history.replaceState(window.history.state, '', url);
    }
    setIsQuickAddOpen(true);
  }, [
    syncStatus,
    hasAnyModalOpen,
    isQuickAddOpen,
    isAuthModalOpen,
    isSmartFilterModalOpen,
    isEveningShutdownOpen,
    isWeeklyReviewOpen,
    selectedTaskId,
    pendingSnapshot,
    setIsQuickAddOpen,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem('flowtask_sidebar_collapsed', String(isSidebarCollapsed));
    } catch {}
  }, [isSidebarCollapsed]);

  // Global Keyboard shortcuts with strict modal isolation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settings?.keyboardShortcutsEnabled === false) return;
      if (shouldIgnoreShortcut(e)) return;

      const isAnyModalActive =
        hasAnyModalOpen ||
        isQuickAddOpen ||
        isAuthModalOpen ||
        isEveningShutdownOpen ||
        isWeeklyReviewOpen ||
        isSmartFilterModalOpen;

      if (isAnyModalActive) return;
      if (document.querySelector('[aria-modal="true"], [data-overlay-open="true"], [data-layout-editing="true"]')) return;

      if (selectedTaskId !== null && !e.ctrlKey && !e.metaKey && !e.altKey) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        openModal('shortcuts');
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openModal('commandPalette');
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        openModal('copilotOmnibar');
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
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && ['n', 'N', 'c', 'C'].includes(e.key)) {
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
    settings?.keyboardShortcutsEnabled,
  ]);

  const todayCount = useMemo(() => tasks.filter((t) => isTodayTask(t, todayStr)).length, [tasks, todayStr]);

  const inboxCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== 'done' &&
          !t.deletedAt &&
          !t.archivedAt &&
          t.projectId === 'inbox' &&
          !t.dueDate &&
          !t.plannedDate &&
          !t.isSomeday
      ).length,
    [tasks]
  );

  const upcomingCount = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === 'done' || t.deletedAt || t.archivedAt) return false;
        const taskDate = t.plannedDate || t.dueDate;
        return !t.isSomeday && taskDate && taskDate > todayStr;
      }).length,
    [tasks, todayStr]
  );

  const getViewTitle = () => {
    switch (activeView as string) {
      case 'today':
        return 'Today';
      case 'dashboard':
        return 'Dashboard Canvas';
      case 'inbox':
        return 'Inbox';
      case 'upcoming':
        return 'Upcoming';
      case 'projects':
        return 'Projects';
      case 'review':
        return 'Review';
      case 'all':
        return 'All Tasks';
      case 'someday':
        return 'Someday';
      case 'timeline':
        return 'Plan';
      case 'study':
        return 'Study Hub';
      case 'matrix':
        return 'Priority Matrix';
      case 'kanban':
        return 'Kanban Board';
      case 'insights':
        return 'Insights';
      case 'logbook':
        return 'Logbook';
      case 'trash':
        return 'Trash';
      case 'archive':
        return 'Archive';
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

  const handleStartFocus = useCallback(
    (taskId: string) => {
      if (focusSession) {
        if (focusSession.taskId === taskId && focusSession.state === 'paused') resumeFocusSession();
        openModal('pomodoro', { taskId: focusSession.taskId });
        return;
      }
      const task = tasks.find((item) => item.id === taskId);
      const timer = studioPreferences.timer;
      startFocusSession(timer.mode, taskId, task?.title, timer.mode === 'stopwatch' ? 0 : timer.focusMinutes * 60);
      updateFocusSession({
        timerConfiguration: timer,
        recipeId: studioPreferences.recipeId,
        nextAction: task?.nextAction,
      });
      openModal('pomodoro', { taskId });
    },
    [focusSession, resumeFocusSession, openModal, tasks, studioPreferences, startFocusSession, updateFocusSession]
  );

  const handleStartStudySprint = useCallback(
    (taskId: string) => {
      openModal('studySprint', { taskId });
    },
    [openModal]
  );

  const handleSelectTask = useCallback(
    (id: string) => {
      setSelectedTaskId(id);
    },
    [setSelectedTaskId]
  );

  const handleOpenBrainDump = useCallback(() => {
    openModal('brainDump');
  }, [openModal]);

  const handleOpenStudySession = useCallback(() => {
    openModal('studySession');
  }, [openModal]);

  const handleCloseDrawer = useCallback(() => {
    setSelectedTaskId(null);
  }, [setSelectedTaskId]);

  const renderActiveView = () => {
    if (activeView === 'trash' || activeView === 'archive') return <RecoveryView mode={activeView} />;
    if (activeView === 'today') {
      return (
        <TodayView key="daily"
          onSelectTask={handleSelectTask}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={handleOpenBrainDump}
          onStartSprint={handleStartStudySprint}
          onOpenStudySession={handleOpenStudySession}
        />
      );
    }
    if ((activeView as string) === 'dashboard') {
      return <TodayView key="dashboard" initialViewMode="dashboard" onSelectTask={handleSelectTask} onStartFocus={handleStartFocus} onStartSprint={handleStartStudySprint} />;
    }
    if (activeView === 'inbox') {
      return (
        <TaskList
          filterInbox
          onSelectTask={handleSelectTask}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={handleOpenBrainDump}
          onStartSprint={handleStartStudySprint}
        />
      );
    }
    if (activeView === 'upcoming') {
      return (
        <UpcomingView
          onSelectTask={handleSelectTask}
          onStartFocus={handleStartFocus}
          onOpenBrainDump={handleOpenBrainDump}
          onStartSprint={handleStartStudySprint}
        />
      );
    }
    if (activeView === 'projects' || activeView.startsWith('project:')) {
      const selectedProjId = activeView.startsWith('project:') ? activeView.split(':')[1] : null;
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
    if (activeView === 'review' || activeView === 'insights' || activeView === 'logbook') {
      return (
        <ReviewView
          key={activeView}
          initialTab={activeView === 'insights' ? 'insights' : 'logbook'}
          onSelectTask={(id) => setSelectedTaskId(id)}
        />
      );
    }
    if (activeView === 'study') {
      return <StudyView onStartSprint={handleStartStudySprint} onSelectTask={(id) => setSelectedTaskId(id)} />;
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

  const mobileHeaderNode = (
    <header
      className="workspace-mobile-header lg:hidden flex items-center justify-between px-3.5 sm:px-6 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/90 backdrop-blur-xl sticky top-0 z-20 transition-all shrink-0"
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
          <span className="mobile-view-title font-bold text-sm tracking-tight text-[var(--text-primary)] truncate">
            {getViewTitle()}
          </span>
          <span className="mobile-mode-badge text-[9px] px-1.5 py-0.2 rounded-full bg-stone-200/80 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 font-semibold border border-[var(--border-subtle)] shrink-0">
            Zen
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <FocusMiniPlayer variant="mobile" />

        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          title={user && !isAnonymous ? `Account: ${user.displayName || user.email}` : 'Cloud Sync & Account'}
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

        <button
          onClick={() => openModal('copilotOmnibar')}
          title="FlowTask Copilot"
          aria-label="Open Copilot Omnibar"
          className="mobile-secondary-action p-2 text-[var(--color-brand)] rounded-xl hover:bg-[var(--bg-surface-hover)]"
        >
          <Sparkles size={18} />
        </button>

        <button
          onClick={() => openModal('commandPalette')}
          title="Search tasks"
          aria-label="Search tasks"
          className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
        >
          <Search size={18} strokeWidth={1.75} />
        </button>

        <button
          onClick={() => openModal('settings')}
          title="Preferences & Settings"
          aria-label="Preferences and Settings"
          className="mobile-secondary-action p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
        >
          <Settings size={18} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );

  return (
    <AppShell
      isSidebarCollapsed={isSidebarCollapsed}
      onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
      isSidebarOpenMobile={isSidebarOpenMobile}
      onCloseMobileSidebar={() => setIsSidebarOpenMobile(false)}
      onOpenMobileSidebar={() => setIsSidebarOpenMobile(true)}
      onOpenPomodoro={() => void transitionView(() => openModal('pomodoro'))}
      onOpenShortcuts={() => openModal('shortcuts')}
      onOpenExportImport={() => openModal('exportImport')}
      onOpenBrainDump={() => openModal('brainDump')}
      onOpenAesthetics={() => openModal('settings', { initialTab: 'aesthetics' })}
      onOpenScratchpad={() => openModal('scratchpad')}
      onOpenStudySession={() => openModal('studySession')}
      onOpenSettings={() => openModal('settings')}
      desktopHeader={
        <DesktopHeader
          viewTitle={getViewTitle()}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          onOpenFocus={() => void transitionView(() => openModal('pomodoro'))}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onQuickAdd={() => setIsQuickAddOpen(true)}
          onOpenCommandPalette={() => openModal('commandPalette')}
          onOpenCopilot={() => openModal('copilotOmnibar')}
          onOpenSettings={() => openModal('settings')}
          syncStatus={syncStatus}
          user={user}
          isAnonymous={isAnonymous}
        />
      }
      mobileHeader={mobileHeaderNode}
      activeView={activeView}
      onSelectView={(viewId) => void transitionView(() => setActiveView(viewId as any))}
      onQuickAdd={() => setIsQuickAddOpen(true)}
      todayCount={todayCount}
      inboxCount={inboxCount}
      upcomingCount={upcomingCount}
      selectedTaskId={selectedTaskId}
      onCloseDrawer={handleCloseDrawer}
      onStartFocus={handleStartFocus}
      onStartSprint={handleStartStudySprint}
      isPomodoroOpen={isModalOpen('pomodoro')}
      onSelectTaskFromModalRoot={(id) => setSelectedTaskId(id)}
    >
      <ViewContainer
        activeView={activeView}
        viewTitle={getViewTitle()}
        onBackToToday={() => setActiveView('today')}
        pendingSnapshot={pendingSnapshot}
        onImportSnapshot={(snapshot) => {
          snapshot.tasks.forEach((t) => {
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
        onDismissSnapshot={dismissSnapshot}
      >
        {renderActiveView()}
      </ViewContainer>
    </AppShell>
  );
};
