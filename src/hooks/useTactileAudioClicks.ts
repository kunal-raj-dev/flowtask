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

    // First-time AudioContext creation can take hundreds of milliseconds on
    // some devices. Let the action paint before optional feedback starts.
    let frame: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const queueClick = () => {
      if (frame !== null || timer !== null || document.hidden) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        timer = setTimeout(() => {
          timer = null;
          audioEngine.playClickSound();
        }, 0);
      });
    };

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
        queueClick();
      }
    };

    const handleTyping = (e: KeyboardEvent) => { const target = e.target as HTMLInputElement | null; if (!keyboardEnabled || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || target?.type === 'password') return; if (target?.matches('input,textarea,[contenteditable=true]')) queueClick(); };
    window.addEventListener('keydown', handleTyping);
    window.addEventListener('click', handleGlobalClick, { capture: true, passive: true });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener('keydown', handleTyping);
      window.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, [enabled, keyboardEnabled]);
}
