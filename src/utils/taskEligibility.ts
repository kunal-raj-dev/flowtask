import type { Project, Task } from '../types/task';
import { formatLocalDate } from './nlpParser';
import { clockInTimezone } from './zonedTime';

export interface TaskEligibilityContext {
  tasks?: Task[];
  projects?: Project[];
  now?: Date | number;
  date?: string;
  timezone?: string;
}
export type EligibilityReason = 'deleted' | 'archived' | 'completed' | 'someday' | 'deferred' | 'dependency' | 'project_archived';
export interface TaskEligibility {
  actionable: boolean;
  reason?: EligibilityReason;
  blockerIds: string[];
}

export function isDeferred(task: Task, context: TaskEligibilityContext = {}): boolean {
  if (!task.deferUntil) return false;
  const now = context.now instanceof Date ? context.now.getTime() : context.now ?? Date.now();
  if (/^\d{4}-\d{2}-\d{2}$/.test(task.deferUntil)) {
    const date = context.date ?? (context.timezone ? clockInTimezone(now, context.timezone).date : formatLocalDate(new Date(now)));
    return task.deferUntil > date;
  }
  // A supplied planning day must not be mixed with the machine's current date.
  const threshold = Date.parse(task.deferUntil);
  if (!Number.isFinite(threshold)) return false;
  if (context.date && context.now === undefined) {
    const deferredDate = context.timezone ? clockInTimezone(threshold, context.timezone).date : formatLocalDate(new Date(threshold));
    const currentDate = context.timezone ? clockInTimezone(now, context.timezone).date : formatLocalDate(new Date(now));
    if (context.date !== currentDate) return deferredDate > context.date;
  }
  return threshold > now;
}

export function getTaskBlockerIds(task: Task, context: TaskEligibilityContext = {}): string[] {
  if (task.status === 'done' || task.deletedAt || task.archivedAt) return [];
  const explicit = [...new Set([...(task.blockedBy ?? []), ...(task.predecessorTaskId ? [task.predecessorTaskId] : [])])];
  // A context-free caller cannot assume a dependency is complete.
  const blockers = context.tasks ? explicit.filter(id => context.tasks!.some(t => t.id === id && t.status !== 'done' && !t.deletedAt && !t.archivedAt)) : explicit;
  const project = context.projects?.find(p => p.id === task.projectId);
  if (project?.isSequential && context.tasks) {
    // Preserve legacy ordering until a separately versioned explicit-order migration.
    const first = context.tasks.filter(t => t.projectId === project.id && t.status !== 'done' && !t.deletedAt && !t.archivedAt)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0];
    if (first && first.id !== task.id) blockers.push(first.id);
  }
  return [...new Set(blockers)];
}

export function getTaskEligibility(task: Task, context: TaskEligibilityContext = {}): TaskEligibility {
  const unavailable = (reason: EligibilityReason, blockerIds: string[] = []): TaskEligibility => ({ actionable: false, reason, blockerIds });
  if (task.deletedAt) return unavailable('deleted');
  if (task.archivedAt) return unavailable('archived');
  if (task.status === 'done') return unavailable('completed');
  if (task.isSomeday) return unavailable('someday');
  if (context.projects?.some(p => p.id === task.projectId && (p.isArchived || p.archivedAt))) return unavailable('project_archived');
  if (isDeferred(task, context)) return unavailable('deferred');
  const blockers = getTaskBlockerIds(task, context);
  return blockers.length ? unavailable('dependency', blockers) : { actionable: true, blockerIds: [] };
}

export function eligibilityMessage(result: TaskEligibility): string {
  switch (result.reason) {
    case 'dependency': return 'Waiting for an unfinished dependency.';
    case 'deferred': return 'This task is not available until its defer date.';
    case 'someday': return 'Choose a day for this someday task before starting focus.';
    case 'project_archived': return 'Restore this task’s project before starting work.';
    default: return 'This task is no longer active.';
  }
}
