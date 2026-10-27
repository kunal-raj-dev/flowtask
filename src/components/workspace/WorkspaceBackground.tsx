import { useState, type ReactNode } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useMediaCatalog } from '../../hooks/useStudio';
import { resolveActiveDashboard } from '../../utils/activeDashboard';
import type { WorkspacePreferences } from '../../types/dashboard';
import { WorkspaceImagePicker } from './WorkspaceImagePicker';

export const DEFAULT_BACKGROUND_SCENE_ID = 'dolomite-dawn';
export const DEFAULT_BACKGROUND_SRC = '/media/backgrounds/v1/dolomite-dawn-960.webp';

/** Persists outside the scrolling and animated views so the scene stays still. */
export function WorkspaceBackground({ children }: { children: ReactNode }) {
  const { dashboards = [], workspacePreferences = {} } = useTaskContext();
  const workspace = workspacePreferences.workspace as WorkspacePreferences | undefined;
  const dashboard = resolveActiveDashboard(dashboards, workspacePreferences.activeDashboardId as string | undefined, workspace);
  const media = useMediaCatalog();

  const presentation = workspace?.presentation as Record<string, unknown> | undefined;
  const isPlain = presentation?.plainBackground === true || dashboard.coverImage === 'none';
  const enabled = workspace?.showCovers !== false && !isPlain;
  // If no cover image set on dashboard, default to Dolomite Dawn unless plain
  const coverId = isPlain ? 'none' : (dashboard.coverImage || DEFAULT_BACKGROUND_SCENE_ID);
  const asset = media.visuals.find(a => a.id === coverId);
  const src = isPlain ? undefined : (asset?.variants?.[0]?.src || asset?.src || (coverId === DEFAULT_BACKGROUND_SCENE_ID ? DEFAULT_BACKGROUND_SRC : undefined));

  const imageKey = `${dashboard.id}:${dashboard.updatedAt}:${src}`;
  const [failedImage, setFailedImage] = useState('');
  const [picker, setPicker] = useState(false);
  const visible = enabled && !!src && failedImage !== imageKey;
  const missing = enabled && !!dashboard.coverImage && dashboard.coverImage !== 'none' && !media.loading && (!asset || failedImage === imageKey);

  const appearanceConfig = workspacePreferences.appearance as { backgroundIntensity?: number } | undefined;
  const backgroundIntensity = typeof presentation?.intensity === 'number'
    ? presentation.intensity
    : typeof appearanceConfig?.backgroundIntensity === 'number'
    ? appearanceConfig.backgroundIntensity
    : 1;

  return (
    <div className="workspace-surface" data-has-workspace-background={visible || undefined}>
      {visible && (
        <div
          className="workspace-background"
          aria-hidden="true"
          data-workspace-background
          data-today-background
          style={{ opacity: backgroundIntensity }}
        >
          <img
            key={imageKey}
            src={src}
            alt=""
            loading="eager"
            onError={() => {
              if (import.meta.env?.MODE === 'test') return;
              setFailedImage(imageKey);
            }}
            style={{
              objectPosition: `${dashboard.coverFocalPoint?.x ?? asset?.focalPoint?.x ?? 50}% ${dashboard.coverFocalPoint?.y ?? asset?.focalPoint?.y ?? 50}%`,
            }}
          />
          <div className="workspace-background-tint" />
        </div>
      )}
      {children}
      {missing && (
        <div className="workspace-image-notice desk-notice" role="status">
          <span>Your saved background is unavailable on this device.</span>
          <button className="desk-button" onClick={() => setPicker(true)}>
            Choose replacement
          </button>
        </div>
      )}
      {picker && (
        <WorkspaceImagePicker
          onClose={() => setPicker(false)}
          onSelect={() => setFailedImage('')}
        />
      )}
    </div>
  );
}
