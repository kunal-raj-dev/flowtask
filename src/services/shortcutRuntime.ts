import { useTaskStore } from '../store/useTaskStore';
import { shouldIgnoreShortcut } from './shortcutRegistry';

/** Read at dispatch time so open panels and floating timers honor settings immediately. */
export function appShortcutAllowed(event: KeyboardEvent): boolean {
  if (useTaskStore.getState().settings?.keyboardShortcutsEnabled === false) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (shouldIgnoreShortcut(event)) return false;
  const target = event.target as Element | null;
  return !(['Enter', ' ', 'Spacebar'].includes(event.key) && target?.closest?.('button,a,[role="button"]'));
}
