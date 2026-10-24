import { lazy, Suspense } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useMediaCatalog } from '../../hooks/useStudio';
import { resolveActiveDashboard } from '../../utils/activeDashboard';
import type { WorkspacePreferences } from '../../types/dashboard';
import { STARTER_DASHBOARDS } from '../../services/starterDashboards';
import { Dialog } from '../ui/Dialog';

const WorkspaceVisualPicker = lazy(() => import('./WorkspaceVisualPicker').then(module => ({ default: module.WorkspaceVisualPicker })));

export function WorkspaceImagePicker({ onClose, onSelect }: { onClose: () => void; onSelect?: () => void }) {
  const { dashboards = [], workspacePreferences = {}, updateDashboards } = useTaskContext();
  const workspace = workspacePreferences.workspace as WorkspacePreferences | undefined;
  const dashboard = resolveActiveDashboard(dashboards, workspacePreferences.activeDashboardId as string | undefined, workspace);
  const media = useMediaCatalog();

  return <Suspense fallback={<Dialog isOpen onClose={onClose} title="Choose a workspace image"><p role="status">Opening your image library…</p></Dialog>}>
    <WorkspaceVisualPicker isOpen onClose={onClose} assets={media.visuals} loading={media.loading} catalogError={media.error}
      context={{ kind: 'dashboard' }} value={dashboard.coverImage} focalPoint={dashboard.coverFocalPoint}
      onSelect={(coverImage, coverFocalPoint) => {
        updateDashboards((dashboards.length ? dashboards : STARTER_DASHBOARDS).map(d => d.id === dashboard.id
          ? { ...d, coverImage, coverFocalPoint: coverImage ? coverFocalPoint : undefined, updatedAt: Date.now() } : d));
        onSelect?.();
      }} />
  </Suspense>;
}
