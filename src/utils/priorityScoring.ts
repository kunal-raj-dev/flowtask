import type { Task, Priority } from '../types/task';
import { formatLocalDate } from './nlpParser';
import { isTaskBlocked } from './dependencyUtils';
import { checkTaskStaleness } from './staleTaskDetector';

export interface TaskPriorityScore {
  urgencyScore: number; // 0 - 50
  importanceScore: number; // 0 - 50
  compositeScore: number; // 0 - 100
  suggestedQuadrant: Priority;
  urgencyReason: string;
  importanceReason: string;
}

/**
 * Multi-Factor Priority Scoring Engine.
 * Evaluates urgency, importance, blocked status, deadline proximity, and staleness
 * to provide a comprehensive prioritization score and optimal Eisenhower quadrant suggestion.
 */
export function calculateTaskPriorityScore(
  task: Task,
  allTasks: Task[] = [],
  currentDate: Date = new Date()
): TaskPriorityScore {
  const todayStr = formatLocalDate(currentDate);

  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  const inThreeDays = new Date(currentDate);
  inThreeDays.setDate(inThreeDays.getDate() + 3);
  const inThreeDaysStr = formatLocalDate(inThreeDays);

  const inSevenDays = new Date(currentDate);
  inSevenDays.setDate(inSevenDays.getDate() + 7);
  const inSevenDaysStr = formatLocalDate(inSevenDays);

  // 1. Urgency Calculation (0 - 50 pts)
  let urgencyScore = 0;
  let urgencyReason = 'No upcoming deadline';

  const effectiveDate = task.dueDate || task.plannedDate;

  if (effectiveDate) {
    if (effectiveDate < todayStr && task.status !== 'done') {
      urgencyScore = 50;
      urgencyReason = 'Overdue deadline';
    } else if (effectiveDate === todayStr) {
      urgencyScore = 40;
      urgencyReason = 'Due today';
    } else if (effectiveDate === tomorrowStr) {
      urgencyScore = 30;
      urgencyReason = 'Due tomorrow';
    } else if (effectiveDate <= inThreeDaysStr) {
      urgencyScore = 20;
      urgencyReason = 'Due within 3 days';
    } else if (effectiveDate <= inSevenDaysStr) {
      urgencyScore = 12;
      urgencyReason = 'Due this week';
    } else {
      urgencyScore = 5;
      urgencyReason = 'Scheduled later';
    }
  } else if (task.priority === 'p1') {
    urgencyScore = 25;
    urgencyReason = 'Elevated by P1 priority';
  }

  // Quick win boost (tasks <= 15m get slight urgency boost for immediate completion)
  if (task.estimatedMinutes !== undefined && task.estimatedMinutes <= 15 && urgencyScore < 25) {
    urgencyScore += 5;
    urgencyReason += ' • Quick win';
  }

  // Dependency friction: Blocked tasks lose urgency since they cannot be executed immediately
  const blockedInfo = isTaskBlocked(task, allTasks);
  if (blockedInfo.isBlocked) {
    urgencyScore = Math.max(0, urgencyScore - 20);
    urgencyReason += ' (Blocked by dependency)';
  }

  // Cap urgency at 50
  urgencyScore = Math.min(50, Math.max(0, urgencyScore));

  // 2. Importance Calculation (0 - 50 pts)
  let importanceScore = 0;
  let importanceReason = 'Standard priority';

  switch (task.priority) {
    case 'p1':
      importanceScore = 40;
      importanceReason = 'Critical priority';
      break;
    case 'p2':
      importanceScore = 30;
      importanceReason = 'High priority';
      break;
    case 'p3':
      importanceScore = 18;
      importanceReason = 'Medium priority';
      break;
    case 'p4':
      importanceScore = 6;
      importanceReason = 'Low priority / Backlog';
      break;
  }

  // Starred Top 3 Focus boost
  if (task.isPinnedToday) {
    importanceScore += 10;
    importanceReason += ' • Top 3 Focus';
  }

  // Subtask progress commitment boost
  if (task.subtasks && task.subtasks.length > 0) {
    const completedCount = task.subtasks.filter((s) => s.completed).length;
    if (completedCount > 0) {
      importanceScore += 5;
      importanceReason += ' • In-progress momentum';
    }
  }

  // Fatigue / Staleness adjustment
  const staleInfo = checkTaskStaleness(task, currentDate);
  if (staleInfo.isStale) {
    importanceScore = Math.max(0, importanceScore - 5);
    importanceReason += ' • Stale review needed';
  }

  // Cap importance at 50
  importanceScore = Math.min(50, Math.max(0, importanceScore));

  // 3. Composite Score (0 - 100 pts)
  const compositeScore = Math.min(100, Math.max(0, urgencyScore + importanceScore));

  // 4. Suggested Quadrant
  // Thresholds: Urgency >= 25 = Urgent, Importance >= 25 = Important
  let suggestedQuadrant: Priority = 'p4';
  if (urgencyScore >= 25 && importanceScore >= 25) {
    suggestedQuadrant = 'p1'; // Q1: Urgent & Important (Do First)
  } else if (urgencyScore < 25 && importanceScore >= 25) {
    suggestedQuadrant = 'p2'; // Q2: Important, Not Urgent (Schedule)
  } else if (urgencyScore >= 25 && importanceScore < 25) {
    suggestedQuadrant = 'p3'; // Q3: Urgent, Not Important (Delegate/Quick Wins)
  } else {
    suggestedQuadrant = 'p4'; // Q4: Neither (Someday / Eliminate)
  }

  return {
    urgencyScore,
    importanceScore,
    compositeScore,
    suggestedQuadrant,
    urgencyReason,
    importanceReason,
  };
}
