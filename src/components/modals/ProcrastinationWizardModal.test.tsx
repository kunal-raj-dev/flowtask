// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProcrastinationWizardModal } from './ProcrastinationWizardModal';
import type { Task } from '../../types/task';

describe('ProcrastinationWizardModal', () => {
  const mockTask: Task = {
    id: 'task-avoided',
    title: 'Prepare quarterly tax filings',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    subtasks: [],
    createdAt: 100,
  };

  const mockOnClose = vi.fn();
  const mockOnAddSubtasks = vi.fn();
  const mockOnStartSprint = vi.fn();
  const mockOnSaveDraft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 1 with 3 CBT emotional triage options', () => {
    render(
      <ProcrastinationWizardModal
        task={mockTask}
        isOpen={true}
        onClose={mockOnClose}
        onAddSubtasks={mockOnAddSubtasks}
        onStartSprint={mockOnStartSprint}
        onSaveDraftToNotes={mockOnSaveDraft}
      />
    );

    expect(screen.getByTestId('procrastination-wizard-modal')).toBeDefined();
    expect(screen.getByTestId('wizard-step-1')).toBeDefined();
    expect(screen.getByTestId('type-overwhelmed-btn')).toBeDefined();
    expect(screen.getByTestId('type-averse-btn')).toBeDefined();
    expect(screen.getByTestId('type-perfectionism-btn')).toBeDefined();
  });

  it('navigates to overwhelmed decomposition and adds micro-actions', () => {
    render(
      <ProcrastinationWizardModal
        task={mockTask}
        isOpen={true}
        onClose={mockOnClose}
        onAddSubtasks={mockOnAddSubtasks}
      />
    );

    fireEvent.click(screen.getByTestId('type-overwhelmed-btn'));
    expect(screen.getByTestId('wizard-intervention-overwhelmed')).toBeDefined();

    const commitBtn = screen.getByTestId('commit-subtasks-btn');
    fireEvent.click(commitBtn);

    expect(mockOnAddSubtasks).toHaveBeenCalledWith(
      'task-avoided',
      expect.arrayContaining([expect.stringContaining('Gather links')])
    );
    expect(screen.getByTestId('wizard-step-3')).toBeDefined();
  });

  it('navigates to 5-minute dash and launches sprint', () => {
    render(
      <ProcrastinationWizardModal
        task={mockTask}
        isOpen={true}
        onClose={mockOnClose}
        onStartSprint={mockOnStartSprint}
      />
    );

    fireEvent.click(screen.getByTestId('type-averse-btn'));
    expect(screen.getByTestId('wizard-intervention-averse')).toBeDefined();

    fireEvent.click(screen.getByTestId('launch-dash-btn'));
    expect(mockOnStartSprint).toHaveBeenCalledWith('task-avoided', 5);
    expect(screen.getByTestId('wizard-step-3')).toBeDefined();
  });

  it('navigates to ugly first draft scratchpad and saves text', () => {
    render(
      <ProcrastinationWizardModal
        task={mockTask}
        isOpen={true}
        onClose={mockOnClose}
        onSaveDraftToNotes={mockOnSaveDraft}
      />
    );

    fireEvent.click(screen.getByTestId('type-perfectionism-btn'));
    expect(screen.getByTestId('wizard-intervention-perfectionism')).toBeDefined();

    const textarea = screen.getByTestId('ugly-draft-textarea');
    fireEvent.change(textarea, { target: { value: 'Just raw disorganized ideas...' } });

    fireEvent.click(screen.getByTestId('save-ugly-draft-btn'));
    expect(mockOnSaveDraft).toHaveBeenCalledWith('task-avoided', 'Just raw disorganized ideas...');
    expect(screen.getByTestId('wizard-step-3')).toBeDefined();
  });
});
