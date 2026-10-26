import { useTaskContext } from '../context/TaskContext';
import { STARTER_DASHBOARDS } from '../services/starterDashboards';
import { resolveActiveDashboard } from '../utils/activeDashboard';
import type { WorkspacePreferences } from '../types/dashboard';

export function useWorkspaceBackgroundChoice() {
  const { dashboards = [], workspacePreferences = {}, updateDashboards, setWorkspacePreference } = useTaskContext();
  const workspace = workspacePreferences.workspace as WorkspacePreferences | undefined;
  const dashboard = resolveActiveDashboard(dashboards, workspacePreferences.activeDashboardId as string | undefined, workspace);
  const hasBackground = workspace?.showCovers !== false && workspace?.presentation?.plainBackground !== true && dashboard.coverImage !== 'none';
  const setBackground = (coverImage?: string, coverFocalPoint?: { x: number; y: number }) => {
    updateDashboards((dashboards.length ? dashboards : STARTER_DASHBOARDS).map(d => d.id === dashboard.id
      ? { ...d, coverImage: coverImage || 'none', coverFocalPoint: coverImage && coverImage !== 'none' ? coverFocalPoint : undefined, updatedAt: Date.now() } : d));
    setWorkspacePreference('workspace', { ...workspace, showCovers: true, presentation: { ...workspace?.presentation, version: 1, plainBackground: false } });
  };
  return { dashboard, hasBackground, setBackground };
}
