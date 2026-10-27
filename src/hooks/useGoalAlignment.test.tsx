import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useGoalAlignment } from './useGoalAlignment';
import { TaskContext, type TaskContextType } from '../context/TaskContext';
import type { Task, Project } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';

describe('useGoalAlignment', () => {
  const todayStr = formatLocalDate(new Date());

  const mockProjects: Project[] = [
    { id: 'proj-1', name: 'Work', color: '#3B82F6', createdAt: 1, updatedAt: 1 },
    { id: 'proj-2', name: 'Personal', color: '#10B981', createdAt: 1, updatedAt: 1 },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Write executive RFC',
      status: 'done',
      projectId: 'proj-1',
      priority: 'p1',
      createdAt: 100,
      updatedAt: 100,
      plannedDate: todayStr,
      subtasks: [],
    },
    {
      id: 'task-2',
      title: 'Refactor audio synthesizer',
      status: 'todo',
      projectId: 'proj-1',
      priority: 'p2',
      createdAt: 100,
      updatedAt: 100,
      plannedDate: todayStr,
      subtasks: [],
    },
    {
      id: 'task-3',
      title: 'Buy groceries',
      status: 'todo',
      projectId: 'proj-2',
      priority: 'p3',
      createdAt: 100,
      updatedAt: 100,
      plannedDate: todayStr,
      subtasks: [],
    },
  ];

  it('calculates alignment metrics correctly for today tasks', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TaskContext.Provider
        value={
          {
            tasks: mockTasks,
            projects: mockProjects,
            workspacePreferences: {},
            settings: {},
          } as unknown as TaskContextType
        }
      >
        {children}
      </TaskContext.Provider>
    );

    const { result } = renderHook(() => useGoalAlignment(), { wrapper });

    expect(result.current.todayAlignment.totalTodayTasks).toBe(2);
    expect(result.current.todayAlignment.alignmentPercent).toBeDefined();
  });
});
