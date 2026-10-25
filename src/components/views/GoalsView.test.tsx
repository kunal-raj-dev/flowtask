// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoalsView } from './GoalsView';
import { TaskContext } from '../../context/TaskContext';
import type { Project, Task } from '../../types/task';

describe('GoalsView', () => {
  const sampleProjects: Project[] = [
    { id: 'work', name: 'Work Project', color: '#3B82F6', isArchived: false },
    { id: 'personal', name: 'Personal Life', color: '#10B981', isArchived: false },
  ];

  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Sprint 12 verification',
      status: 'done',
      priority: 'p1',
      projectId: 'work',
      subtasks: [],
      createdAt: 100,
    },
  ];

  const renderWithContext = (props: { onSelectProject?: any } = {}) => {
    return render(
      <TaskContext.Provider
        value={{
          projects: sampleProjects,
          tasks: sampleTasks,
        } as any}
      >
        <GoalsView {...props} />
      </TaskContext.Provider>
    );
  };

  it('renders starter goals and quarter filters', () => {
    renderWithContext();

    expect(screen.getByTestId('goals-view')).toBeDefined();
    expect(screen.getByText('Publish Product 2.0 Workstation Release')).toBeDefined();
    expect(screen.getByText('Achieve Sub-25m 5k Aerobic Baseline')).toBeDefined();
  });

  it('filters goals by target quarter', () => {
    renderWithContext();

    const q1Tab = screen.getByRole('button', { name: '2027-Q1' });
    fireEvent.click(q1Tab);

    expect(screen.getByText('Consolidate Whole-Life Admin & Financial Backlogs')).toBeDefined();
    expect(screen.queryByText('Publish Product 2.0 Workstation Release')).toBeNull();
  });

  it('creates a new goal and adds to list', () => {
    renderWithContext();

    const newGoalBtn = screen.getByTestId('create-goal-button');
    fireEvent.click(newGoalBtn);

    const titleInput = screen.getByPlaceholderText('What significant outcome will you achieve?');
    fireEvent.change(titleInput, { target: { value: 'Master TypeScript 5.8 AST Transformers' } });

    const createSubmitBtn = screen.getByText('Save Goal');
    fireEvent.click(createSubmitBtn);

    expect(screen.getByText('Master TypeScript 5.8 AST Transformers')).toBeDefined();
  });

  it('toggles goal status between in_progress and achieved', () => {
    renderWithContext();

    const goalCard = screen.getByTestId('goal-card-goal-1');
    expect(goalCard).toBeDefined();

    const toggleBtn = goalCard.querySelector('button[title*="Mark Achieved"]');
    expect(toggleBtn).toBeTruthy();

    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      // Title of button toggles to 'Mark In Progress'
      const updatedBtn = goalCard.querySelector('button[title*="Mark In Progress"]');
      expect(updatedBtn).toBeTruthy();
    }
  });
});
