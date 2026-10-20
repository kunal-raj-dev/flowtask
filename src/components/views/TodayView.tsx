import React, { useMemo, useState, useCallback } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { HorizonTodayView } from './today/HorizonTodayView';
import { DashboardCanvasView } from './DashboardCanvasView';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { isFocusTask, isTodayTask } from '../../utils/taskSelectors';
import { OnboardingFlow } from '../modals/OnboardingFlow';
import { BackupReminder } from '../workflow/BackupReminder';
import celebrate from '../../utils/celebrate';
import { TodayAppearance } from '../workspace/TodayAppearance';

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
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
    batchUpdateTasks,
    batchDeleteTasks,
    settings,
  } = useTaskContext();

  const [viewMode, setViewMode] = useState<'horizon' | 'dashboard'>(initialViewMode);
  const [customizeOpen, setCustomizeOpen] = useState(false);
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

  // Active tasks for keyboard navigation
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => !t.deletedAt && !t.archivedAt && (isTodayTask(t, today) || isFocusTask(t, today)));
  }, [tasks, today]);

  const handleToggleStatusWithCelebration = useCallback(
    (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      const willBeDone = target ? target.status !== 'done' : false;
      const isTopThree = target ? isFocusTask(target, today) : false;

      toggleTaskStatus(taskId);

      if (willBeDone && isTopThree) {
        celebrate({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#3B82F6'],
        });
      }
    },
    [tasks, today, toggleTaskStatus]
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
      <BackupReminder />
      {!!workspacePreferences._dashboardRecovery && (
        <p className="desk-notice" role="status">
          A saved layout needs repair. A recovery copy is preserved on this device; your tasks and notes are safe.
        </p>
      )}
  </>;

  return (
    <div className="today-surface">
      <TodayAppearance customizeOpen={customizeOpen} onClose={() => setCustomizeOpen(false)} onEditWidgets={() => setViewMode('dashboard')} />
      <div className="today-content">

      {viewMode === 'horizon' ? (
        <HorizonTodayView
          introduction={introduction}
          onSelectTask={onSelectTask}
          onStartFocus={onStartFocus}
          onStartSprint={onStartSprint}
          onSwitchToDashboard={() => setViewMode('dashboard')}
          onCustomize={() => setCustomizeOpen(true)}
        />
      ) : (
        <DashboardCanvasView
          introduction={introduction}
          onSelectTask={onSelectTask}
          onStartFocus={onStartFocus}
          onStartSprint={onStartSprint}
          onSwitchToHorizon={() => setViewMode('horizon')}
        />
      )}
      </div>
    </div>
  );
};
