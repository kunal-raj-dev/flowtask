import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FocusHUD } from './FocusHUD';
import { useFocusStore } from '../../store/useFocusStore';
import * as TaskContextModule from '../../context/TaskContext';

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: vi.fn(),
}));

describe('FocusHUD (Phase 4)', () => {
  const mockTaskContext = {
    tasks: [
      {
        id: 'task-1',
        title: 'Calibrate Sprint Engine',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [],
      },
    ],
    pauseFocusSession: vi.fn(),
    resumeFocusSession: vi.fn(),
    stopFocusSession: vi.fn(),
    toggleTaskStatus: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (TaskContextModule.useTaskContext as any).mockReturnValue(mockTaskContext);
    useFocusStore.setState({
      focusSession: null,
      focusElapsedSeconds: 0,
      activeTimerTaskId: null,
    });
  });

  it('renders null when no active focus session exists', () => {
    const { container } = render(<FocusHUD />);
    expect(container.firstChild).toBeNull();
  });

  it('renders compact HUD with formatted clock and task name', () => {
    useFocusStore.setState({
      focusSession: {
        id: 'session-1',
        taskId: 'task-1',
        taskTitle: 'Calibrate Sprint Engine',
        mode: 'pomodoro',
        pomodoroPhase: 'focus',
        targetDurationSec: 1500,
        accumulatedElapsedMs: 0,
        startedAt: Date.now(),
        state: 'running',
      },
      focusElapsedSeconds: 300,
    });

    render(<FocusHUD compact={true} />);

    expect(screen.getByTestId('focus-hud-compact')).toBeDefined();
    expect(screen.getByText('Calibrate Sprint Engine')).toBeDefined();
    // 1500 - 300 = 1200 sec = 20:00
    expect(screen.getByText('20:00')).toBeDefined();
  });

  it('renders card HUD and handles pause/resume clicks', () => {
    useFocusStore.setState({
      focusSession: {
        id: 'session-1',
        taskId: 'task-1',
        taskTitle: 'Calibrate Sprint Engine',
        mode: 'pomodoro',
        pomodoroPhase: 'focus',
        targetDurationSec: 1500,
        accumulatedElapsedMs: 0,
        startedAt: Date.now(),
        state: 'running',
      },
      focusElapsedSeconds: 0,
    });

    render(<FocusHUD />);

    expect(screen.getByTestId('focus-hud-card')).toBeDefined();
    const pauseBtn = screen.getByTitle('Pause');
    fireEvent.click(pauseBtn);
    expect(mockTaskContext.pauseFocusSession).toHaveBeenCalled();
  });

  it('handles task completion directly from HUD', () => {
    useFocusStore.setState({
      focusSession: {
        id: 'session-1',
        taskId: 'task-1',
        taskTitle: 'Calibrate Sprint Engine',
        mode: 'pomodoro',
        pomodoroPhase: 'focus',
        targetDurationSec: 1500,
        accumulatedElapsedMs: 0,
        startedAt: Date.now(),
        state: 'running',
      },
      focusElapsedSeconds: 60,
    });

    render(<FocusHUD />);

    const completeBtn = screen.getByTitle('Complete Task and Finish Session');
    fireEvent.click(completeBtn);
    expect(mockTaskContext.toggleTaskStatus).toHaveBeenCalledWith('task-1');
    expect(mockTaskContext.stopFocusSession).toHaveBeenCalled();
  });
});
