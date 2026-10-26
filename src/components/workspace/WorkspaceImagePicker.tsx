import { lazy, Suspense } from 'react';
import { useWorkspaceBackgroundChoice } from '../../hooks/useWorkspaceBackgroundChoice';
import { useMediaCatalog } from '../../hooks/useStudio';
import { Dialog } from '../ui/Dialog';

const WorkspaceVisualPicker = lazy(() => import('./WorkspaceVisualPicker').then(module => ({ default: module.WorkspaceVisualPicker })));

export function WorkspaceImagePicker({ onClose, onSelect }: { onClose: () => void; onSelect?: () => void }) {
  const { dashboard, setBackground } = useWorkspaceBackgroundChoice();
  const media = useMediaCatalog();

  return <Suspense fallback={<Dialog isOpen onClose={onClose} title="Choose a workspace image"><p role="status">Opening your image library…</p></Dialog>}>
    <WorkspaceVisualPicker isOpen onClose={onClose} assets={media.visuals} loading={media.loading} catalogError={media.error}
      context={{ kind: 'dashboard' }} value={dashboard.coverImage} focalPoint={dashboard.coverFocalPoint}
      onSelect={(coverImage, coverFocalPoint) => {
        setBackground(coverImage, coverFocalPoint);
        onSelect?.();
      }} />
  </Suspense>;
}
