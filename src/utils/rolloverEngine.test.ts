import { describe, it, expect } from 'vitest';
import { analyzeRolloverBatch, identifySurplusTasksToRollover } from './rolloverEngine';
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

  describe('identifySurplusTasksToRollover', () => {
    it('protects locks, work sessions, same-day deadlines and modern Top 3 memberships', () => {
      const tasks: Task[] = [
        { ...baseTask, id: 'locked', plannedDate: todayStr, scheduleLocked: true },
        { ...baseTask, id: 'scheduled', plannedDate: todayStr, scheduledStart: '10:00' },
        { ...baseTask, id: 'due', plannedDate: todayStr, dueDate: todayStr },
        { ...baseTask, id: 'top', plannedDate: todayStr, topThreeDate: todayStr },
        { ...baseTask, id: 'flexible', plannedDate: todayStr },
      ];
      expect(identifySurplusTasksToRollover(tasks, todayStr, 120).map(t => t.id)).toEqual(['flexible']);
    });
    it('returns empty array when overbookedMinutes <= 0', () => {
      const tasks: Task[] = [{ ...baseTask, plannedDate: todayStr, estimatedMinutes: 60 }];
      expect(identifySurplusTasksToRollover(tasks, todayStr, 0)).toEqual([]);
      expect(identifySurplusTasksToRollover(tasks, todayStr, -20)).toEqual([]);
    });

    it('selects lowest priority tasks first and respects pinned today tasks', () => {
      const tasks: Task[] = [
        { ...baseTask, id: 't-p1', priority: 'p1', plannedDate: todayStr, estimatedMinutes: 60 },
        { ...baseTask, id: 't-p4-pinned', priority: 'p4', isPinnedToday: true, plannedDate: todayStr, estimatedMinutes: 60 },
        { ...baseTask, id: 't-p3', priority: 'p3', plannedDate: todayStr, estimatedMinutes: 60 },
        { ...baseTask, id: 't-p4', priority: 'p4', plannedDate: todayStr, estimatedMinutes: 45 },
      ];

      // Needs 40 minutes: should pick 't-p4' (lowest priority, unpinned)
      const surplus = identifySurplusTasksToRollover(tasks, todayStr, 40);
      expect(surplus).toHaveLength(1);
      expect(surplus[0].id).toBe('t-p4');

      // Needs 90 minutes: should pick 't-p4' (45m) + 't-p3' (60m) = 105m, skipping pinned 't-p4-pinned' and high-priority 't-p1'
      const surplus90 = identifySurplusTasksToRollover(tasks, todayStr, 90);
      expect(surplus90.map((t) => t.id)).toEqual(['t-p4', 't-p3']);
    });

    it('uses subtask estimates when task estimatedMinutes is not explicitly set', () => {
      const taskWithSubtasks: Task = {
        ...baseTask,
        id: 't-sub',
        priority: 'p4',
        plannedDate: todayStr,
        estimatedMinutes: undefined,
        subtasks: [
          { id: 's1', title: 'Part 1', completed: false, estimatedMinutes: 25 },
          { id: 's2', title: 'Part 2', completed: false, estimatedMinutes: 25 },
        ], // Effective estimate = 50m
      };

      const surplus = identifySurplusTasksToRollover([taskWithSubtasks], todayStr, 45);
      expect(surplus).toHaveLength(1);
      expect(surplus[0].id).toBe('t-sub');
    });
  });
});
