import type { Task } from '../types/task';

export interface RolloverAnalysis {
  overdueTasks: Task[];
  staleTasks: Task[];
  quickWinTasks: Task[];
  totalEstimatedMinutes: number;
}

export function analyzeRolloverBatch(tasks: Task[], todayStr: string): RolloverAnalysis {
  const overdue = tasks.filter(
    (t) => !t.deletedAt && !t.archivedAt && t.status !== 'done' && t.plannedDate && t.plannedDate < todayStr
  );
  const stale = overdue.filter(
    (t) => (t.rolloverCount || 0) >= 3 || (Date.now() - t.createdAt > 7 * 86400000)
  );
  const quickWins = overdue.filter((t) => (t.estimatedMinutes || 30) <= 15);

  return {
    overdueTasks: overdue,
    staleTasks: stale,
    quickWinTasks: quickWins,
    totalEstimatedMinutes: overdue.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0),
  };
}
