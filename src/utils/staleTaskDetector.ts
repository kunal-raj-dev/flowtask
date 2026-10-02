import type { Task } from '../types/task';
import { formatLocalDate } from './nlpParser';

export interface StaleTaskInfo {
  isStale: boolean;
  reason?: 'overdue_multiple_days' | 'long_pending';
  daysOverdue?: number;
  daysSinceCreation?: number;
}

/**
 * Evaluates whether a task exhibits avoidance/rollover fatigue.
 * Pure utility function with deterministic criteria.
 */
export function checkTaskStaleness(task: Task, referenceDate: Date = new Date()): StaleTaskInfo {
  if (task.status === 'done') {
    return { isStale: false };
  }

  const todayStr = formatLocalDate(referenceDate);

  // 1. Check if dueDate is overdue by 3 or more days
  if (task.dueDate && task.dueDate < todayStr) {
    const [dueY, dueM, dueD] = task.dueDate.split('-').map(Number);
    const dueDateObj = new Date(dueY, dueM - 1, dueD);
    const diffTime = referenceDate.getTime() - dueDateObj.getTime();
    const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (daysOverdue >= 3) {
      return {
        isStale: true,
        reason: 'overdue_multiple_days',
        daysOverdue,
      };
    }
  }

  // 2. Check if task was created 14+ days ago and still pending without recent updates
  if (task.createdAt) {
    const ageDays = Math.floor((referenceDate.getTime() - task.createdAt) / (1000 * 60 * 60 * 24));
    if (ageDays >= 14 && (!task.dueDate || task.dueDate <= todayStr)) {
      return {
        isStale: true,
        reason: 'long_pending',
        daysSinceCreation: ageDays,
      };
    }
  }

  return { isStale: false };
}
