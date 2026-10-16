// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TaskDrawerNotes } from './TaskDrawerNotes';
import type { Task } from '../../../types/task';

const mockUpdateTask = vi.fn();

const sampleTaskWithNotes: Task = {
  id: 'task-notes-1',
  title: 'Solve DSA Questions',
  description: 'Initial notes content',
  status: 'todo',
  priority: 'p2',
  projectId: 'work',
  createdAt: Date.now(),
  subtasks: [],
};

vi.mock('../../../context/TaskContext', () => ({
  useTaskContext: () => ({
    updateTask: mockUpdateTask,
  }),
}));

describe('TaskDrawerNotes Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders notes textarea with initial description', () => {
    render(<TaskDrawerNotes task={sampleTaskWithNotes} />);

    const textarea = screen.getByLabelText(/Task notes and description/i) as HTMLTextAreaElement;
    expect(textarea).toBeDefined();
    expect(textarea.value).toBe('Initial notes content');
  });

  it('allows typing continuous text without losing focus', () => {
    render(<TaskDrawerNotes task={sampleTaskWithNotes} />);

    const textarea = screen.getByLabelText(/Task notes and description/i) as HTMLTextAreaElement;
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Simulate typing character by character as user described
    fireEvent.change(textarea, { target: { value: 'q' } });
    expect(textarea.value).toBe('q');
    expect(document.activeElement).toBe(textarea);

    fireEvent.change(textarea, { target: { value: 'qu' } });
    expect(textarea.value).toBe('qu');
    expect(document.activeElement).toBe(textarea);

    fireEvent.change(textarea, { target: { value: 'questions' } });
    expect(textarea.value).toBe('questions');
    expect(document.activeElement).toBe(textarea);
  });

  it('debounces updateTask call while typing and commits after delay', () => {
    render(<TaskDrawerNotes task={sampleTaskWithNotes} />);

    const textarea = screen.getByLabelText(/Task notes and description/i);
    fireEvent.change(textarea, { target: { value: 'New notes' } });

    // Should not call immediately before debounce interval
    expect(mockUpdateTask).not.toHaveBeenCalled();

    // Fast-forward past 300ms debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockUpdateTask).toHaveBeenCalledWith('task-notes-1', {
      description: 'New notes',
    });
  });

  it('flushes pending changes immediately on blur', () => {
    render(<TaskDrawerNotes task={sampleTaskWithNotes} />);

    const textarea = screen.getByLabelText(/Task notes and description/i);
    fireEvent.change(textarea, { target: { value: 'Immediate blur save' } });

    expect(mockUpdateTask).not.toHaveBeenCalled();

    fireEvent.blur(textarea);

    expect(mockUpdateTask).toHaveBeenCalledWith('task-notes-1', {
      description: 'Immediate blur save',
    });
  });

  it('toggles markdown preview mode and back to edit mode', () => {
    render(<TaskDrawerNotes task={sampleTaskWithNotes} />);

    const previewButton = screen.getByRole('button', { name: /Preview/i });
    fireEvent.click(previewButton);

    // Preview mode should now be active
    expect(screen.getByRole('button', { name: /Edit Notes/i })).toBeDefined();
    expect(screen.queryByLabelText(/Task notes and description/i)).toBeNull();

    // Click back to edit mode
    const editNotesBtn = screen.getByRole('button', { name: /Edit Notes/i });
    fireEvent.click(editNotesBtn);

    expect(screen.getByLabelText(/Task notes and description/i)).toBeDefined();
  });
});
