import { describe, it, expect } from 'vitest';
import { filterTasksByPredicate, BUILT_IN_SMART_VIEWS } from './smartViewUtils';
import type { Task } from '../types/task';

describe('smartViewUtils', () => {
  const baseTask: Task = {
    id: 't-1',
    title: 'Test task',
    status: 'todo',
    priority: 'p3',
    projectId: 'inbox',
    subtasks: [],
    createdAt: Date.now(),
  };

  const fixedDate = new Date(2026, 9, 2); // 2026-10-02

  it('filters active quick wins (<= 15 mins)', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', title: 'Quick check', estimatedMinutes: 10, status: 'todo' },
      { ...baseTask, id: '2', title: 'Deep feature', estimatedMinutes: 60, status: 'todo' },
      { ...baseTask, id: '3', title: 'Done quick check', estimatedMinutes: 5, status: 'done' },
    ];

    const quickWinsView = BUILT_IN_SMART_VIEWS.find((v) => v.id === 'quick-wins')!;
    const result = filterTasksByPredicate(tasks, quickWinsView.predicate, fixedDate);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters deep focus (>= 45 mins or P1)', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', title: 'Short task', estimatedMinutes: 15, priority: 'p3' },
      { ...baseTask, id: '2', title: 'Heavy spec', estimatedMinutes: 90, priority: 'p2' },
      { ...baseTask, id: '3', title: 'P1 without duration', priority: 'p1', estimatedMinutes: undefined },
    ];

    const deepWorkView = BUILT_IN_SMART_VIEWS.find((v) => v.id === 'deep-work')!;
    const result = filterTasksByPredicate(tasks, deepWorkView.predicate, fixedDate);

    expect(result.map((t) => t.id)).toEqual(['2', '3']);
  });

  it('filters high urgency tasks (P1 and P2)', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', priority: 'p1' },
      { ...baseTask, id: '2', priority: 'p2' },
      { ...baseTask, id: '3', priority: 'p3' },
      { ...baseTask, id: '4', priority: 'p4' },
    ];

    const urgencyView = BUILT_IN_SMART_VIEWS.find((v) => v.id === 'high-urgency')!;
    const result = filterTasksByPredicate(tasks, urgencyView.predicate, fixedDate);

    expect(result.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('filters unscheduled backlog tasks taking plannedDate into account', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', dueDate: undefined, plannedDate: undefined },
      { ...baseTask, id: '2', dueDate: '2026-10-02' },
      { ...baseTask, id: '3', plannedDate: '2026-10-03' },
    ];

    const backlogView = BUILT_IN_SMART_VIEWS.find((v) => v.id === 'backlog')!;
    const result = filterTasksByPredicate(tasks, backlogView.predicate, fixedDate);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters overdue tasks accurately', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', dueDate: '2026-10-01', status: 'todo' }, // overdue
      { ...baseTask, id: '2', dueDate: '2026-10-02', status: 'todo' }, // today
      { ...baseTask, id: '3', dueDate: '2026-10-01', status: 'done' }, // completed
    ];

    const result = filterTasksByPredicate(
      tasks,
      { dueRange: 'overdue', status: 'active' },
      fixedDate
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters This Evening tasks', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', isEvening: true },
      { ...baseTask, id: '2', isEvening: false },
      { ...baseTask, id: '3' },
    ];

    const eveningView = BUILT_IN_SMART_VIEWS.find((v) => v.id === 'evening')!;
    const result = filterTasksByPredicate(tasks, eveningView.predicate, fixedDate);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters blocked tasks', () => {
    const blocker: Task = { ...baseTask, id: 'blocker', status: 'todo' };
    const blocked: Task = { ...baseTask, id: 'blocked', blockedBy: ['blocker'] };
    const unblocked: Task = { ...baseTask, id: 'clean' };

    const result = filterTasksByPredicate(
      [blocker, blocked, unblocked],
      { isBlocked: true, status: 'active' },
      fixedDate
    );

    expect(result.map((t) => t.id)).toEqual(['blocked']);
  });
});
