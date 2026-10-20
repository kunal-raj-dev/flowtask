import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { DashboardEditor } from '../dashboard/DashboardEditor';
import { DailyPlanning } from '../workflow/DailyPlanning';
import { STARTER_DASHBOARDS } from '../../services/starterDashboards';
import type { WorkspacePreferences } from '../../types/dashboard';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { resolveActiveDashboard } from '../../utils/activeDashboard';

interface DashboardCanvasViewProps {
  onSelectTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void;
  onPlanMyDay?: () => void;
  onSwitchToHorizon?: () => void;
  introduction?: React.ReactNode;
}

export const DashboardCanvasView: React.FC<DashboardCanvasViewProps> = ({
  onSelectTask,
  onStartFocus,
  onStartSprint,
  onPlanMyDay,
  onSwitchToHorizon,
  introduction,
}) => {
  const {
    dashboards = [],
    updateDashboards,
    workspacePreferences = {},
    workspaceId = 'local',
    setWorkspacePreference,
  } = useTaskContext();

  const [planning, setPlanning] = useState(false);
  const activeDashboard = resolveActiveDashboard(dashboards, workspacePreferences.activeDashboardId as string | undefined, workspacePreferences.workspace as WorkspacePreferences | undefined);

  return (
    <div className="desk-dashboard-canvas-view">
      {onSwitchToHorizon && (
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/70 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2">
            <LayoutGrid size={15} className="text-amber-500" />
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Modular Dashboard Canvas</span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[var(--color-brand)] hover:underline rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.04] transition-colors"
            onClick={onSwitchToHorizon}
          >
            <ArrowLeft size={13} />
            <span>Back to Horizon Daily Flow</span>
          </button>
        </div>
      )}

      {planning && <DailyPlanning showCard={false} isOpen={true} onOpenChange={setPlanning} />}

      <div className="today-dashboard-scroll desk-page-frame">
        {introduction}
        <DashboardEditor
          key={workspaceId}
          workspaceId={workspaceId}
          dashboards={dashboards.length ? dashboards : STARTER_DASHBOARDS}
          activeDashboardId={activeDashboard.id}
          onActiveDashboardChange={(id) => setWorkspacePreference?.('activeDashboardId', id)}
          onUpdateDashboards={updateDashboards}
          onSelectTask={onSelectTask}
          onStartFocus={onStartFocus}
          onStartSprint={onStartSprint}
          onPlanMyDay={() => {
            if (onPlanMyDay) {
              onPlanMyDay();
            } else {
              setPlanning(true);
            }
          }}
        />
      </div>
    </div>
  );
};
