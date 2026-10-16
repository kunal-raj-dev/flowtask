// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EisenhowerView } from './EisenhowerView';
import type { Task } from '../../types/task';

const mockUpdateTask = vi.fn();
const mockBatchUpdateTasks = vi.fn();
const mockToggleTaskStatus = vi.fn();
const mockOnSelectTask = vi.fn();
const mockShowToast = vi.fn();

const sampleTasks: Task[] = [
  {
    id: 'e-1',
    title: 'Urgent System Outage',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    createdAt: 1000,
    subtasks: [],
  },
  {
    id: 'e-2',
    title: 'Quarterly Strategic Plan',
    status: 'todo',
    priority: 'p2',
    projectId: 'inbox',
    createdAt: 2000,
    subtasks: [],
  },
];

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: sampleTasks,
    updateTask: mockUpdateTask,
    batchUpdateTasks: mockBatchUpdateTasks,
    toggleTaskStatus: mockToggleTaskStatus,
    showToast: mockShowToast,
  }),
}));

vi.mock('../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-04',
  getTomorrowStr: () => '2026-10-05',
}));

describe('EisenhowerView Touch & Pointer Drag-and-Drop (BUG-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders quadrants with data-quadrant attributes and task cards', () => {
    render(<EisenhowerView onSelectTask={mockOnSelectTask} />);

    // Quadrants should have data-quadrant attributes
    const q1Elements = document.querySelectorAll('[data-quadrant="p1"]');
    expect(q1Elements.length).toBeGreaterThan(0);

    const q2Elements = document.querySelectorAll('[data-quadrant="p2"]');
    expect(q2Elements.length).toBeGreaterThan(0);

    expect(screen.getByText('Urgent System Outage')).toBeDefined();
    expect(screen.getByText('Quarterly Strategic Plan')).toBeDefined();
  });

  it('selects task on simple pointer click without movement', () => {
    render(<EisenhowerView onSelectTask={mockOnSelectTask} />);

    const card = screen.getByText('Urgent System Outage').closest('[data-task-id="e-1"]')!;
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(card, { clientX: 100, clientY: 100 });

    expect(mockOnSelectTask).toHaveBeenCalledWith('e-1');
  });

  it('updates task priority when dropped via HTML5 drag-and-drop', () => {
    render(<EisenhowerView onSelectTask={mockOnSelectTask} />);

    const q3Quadrant = document.querySelector('div[data-quadrant="p3"]')!;

    fireEvent.drop(q3Quadrant, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/plain' ? 'e-1' : ''),
      },
    });

    expect(mockUpdateTask).toHaveBeenCalledWith('e-1', {
      priority: 'p3',
    });
  });

  it('cleanly cancels drag when pointercancel fires without changing priority or selecting task', () => {
    render(<EisenhowerView onSelectTask={mockOnSelectTask} />);

    const card = screen.getByText('Urgent System Outage').closest('[data-task-id="e-1"]')!;
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(card, { clientX: 150, clientY: 150 });
    fireEvent.pointerCancel(card);

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockOnSelectTask).not.toHaveBeenCalled();
  });
});
