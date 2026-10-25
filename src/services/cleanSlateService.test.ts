import { describe, it, expect } from 'vitest';
import {
  calculateTaskOpacity,
  getOverdueTasks,
  assessCleanSlateEligibility,
  quarantineTasks,
} from './cleanSlateService';
import type { Task } from '../types/task';

describe('cleanSlateService', () => {
  it('calculates opacity decay according to Opacity = max(0.40, 1.0 - 0.12 * deferCount)', () => {
    const taskZero: Task = { id: 't0', title: 'New', status: 'todo', priority: 'p2', projectId: 'inbox', subtasks: [], createdAt: 1 };
    expect(calculateTaskOpacity(taskZero)).toBe(1.0);

    const task1: Task = { ...taskZero, rolloverCount: 1 };
    expect(calculateTaskOpacity(task1)).toBe(0.88);

    const task3: Task = { ...taskZero, rolloverCount: 3 };
    expect(calculateTaskOpacity(task3)).toBe(0.64);

    const task6: Task = { ...taskZero, rolloverCount: 6 };
    expect(calculateTaskOpacity(task6)).toBe(0.40); // Clamped at 0.40 floor

    const task10: Task = { ...taskZero, rolloverCount: 10 };
    expect(calculateTaskOpacity(task10)).toBe(0.40);
  });

  it('correctly filters overdue tasks based on plannedDate or dueDate', () => {
    const today = '2026-10-25';
    const tasks: Task[] = [
      { id: 't1', title: 'Overdue Planned', status: 'todo', priority: 'p2', projectId: 'inbox', plannedDate: '2026-10-20', subtasks: [], createdAt: 1 },
      { id: 't2', title: 'Overdue Due', status: 'todo', priority: 'p2', projectId: 'inbox', dueDate: '2026-10-24', subtasks: [], createdAt: 2 },
      { id: 't3', title: 'Today Task', status: 'todo', priority: 'p2', projectId: 'inbox', plannedDate: '2026-10-25', subtasks: [], createdAt: 3 },
      { id: 't4', title: 'Future Task', status: 'todo', priority: 'p2', projectId: 'inbox', plannedDate: '2026-10-28', subtasks: [], createdAt: 4 },
      { id: 't5', title: 'Completed Task', status: 'done', priority: 'p2', projectId: 'inbox', plannedDate: '2026-10-20', subtasks: [], createdAt: 5 },
      { id: 't6', title: 'Already Someday', status: 'todo', priority: 'p2', projectId: 'inbox', plannedDate: '2026-10-20', isSomeday: true, subtasks: [], createdAt: 6 },
    ];

    const overdue = getOverdueTasks(tasks, today);
    expect(overdue.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('triggers Clean Slate assessment when overdue tasks exceed 15', () => {
    const today = '2026-10-25';
    const manyTasks: Task[] = Array.from({ length: 18 }, (_, i) => ({
      id: `task-${i}`,
      title: `Overdue ${i}`,
      status: 'todo',
      priority: 'p2',
      projectId: 'inbox',
      plannedDate: '2026-10-15',
      subtasks: [],
      createdAt: i,
    }));

    const assessment = assessCleanSlateEligibility(manyTasks, Date.now(), today);
    expect(assessment.shouldPromptCleanSlate).toBe(true);
    expect(assessment.reason).toBe('overdue_threshold');
    expect(assessment.overdueTasksCount).toBe(18);
  });

  it('triggers Clean Slate assessment after 5+ days of absence with overdue tasks', () => {
    const today = '2026-10-25';
    const fewTasks: Task[] = [
      { id: 't1', title: 'Stale item', status: 'todo', priority: 'p2', projectId: 'inbox', plannedDate: '2026-10-18', subtasks: [], createdAt: 1 },
    ];
    // 6 days ago
    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000;

    const assessment = assessCleanSlateEligibility(fewTasks, sixDaysAgo, today);
    expect(assessment.shouldPromptCleanSlate).toBe(true);
    expect(assessment.reason).toBe('prolonged_absence');
    expect(assessment.daysAbsent).toBeGreaterThanOrEqual(5);
  });

  it('quarantines tasks into Someday backlog safely without data loss', () => {
    const tasks: Task[] = [
      { id: 't1', title: 'Overdue task', status: 'todo', priority: 'p1', projectId: 'work', plannedDate: '2026-10-10', dueDate: '2026-10-12', isPinnedToday: true, subtasks: [], createdAt: 1 },
      { id: 't2', title: 'Current task', status: 'todo', priority: 'p2', projectId: 'work', plannedDate: '2026-10-25', subtasks: [], createdAt: 2 },
    ];

    const result = quarantineTasks(tasks, ['t1']);
    expect(result.quarantinedCount).toBe(1);
    const quarantined = result.updatedTasks.find((t) => t.id === 't1')!;
    expect(quarantined.isSomeday).toBe(true);
    expect(quarantined.plannedDate).toBeUndefined();
    expect(quarantined.dueDate).toBeUndefined();
    expect(quarantined.isPinnedToday).toBe(false);

    // Untouched task
    const current = result.updatedTasks.find((t) => t.id === 't2')!;
    expect(current.plannedDate).toBe('2026-10-25');
  });
});
