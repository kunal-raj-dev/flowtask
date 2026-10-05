// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import type { Task } from '../../types/task';

// Mock audio engine
vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    playClickSound: vi.fn(),
    playTaskComplete: vi.fn(),
  },
}));

const mockToggleTaskStatus = vi.fn();
const mockToggleTaskPinToday = vi.fn();
const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockToggleTaskTimer = vi.fn();

let mockContextState = {
  tasks: [] as Task[],
  toggleTaskStatus: mockToggleTaskStatus,
  toggleTaskPinToday: mockToggleTaskPinToday,
  updateTask: mockUpdateTask,
  deleteTask: mockDeleteTask,
  projects: [{ id: 'inbox', name: 'Inbox', color: '#6366f1' }],
  focusSession: null as any,
  activeTimerTaskId: null as string | null,
  activeTimerSeconds: 0,
  toggleTaskTimer: mockToggleTaskTimer,
  selectedTaskIds: [] as string[],
  toggleTaskSelection: vi.fn(),
  showToast: vi.fn(),
};

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => mockContextState,
}));

describe('TaskCard Timer and Badge Rendering', () => {
  const baseTask: Task = {
    id: 'task-101',
    title: 'Leetcode Practise',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    estimatedMinutes: 100, // 1h 40m
    timeSpentMinutes: 0,   // Should NOT render stray '0'
    subtasks: [],
    createdAt: Date.now(),
  };

  it('formats duration nicely as "1h 40m" instead of float hours and avoids stray 0', () => {
    mockContextState = {
      ...mockContextState,
      activeTimerTaskId: null,
      focusSession: null,
    };

    const { container } = render(<TaskCard task={baseTask} onSelectTask={vi.fn()} />);

    // Should display formatted duration
    expect(screen.getByText('1h 40m')).toBeDefined();

    // Should not render unrounded float
    expect(screen.queryByText(/1\.6666/)).toBeNull();

    // Verify there is no standalone '0' element or text node rendered from timeSpentMinutes
    const spans = Array.from(container.querySelectorAll('span, p, div'));
    const strayZeros = spans.filter(el => el.textContent?.trim() === '0');
    expect(strayZeros.length).toBe(0);
  });

  it('displays Pause icon and title when timer is actively RUNNING', () => {
    mockContextState = {
      ...mockContextState,
      activeTimerTaskId: 'task-101',
      activeTimerSeconds: 125,
      focusSession: {
        id: 'session-1',
        mode: 'stopwatch',
        taskId: 'task-101',
        state: 'running',
        startedAt: Date.now(),
        accumulatedElapsedMs: 0,
        targetDurationSec: 0,
      },
    };

    render(<TaskCard task={baseTask} onSelectTask={vi.fn()} />);

    // Both mobile and desktop action buttons should indicate pause
    const pauseButtons = screen.getAllByTitle('Pause tracking time');
    expect(pauseButtons.length).toBeGreaterThan(0);

    // Active pill should show formatted stopwatch
    expect(screen.getByText(/02:05/)).toBeDefined();
    // Paused badge should not be present
    expect(screen.queryByText('Paused')).toBeNull();
  });

  it('displays Play/Resume icon, title, and Paused badge when timer is PAUSED', () => {
    mockContextState = {
      ...mockContextState,
      activeTimerTaskId: 'task-101',
      activeTimerSeconds: 125,
      focusSession: {
        id: 'session-1',
        mode: 'stopwatch',
        taskId: 'task-101',
        state: 'paused',
        startedAt: Date.now(),
        accumulatedElapsedMs: 125000,
        targetDurationSec: 0,
      },
    };

    render(<TaskCard task={baseTask} onSelectTask={vi.fn()} />);

    // Action buttons should indicate resume
    const resumeButtons = screen.getAllByTitle('Resume tracking time');
    expect(resumeButtons.length).toBeGreaterThan(0);

    // Pill badge should show Paused
    expect(screen.getByText('Paused')).toBeDefined();
    expect(screen.getByTitle('Timer paused. Click to resume.')).toBeDefined();
  });
});
