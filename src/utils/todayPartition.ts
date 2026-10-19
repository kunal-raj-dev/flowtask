import type { Task } from '../types/task';

export interface TodayPartitionedTasks {
  topThreeTasks: Task[];
  daytimeTasks: Task[];
  eveningTasks: Task[];
}

/**
 * Pure function to partition active today tasks into:
 * 1. Top 3 MITs (pinned today with matching topThreeDate or plannedDate)
 * 2. Daytime tasks (not in Top 3, not flagged as evening)
 * 3. This Evening tasks (not in Top 3, marked as evening)
 */
export function partitionTodayTasks(tasks: Task[], todayStr: string): TodayPartitionedTasks {
  const topThreeTasks = tasks.filter(
    (t) =>
      t.isPinnedToday &&
      (t.topThreeDate === todayStr || (!t.topThreeDate && (t.plannedDate === todayStr || (!t.plannedDate && t.dueDate === todayStr))))
  );

  const topThreeIds = new Set(topThreeTasks.map((t) => t.id));

  const daytimeTasks = tasks.filter(
    (t) => !topThreeIds.has(t.id) && !t.isEvening
  );

  const eveningTasks = tasks.filter(
    (t) => !topThreeIds.has(t.id) && Boolean(t.isEvening)
  );

  return {
    topThreeTasks,
    daytimeTasks,
    eveningTasks,
  };
}
