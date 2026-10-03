import type { Task, Project } from '../types/task';
import { wouldCreateCycle } from './dependencyUtils';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const idValid = (value: unknown): value is string => typeof value === 'string' && /^[^/\s]{1,200}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
export const isSafeUrl = (value: string) => { try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; } };
function fail(message: string): never { throw new Error(message); }
function validateDate(value: unknown, label: string) {
  if (value === undefined || value === '') return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(`${label}: use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(`${label}: invalid calendar date.`);
}
export function validateWorkspaceData(rawTasks: unknown, rawProjects: unknown): { tasks: Task[]; projects: Project[] } {
  if (!Array.isArray(rawTasks) || !Array.isArray(rawProjects)) fail('Backup must contain tasks and projects arrays.');
  if (rawTasks.length > 100000) fail('This backup exceeds 100,000 tasks. Split it into smaller imports.');
  const projectIds = new Set<string>();
  const projects: Project[] = rawProjects.map((p, i) => {
    if (!object(p) || !idValid(p.id) || typeof p.name !== 'string' || !p.name.trim()) fail(`Project ${i + 1}: valid ID and name required.`);
    if (projectIds.has(p.id)) fail(`Duplicate project ID: ${p.id}`);
    projectIds.add(p.id);
    return { ...p, name: p.name.trim(), color: typeof p.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : '#64748B' } as unknown as Project;
  });
  if (!projectIds.has('inbox')) { projects.unshift({ id: 'inbox', name: 'Inbox', color: '#64748B' }); projectIds.add('inbox'); }
  const taskIds = new Set<string>();
  const tasks: Task[] = rawTasks.map((t, i) => {
    const label = `Task ${i + 1}`;
    if (!object(t) || !idValid(t.id) || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 10000) fail(`${label}: valid ID and title required.`);
    if (taskIds.has(t.id)) fail(`Duplicate task ID: ${t.id}`);
    taskIds.add(t.id);
    if (!['todo', 'in_progress', 'done'].includes(String(t.status)) || !['p1', 'p2', 'p3', 'p4'].includes(String(t.priority))) fail(`${label}: invalid status or priority.`);
    if (!projectIds.has(String(t.projectId))) fail(`${label}: project "${t.projectId}" is missing. Include its project in the backup.`);
    if (typeof t.createdAt !== 'number' || !Number.isFinite(t.createdAt) || t.createdAt < 0) fail(`${label}: invalid creation timestamp.`);
    for (const key of ['plannedDate', 'dueDate', 'topThreeDate']) validateDate(t[key], `${label} ${key}`);
    for (const key of ['dueTime', 'scheduledStart', 'scheduledEnd']) if (t[key] !== undefined && t[key] !== '' && (typeof t[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t[key] as string))) fail(`${label}: invalid ${key}.`);
    for (const key of ['estimatedMinutes', 'timeSpentMinutes', 'updatedAt', 'completedAt', 'deletedAt', 'archivedAt', 'revision']) if (t[key] !== undefined && (typeof t[key] !== 'number' || !Number.isFinite(t[key]) || (t[key] as number) < 0)) fail(`${label}: invalid ${key}.`);
    if (t.recurrence !== undefined && !['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom'].includes(String(t.recurrence))) fail(`${label}: invalid recurrence.`);
    if (t.recurrence === 'custom') {
      const rule = t.customRecurrence;
      if (!object(rule) || !Number.isInteger(rule.interval) || (rule.interval as number) < 1 || !['days', 'weeks', 'months'].includes(String(rule.unit))) fail(`${label}: invalid custom recurrence.`);
    }
    for (const key of ['tags', 'contextTags', 'blockedBy']) if (t[key] !== undefined && (!Array.isArray(t[key]) || !(t[key] as unknown[]).every(x => typeof x === 'string'))) fail(`${label}: invalid ${key}.`);
    const subIds = new Set<string>();
    const subs = t.subtasks === undefined ? [] : t.subtasks;
    if (!Array.isArray(subs)) fail(`${label}: subtasks must be an array.`);
    for (const s of subs) {
      if (!object(s) || !idValid(s.id) || subIds.has(s.id) || typeof s.title !== 'string' || !s.title.trim() || typeof s.completed !== 'boolean') fail(`${label}: invalid or duplicate subtask.`);
      subIds.add(s.id);
      if (s.url && (typeof s.url !== 'string' || !isSafeUrl(s.url))) fail(`${label}: subtask links must use http or https.`);
      if (s.estimatedMinutes !== undefined && (typeof s.estimatedMinutes !== 'number' || !Number.isFinite(s.estimatedMinutes) || s.estimatedMinutes < 0)) fail(`${label}: invalid subtask duration.`);
    }
    return { ...t, title: t.title.trim(), subtasks: subs } as unknown as Task;
  });
  for (const task of tasks) for (const blocker of task.blockedBy || []) {
    if (!taskIds.has(blocker)) fail(`Task "${task.title}" references a missing dependency.`);
    if (wouldCreateCycle(task.id, blocker, tasks)) fail(`Task "${task.title}" has a circular dependency.`);
  }
  return { tasks, projects };
}
