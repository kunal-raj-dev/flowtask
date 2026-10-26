import type { Task, Project } from '../types/task';
import { getTaskEligibility, getTaskBlockerIds, isDeferred } from '../utils/taskEligibility';

/** Compatibility adapters; domain eligibility lives in one shared pure module. */
export function isTaskDeferred(task: Task, now?: Date | number): boolean {
  return isDeferred(task, { now });
}
export function isTaskBlocked(task: Task, tasks: Task[], projects: Project[] = []): boolean {
  return getTaskBlockerIds(task, { tasks, projects }).length > 0;
}
export function isActionableTask(task: Task, tasks: Task[], projects: Project[] = [], now?: Date | number): boolean {
  return getTaskEligibility(task, { tasks, projects, now }).actionable;
}
export function getAvailableTasks(tasks: Task[], projects: Project[] = [], now?: Date | number): Task[] {
  return tasks.filter(task => isActionableTask(task, tasks, projects, now));
}
export function getDeferredTasks(tasks: Task[], now?: Date | number): Task[] {
  return tasks.filter(task => !task.deletedAt && !task.archivedAt && task.status !== 'done' && isTaskDeferred(task, now));
}
export function getBlockedTasks(tasks: Task[], projects: Project[] = []): Task[] {
  return tasks.filter(task => !task.deletedAt && !task.archivedAt && task.status !== 'done' && isTaskBlocked(task, tasks, projects));
}
