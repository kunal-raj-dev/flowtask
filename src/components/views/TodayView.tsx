import React, { useMemo, useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { DashboardEditor } from '../dashboard/DashboardEditor';
import { DailyPlanning } from '../workflow/DailyPlanning';
import { STARTER_DASHBOARDS } from '../../services/starterDashboards';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { isFocusTask, isTodayTask } from '../../utils/taskSelectors';
import { filterTasksByPredicate } from '../../utils/smartViewUtils';
import type { WorkspacePreferences } from '../../types/dashboard';
import { OnboardingFlow } from '../modals/OnboardingFlow';
import { BackupReminder } from '../workflow/BackupReminder';
interface TodayViewProps {
  onSelectTask: (id: string) => void; onStartFocus: (id: string) => void;
  onOpenBrainDump?: () => void; onStartSprint?: (id: string) => void; onOpenStudySession?: () => void;
}
export const TodayView: React.FC<TodayViewProps> = ({ onSelectTask, onStartFocus, onStartSprint }) => {
  const { dashboards = [], updateDashboards, workspacePreferences = {}, workspaceId = 'local', setWorkspacePreference, tasks, smartViews = [], toggleTaskStatus, toggleTaskPinToday, updateTask, deleteTask, batchUpdateTasks, batchDeleteTasks } = useTaskContext();
  const [planning, setPlanning] = useState(false);
  const { settings } = useTaskContext();
  const [welcome, setWelcome] = useState(() => {
    try { return !settings?.onboardingCompleted && localStorage.getItem('flowtask_onboarding_completed') !== 'true' && tasks.length === 0; }
    catch { return !settings?.onboardingCompleted && tasks.length === 0; }
  });
  const today = useTodayStr();
  const defaultDashboardId = (workspacePreferences.workspace as WorkspacePreferences | undefined)?.defaultDashboardId;
  const visibleTasks = useMemo(() => {
    const desks = dashboards.length ? dashboards : STARTER_DASHBOARDS;
    const desk = desks.find(d => d.id === (workspacePreferences.activeDashboardId || defaultDashboardId)) || desks[0];
    const result = new Map<string, typeof tasks[number]>();
    for (const widget of desk.widgets) {
      let source = tasks.filter(t => !t.deletedAt && !t.archivedAt && t.status !== 'done');
      if (widget.type === 'top3') source = source.filter(t => isFocusTask(t,today));
      else if (widget.type === 'taskList') {
        if (widget.config.source === 'project') source = source.filter(t => t.projectId === widget.config.projectId);
        else if (widget.config.source === 'filter') { const view = smartViews.find(v => v.id === widget.config.filterId); source = view ? filterTasksByPredicate(source,view.predicate) : []; }
        else if (widget.config.source === 'inbox') source = source.filter(t => t.projectId === 'inbox' && !t.plannedDate && !t.dueDate && !t.isSomeday);
        else source = source.filter(t => isTodayTask(t,today) && !(widget.config.excludeTop3 && isFocusTask(t,today)));
      } else continue;
      source.forEach(t => result.set(t.id,t));
    }
    return [...result.values()];
  }, [dashboards,workspacePreferences.activeDashboardId,defaultDashboardId,tasks,smartViews,today]);
  useKeyboardNavigation({ tasks: visibleTasks, onSelectTask, onToggleStatus: toggleTaskStatus, onTogglePinToday: toggleTaskPinToday, onUpdateTask: updateTask, onDeleteTask: deleteTask, onBatchUpdate: batchUpdateTasks, onBatchDelete: batchDeleteTasks, onBatchArchive: ids => batchUpdateTasks(ids, { archivedAt: Date.now() }), onStartFocus, enabled: true });
  return <div className="desk-today-page">
    {welcome && <OnboardingFlow inline isOpen onClose={() => setWelcome(false)}/>}
    <BackupReminder/>
    {!!workspacePreferences._dashboardRecovery && <p className="desk-notice" role="status">A saved layout needs repair. A recovery copy is preserved on this device; your tasks and notes are safe.</p>}
    {planning && <DailyPlanning showCard={false} isOpen={true} onOpenChange={setPlanning}/>}
    <DashboardEditor key={workspaceId} workspaceId={workspaceId} dashboards={dashboards.length ? dashboards : STARTER_DASHBOARDS}
      activeDashboardId={(workspacePreferences.activeDashboardId || defaultDashboardId) as string | undefined}
      onActiveDashboardChange={id => setWorkspacePreference?.('activeDashboardId', id)} onUpdateDashboards={updateDashboards}
      onSelectTask={onSelectTask} onStartFocus={onStartFocus} onStartSprint={onStartSprint} onPlanMyDay={() => setPlanning(true)}/>
  </div>;
};
