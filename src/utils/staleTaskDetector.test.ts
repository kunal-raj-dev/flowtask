import { describe, it, expect } from 'vitest';
import { checkTaskStaleness } from './staleTaskDetector';
import type { Task } from '../types/task';

describe('staleTaskDetector', () => {
  const refDate = new Date(2026, 9, 2); // 2026-10-02

  const baseTask: Task = {
    id: 't-1',
    title: 'Tax filing review',
    status: 'todo',
    priority: 'p2',
    projectId: 'inbox',
    subtasks: [],
    createdAt: new Date(2026, 9, 1).getTime(), // 1 day old
  };

  it('detects a task overdue by 3 or more days as stale', () => {
    const overdueTask: Task = {
      ...baseTask,
      dueDate: '2026-09-28', // 4 days overdue
    };

    const result = checkTaskStaleness(overdueTask, refDate);
    expect(result.isStale).toBe(true);
    expect(result.reason).toBe('overdue_multiple_days');
    expect(result.daysOverdue).toBeGreaterThanOrEqual(3);
  });

  it('marks tasks overdue by only 1 day as not stale (normal workflow)', () => {
    const freshOverdueTask: Task = {
      ...baseTask,
      dueDate: '2026-10-01', // 1 day overdue
    };

    const result = checkTaskStaleness(freshOverdueTask, refDate);
    expect(result.isStale).toBe(false);
  });

  it('marks tasks pending for 14+ days as stale', () => {
    const oldTask: Task = {
      ...baseTask,
      createdAt: new Date(2026, 8, 15).getTime(), // 17 days ago
      dueDate: undefined,
    };

    const result = checkTaskStaleness(oldTask, refDate);
    expect(result.isStale).toBe(true);
    expect(result.reason).toBe('long_pending');
  });

  it('ignores completed tasks even if old or overdue', () => {
    const doneTask: Task = {
      ...baseTask,
      status: 'done',
      dueDate: '2026-09-20',
      createdAt: new Date(2026, 8, 10).getTime(),
    };

    const result = checkTaskStaleness(doneTask, refDate);
    expect(result.isStale).toBe(false);
  });
});
