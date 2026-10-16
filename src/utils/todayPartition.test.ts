import { describe, it, expect } from 'vitest';
import type { Task } from '../types/task';
import { partitionTodayTasks } from './todayPartition';

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

  it('correctly partitions tasks into Top 3, Daytime, and This Evening via partitionTodayTasks', () => {
    const { topThreeTasks, daytimeTasks, eveningTasks } = partitionTodayTasks(sampleTasks, todayStr);

    expect(topThreeTasks.map((t) => t.id)).toEqual(['task-1']);
    expect(daytimeTasks.map((t) => t.id)).toEqual(['task-2']);
    expect(eveningTasks.map((t) => t.id)).toEqual(['task-3', 'task-4']);

    const linearOrder = [...topThreeTasks, ...daytimeTasks, ...eveningTasks];
    expect(linearOrder.map((t) => t.id)).toEqual(['task-1', 'task-2', 'task-3', 'task-4']);
  });
});
