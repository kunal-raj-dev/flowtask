import type { Task } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';

export interface CleanSlateAssessment {
  shouldPromptCleanSlate: boolean;
  overdueTasksCount: number;
  daysAbsent: number;
  reason: 'overdue_threshold' | 'prolonged_absence' | 'none';
}

/**
 * Calculates visual opacity decay on deferred tasks:
 * Opacity(task) = max(0.40, 1.0 - 0.12 * deferCount)
 */
export function calculateTaskOpacity(task: Task): number {
  const deferCount = task.rolloverCount || 0;
  if (deferCount <= 0) return 1.0;
  const decay = 1.0 - 0.12 * deferCount;
  return Math.max(0.40, Math.round(decay * 100) / 100);
}

/**
 * Identifies overdue tasks (plannedDate < today OR dueDate < today, uncompleted, not someday, not deleted).
 */
export function getOverdueTasks(tasks: Task[], todayStr?: string): Task[] {
  const today = todayStr || formatLocalDate(new Date());

  return tasks.filter((t) => {
    if (t.deletedAt || t.archivedAt || t.status === 'done' || t.isSomeday) return false;
    const effectiveDate = t.plannedDate || t.dueDate;
    if (!effectiveDate) return false;
    return effectiveDate < today;
  });
}

/**
 * Evaluates whether the user qualifies for the non-judgmental Clean Slate quarantine prompt.
 * Trigger criteria: > 15 overdue tasks OR 5+ days of absence.
 */
export function assessCleanSlateEligibility(
  tasks: Task[],
  lastActiveTimestamp?: number,
  todayStr?: string
): CleanSlateAssessment {
  const overdue = getOverdueTasks(tasks, todayStr);
  const now = Date.now();
  const daysAbsent = lastActiveTimestamp
    ? Math.max(0, Math.floor((now - lastActiveTimestamp) / (1000 * 60 * 60 * 24)))
    : 0;

  if (overdue.length > 15) {
    return {
      shouldPromptCleanSlate: true,
      overdueTasksCount: overdue.length,
      daysAbsent,
      reason: 'overdue_threshold',
    };
  }

  if (daysAbsent >= 5 && overdue.length > 0) {
    return {
      shouldPromptCleanSlate: true,
      overdueTasksCount: overdue.length,
      daysAbsent,
      reason: 'prolonged_absence',
    };
  }

  return {
    shouldPromptCleanSlate: false,
    overdueTasksCount: overdue.length,
    daysAbsent,
    reason: 'none',
  };
}

/**
 * 1-click bulk quarantine: moves all overdue tasks to the "Someday Parking Lot",
 * clearing overdue shame with zero data loss.
 */
export function quarantineTasks(
  tasks: Task[],
  targetTaskIds?: string[]
): { quarantinedCount: number; updatedTasks: Task[] } {
  const targetSet = targetTaskIds ? new Set(targetTaskIds) : null;
  let quarantinedCount = 0;

  const updatedTasks = tasks.map((task) => {
    const shouldQuarantine = targetSet ? targetSet.has(task.id) : true;
    if (shouldQuarantine && !task.deletedAt && !task.archivedAt && task.status !== 'done') {
      quarantinedCount += 1;
      return {
        ...task,
        isSomeday: true,
        plannedDate: undefined,
        dueDate: undefined,
        isPinnedToday: false,
        updatedAt: Date.now(),
      };
    }
    return task;
  });

  return {
    quarantinedCount,
    updatedTasks,
  };
}
