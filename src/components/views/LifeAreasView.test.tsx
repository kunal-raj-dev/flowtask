// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LifeAreasView } from './LifeAreasView';
import { TaskContext } from '../../context/TaskContext';
import type { Project, Task } from '../../types/task';

describe('LifeAreasView', () => {
  const sampleProjects: Project[] = [
    { id: 'proj-work', name: 'Work Project', color: '#3B82F6', isArchived: false, areaId: 'area-career' },
    { id: 'proj-health', name: 'Marathon Prep', color: '#10B981', isArchived: false, areaId: 'area-health' },
  ];

  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Quarterly review report',
      status: 'done',
      priority: 'p1',
      projectId: 'proj-work',
      subtasks: [],
      createdAt: 100,
    },
    {
      id: 'task-2',
      title: 'Prepare executive slides',
      status: 'todo',
      priority: 'p2',
      projectId: 'proj-work',
      subtasks: [],
      createdAt: 101,
    },
    {
      id: 'task-3',
      title: 'Morning 8k tempo run',
      status: 'done',
      priority: 'p3',
      projectId: 'proj-health',
      subtasks: [],
      createdAt: 102,
    },
  ];

  const mockAddProject = vi.fn();

  const renderWithContext = (props: { onSelectProject?: any; onSelectTask?: any } = {}) => {
    return render(
      <TaskContext.Provider
        value={{
          projects: sampleProjects,
          tasks: sampleTasks,
          addProject: mockAddProject,
        } as any}
      >
        <LifeAreasView {...props} />
      </TaskContext.Provider>
    );
  };

  it('renders default life areas with calculated task metrics and progress', () => {
    renderWithContext();

    expect(screen.getByTestId('life-areas-view')).toBeDefined();
    expect(screen.getByText('Career & Work')).toBeDefined();
    expect(screen.getByText('Health & Vitality')).toBeDefined();
    expect(screen.getByText('Wealth & Finance')).toBeDefined();

    // Career & Work has 1 done of 2 tasks => 50%
    expect(screen.getByText('50%')).toBeDefined();
    // Health & Vitality has 1 done of 1 task => 100%
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('creates a new life area when form is submitted', () => {
    renderWithContext();

    const newAreaBtn = screen.getByTestId('create-area-button');
    fireEvent.click(newAreaBtn);

    const nameInput = screen.getByPlaceholderText('e.g. Creative Projects, Spirituality...');
    fireEvent.change(nameInput, { target: { value: 'Creative Arts & Writing' } });

    const createBtn = screen.getByText('Save Area');
    fireEvent.click(createBtn);

    expect(screen.getByText('Creative Arts & Writing')).toBeDefined();
  });

  it('triggers onSelectProject when project chip is clicked', () => {
    const onSelectProject = vi.fn();
    renderWithContext({ onSelectProject });

    const projectChip = screen.getByText('Work Project');
    fireEvent.click(projectChip);

    expect(onSelectProject).toHaveBeenCalledWith('proj-work');
  });
});
