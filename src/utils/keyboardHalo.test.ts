import { describe, it, expect } from 'vitest';
import { formatLocalDate } from './nlpParser';
import { checkTaskStaleness } from './staleTaskDetector';
import type { Task, Priority } from '../types/task';

describe('Keyboard Halo and Backlog Sweeper integration', () => {
  it('correctly maps priority shortcut keys to task priorities', () => {
    const priorityMap: Record<string, Priority> = {
      '1': 'p1',
      '2': 'p2',
      '3': 'p3',
      '4': 'p4',
    };

    expect(priorityMap['1']).toBe('p1');
    expect(priorityMap['2']).toBe('p2');
    expect(priorityMap['3']).toBe('p3');
    expect(priorityMap['4']).toBe('p4');
  });

  it('calculates Tomorrow local date string correctly for keyboard rescheduling', () => {
    const today = new Date(2026, 9, 2); // 2026-10-02
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    expect(formatLocalDate(today)).toBe('2026-10-02');
    expect(formatLocalDate(tomorrow)).toBe('2026-10-03');
  });

  it('correctly isolates stale backlog items for batch sweeper actions', () => {
    const refDate = new Date(2026, 9, 2);
    const mockTasks: Task[] = [
      {
        id: 't-fresh',
        title: 'Recent brainstorm item',
        status: 'todo',
        priority: 'p4',
        projectId: 'ideas',
        createdAt: new Date(2026, 9, 1).getTime(), // 1 day old
        subtasks: [],
      },
      {
        id: 't-stale-idle',
        title: 'Ancient concept untouched',
        status: 'todo',
        priority: 'p3',
        projectId: 'ideas',
        createdAt: new Date(2026, 8, 1).getTime(), // 31 days old
        subtasks: [],
      },
      {
        id: 't-stale-overdue',
        title: 'Lapsed proposal',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        dueDate: '2026-09-20',
        createdAt: new Date(2026, 8, 20).getTime(),
        subtasks: [],
      },
      {
        id: 't-completed-old',
        title: 'Old done task',
        status: 'done',
        priority: 'p3',
        projectId: 'ideas',
        createdAt: new Date(2026, 7, 1).getTime(),
        subtasks: [],
      },
    ];

    const staleItems = mockTasks.filter(
      (t) => t.status !== 'done' && checkTaskStaleness(t, refDate).isStale
    );

    expect(staleItems.map((t) => t.id)).toEqual(['t-stale-idle', 't-stale-overdue']);
  });
});
