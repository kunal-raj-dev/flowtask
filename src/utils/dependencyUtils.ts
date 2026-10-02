import type { Task, Priority } from '../types/task';

export interface BlockedStatus {
  isBlocked: boolean;
  blockingTasks: Task[];
}

/**
 * Checks if a task is blocked by any unfinished tasks.
 */
export function isTaskBlocked(task: Task, allTasks: Task[]): BlockedStatus {
  if (!task.blockedBy || task.blockedBy.length === 0) {
    return { isBlocked: false, blockingTasks: [] };
  }

  const blockingTasks = allTasks.filter(
    (t) => task.blockedBy!.includes(t.id) && t.status !== 'done'
  );

  return {
    isBlocked: blockingTasks.length > 0,
    blockingTasks,
  };
}

/**
 * Returns tasks that can safely be assigned as blocking dependencies without circular loops.
 */
export function getPotentialBlockingCandidates(
  currentTaskId: string,
  allTasks: Task[]
): Task[] {
  return allTasks.filter((t) => {
    if (t.id === currentTaskId) return false;
    if (t.status === 'done') return false;
    // Check if `t` is blocked by `currentTaskId` (prevent 1-hop circular dependency)
    if (t.blockedBy && t.blockedBy.includes(currentTaskId)) return false;
    return true;
  });
}

const PRIORITY_RANKS: Record<Priority, number> = {
  p1: 4,
  p2: 3,
  p3: 2,
  p4: 1,
};

/**
 * Merge two tasks together into an updated target task.
 */
export function mergeTaskData(targetTask: Task, sourceTask: Task): Partial<Task> {
  // Combine descriptions
  let mergedDescription = targetTask.description || '';
  if (sourceTask.description?.trim()) {
    if (mergedDescription.trim()) {
      mergedDescription += `\n\n--- Merged Notes from "${sourceTask.title}" ---\n${sourceTask.description}`;
    } else {
      mergedDescription = sourceTask.description;
    }
  }

  // Combine subtasks with unique IDs
  const combinedSubtasks = [...targetTask.subtasks];
  sourceTask.subtasks.forEach((sub) => {
    combinedSubtasks.push({
      ...sub,
      id: `sub-merged-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    });
  });

  // Combine context tags
  const contextSet = new Set<string>();
  targetTask.contextTags?.forEach((ctx) => contextSet.add(ctx));
  sourceTask.contextTags?.forEach((ctx) => contextSet.add(ctx));
  const mergedContextTags = contextSet.size > 0 ? Array.from(contextSet) : undefined;

  // Higher priority wins
  const targetRank = PRIORITY_RANKS[targetTask.priority] || 1;
  const sourceRank = PRIORITY_RANKS[sourceTask.priority] || 1;
  const higherPriority: Priority = sourceRank > targetRank ? sourceTask.priority : targetTask.priority;

  // Combine estimated and spent minutes
  const mergedEstimated = (targetTask.estimatedMinutes || 0) + (sourceTask.estimatedMinutes || 0);
  const mergedSpent = (targetTask.timeSpentMinutes || 0) + (sourceTask.timeSpentMinutes || 0);

  return {
    description: mergedDescription,
    subtasks: combinedSubtasks,
    contextTags: mergedContextTags,
    priority: higherPriority,
    estimatedMinutes: mergedEstimated > 0 ? mergedEstimated : targetTask.estimatedMinutes,
    timeSpentMinutes: mergedSpent > 0 ? mergedSpent : targetTask.timeSpentMinutes,
  };
}
