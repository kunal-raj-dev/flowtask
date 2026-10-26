import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskContext } from '../context/TaskContext';
import { STARTER_DASHBOARDS } from '../services/starterDashboards';
import { useWorkspaceBackgroundChoice } from './useWorkspaceBackgroundChoice';

describe('workspace background choices', () => {
  it('saves explicit removal so reloading cannot restore the default scene', () => {
    const updateDashboards = vi.fn(), setWorkspacePreference = vi.fn();
    const context = { dashboards: STARTER_DASHBOARDS, workspacePreferences: {}, updateDashboards, setWorkspacePreference };
    const { result } = renderHook(useWorkspaceBackgroundChoice, { wrapper: ({ children }) => <TaskContext.Provider value={context as any}>{children}</TaskContext.Provider> });
    act(() => result.current.setBackground());
    const saved = updateDashboards.mock.calls[0][0];
    expect(saved[0].coverImage).toBe('none');
    expect(saved[0].coverFocalPoint).toBeUndefined();
    expect(saved.slice(1)).toEqual(STARTER_DASHBOARDS.slice(1));
  });

  it('a new image re-enables backgrounds after the old visibility settings hid them', () => {
    const updateDashboards = vi.fn(), setWorkspacePreference = vi.fn();
    const context = { dashboards: STARTER_DASHBOARDS, workspacePreferences: { workspace: { showCovers: false, presentation: { version: 1, plainBackground: true, intensity: .5 } } }, updateDashboards, setWorkspacePreference };
    const { result } = renderHook(useWorkspaceBackgroundChoice, { wrapper: ({ children }) => <TaskContext.Provider value={context as any}>{children}</TaskContext.Provider> });
    expect(result.current.hasBackground).toBe(false);
    act(() => result.current.setBackground('new-image', { x: 40, y: 70 }));
    expect(updateDashboards.mock.calls[0][0][0]).toMatchObject({ coverImage: 'new-image', coverFocalPoint: { x: 40, y: 70 } });
    expect(setWorkspacePreference).toHaveBeenCalledWith('workspace', { showCovers: true, presentation: { version: 1, plainBackground: false, intensity: .5 } });
  });
});
