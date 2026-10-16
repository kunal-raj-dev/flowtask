// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KanbanView } from './KanbanView';
import type { Task } from '../../types/task';

const mockUpdateTask = vi.fn();
const mockAddTask = vi.fn();
const mockToggleTaskStatus = vi.fn();
const mockOnSelectTask = vi.fn();

const sampleTasks: Task[] = [
  {
    id: 'k-1',
    title: 'Analyze DB Performance',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    createdAt: 1000,
    subtasks: [],
  },
  {
    id: 'k-2',
    title: 'Write API Documentation',
    status: 'in_progress',
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
    addTask: mockAddTask,
    toggleTaskStatus: mockToggleTaskStatus,
  }),
}));

describe('KanbanView Touch & Pointer Drag-and-Drop (BUG-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Kanban columns and cards with touch/pointer drag attributes', () => {
    render(<KanbanView onSelectTask={mockOnSelectTask} />);

    // Columns should have data-kanban-column attributes
    const todoColumns = document.querySelectorAll('[data-kanban-column="todo"]');
    expect(todoColumns.length).toBeGreaterThan(0);

    const inProgressColumns = document.querySelectorAll('[data-kanban-column="in_progress"]');
    expect(inProgressColumns.length).toBeGreaterThan(0);

    // Cards should render
    expect(screen.getByText('Analyze DB Performance')).toBeDefined();
    expect(screen.getByText('Write API Documentation')).toBeDefined();
  });

  it('selects task on simple pointer click without movement', () => {
    render(<KanbanView onSelectTask={mockOnSelectTask} />);

    const card = screen.getByText('Analyze DB Performance').closest('[data-task-id="k-1"]')!;
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(card, { clientX: 100, clientY: 100 });

    expect(mockOnSelectTask).toHaveBeenCalledWith('k-1');
  });

  it('supports HTML5 drag and drop across columns', () => {
    render(<KanbanView onSelectTask={mockOnSelectTask} />);

    const inProgressColumn = document.querySelector('div[data-kanban-column="in_progress"]')!;

    fireEvent.drop(inProgressColumn, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/plain' ? 'k-1' : ''),
      },
    });

    expect(mockUpdateTask).toHaveBeenCalledWith('k-1', {
      status: 'in_progress',
      completedAt: undefined,
    });
  });

  it('toggles task status when dropped into completed column', () => {
    render(<KanbanView onSelectTask={mockOnSelectTask} />);

    const doneColumn = document.querySelector('div[data-kanban-column="done"]')!;

    fireEvent.drop(doneColumn, {
      dataTransfer: {
        getData: (type: string) => (type === 'text/plain' ? 'k-1' : ''),
      },
    });

    expect(mockToggleTaskStatus).toHaveBeenCalledWith('k-1');
  });

  it('cleanly cancels drag when pointercancel fires without moving task or opening details', () => {
    render(<KanbanView onSelectTask={mockOnSelectTask} />);

    const card = screen.getByText('Analyze DB Performance').closest('[data-task-id="k-1"]')!;
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(card, { clientX: 150, clientY: 150 });
    fireEvent.pointerCancel(card);

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockToggleTaskStatus).not.toHaveBeenCalled();
    expect(mockOnSelectTask).not.toHaveBeenCalled();
  });
});
