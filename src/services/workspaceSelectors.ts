import type { Task, Project } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';

/**
 * Checks if a task is deferred to a future date or time.
 * A task is deferred if t_now < t_defer.
 */
export function isTaskDeferred(task: Task, nowInput?: Date | number): boolean {
  if (!task.deferUntil) return false;

  const now = typeof nowInput === 'number' ? nowInput : nowInput ? nowInput.getTime() : Date.now();
  const todayStr = formatLocalDate(new Date(now));

  // If deferUntil is formatted as YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(task.deferUntil)) {
    return task.deferUntil > todayStr;
  }

  // If deferUntil is ISO 8601 UTC timestamp or date-time string
  const deferTime = Date.parse(task.deferUntil);
  if (!isNaN(deferTime)) {
    return deferTime > now;
  }

  return false;
}

/**
 * Checks if a task is blocked:
 * 1. Blocked by a direct predecessor (predecessorTaskId or blockedBy) that is not completed.
 * 2. Blocked by sequential execution order within a sequential project (isSequential = true).
 *    In a sequential project, only the first incomplete task is actionable.
 */
export function isTaskBlocked(task: Task, allTasks: Task[], projects: Project[] = []): boolean {
  if (task.status === 'done' || task.deletedAt || task.archivedAt) return false;

  // Direct predecessor dependency
  if (task.predecessorTaskId) {
    const predecessor = allTasks.find(
      (t) => t.id === task.predecessorTaskId && !t.deletedAt && !t.archivedAt
    );
    if (predecessor && predecessor.status !== 'done') {
      return true;
    }
  }

  // Explicit blockedBy list
  if (task.blockedBy && task.blockedBy.length > 0) {
    const hasUncompletedBlocker = task.blockedBy.some((blockerId) => {
      const blocker = allTasks.find(
        (t) => t.id === blockerId && !t.deletedAt && !t.archivedAt
      );
      return blocker && blocker.status !== 'done';
    });
    if (hasUncompletedBlocker) return true;
  }

  // Sequential project DAG ordering
  if (task.projectId && task.projectId !== 'inbox') {
    const project = projects.find((p) => p.id === task.projectId);
    if (project?.isSequential) {
      // Find all active uncompleted tasks in this sequential project
      const projectTasks = allTasks
        .filter(
          (t) =>
            t.projectId === task.projectId &&
            !t.deletedAt &&
            !t.archivedAt &&
            t.status !== 'done'
        )
        .sort((a, b) => a.createdAt - b.createdAt);

      if (projectTasks.length > 0) {
        const firstActionableTask = projectTasks[0];
        // If this task is not the first incomplete task in the sequence, it is blocked
        if (task.id !== firstActionableTask.id) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Determines whether a task is actionable and available right now:
 * Not completed, not deleted, not archived, not someday, not deferred, and not blocked.
 */
export function isActionableTask(
  task: Task,
  allTasks: Task[],
  projects: Project[] = [],
  now?: Date | number
): boolean {
  if (task.status === 'done' || task.deletedAt || task.archivedAt || task.isSomeday) {
    return false;
  }
  if (isTaskDeferred(task, now)) {
    return false;
  }
  if (isTaskBlocked(task, allTasks, projects)) {
    return false;
  }
  return true;
}

/**
 * Returns only the available, actionable tasks for GTD Next Actions / Workstation stream.
 */
export function getAvailableTasks(
  tasks: Task[],
  projects: Project[] = [],
  now?: Date | number
): Task[] {
  return tasks.filter((t) => isActionableTask(t, tasks, projects, now));
}

/**
 * Returns tasks currently in the deferred holding zone (t_now < t_defer).
 */
export function getDeferredTasks(tasks: Task[], now?: Date | number): Task[] {
  return tasks.filter((t) => {
    if (t.deletedAt || t.archivedAt || t.status === 'done') return false;
    return isTaskDeferred(t, now);
  });
}

/**
 * Returns tasks currently blocked by incomplete predecessors or sequential ordering.
 */
export function getBlockedTasks(tasks: Task[], projects: Project[] = []): Task[] {
  return tasks.filter((t) => {
    if (t.deletedAt || t.archivedAt || t.status === 'done') return false;
    return isTaskBlocked(t, tasks, projects);
  });
}
