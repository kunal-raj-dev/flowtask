import { lazy, Suspense, useState } from 'react';
import { Image, LayoutGrid, Palette } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useMediaCatalog } from '../../hooks/useStudio';
import { resolveActiveDashboard } from '../../utils/activeDashboard';
import type { WorkspacePreferences } from '../../types/dashboard';
import { STARTER_DASHBOARDS } from '../../services/starterDashboards';
import { Dialog } from '../ui/Dialog';
import { useModalStore } from '../../store/useModalStore';

const WorkspaceVisualPicker = lazy(() => import('./WorkspaceVisualPicker').then(module => ({ default: module.WorkspaceVisualPicker })));

export function TodayAppearance({ customizeOpen, onClose, onEditWidgets }: {
  customizeOpen: boolean; onClose: () => void; onEditWidgets: () => void;
}) {
  const { dashboards = [], workspacePreferences = {}, updateDashboards } = useTaskContext();
  const workspace = workspacePreferences.workspace as WorkspacePreferences | undefined;
  const dashboard = resolveActiveDashboard(dashboards, workspacePreferences.activeDashboardId as string | undefined, workspace);
  const media = useMediaCatalog();
  const asset = media.visuals.find(a => a.id === dashboard.coverImage);
  const src = asset?.variants?.[0]?.src || asset?.src;
  const [failedSrc, setFailedSrc] = useState('');
  const [picker, setPicker] = useState(false);
  const visible = workspace?.showCovers !== false && !!src && failedSrc !== src;
  const missing = !!dashboard.coverImage && !media.loading && (!asset || failedSrc === src);
  return <>
    {visible && <div className="today-background" aria-hidden="true" data-today-background>
      <img src={src} alt="" onError={() => setFailedSrc(src || '')} style={{ objectPosition: `${dashboard.coverFocalPoint?.x ?? asset?.focalPoint?.x ?? 50}% ${dashboard.coverFocalPoint?.y ?? asset?.focalPoint?.y ?? 50}%` }} />
      <div className="today-background-tint" />
    </div>}
    {missing && <div className="today-image-notice desk-notice" role="status"><span>Your saved background is unavailable on this device.</span><button className="desk-button" onClick={() => setPicker(true)}>Choose replacement</button></div>}
    <Dialog isOpen={customizeOpen} onClose={onClose} title="Customize Today" description="Make this space work for you." size="sm">
      <div className="today-customize-actions">
        <button className="desk-button" onClick={() => { onClose(); onEditWidgets(); }}><LayoutGrid size={18} />Desks & layouts</button>
        <button className="desk-button" onClick={() => { onClose(); setPicker(true); }}><Image size={18} />Background</button>
        <button className="desk-button" onClick={() => { onClose(); useModalStore.getState().openModal('settings', { initialTab: 'aesthetics' }); }}><Palette size={18} />Appearance</button>
      </div>
    </Dialog>
    {picker && <Suspense fallback={<Dialog isOpen onClose={() => setPicker(false)} title="Choose a workspace image"><p role="status">Opening your image library…</p></Dialog>}><WorkspaceVisualPicker isOpen onClose={() => setPicker(false)} assets={media.visuals} loading={media.loading} catalogError={media.error} context={{ kind: 'dashboard' }} value={dashboard.coverImage} focalPoint={dashboard.coverFocalPoint} onSelect={(coverImage, coverFocalPoint) => {
      updateDashboards((dashboards.length ? dashboards : STARTER_DASHBOARDS).map(d => d.id === dashboard.id ? { ...d, coverImage, coverFocalPoint: coverImage ? coverFocalPoint : undefined, updatedAt: Date.now() } : d));
      setFailedSrc('');
    }} /></Suspense>}
  </>;
}
