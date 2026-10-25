// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CleanSlateModal } from './CleanSlateModal';
import type { Task } from '../../types/task';

describe('CleanSlateModal', () => {
  const mockOnClose = vi.fn();
  const mockApplyQuarantine = vi.fn();

  const overdueTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Old tax forms',
      status: 'todo',
      priority: 'p1',
      projectId: 'inbox',
      plannedDate: '2026-10-10',
      subtasks: [],
      createdAt: 1,
    },
    {
      id: 'task-2',
      title: 'Car inspection',
      status: 'todo',
      priority: 'p2',
      projectId: 'inbox',
      dueDate: '2026-10-12',
      subtasks: [],
      createdAt: 2,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with non-judgmental banner and overdue task list', () => {
    render(
      <CleanSlateModal
        isOpen={true}
        tasks={overdueTasks}
        onClose={mockOnClose}
        onApplyQuarantine={mockApplyQuarantine}
      />
    );

    expect(screen.getByTestId('clean-slate-modal')).toBeDefined();
    expect(screen.getByText(/Life happened. Want a Clean Slate\?/i)).toBeDefined();
    expect(screen.getByText('Old tax forms')).toBeDefined();
    expect(screen.getByText('Car inspection')).toBeDefined();
  });

  it('executes 1-click bulk quarantine to Someday without data loss', () => {
    render(
      <CleanSlateModal
        isOpen={true}
        tasks={overdueTasks}
        onClose={mockOnClose}
        onApplyQuarantine={mockApplyQuarantine}
      />
    );

    const confirmBtn = screen.getByTestId('confirm-clean-slate-btn');
    fireEvent.click(confirmBtn);

    expect(mockApplyQuarantine).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'task-1', isSomeday: true }),
        expect.objectContaining({ id: 'task-2', isSomeday: true }),
      ]),
      2
    );
    expect(mockOnClose).toHaveBeenCalled();
  });
});
