import { describe, it, expect } from 'vitest';
import { analyzeRolloverBatch } from './rolloverEngine';
import type { Task } from '../types/task';

describe('rolloverEngine', () => {
  const todayStr = '2026-10-18';

  const baseTask: Task = {
    id: 't-1',
    title: 'Test Task',
    status: 'todo',
    priority: 'p3',
    projectId: 'inbox',
    createdAt: Date.now(),
    subtasks: [],
  };

  it('correctly categorizes overdue, stale, and quick-win tasks', () => {
    const tasks: Task[] = [
      {
        ...baseTask,
        id: 't-overdue-quick',
        title: 'Quick fix',
        plannedDate: '2026-10-17',
        estimatedMinutes: 10,
      },
      {
        ...baseTask,
        id: 't-overdue-stale',
        title: 'Stale feature draft',
        plannedDate: '2026-10-16',
        rolloverCount: 4,
        estimatedMinutes: 60,
      },
      {
        ...baseTask,
        id: 't-overdue-old',
        title: 'Old backlog task',
        plannedDate: '2026-10-10',
        createdAt: Date.now() - 10 * 86400000,
        estimatedMinutes: 45,
      },
      {
        ...baseTask,
        id: 't-today',
        title: 'Planned today',
        plannedDate: '2026-10-18',
        estimatedMinutes: 30,
      },
      {
        ...baseTask,
        id: 't-done',
        title: 'Completed yesterday',
        plannedDate: '2026-10-17',
        status: 'done',
      },
    ];

    const result = analyzeRolloverBatch(tasks, todayStr);

    expect(result.overdueTasks).toHaveLength(3);
    expect(result.quickWinTasks).toHaveLength(1);
    expect(result.quickWinTasks[0].id).toBe('t-overdue-quick');
    expect(result.staleTasks).toHaveLength(2);
    expect(result.totalEstimatedMinutes).toBe(10 + 60 + 45);
  });

  it('returns empty lists when no tasks are overdue', () => {
    const tasks: Task[] = [
      {
        ...baseTask,
        id: 't-today',
        plannedDate: '2026-10-18',
      },
    ];

    const result = analyzeRolloverBatch(tasks, todayStr);
    expect(result.overdueTasks).toHaveLength(0);
    expect(result.staleTasks).toHaveLength(0);
    expect(result.quickWinTasks).toHaveLength(0);
    expect(result.totalEstimatedMinutes).toBe(0);
  });
});
