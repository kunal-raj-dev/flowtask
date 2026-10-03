// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualTaskList } from './VirtualTaskList';
import type { Task } from '../../types/task';

describe('VirtualTaskList component', () => {
  it('renders list items directly when below threshold', () => {
    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Review PR',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [],
      },
      {
        id: 'task-2',
        title: 'Draft RFC',
        status: 'in_progress',
        priority: 'p2',
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [],
      },
    ];

    render(
      <VirtualTaskList
        tasks={tasks}
        renderTask={(t) => (
          <div key={t.id} data-testid={`item-${t.id}`}>
            {t.title}
          </div>
        )}
      />
    );

    expect(screen.getByTestId('item-task-1')).toBeDefined();
    expect(screen.getByTestId('item-task-2')).toBeDefined();
    expect(screen.getByText('Review PR')).toBeDefined();
    expect(screen.getByText('Draft RFC')).toBeDefined();
  });

  it('renders virtual items with spacer elements when exceeding threshold', () => {
    const tasks: Task[] = Array.from({ length: 50 }, (_, i) => ({
      id: `task-${i}`,
      title: `Task item ${i}`,
      status: 'todo',
      priority: 'p3',
      projectId: 'inbox',
      createdAt: Date.now(),
      subtasks: [],
    }));

    const { container } = render(
      <VirtualTaskList
        tasks={tasks}
        renderTask={(t) => (
          <div key={t.id} data-testid={`item-${t.id}`}>
            {t.title}
          </div>
        )}
      />
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeDefined();
    expect(screen.getByTestId('item-task-0')).toBeDefined();
  });
});
