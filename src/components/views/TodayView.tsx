import { useTaskAvailabilityClock } from '../../hooks/useTaskAvailabilityClock';
import React, { lazy, Suspense, useMemo, useState, useCallback } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { HorizonTodayView } from './today/HorizonTodayView';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { isFocusTask, isTodayTask } from '../../utils/taskSelectors';
import { OnboardingFlow } from '../modals/OnboardingFlow';
import { BackupReminder } from '../workflow/BackupReminder';
import celebrate from '../../utils/celebrate';
import { TodayAppearance } from '../workspace/TodayAppearance';
import type { TodayLayoutPreferences, WorkspacePreferences } from '../../types/dashboard';
import { normalizeTodayLayout, partitionTodayTasks } from '../../utils/todayLayout';
import type { Priority } from '../../types/task';

const DashboardCanvasView = lazy(() => import('./DashboardCanvasView').then(module => ({ default: module.DashboardCanvasView })));

interface TodayViewProps {
  onSelectTask: (id: string) => void;
  onStartFocus: (id: string) => void;
  onOpenBrainDump?: () => void;
  onStartSprint?: (id: string) => void;
  onOpenStudySession?: () => void;
  initialViewMode?: 'horizon' | 'dashboard';
}

export const TodayView: React.FC<TodayViewProps> = ({
  onSelectTask,
  onStartFocus,
  onStartSprint,
  initialViewMode = 'horizon',
}) => {
  const {
    workspacePreferences = {},
    tasks,
    projects = [],
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
    batchUpdateTasks,
    batchDeleteTasks,
    settings,
    setWorkspacePreference,
  } = useTaskContext();

  const [viewMode, setViewMode] = useState<'horizon' | 'dashboard'>(initialViewMode);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [layoutPreview, setLayoutPreview] = useState<TodayLayoutPreferences | null>(null);
  const workspace = workspacePreferences.workspace as WorkspacePreferences | undefined;
  const savedLayout = normalizeTodayLayout(workspace?.todayLayout);
  const layout = layoutPreview ?? savedLayout;
  const closeCustomize = () => { setLayoutPreview(null); setCustomizeOpen(false); };
  const openCustomize = () => { setLayoutPreview(normalizeTodayLayout(workspace?.todayLayout)); setCustomizeOpen(true); };
  const saveLayout = (next: TodayLayoutPreferences) => setWorkspacePreference?.('workspace', { ...workspace, todayLayout: next });
  const [welcome, setWelcome] = useState(() => {
    try {
      return (
        !settings?.onboardingCompleted &&
        localStorage.getItem('flowtask_onboarding_completed') !== 'true' &&
        tasks.length === 0
      );
    } catch {
      return !settings?.onboardingCompleted && tasks.length === 0;
    }
  });

  const today = useTodayStr();
  const availabilityNow = useTaskAvailabilityClock(tasks);

  // Active tasks for keyboard navigation
  const visibleTasks = useMemo(() => {
    const active = tasks.filter((t) => !t.deletedAt && !t.archivedAt && t.status !== 'done' && (isTodayTask(t, today, { tasks, projects, now: availabilityNow }) || isFocusTask(t, today, { tasks, projects, now: availabilityNow })));
    const weight: Record<Priority, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
    const priorities = active.filter(task => isFocusTask(task, today, { tasks, projects, now: availabilityNow })).sort((a, b) => weight[a.priority] - weight[b.priority]).slice(0, 3);
    const groups = partitionTodayTasks(active, layout, priorities.map(task => task.id));
    return layout.sections.flatMap(section => section.visible && section.id in groups ? groups[section.id as keyof typeof groups] : []);
  }, [tasks, projects, today, availabilityNow, layout]);

  const handleToggleStatusWithCelebration = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      const willBeDone = target ? target.status !== 'done' : false;
      const isTopThree = target ? isFocusTask(target, today, { tasks, projects, now: availabilityNow }) : false;

      toggleTaskStatus(taskId);

      if (willBeDone && isTopThree) {
        const theme = getComputedStyle(document.documentElement);
        const celebrationColors = ['--color-brand', '--pastel-sage', '--pastel-lavender', '--pastel-coral', '--pastel-sky']
          .map(token => theme.getPropertyValue(token).trim())
          .filter(Boolean);
        celebrate({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          ...(celebrationColors.length > 0 ? { colors: celebrationColors } : {}),
        });
      }
    },
    [tasks, projects, today, availabilityNow, toggleTaskStatus]
  );

  useKeyboardNavigation({
    tasks: visibleTasks,
    onSelectTask,
    onToggleStatus: handleToggleStatusWithCelebration,
    onTogglePinToday: toggleTaskPinToday,
    onUpdateTask: updateTask,
    onDeleteTask: deleteTask,
    onBatchUpdate: batchUpdateTasks,
    onBatchDelete: batchDeleteTasks,
    onBatchArchive: (ids) => batchUpdateTasks(ids, { archivedAt: Date.now() }),
    onStartFocus,
    enabled: true,
  });

  const introduction = <>
      {welcome && <OnboardingFlow inline isOpen onClose={() => setWelcome(false)} />}
      {!!workspacePreferences._dashboardRecovery && (
        <p className="desk-notice" role="status">
          A saved layout needs repair. A recovery copy is preserved on this device; your tasks and notes are safe.
        </p>
      )}
  </>;

  return (
    <div className="today-surface">
      <TodayAppearance customizeOpen={customizeOpen} onClose={closeCustomize} onEditWidgets={() => setViewMode('dashboard')} layout={layout} onPreview={setLayoutPreview} onApply={() => { saveLayout(layout); closeCustomize(); }} />
      <div className="today-content">

      {viewMode === 'horizon' ? (
        <HorizonTodayView
          introduction={introduction}
          footer={<BackupReminder />}
          onSelectTask={onSelectTask}
          onStartFocus={onStartFocus}
          onStartSprint={onStartSprint}
          onSwitchToDashboard={() => setViewMode('dashboard')}
          onCustomize={openCustomize}
          layout={layout}
          onLayoutChange={next => customizeOpen ? setLayoutPreview(next) : saveLayout(next)}
        />
      ) : (
        <Suspense fallback={<p role="status">Opening your dashboard…</p>}>
        <DashboardCanvasView
          introduction={<>{introduction}<BackupReminder /></>}
          onSelectTask={onSelectTask}
          onStartFocus={onStartFocus}
          onStartSprint={onStartSprint}
          onSwitchToHorizon={() => setViewMode('horizon')}
        />
        </Suspense>
      )}
      </div>
    </div>
  );
};
