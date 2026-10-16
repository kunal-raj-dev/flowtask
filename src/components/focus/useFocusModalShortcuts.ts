import { useEffect } from 'react';

export interface UseFocusModalShortcutsOptions {
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  enabled?: boolean;
}

/**
 * Standard keyboard shortcuts for Focus Modals:
 * - 'F' or 'f': Toggle Zen / Fullscreen mode (guarded against active inputs/textareas)
 * - 'Escape': If in fullscreen, exit fullscreen; otherwise close modal
 */
export function useFocusModalShortcuts({
  isFullscreen,
  setIsFullscreen,
  onClose,
  enabled = true,
}: UseFocusModalShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, isFullscreen, onClose, setIsFullscreen]);
}
