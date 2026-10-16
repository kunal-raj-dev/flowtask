// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskDrawerSubtasks } from './TaskDrawerSubtasks';
import type { Task } from '../../../types/task';

const mockUpdateTask = vi.fn();
const mockToggleSubTask = vi.fn();
const mockAddSubTask = vi.fn();
const mockAddSubTasks = vi.fn();
const mockUpdateSubTask = vi.fn();
const mockDeleteSubTask = vi.fn();
const mockPromoteSubTaskToTask = vi.fn();
const mockMoveSubTask = vi.fn();
const mockShowToast = vi.fn();

const sampleTaskWithSubtasks: Task = {
  id: 'task-test-1',
  title: 'Solve DSA Questions',
  status: 'todo',
  priority: 'p2',
  projectId: 'work',
  createdAt: Date.now(),
  subtasks: [
    {
      id: 'sub-1',
      title: 'Binary Search Implementation',
      completed: false,
      estimatedMinutes: 15,
    },
    {
      id: 'sub-2',
      title: 'Two Pointers Practice',
      completed: true,
      estimatedMinutes: 25,
    },
  ],
};

vi.mock('../../../context/TaskContext', () => ({
  useTaskContext: () => ({
    updateTask: mockUpdateTask,
    toggleSubTask: mockToggleSubTask,
    addSubTask: mockAddSubTask,
    addSubTasks: mockAddSubTasks,
    updateSubTask: mockUpdateSubTask,
    deleteSubTask: mockDeleteSubTask,
    promoteSubTaskToTask: mockPromoteSubTaskToTask,
    moveSubTask: mockMoveSubTask,
    showToast: mockShowToast,
  }),
}));

describe('TaskDrawerSubtasks Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders list of subtasks with titles and estimates', () => {
    render(<TaskDrawerSubtasks task={sampleTaskWithSubtasks} />);

    expect(screen.getByText('Binary Search Implementation')).toBeDefined();
    expect(screen.getByText('Two Pointers Practice')).toBeDefined();
    expect(screen.getByText('15m')).toBeDefined();
    expect(screen.getByText('25m')).toBeDefined();
  });

  it('enters inline edit mode when clicking the Edit button', () => {
    render(<TaskDrawerSubtasks task={sampleTaskWithSubtasks} />);

    const editButtons = screen.getAllByRole('button', { name: /Edit subtask/i });
    expect(editButtons.length).toBe(2);

    fireEvent.click(editButtons[0]);

    // An input with pre-filled title should appear
    const titleInput = screen.getByLabelText(/Edit subtask title/i) as HTMLInputElement;
    expect(titleInput).toBeDefined();
    expect(titleInput.value).toBe('Binary Search Implementation');

    const estimateInput = screen.getByLabelText(/Edit subtask duration in minutes/i) as HTMLInputElement;
    expect(estimateInput).toBeDefined();
    expect(estimateInput.value).toBe('15');
  });

  it('enters inline edit mode on double-clicking subtask text', () => {
    render(<TaskDrawerSubtasks task={sampleTaskWithSubtasks} />);

    const subItem = screen.getByText('Binary Search Implementation');
    fireEvent.doubleClick(subItem);

    const titleInput = screen.getByLabelText(/Edit subtask title/i) as HTMLInputElement;
    expect(titleInput).toBeDefined();
    expect(titleInput.value).toBe('Binary Search Implementation');
  });

  it('saves edited subtask title and estimate on save button click', () => {
    render(<TaskDrawerSubtasks task={sampleTaskWithSubtasks} />);

    const editButtons = screen.getAllByRole('button', { name: /Edit subtask/i });
    fireEvent.click(editButtons[0]);

    const titleInput = screen.getByLabelText(/Edit subtask title/i);
    const estimateInput = screen.getByLabelText(/Edit subtask duration in minutes/i);

    fireEvent.change(titleInput, { target: { value: 'Optimized Binary Search' } });
    fireEvent.change(estimateInput, { target: { value: '20' } });

    const saveButton = screen.getByRole('button', { name: /Save subtask/i });
    fireEvent.click(saveButton);

    expect(mockUpdateSubTask).toHaveBeenCalledWith('task-test-1', 'sub-1', {
      title: 'Optimized Binary Search',
      estimatedMinutes: 20,
    });
  });

  it('saves edited subtask on Enter key press', () => {
    render(<TaskDrawerSubtasks task={sampleTaskWithSubtasks} />);

    const editButtons = screen.getAllByRole('button', { name: /Edit subtask/i });
    fireEvent.click(editButtons[0]);

    const titleInput = screen.getByLabelText(/Edit subtask title/i);
    fireEvent.change(titleInput, { target: { value: 'Keyboard Enter Save' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(mockUpdateSubTask).toHaveBeenCalledWith('task-test-1', 'sub-1', {
      title: 'Keyboard Enter Save',
      estimatedMinutes: 15,
    });
  });

  it('cancels editing on Escape key without updating subtask', () => {
    render(<TaskDrawerSubtasks task={sampleTaskWithSubtasks} />);

    const editButtons = screen.getAllByRole('button', { name: /Edit subtask/i });
    fireEvent.click(editButtons[0]);

    const titleInput = screen.getByLabelText(/Edit subtask title/i);
    fireEvent.change(titleInput, { target: { value: 'Cancelled changes' } });
    fireEvent.keyDown(titleInput, { key: 'Escape' });

    expect(mockUpdateSubTask).not.toHaveBeenCalled();
    // Reverts to normal view
    expect(screen.queryByLabelText(/Edit subtask title/i)).toBeNull();
    expect(screen.getByText('Binary Search Implementation')).toBeDefined();
  });

  it('cancels editing on Cancel button click without updating subtask', () => {
    render(<TaskDrawerSubtasks task={sampleTaskWithSubtasks} />);

    const editButtons = screen.getAllByRole('button', { name: /Edit subtask/i });
    fireEvent.click(editButtons[0]);

    const cancelButton = screen.getByRole('button', { name: /Cancel editing subtask/i });
    fireEvent.click(cancelButton);

    expect(mockUpdateSubTask).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Edit subtask title/i)).toBeNull();
  });
});
