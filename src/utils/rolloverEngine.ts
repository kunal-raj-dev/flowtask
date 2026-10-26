import type { Task, Project } from '../types/task';
import { isTodayTask, isTaskPinnedForDate } from './taskSelectors';
import { getEffectiveTaskEstimate } from './taskTimeSummary';

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

/**
 * Identifies unpinned, lowest-priority tasks planned for today that exceed capacity
 * to safely roll over to tomorrow and eliminate daily overload.
 */
export function identifySurplusTasksToRollover(
  tasks: Task[],
  todayStr: string,
  overbookedMinutes: number,
  projects: Project[] = []
): Task[] {
  if (overbookedMinutes <= 0) return [];

  const priorityRank: Record<string, number> = { p4: 0, p3: 1, p2: 2, p1: 3 };

  // Eligible tasks: planned for today, not done/deleted/archived, and not pinned
  const candidates = tasks.filter(
    (t) =>
      !t.deletedAt &&
      !t.archivedAt &&
      t.status !== 'done' &&
      !isTaskPinnedForDate(t, todayStr) &&
      !t.scheduleLocked &&
      !t.scheduledStart &&
      !(t.workBlocks || []).some(b => b.status !== 'cancelled' && b.status !== 'completed') &&
      !(t.dueDate && t.dueDate <= todayStr) &&
      isTodayTask(t, todayStr, { tasks, projects })
  );

  // Sort lowest priority first (p4 -> p3 -> p2 -> p1)
  // Tie-breaker: larger tasks first to efficiently clear overbooking
  candidates.sort((a, b) => {
    const rankA = priorityRank[a.priority || 'p4'] ?? 0;
    const rankB = priorityRank[b.priority || 'p4'] ?? 0;
    if (rankA !== rankB) return rankA - rankB;
    const durA = getEffectiveTaskEstimate(a) || 30;
    const durB = getEffectiveTaskEstimate(b) || 30;
    return durB - durA;
  });

  const surplus: Task[] = [];
  let accumulated = 0;

  for (const task of candidates) {
    surplus.push(task);
    accumulated += getEffectiveTaskEstimate(task) || 30;
    if (accumulated >= overbookedMinutes) {
      break;
    }
  }

  return surplus;
}

