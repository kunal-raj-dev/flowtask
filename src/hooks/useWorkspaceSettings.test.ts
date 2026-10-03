// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspaceSettings, loadSettingsFromStorage, saveSettingsToStorage } from './useWorkspaceSettings';
import { DEFAULT_WORKFLOW_SETTINGS } from '../types/settings';

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};
(globalThis as any).localStorage = localStorageMock;

describe('useWorkspaceSettings', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('loads default settings when storage is empty', () => {
    const settings = loadSettingsFromStorage();
    expect(settings.targetWorkCapacityHours).toBe(6.0);
    expect(settings.defaultTaskDuration).toBe(30);
    expect(settings.timelineStartHour).toBe(7);
    expect(settings.timelineEndHour).toBe(22);
    expect(settings.onboardingCompleted).toBe(false);
  });

  it('saves and loads customized settings', () => {
    saveSettingsToStorage({
      ...DEFAULT_WORKFLOW_SETTINGS,
      targetWorkCapacityHours: 4.5,
      defaultTaskDuration: 45,
      onboardingCompleted: true,
    });

    const settings = loadSettingsFromStorage();
    expect(settings.targetWorkCapacityHours).toBe(4.5);
    expect(settings.defaultTaskDuration).toBe(45);
    expect(settings.onboardingCompleted).toBe(true);
  });

  it('updates settings reactively using the hook', () => {
    const { result } = renderHook(() => useWorkspaceSettings());

    expect(result.current.settings.targetWorkCapacityHours).toBe(6.0);

    act(() => {
      result.current.updateSettings({ targetWorkCapacityHours: 7.5 });
    });

    expect(result.current.settings.targetWorkCapacityHours).toBe(7.5);

    // Verify persistence to localStorage
    const stored = loadSettingsFromStorage();
    expect(stored.targetWorkCapacityHours).toBe(7.5);
  });

  it('resets settings back to default', () => {
    const { result } = renderHook(() => useWorkspaceSettings());

    act(() => {
      result.current.updateSettings({ targetWorkCapacityHours: 8.0 });
    });
    expect(result.current.settings.targetWorkCapacityHours).toBe(8.0);

    act(() => {
      result.current.resetSettings();
    });
    expect(result.current.settings.targetWorkCapacityHours).toBe(6.0);
  });
});
