// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FocusEngineModal } from '../src/components/focus/FocusEngineModal';
import { focusSessionService } from '../src/services/focusSessionService';
import { useFocusStore } from '../src/store/useFocusStore';
import { useTaskStore } from '../src/store/useTaskStore';
import type { Task } from '../src/types/task';

// Mocks for Web Audio & Celebrations
vi.mock('../src/utils/audioEngine', () => ({
  audioEngine: {
    getSoundEnabled: vi.fn(() => true),
    getSoundProfile: vi.fn(() => 'marimba'),
    playClickSound: vi.fn(),
    playRuleOf3Fanfare: vi.fn(),
    playPomodoroComplete: vi.fn(),
    playCompletionChime: vi.fn(),
    playStashChime: vi.fn(),
  },
}));

vi.mock('../src/utils/celebrate', () => ({
  default: vi.fn(),
}));

const mockToggleSubTask = vi.fn();
let mockActiveTasks: Task[] = [];

vi.mock('../src/context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: mockActiveTasks,
    toggleSubTask: mockToggleSubTask,
    setSelectedTaskId: vi.fn(),
  }),
}));

describe('Empirical Challenger: M3 Subtask Pacing & Pomodoro Capping Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFocusStore.setState({
      focusSession: null,
      focusElapsedSeconds: 0,
      focusRemainingSeconds: 0,
      activeTimerTaskId: null,
      isTimerActive: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. FocusSessionService Capping Invariants', () => {
    it('strictly caps Pomodoro sessions at targetDurationSec regardless of extreme overtime', () => {
      vi.useFakeTimers();
      const startTime = 1_000_000;
      vi.setSystemTime(startTime);

      // 25-minute Pomodoro session (1500 seconds)
      const session = focusSessionService.startSession('pomodoro', 'task-pomo', 'Deep Work', 1500);
      expect(session.state).toBe('running');
      expect(session.targetDurationSec).toBe(1500);

      // Advance by 5 hours (18,000,000 ms)
      vi.advanceTimersByTime(18_000_000);

      const elapsed = focusSessionService.getElapsedSeconds(session);
      const remaining = focusSessionService.getRemainingSeconds(session);

      // Elapsed must be capped strictly at 1500s
      expect(elapsed).toBe(1500);
      // Remaining must be clamped to 0s
      expect(remaining).toBe(0);

      // Stopping the session must log the capped 1500s
      const stopped = focusSessionService.stopSession(session);
      expect(stopped.finalElapsedSeconds).toBe(1500);
    });

    it('does NOT cap Sprint sessions at subtask targetDurationSec, allowing overtime logging', () => {
      vi.useFakeTimers();
      const startTime = 2_000_000;
      vi.setSystemTime(startTime);

      // 5-minute subtask sprint session (300 seconds)
      const session = focusSessionService.startSession(
        'sprint',
        'task-sprint',
        'Sprint Session',
        300,
        'sub-1',
        'Subtask 1',
        300
      );
      expect(session.state).toBe('running');
      expect(session.targetDurationSec).toBe(300);

      // Advance by 50 minutes (3,000,000 ms = 3000 seconds = 10x overtime)
      vi.advanceTimersByTime(3_000_000);

      const elapsed = focusSessionService.getElapsedSeconds(session);
      const remaining = focusSessionService.getRemainingSeconds(session);

      // Sprint elapsed must NOT be capped: full 3000s preserved
      expect(elapsed).toBe(3000);
      // Remaining must safely floor at 0s
      expect(remaining).toBe(0);

      // Stopping the session must credit the full 3000s focus work in stats
      const stopped = focusSessionService.stopSession(session);
      expect(stopped.finalElapsedSeconds).toBe(3000);
    });
  });

  describe('2. FocusEngineModal Component Overtime & Banked Pace Integration', () => {
    it('accumulates negative banked pace (-45m) and renders text-rose-400 on 10x subtask overtime', () => {
      vi.useFakeTimers();
      const startTime = 10_000_000;
      vi.setSystemTime(startTime);

      const task: Task = {
        id: 'task-overtime-1',
        title: 'Refactor Ast Parser',
        status: 'todo',
        priority: 'p1',
        projectId: 'core',
        createdAt: startTime,
        subtasks: [
          { id: 'sub-1', title: '5-minute micro task', completed: false, estimatedMinutes: 5 },
          { id: 'sub-2', title: '10-minute follow-up', completed: false, estimatedMinutes: 10 },
        ],
      };
      mockActiveTasks = [task];
      useTaskStore.setState({ tasks: [task] });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={task.id} initialMode="sprint" onClose={vi.fn()} />
      );

      // Verify initial banked pace display is +0m with emerald text
      const initialBanked = screen.getByText('+0m');
      expect(initialBanked).toBeDefined();
      expect(initialBanked.className).toContain('text-emerald-400');

      // Click Start Sprint
      const startBtn = screen.getByRole('button', { name: /Start sprint/i });
      act(() => {
        fireEvent.click(startBtn);
      });

      // Advance by 50 minutes (3,000,000 ms) -> 10x estimate
      act(() => {
        vi.advanceTimersByTime(3_000_000);
        useFocusStore.getState().tick();
      });

      expect(useFocusStore.getState().focusElapsedSeconds).toBe(3000);

      // Mark solved and advance to next subtask
      const markSolvedBtn = screen.getByRole('button', { name: /Mark Solved and Next/i });
      act(() => {
        fireEvent.click(markSolvedBtn);
      });

      // Target: 300s. Elapsed: 3000s. Surplus: 300 - 3000 = -2700s (-45m).
      const negativeBadge = screen.getByText('-45m');
      expect(negativeBadge).toBeDefined();
      expect(negativeBadge.className).toContain('text-rose-400');
      expect(negativeBadge.className).not.toContain('text-emerald-400');

      unmount();
    });

    it('smoothly recovers banked pace from negative to positive across sequential subtasks', () => {
      vi.useFakeTimers();
      const startTime = 20_000_000;
      vi.setSystemTime(startTime);

      const multiSubTask: Task = {
        id: 'task-multi-sub',
        title: 'Multi Subtask Recovery',
        status: 'todo',
        priority: 'p1',
        projectId: 'core',
        createdAt: startTime,
        subtasks: [
          { id: 'sub-a', title: 'Quick Task A', completed: false, estimatedMinutes: 10 },
          { id: 'sub-b', title: 'Short Task B', completed: false, estimatedMinutes: 10 },
          { id: 'sub-c', title: 'Long Task C', completed: false, estimatedMinutes: 60 },
        ],
      };
      mockActiveTasks = [multiSubTask];
      useTaskStore.setState({ tasks: [multiSubTask] });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={multiSubTask.id} initialMode="sprint" onClose={vi.fn()} />
      );

      // 1. Start Subtask A (10m estimate = 600s). Work for 30m (1800s) -> 20m overtime
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /Start sprint/i }));
        vi.advanceTimersByTime(30 * 60 * 1000);
        useFocusStore.getState().tick();
      });

      // Mark Subtask A solved -> surplus = 600 - 1800 = -1200s (-20m)
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /Mark Solved and Next/i }));
      });

      const badgeA = screen.getByText('-20m');
      expect(badgeA).toBeDefined();
      expect(badgeA.className).toContain('text-rose-400');

      // 2. Subtask B (10m estimate = 600s). Work for 5m (300s) -> 5m surplus
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
        useFocusStore.getState().tick();
      });

      // Mark Subtask B solved -> surplus = 600 - 300 = +300s (+5m)
      // Banked seconds becomes -1200 + 300 = -900s (-15m)
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /Mark Solved and Next/i }));
      });

      const badgeB = screen.getByText('-15m');
      expect(badgeB).toBeDefined();
      expect(badgeB.className).toContain('text-rose-400');

      // 3. Subtask C (60m estimate = 3600s). Work for 10m (600s) -> 50m surplus
      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
        useFocusStore.getState().tick();
      });

      // Mark Subtask C solved -> surplus = 3600 - 600 = +3000s (+50m)
      // Banked seconds becomes -900 + 3000 = +2100s (+35m)
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: /Mark Solved and Next/i }));
      });

      const badgeC = screen.getByText('+35m');
      expect(badgeC).toBeDefined();
      expect(badgeC.className).toContain('text-emerald-400');
      expect(badgeC.className).not.toContain('text-rose-400');

      unmount();
    });
  });
});
