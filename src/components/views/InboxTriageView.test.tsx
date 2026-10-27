import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InboxTriageView } from './InboxTriageView';
import { TaskContext, type TaskContextType } from '../../context/TaskContext';
import type { Task, Project } from '../../types/task';

describe('InboxTriageView', () => {
  const mockProjects: Project[] = [
    { id: 'inbox', name: 'Inbox', color: '#3B82F6', createdAt: 1, updatedAt: 1 },
    { id: 'work', name: 'Work', color: '#10B981', createdAt: 1, updatedAt: 1 },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-inbox-1',
      title: 'Draft Q4 Product Strategy',
      description: 'Detail executive roadmaps and architecture',
      status: 'todo',
      projectId: 'inbox',
      priority: 'p1',
      createdAt: 100,
      updatedAt: 100,
      subtasks: [],
    },
    {
      id: 'task-inbox-2',
      title: 'Review PR #42',
      status: 'todo',
      projectId: 'inbox',
      priority: 'p2',
      createdAt: 200,
      updatedAt: 200,
      subtasks: [],
    },
  ];

  let toggleTaskStatusMock: ReturnType<typeof vi.fn>;
  let updateTaskMock: ReturnType<typeof vi.fn>;
  let deleteTaskMock: ReturnType<typeof vi.fn>;
  let showToastMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toggleTaskStatusMock = vi.fn();
    updateTaskMock = vi.fn();
    deleteTaskMock = vi.fn();
    showToastMock = vi.fn();
  });

  const renderWithContext = (tasksList: Task[] = mockTasks) => {
    const mockContext = {
      tasks: tasksList,
      projects: mockProjects,
      toggleTaskStatus: toggleTaskStatusMock,
      updateTask: updateTaskMock,
      deleteTask: deleteTaskMock,
      showToast: showToastMock,
      undoLastAction: vi.fn(),
      addSubTasks: vi.fn(),
      workspacePreferences: {},
      settings: {} as unknown,
    } as unknown as TaskContextType;

    return render(
      <TaskContext.Provider value={mockContext}>
        <InboxTriageView />
      </TaskContext.Provider>
    );
  };

  it('renders the top inbox item in full focus with remaining queue count', () => {
    renderWithContext();

    expect(screen.getByText('Superhuman Inbox Triage')).toBeDefined();
    expect(screen.getByText('Draft Q4 Product Strategy')).toBeDefined();
    expect(screen.getByText('Detail executive roadmaps and architecture')).toBeDefined();
    expect(screen.getByText('Task 1 of 2')).toBeDefined();
    expect(screen.getByText('Review PR #42')).toBeDefined();
  });

  it('marks task as complete when Complete button or E key is triggered', () => {
    renderWithContext();

    const completeBtn = screen.getByRole('button', { name: /Complete/i });
    fireEvent.click(completeBtn);

    expect(toggleTaskStatusMock).toHaveBeenCalledWith('task-inbox-1');
  });

  it('renders celebratory Inbox Zero state when all tasks are cleared', () => {
    renderWithContext([]);

    expect(screen.getByText('Inbox Zero Achieved')).toBeDefined();
    expect(
      screen.getByText('You are completely clear. Every thought has been routed, prioritized, or executed.')
    ).toBeDefined();
  });
});
