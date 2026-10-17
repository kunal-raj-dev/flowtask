import { useEffect } from 'react';
import { audioEngine } from '../utils/audioEngine';

/**
 * Universal Tactile Click Audio Feedback Hook
 * Listens globally for user clicks on interactive elements (buttons, links,
 * tabs, checkboxes, cards, switchers, and dropdowns) and plays the active tactile click/pop sound.
 * Automatically excludes text inputs/textareas to maintain calm typing focus.
 */
export function useTactileAudioClicks(enabled: boolean = true, keyboardEnabled = false) {
  useEffect(() => {
    if (!enabled) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;

      // Exclude text typing inputs & editable regions
      const isTextInput = target.closest(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="range"]), textarea, [contenteditable="true"]'
      );
      if (isTextInput) return;

      // Identify interactive clickable elements
      const isInteractive = target.closest(
        'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], input[type="checkbox"], input[type="radio"], select, .cursor-pointer, [data-clickable]'
      );

      if (isInteractive) {
        audioEngine.playClickSound();
      }
    };

    const handleTyping = (e: KeyboardEvent) => { const target = e.target as HTMLInputElement | null; if (!keyboardEnabled || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || target?.type === 'password') return; if (target?.matches('input,textarea,[contenteditable=true]')) audioEngine.playClickSound(); };
    window.addEventListener('keydown', handleTyping);
    window.addEventListener('click', handleGlobalClick, { capture: true, passive: true });

    return () => {
      window.removeEventListener('keydown', handleTyping);
      window.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, [enabled, keyboardEnabled]);
}
