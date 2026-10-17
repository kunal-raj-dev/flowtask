// @vitest-environment jsdom
import { describe, it, vi, expect, afterEach, beforeEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { AppearanceRuntime } from './AppearanceRuntime';
import { normalizeAppearance } from '../../utils/appearance';
import { THEMES } from '../../utils/themeRegistry';
const context = vi.hoisted(() => ({ workspaceId: 'local', workspacePreferences: { appearance: undefined as unknown }, setWorkspacePreference: vi.fn() }));
vi.mock('../../context/TaskContext', () => ({ useTaskContext: () => context }));
function matchMedia(dark = false) {
  const target = new EventTarget();
  const media = { matches: dark, addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target) };
  vi.stubGlobal('matchMedia', () => media);
  return { media, target };
}
beforeEach(() => { const data = new Map<string,string>(); vi.stubGlobal('localStorage', { getItem: (key:string) => data.get(key) ?? null, setItem: (key:string,value:string) => data.set(key,value) }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('single appearance runtime', () => {
  it('crosses schedule boundaries once, survives sleep and responds to manual mode', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026,9,17,16,59,59)); matchMedia();
    context.workspaceId = 'local'; context.workspacePreferences.appearance = normalizeAppearance({ mode: 'schedule' });
    const rendered = render(<AppearanceRuntime />);
    expect(document.documentElement.dataset.theme).toBe('light');
    const writes = vi.spyOn(document.documentElement.style, 'setProperty');
    act(() => vi.advanceTimersByTime(1000));
    expect(document.documentElement.dataset.theme).toBe('desert');
    writes.mockClear(); act(() => vi.advanceTimersByTime(5000)); expect(writes).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(2026,9,18,2)); act(() => window.dispatchEvent(new Event('focus')));
    expect(document.documentElement.dataset.theme).toBe('abyss');
    context.workspacePreferences.appearance = normalizeAppearance({ mode: 'manual', theme: 'forest' });
    rendered.rerender(<AppearanceRuntime />);
    vi.setSystemTime(new Date(2026,9,18,8)); act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(document.documentElement.dataset.theme).toBe('forest');
    writes.mockRestore();
  });
  it('follows system changes and isolates missing account preferences from the previous account', () => {
    const { media, target } = matchMedia(false);
    context.workspaceId = 'account-A'; context.workspacePreferences.appearance = normalizeAppearance({ mode: 'system' });
    const rendered = render(<AppearanceRuntime />);
    expect(document.documentElement.dataset.theme).toBe('light');
    media.matches = true; act(() => target.dispatchEvent(new Event('change')));
    expect(document.documentElement.dataset.theme).toBe('dark');
    localStorage.setItem('flowtask_theme', 'matcha'); localStorage.setItem('flowtask_diurnal_override', 'aurora');
    context.workspaceId = 'account-B'; context.workspacePreferences.appearance = undefined;
    rendered.rerender(<AppearanceRuntime />);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.atmosphere).toBe('off');
    expect(context.setWorkspacePreference).toHaveBeenCalledWith('appearance', expect.objectContaining({ theme: 'light', mode: 'manual' }));
  });
  it('applies atmosphere intensity, true zero, contrast suppression and restores theme accent', () => {
    matchMedia(); context.workspaceId = 'local';
    context.workspacePreferences.appearance = normalizeAppearance({ theme: 'aurora', accent: '#ff00ff', atmosphere: { preset: 'forest', intensity: .8 } });
    const rendered = render(<AppearanceRuntime />), root = document.documentElement;
    expect(root.style.getPropertyValue('--diurnal-intensity')).toBe('0.8');
    context.workspacePreferences.appearance = normalizeAppearance({ theme: 'aurora', highContrast: true, atmosphere: { preset: 'forest', intensity: .8 } });
    rendered.rerender(<AppearanceRuntime />);
    expect(root.style.getPropertyValue('--diurnal-intensity')).toBe('0');
    expect(root.style.getPropertyValue('--color-brand')).toBe(THEMES.aurora.tokens['--color-brand']);
    context.workspacePreferences.appearance = normalizeAppearance({ theme: 'aurora', atmosphere: { preset: 'forest', intensity: 0 } });
    rendered.rerender(<AppearanceRuntime />);
    expect(root.style.getPropertyValue('--diurnal-intensity')).toBe('0');
    expect(root.style.getPropertyValue('--text-primary')).toBe(THEMES.aurora.tokens['--text-primary']);
  });
});
