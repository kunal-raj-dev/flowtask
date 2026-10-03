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
 * Checks if setting `candidateId` as a blocker for `taskId` would create a circular dependency
 * across the entire dependency graph (supports arbitrary N-hop cycles).
 */
export function wouldCreateCycle(
  taskId: string,
  candidateId: string,
  allTasks: Task[]
): boolean {
  if (taskId === candidateId) return true;

  const taskMap = new Map<string, Task>();
  allTasks.forEach((t) => taskMap.set(t.id, t));

  const visited = new Set<string>();
  const queue = [candidateId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === taskId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const currentTask = taskMap.get(currentId);
    if (currentTask?.blockedBy && currentTask.blockedBy.length > 0) {
      for (const blockerId of currentTask.blockedBy) {
        if (!visited.has(blockerId)) {
          queue.push(blockerId);
        }
      }
    }
  }

  return false;
}

/**
 * Returns tasks that can safely be assigned as blocking dependencies without circular loops (full graph checked).
 */
export function getPotentialBlockingCandidates(
  currentTaskId: string,
  allTasks: Task[]
): Task[] {
  return allTasks.filter((t) => {
    if (t.id === currentTaskId) return false;
    if (t.status === 'done') return false;
    if (wouldCreateCycle(currentTaskId, t.id, allTasks)) return false;
    return true;
  });
}

const PRIORITY_RANKS: Record<Priority, number> = {
  p1: 4,
  p2: 3,
  p3: 2,
  p4: 1,
};

export interface MergeConflict {
  field: string;
  targetValue: unknown;
  sourceValue: unknown;
  resolvedValue: unknown;
}

export interface MergePreviewResult {
  combinedTaskUpdates: Partial<Task>;
  conflicts: MergeConflict[];
  redirectedTasks: Array<{ taskId: string; title: string }>;
}

/**
 * Generates a comprehensive merge preview including conflicting fields and dependency redirects.
 */
export function getMergePreview(
  targetTask: Task,
  sourceTask: Task,
  allTasks: Task[]
): MergePreviewResult {
  const conflicts: MergeConflict[] = [];

  if (targetTask.projectId !== sourceTask.projectId) {
    conflicts.push({
      field: 'Project',
      targetValue: targetTask.projectId,
      sourceValue: sourceTask.projectId,
      resolvedValue: targetTask.projectId,
    });
  }

  if (targetTask.priority !== sourceTask.priority) {
    const targetRank = PRIORITY_RANKS[targetTask.priority] || 1;
    const sourceRank = PRIORITY_RANKS[sourceTask.priority] || 1;
    const higher = sourceRank > targetRank ? sourceTask.priority : targetTask.priority;
    conflicts.push({
      field: 'Priority',
      targetValue: targetTask.priority.toUpperCase(),
      sourceValue: sourceTask.priority.toUpperCase(),
      resolvedValue: higher.toUpperCase(),
    });
  }

  if (targetTask.dueDate !== sourceTask.dueDate) {
    conflicts.push({
      field: 'Due Date',
      targetValue: targetTask.dueDate || 'None',
      sourceValue: sourceTask.dueDate || 'None',
      resolvedValue: targetTask.dueDate || sourceTask.dueDate || 'None',
    });
  }

  // Find other tasks blocked by sourceTask that need to redirect to targetTask
  const redirectedTasks: Array<{ taskId: string; title: string }> = [];
  allTasks.forEach((t) => {
    if (t.id !== targetTask.id && t.id !== sourceTask.id && t.blockedBy?.includes(sourceTask.id)) {
      redirectedTasks.push({ taskId: t.id, title: t.title });
    }
  });

  const combinedTaskUpdates = mergeTaskData(targetTask, sourceTask);
  if (!targetTask.plannedDate && sourceTask.plannedDate) {
    combinedTaskUpdates.plannedDate = sourceTask.plannedDate;
  }
  if (!targetTask.dueDate && sourceTask.dueDate) {
    combinedTaskUpdates.dueDate = sourceTask.dueDate;
  }

  return {
    combinedTaskUpdates,
    conflicts,
    redirectedTasks,
  };
}

/**
 * Redirects incoming dependencies from an old task ID to a new task ID.
 */
export function redirectDependencies(
  allTasks: Task[],
  oldId: string,
  newId: string
): Task[] {
  return allTasks.map((t) => {
    if (t.blockedBy && t.blockedBy.includes(oldId)) {
      const updatedBlockedBy = t.blockedBy.map((id) => (id === oldId ? newId : id));
      const unique = Array.from(new Set(updatedBlockedBy)).filter((id) => id !== t.id);
      return { ...t, blockedBy: unique };
    }
    return t;
  });
}

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

