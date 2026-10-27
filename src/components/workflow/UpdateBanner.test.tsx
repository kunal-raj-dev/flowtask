import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UpdateBanner } from './UpdateBanner';
import * as focusCheckpoint from '../../services/focusCheckpoint';
import type { FocusSession } from '../../types/task';

describe('UpdateBanner', () => {
  let mockPostMessage: ReturnType<typeof vi.fn>;
  let mockAddEventListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    mockAddEventListener = vi.fn();
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        controller: {},
        getRegistration: vi.fn().mockResolvedValue({
          waiting: { postMessage: mockPostMessage },
        }),
        addEventListener: mockAddEventListener,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('does not render until flowtask:update-available is fired', async () => {
    render(<UpdateBanner isSessionActive={false} />);
    expect(screen.queryByRole('status')).toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('flowtask:update-available'));
    });
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/A fresh FlowTask is ready/i)).toBeTruthy();
  });

  it('enables immediate 1-click update when no focus session is active', async () => {
    render(<UpdateBanner isSessionActive={false} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('flowtask:update-available'));
    });

    const updateBtn = screen.getByRole('button', { name: 'Update now' });
    expect(updateBtn).toBeDefined();
    expect(updateBtn.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      fireEvent.click(updateBtn);
    });

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('displays session-aware auto-update notice and provides save & reload button when session is active', async () => {
    const checkpointSpy = vi.spyOn(focusCheckpoint, 'writeFocusCheckpoint');
    const mockSession: FocusSession = {
      id: 'session-123',
      workspaceId: 'local',
      mode: 'pomodoro',
      taskId: 'task-1',
      taskTitle: 'Important task',
      targetDurationSec: 1500,
      state: 'running',
      startedAt: Date.now(),
      originalStartedAt: Date.now(),
      accumulatedElapsedMs: 300000,
      pomodoroCycle: 1,
      pomodoroPhase: 'focus',
    };

    render(
      <UpdateBanner
        isSessionActive={true}
        workspaceId="local"
        focusSession={mockSession}
      />
    );
    act(() => {
      window.dispatchEvent(new CustomEvent('flowtask:update-available'));
    });

    expect(
      screen.getByText(/FlowTask will automatically update when your focus session completes/i)
    ).toBeTruthy();

    const saveAndReloadBtn = screen.getByRole('button', { name: 'Update now (save & reload)' });
    expect(saveAndReloadBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(saveAndReloadBtn);
    });

    expect(checkpointSpy).toHaveBeenCalledWith('local', mockSession);
    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('auto-updates when active focus session finishes (transitions from active to false)', async () => {
    const { rerender } = render(
      <UpdateBanner
        isSessionActive={true}
        workspaceId="local"
      />
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('flowtask:update-available'));
    });
    expect(mockPostMessage).not.toHaveBeenCalled();

    // Session completes
    await act(async () => {
      rerender(
        <UpdateBanner
          isSessionActive={false}
          workspaceId="local"
        />
      );
    });

    expect(mockPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('allows dismissing the update notice', async () => {
    render(<UpdateBanner isSessionActive={false} />);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('flowtask:update-available'));
    });
    expect(screen.getByRole('status')).toBeTruthy();

    const dismissBtn = screen.getByRole('button', { name: 'Dismiss update notice' });
    await act(async () => {
      fireEvent.click(dismissBtn);
    });

    expect(screen.queryByRole('status')).toBeNull();
  });
});
