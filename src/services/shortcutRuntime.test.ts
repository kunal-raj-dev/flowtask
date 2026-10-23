// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useTaskStore } from '../store/useTaskStore';
import { appShortcutAllowed } from './shortcutRuntime';
import { shortcutHintsEnabled } from './shortcutRegistry';

const original = useTaskStore.getState().settings;
afterEach(() => { useTaskStore.setState({ settings: original }); document.body.replaceChildren(); window.getSelection()?.removeAllRanges(); });
const eventAt = (target: HTMLElement, options: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key: 'f', cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
};
describe('shared shortcut runtime', () => {
  it('checks current master state at dispatch time, including an already open view', () => {
    const event = eventAt(document.body);
    useTaskStore.setState({ settings: { ...original, keyboardShortcutsEnabled: true } });
    expect(appShortcutAllowed(event)).toBe(true);
    useTaskStore.setState({ settings: { ...original, keyboardShortcutsEnabled: false } });
    expect(appShortcutAllowed(event)).toBe(false);
  });
  it('protects IME, held keys, handled events, focused buttons and descendants of editables', () => {
    useTaskStore.setState({ settings: { ...original, keyboardShortcutsEnabled: true } });
    expect(appShortcutAllowed(eventAt(document.body, { isComposing: true }))).toBe(false);
    expect(appShortcutAllowed(eventAt(document.body, { repeat: true }))).toBe(false);
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      expect(appShortcutAllowed(eventAt(document.body, { [modifier]: true }))).toBe(false);
    }
    const handled = eventAt(document.body); handled.preventDefault();
    expect(appShortcutAllowed(handled)).toBe(false);
    const button = document.createElement('button'); document.body.append(button);
    expect(appShortcutAllowed(eventAt(button, { key: ' ' }))).toBe(false);
    const editable = document.createElement('div'); editable.contentEditable = 'true'; editable.setAttribute('contenteditable', 'true');
    const child = document.createElement('span'); editable.append(child); document.body.append(editable);
    expect(appShortcutAllowed(eventAt(child))).toBe(false);
  });
  it('keeps legacy hint Off and temporarily hides hints under the master without erasing the preference', () => {
    expect(shortcutHintsEnabled({ keyboardHaloEnabled: false })).toBe(false);
    expect(shortcutHintsEnabled({ keyboardShortcutsEnabled: false, showShortcutHints: true })).toBe(false);
    expect(shortcutHintsEnabled({ keyboardShortcutsEnabled: true, showShortcutHints: true })).toBe(true);
  });
});
