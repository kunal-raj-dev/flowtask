import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusTabHUD } from './useFocusTabHUD';
import { useFocusStore } from '../store/useFocusStore';
import type { FocusSession } from '../types/task';

describe('useFocusTabHUD', () => {
  const originalTitle = document.title;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    document.title = 'FlowTask - Original';
    useFocusStore.setState({
      focusSession: null,
      focusElapsedSeconds: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.title = originalTitle;
  });

  it('updates document title during running focus session and restores it after', () => {
    const { unmount } = renderHook(() => useFocusTabHUD());

    expect(document.title).toBe('FlowTask - Original');

    const mockSession: FocusSession = {
      id: 'test-session',
      mode: 'pomodoro',
      state: 'running',
      targetDurationSec: 1500,
      accumulatedElapsedMs: 0,
      startedAt: Date.now(),
      taskId: 'task-1',
      taskTitle: 'Deep Work on FlowTask',
    };

    act(() => {
      useFocusStore.setState({
        focusSession: mockSession,
        focusElapsedSeconds: 60,
      });
    });

    // 1500 - 60 = 1440 seconds = 24:00
    expect(document.title).toBe('(24:00) Deep Work on FlowTask - FlowTask');

    // End session
    act(() => {
      useFocusStore.setState({
        focusSession: null,
        focusElapsedSeconds: 0,
      });
    });

    expect(document.title).toBe('FlowTask - Original');

    unmount();
  });

  it('restores document title on unmount', () => {
    const mockSession: FocusSession = {
      id: 'test-session-2',
      mode: 'countdown',
      state: 'running',
      targetDurationSec: 300,
      accumulatedElapsedMs: 0,
      startedAt: Date.now(),
      taskId: 'task-2',
      taskTitle: 'Sprint Task',
    };

    useFocusStore.setState({
      focusSession: mockSession,
      focusElapsedSeconds: 0,
    });

    const { unmount } = renderHook(() => useFocusTabHUD());
    expect(document.title).toContain('Sprint Task');

    unmount();
    expect(document.title).toBe('FlowTask - Original');
  });
});
