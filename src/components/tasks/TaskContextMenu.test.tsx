// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskContextMenu } from './TaskContextMenu';
import type { Task, Project } from '../../types/task';

const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();
const mockToggleTaskStatus = vi.fn();
const mockToggleTaskPinToday = vi.fn();
const mockDuplicateTask = vi.fn();
const mockToggleTaskSelection = vi.fn();
const mockShowToast = vi.fn();
const mockUndoLastAction = vi.fn();
const mockSetActiveView = vi.fn();

const sampleProjects: Project[] = [
  { id: 'inbox', name: 'Inbox', color: '#64748B', createdAt: 1 },
  { id: 'proj-work', name: 'Work', color: '#3B82F6', createdAt: 2 },
  { id: 'proj-personal', name: 'Personal', color: '#10B981', createdAt: 3 },
];

const sampleTask: Task = {
  id: 'task-100',
  title: 'Test Context Menu Task',
  status: 'todo',
  priority: 'p3',
  projectId: 'inbox',
  subtasks: [],
  createdAt: 1000,
  updatedAt: 1000,
};

let mockSettings: any = { keyboardShortcutsEnabled: true, showShortcutHints: true };

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    updateTask: mockUpdateTask,
    deleteTask: mockDeleteTask,
    toggleTaskStatus: mockToggleTaskStatus,
    toggleTaskPinToday: mockToggleTaskPinToday,
    duplicateTask: mockDuplicateTask,
    toggleTaskSelection: mockToggleTaskSelection,
    selectedTaskIds: [],
    projects: sampleProjects,
    showToast: mockShowToast,
    undoLastAction: mockUndoLastAction,
    setActiveView: mockSetActiveView,
    settings: mockSettings,
  }),
}));

describe('TaskContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Move to Project option and opens searchable picker', () => {
    const onClose = vi.fn();
    render(<TaskContextMenu task={sampleTask} position={{ x: 100, y: 100 }} onClose={onClose} />);

    const moveBtn = screen.getByRole('button', { name: /Move to Project/i });
    expect(moveBtn).toBeDefined();

    fireEvent.click(moveBtn);

    // Search input should be present
    expect(screen.getByPlaceholderText(/Search project/i)).toBeDefined();
    // Project options should be rendered
    expect(screen.getByText('Work')).toBeDefined();
    expect(screen.getByText('Personal')).toBeDefined();
  });

  it('moves task to selected project and triggers toast with Undo and View project', () => {
    const onClose = vi.fn();
    render(<TaskContextMenu task={sampleTask} position={{ x: 100, y: 100 }} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /Move to Project/i }));
    fireEvent.click(screen.getByText('Work'));

    expect(mockUpdateTask).toHaveBeenCalledWith('task-100', {
      projectId: 'proj-work',
      milestoneId: undefined,
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      'Moved "Test Context Menu Task" to Work',
      'Undo',
      mockUndoLastAction,
      'View project',
      expect.any(Function)
    );

    expect(onClose).toHaveBeenCalled();
  });

  it('does not display duplicate "m" shortcut badge on Move to Project, but displays it on Move to Tomorrow', () => {
    mockSettings = { keyboardShortcutsEnabled: true, showShortcutHints: true };
    const onClose = vi.fn();
    render(<TaskContextMenu task={sampleTask} position={{ x: 100, y: 100 }} onClose={onClose} />);

    const moveProjectBtn = screen.getByRole('button', { name: /Move to Project/i });
    expect(moveProjectBtn.querySelector('kbd')).toBeNull();

    const tomorrowBtn = screen.getByRole('button', { name: /Move to Tomorrow/i });
    const tomorrowKbd = tomorrowBtn.querySelector('kbd');
    expect(tomorrowKbd).not.toBeNull();
    expect(tomorrowKbd?.textContent).toBe('m');
  });

  it('hides shortcut badges when keyboard shortcuts or hints are disabled', () => {
    mockSettings = { keyboardShortcutsEnabled: false, showShortcutHints: true };
    const onClose = vi.fn();
    const { unmount } = render(<TaskContextMenu task={sampleTask} position={{ x: 100, y: 100 }} onClose={onClose} />);

    expect(document.querySelectorAll('kbd').length).toBe(0);
    unmount();

    mockSettings = { keyboardShortcutsEnabled: true, showShortcutHints: false };
    render(<TaskContextMenu task={sampleTask} position={{ x: 100, y: 100 }} onClose={onClose} />);
    expect(document.querySelectorAll('kbd').length).toBe(0);
  });
});
