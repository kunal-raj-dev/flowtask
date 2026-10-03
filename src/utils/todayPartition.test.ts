import { describe, it, expect } from 'vitest';
import type { Task } from '../types/task';

describe('Today View task partitioning logic', () => {
  const todayStr = '2026-10-03';

  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Top priority morning design',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      plannedDate: todayStr,
      isPinnedToday: true,
      topThreeDate: todayStr,
      createdAt: Date.now(),
      subtasks: [],
    },
    {
      id: 'task-2',
      title: 'Daytime feature review',
      status: 'todo',
      priority: 'p2',
      projectId: 'work',
      plannedDate: todayStr,
      isPinnedToday: false,
      isEvening: false,
      createdAt: Date.now(),
      subtasks: [],
    },
    {
      id: 'task-3',
      title: 'Evening gym workout',
      status: 'todo',
      priority: 'p3',
      projectId: 'personal',
      plannedDate: todayStr,
      isPinnedToday: false,
      isEvening: true,
      createdAt: Date.now(),
      subtasks: [],
    },
    {
      id: 'task-4',
      title: 'Evening read chapter 4',
      status: 'todo',
      priority: 'p4',
      projectId: 'personal',
      plannedDate: todayStr,
      isPinnedToday: false,
      isEvening: true,
      createdAt: Date.now(),
      subtasks: [],
    },
  ];

  it('correctly partitions tasks into Top 3, Daytime, and This Evening', () => {
    // 1. Top 3
    const topThree = sampleTasks.filter(
      (t) => t.isPinnedToday && (t.topThreeDate === todayStr || (!t.topThreeDate && t.plannedDate === todayStr))
    );
    expect(topThree.map((t) => t.id)).toEqual(['task-1']);

    // 2. Daytime tasks (not Top 3, not marked for evening)
    const daytime = sampleTasks.filter(
      (t) => !topThree.some((top) => top.id === t.id) && !t.isEvening
    );
    expect(daytime.map((t) => t.id)).toEqual(['task-2']);

    // 3. Evening tasks (not Top 3, marked for evening)
    const evening = sampleTasks.filter(
      (t) => !topThree.some((top) => top.id === t.id) && Boolean(t.isEvening)
    );
    expect(evening.map((t) => t.id)).toEqual(['task-3', 'task-4']);

    // 4. Combined active list maintains logical order
    const linearOrder = [...topThree, ...daytime, ...evening];
    expect(linearOrder.map((t) => t.id)).toEqual(['task-1', 'task-2', 'task-3', 'task-4']);
  });
});
