// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskDrawer } from './TaskDrawer';
import type { Task } from '../../types/task';

const mockUpdateTask = vi.fn();
const mockOnClose = vi.fn();
const mockOnStartFocus = vi.fn();

const sampleTask: Task = {
  id: 'task-focus-test',
  title: 'Test Focus Task',
  description: 'Initial description',
  status: 'todo',
  priority: 'p2',
  projectId: 'work',
  createdAt: Date.now(),
  subtasks: [],
};

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: [sampleTask],
    projects: [{ id: 'work', name: 'Work', color: '#3B82F6' }],
    updateTask: mockUpdateTask,
    deleteTask: vi.fn(),
    archiveTask: vi.fn(),
    toggleTaskStatus: vi.fn(),
    toggleTaskPinToday: vi.fn(),
    duplicateTask: vi.fn(),
    toggleSubTask: vi.fn(),
    addSubTask: vi.fn(),
    addSubTasks: vi.fn(),
    updateSubTask: vi.fn(),
    deleteSubTask: vi.fn(),
    promoteSubTaskToTask: vi.fn(),
    moveSubTask: vi.fn(),
    showToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-16',
  useTomorrowStr: () => '2026-10-17',
}));

describe('TaskDrawer Focus Retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps focus on textarea across component re-renders', () => {
    const { rerender } = render(
      <TaskDrawer
        taskId="task-focus-test"
        onClose={mockOnClose}
        onStartFocus={mockOnStartFocus}
      />
    );

    const textarea = screen.getByLabelText(/Task notes and description/i) as HTMLTextAreaElement;
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Simulate parent re-render (which previously recreated onClose and reset focus)
    rerender(
      <TaskDrawer
        taskId="task-focus-test"
        onClose={vi.fn()} // even if a new function reference is passed
        onStartFocus={mockOnStartFocus}
      />
    );

    // Focus must NOT be lost!
    expect(document.activeElement).toBe(textarea);
  });

  it('keeps focus on title input across component re-renders', () => {
    const { rerender } = render(
      <TaskDrawer
        taskId="task-focus-test"
        onClose={mockOnClose}
        onStartFocus={mockOnStartFocus}
      />
    );

    const titleInput = screen.getByLabelText(/Task title/i) as HTMLInputElement;
    titleInput.focus();
    expect(document.activeElement).toBe(titleInput);

    // Rerender with new callback reference
    rerender(
      <TaskDrawer
        taskId="task-focus-test"
        onClose={vi.fn()}
        onStartFocus={mockOnStartFocus}
      />
    );

    // Focus must remain on title input
    expect(document.activeElement).toBe(titleInput);
  });
});
