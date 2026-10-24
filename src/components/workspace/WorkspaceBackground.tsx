import { useState, type ReactNode } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useMediaCatalog } from '../../hooks/useStudio';
import { resolveActiveDashboard } from '../../utils/activeDashboard';
import type { WorkspacePreferences } from '../../types/dashboard';
import { WorkspaceImagePicker } from './WorkspaceImagePicker';

/** Persists outside the scrolling and animated views so the scene stays still. */
export function WorkspaceBackground({ children }: { children: ReactNode }) {
  const { dashboards = [], workspacePreferences = {} } = useTaskContext();
  const workspace = workspacePreferences.workspace as WorkspacePreferences | undefined;
  const dashboard = resolveActiveDashboard(dashboards, workspacePreferences.activeDashboardId as string | undefined, workspace);
  const media = useMediaCatalog();
  const asset = media.visuals.find(a => a.id === dashboard.coverImage);
  const src = asset?.variants?.[0]?.src || asset?.src;
  const imageKey = `${dashboard.id}:${dashboard.updatedAt}:${src}`;
  const [failedImage, setFailedImage] = useState('');
  const [picker, setPicker] = useState(false);
  const enabled = workspace?.showCovers !== false;
  const visible = enabled && !!src && failedImage !== imageKey;
  const missing = enabled && !!dashboard.coverImage && !media.loading && (!asset || failedImage === imageKey);

  return <div className="workspace-surface" data-has-workspace-background={visible || undefined}>
    {visible && <div className="workspace-background" aria-hidden="true" data-workspace-background data-today-background>
      <img key={imageKey} src={src} alt="" onError={() => setFailedImage(imageKey)} style={{ objectPosition: `${dashboard.coverFocalPoint?.x ?? asset?.focalPoint?.x ?? 50}% ${dashboard.coverFocalPoint?.y ?? asset?.focalPoint?.y ?? 50}%` }} />
      <div className="workspace-background-tint" />
    </div>}
    {children}
    {missing && <div className="workspace-image-notice desk-notice" role="status"><span>Your saved background is unavailable on this device.</span><button className="desk-button" onClick={() => setPicker(true)}>Choose replacement</button></div>}
    {picker && <WorkspaceImagePicker onClose={() => setPicker(false)} onSelect={() => setFailedImage('')} />}
  </div>;
}
