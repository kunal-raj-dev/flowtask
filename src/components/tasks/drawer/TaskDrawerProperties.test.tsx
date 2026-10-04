// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskDrawerProperties } from './TaskDrawerProperties';
import type { Task } from '../../../types/task';

const mockUpdateTask = vi.fn();

const sampleTask: Task = {
  id: 'task-leet-1',
  title: 'leetcode question practise',
  status: 'todo',
  priority: 'p1',
  projectId: 'work',
  plannedDate: '2026-10-04',
  dueDate: '2026-10-04',
  createdAt: Date.now(),
  subtasks: [],
};

vi.mock('../../../context/TaskContext', () => ({
  useTaskContext: () => ({
    projects: [
      { id: 'work', name: 'Web Development', color: '#3B82F6' },
      { id: 'inbox', name: 'Inbox', color: '#64748B' },
    ],
    tasks: [sampleTask],
    updateTask: mockUpdateTask,
  }),
}));

vi.mock('../../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-04',
  useTomorrowStr: () => '2026-10-05',
}));

describe('TaskDrawerProperties Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project, priority, planned date, deadline without duplicate clear buttons', () => {
    render(<TaskDrawerProperties task={sampleTask} />);

    // Planned date and deadline headers
    expect(screen.getByText('Planned Date')).toBeDefined();
    expect(screen.getByText('Deadline')).toBeDefined();

    // Verify there are exactly 2 Clear buttons (1 for planned date, 1 for deadline), not 4!
    const clearButtons = screen.getAllByRole('button', { name: /^clear$/i });
    expect(clearButtons.length).toBe(2);

    // Verify Today and Tomorrow buttons
    const todayButtons = screen.getAllByRole('button', { name: /^today$/i });
    expect(todayButtons.length).toBe(2);
  });

  it('adds session duration block from 08:00 to 11:00 when + Add Session is clicked', () => {
    render(<TaskDrawerProperties task={sampleTask} />);

    const addSessionBtn = screen.getByRole('button', { name: /\+ Add Session/i });
    fireEvent.click(addSessionBtn);

    expect(mockUpdateTask).toHaveBeenCalledWith('task-leet-1', expect.objectContaining({
      scheduledStart: '08:00',
      scheduledEnd: '11:00',
      estimatedMinutes: 180,
      sessionMetadata: expect.objectContaining({
        isSession: true,
        sessionNumber: 1,
      }),
    }));
  });

  it('allows removing session time block', () => {
    const taskWithSession: Task = {
      ...sampleTask,
      scheduledStart: '08:00',
      scheduledEnd: '11:00',
      estimatedMinutes: 180,
      sessionMetadata: { isSession: true, sessionNumber: 1 },
    };

    render(<TaskDrawerProperties task={taskWithSession} />);

    const removeBtn = screen.getByRole('button', { name: /Remove Session/i });
    fireEvent.click(removeBtn);

    expect(mockUpdateTask).toHaveBeenCalledWith('task-leet-1', expect.objectContaining({
      scheduledStart: undefined,
      scheduledEnd: undefined,
    }));
  });
});
