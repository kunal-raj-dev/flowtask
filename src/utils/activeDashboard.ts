import type { WorkspaceDashboard, WorkspacePreferences } from '../types/dashboard';
import { STARTER_DASHBOARDS } from '../services/starterDashboards';

/** One selection rule for Today, its background and the dashboard editor. */
export function resolveActiveDashboard(dashboards: WorkspaceDashboard[], activeId?: string, workspace?: WorkspacePreferences) {
  const saved = dashboards.length ? dashboards : STARTER_DASHBOARDS;
  return saved.find(d => d.id === activeId)
    || saved.find(d => d.id === workspace?.defaultDashboardId)
    || saved.find(d => d.isDefault)
    || saved[0];
}
