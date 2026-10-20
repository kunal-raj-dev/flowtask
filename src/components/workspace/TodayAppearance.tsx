import { useState } from 'react';
import { Image, LayoutGrid } from 'lucide-react';
import { useTaskContext } from '../../context/TaskContext';
import { useMediaCatalog } from '../../hooks/useStudio';
import { resolveActiveDashboard } from '../../utils/activeDashboard';
import type { WorkspacePreferences } from '../../types/dashboard';
import { STARTER_DASHBOARDS } from '../../services/starterDashboards';
import { Dialog } from '../ui/Dialog';
import { WorkspaceVisualPicker } from './WorkspaceVisualPicker';

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
        <button className="desk-button" onClick={() => { onClose(); setPicker(true); }}><Image size={18} />{dashboard.coverImage ? 'Change background' : 'Choose a background'}</button>
        <button className="desk-button" onClick={() => { onClose(); onEditWidgets(); }}><LayoutGrid size={18} />Dashboard widgets and layouts</button>
      </div>
    </Dialog>
    {picker && <WorkspaceVisualPicker isOpen onClose={() => setPicker(false)} assets={media.visuals} loading={media.loading} catalogError={media.error} context={{ kind: 'dashboard' }} value={dashboard.coverImage} focalPoint={dashboard.coverFocalPoint} onSelect={(coverImage, coverFocalPoint) => {
      updateDashboards((dashboards.length ? dashboards : STARTER_DASHBOARDS).map(d => d.id === dashboard.id ? { ...d, coverImage, coverFocalPoint: coverImage ? coverFocalPoint : undefined, updatedAt: Date.now() } : d));
      setFailedSrc('');
    }} />}
  </>;
}
