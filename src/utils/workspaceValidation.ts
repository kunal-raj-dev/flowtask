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
  if (rawProjects.length > 10000) fail('This backup exceeds 10,000 projects. Split it into smaller imports.');
  const projectIds = new Set<string>();
  const projects: Project[] = rawProjects.map((p, i) => {
    if (!object(p) || !idValid(p.id) || typeof p.name !== 'string' || !p.name.trim()) fail(`Project ${i + 1}: valid ID and name required.`);
    if (projectIds.has(p.id)) fail(`Duplicate project ID: ${p.id}`);
    projectIds.add(p.id);
    if (p.coverAssetId !== undefined && (typeof p.coverAssetId !== 'string' || !idValid(p.coverAssetId))) fail(`Project ${p.name}: invalid cover image reference.`);
    let coverFocalPoint: { x: number; y: number } | undefined;
    if (p.coverFocalPoint !== undefined) {
      if (!object(p.coverFocalPoint) || typeof p.coverFocalPoint.x !== 'number' || !Number.isFinite(p.coverFocalPoint.x) || typeof p.coverFocalPoint.y !== 'number' || !Number.isFinite(p.coverFocalPoint.y)) fail(`Project ${p.name}: invalid cover focal point.`);
      coverFocalPoint = { x: Math.round(Math.max(0, Math.min(100, p.coverFocalPoint.x))), y: Math.round(Math.max(0, Math.min(100, p.coverFocalPoint.y))) };
    }
    if (p.milestones !== undefined && (!Array.isArray(p.milestones) || p.milestones.length > 100)) fail(`Project ${p.name}: milestones must be a list of at most 100 items.`);
    const milestoneIds = new Set<string>();
    const milestones = (p.milestones || []).map((item, index) => {
      if (!object(item) || !idValid(item.id) || milestoneIds.has(item.id) || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 500 || !Number.isInteger(item.order) || (item.order as number) < 0) fail(`Project ${p.name}: invalid milestone ${index + 1}.`);
      milestoneIds.add(item.id);
      validateDate(item.dueDate, `Project ${p.name} milestone date`);
      if (item.completedAt !== undefined && (typeof item.completedAt !== 'number' || !Number.isFinite(item.completedAt) || item.completedAt < 0)) fail(`Project ${p.name}: invalid milestone completion time.`);
      if (item.skippedAt !== undefined && (typeof item.skippedAt !== 'number' || !Number.isFinite(item.skippedAt) || item.skippedAt < 0)) fail(`Project ${p.name}: invalid milestone skip time.`);
      return { id: item.id, title: item.title.trim(), order: item.order as number, ...(typeof item.dueDate === 'string' && item.dueDate ? { dueDate: item.dueDate } : {}), ...(typeof item.completedAt === 'number' ? { completedAt: item.completedAt } : {}), ...(typeof item.skippedAt === 'number' ? { skippedAt: item.skippedAt } : {}) };
    });
    return { ...p, name: p.name.trim(), color: typeof p.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(p.color) ? p.color : '#64748B', ...(p.milestones !== undefined ? { milestones } : {}), ...(coverFocalPoint ? { coverFocalPoint } : {}) } as unknown as Project;
  });
  if (!projectIds.has('inbox')) { projects.unshift({ id: 'inbox', name: 'Inbox', color: '#64748B' }); projectIds.add('inbox'); }
  const taskIds = new Set<string>();
  const tasks: Task[] = rawTasks.map((t, i) => {
    const label = `Task ${i + 1}`;
    if (!object(t) || !idValid(t.id) || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 10000) fail(`${label}: valid ID and title required.`);
    if (taskIds.has(t.id)) fail(`Duplicate task ID: ${t.id}`);
    taskIds.add(t.id);
    if (t.originNoteId !== undefined && !idValid(t.originNoteId)) fail(`${label}: invalid source note.`);
    if (!['todo', 'in_progress', 'done'].includes(String(t.status)) || !['p1', 'p2', 'p3', 'p4'].includes(String(t.priority))) fail(`${label}: invalid status or priority.`);
    let projectId = typeof t.projectId === 'string' && t.projectId ? t.projectId : 'inbox';
    let isSomeday = Boolean(t.isSomeday);
    if (projectId === 'ideas') {
      isSomeday = true;
      if (!projectIds.has('ideas')) {
        projectId = 'inbox';
      }
    } else if (!projectIds.has(projectId)) {
      projectId = 'inbox';
    }
    const createdAt = typeof t.createdAt === 'string' ? Date.parse(t.createdAt) : t.createdAt;
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt) || createdAt < 0) fail(`${label}: invalid creation timestamp.`);
    for (const key of ['plannedDate', 'dueDate', 'topThreeDate']) validateDate(t[key], `${label} ${key}`);
    for (const key of ['dueTime', 'scheduledStart', 'scheduledEnd']) if (t[key] !== undefined && t[key] !== '' && (typeof t[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t[key] as string))) fail(`${label}: invalid ${key}.`);
    const coerceTimestamp = (val: unknown): unknown => {
      if (typeof val === 'string') {
        const parsed = Date.parse(val);
        if (Number.isFinite(parsed)) return parsed;
      }
      return val;
    };
    const updatedAt = coerceTimestamp(t.updatedAt);
    const completedAt = coerceTimestamp(t.completedAt);
    const deletedAt = coerceTimestamp(t.deletedAt);
    const archivedAt = coerceTimestamp(t.archivedAt);
    const timeChecked: Record<string, unknown> = {
      estimatedMinutes: t.estimatedMinutes,
      timeSpentMinutes: t.timeSpentMinutes,
      updatedAt,
      completedAt,
      deletedAt,
      archivedAt,
      revision: t.revision,
      rolloverCount: t.rolloverCount,
      lastRolledOverAt: t.lastRolledOverAt,
      bufferMinutes: t.bufferMinutes,
    };
    for (const key of ['estimatedMinutes', 'timeSpentMinutes', 'updatedAt', 'completedAt', 'deletedAt', 'archivedAt', 'revision', 'rolloverCount', 'lastRolledOverAt', 'bufferMinutes']) if (timeChecked[key] !== undefined && (typeof timeChecked[key] !== 'number' || !Number.isFinite(timeChecked[key] as number) || (timeChecked[key] as number) < 0)) fail(`${label}: invalid ${key}.`);
    if (t.isAutoTriaged !== undefined && typeof t.isAutoTriaged !== 'boolean') fail(`${label}: invalid isAutoTriaged.`);
    if (t.recurrence !== undefined && !['none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom'].includes(String(t.recurrence))) fail(`${label}: invalid recurrence.`);
    if (t.recurrence === 'custom') {
      const rule = t.customRecurrence;
      if (!object(rule) || !Number.isInteger(rule.interval) || (rule.interval as number) < 1 || !['days', 'weeks', 'months'].includes(String(rule.unit))) fail(`${label}: invalid custom recurrence.`);
    }
    for (const key of ['tags', 'contextTags', 'blockedBy']) if (t[key] !== undefined && (!Array.isArray(t[key]) || !(t[key] as unknown[]).every(x => typeof x === 'string'))) fail(`${label}: invalid ${key}.`);
    if (t.milestoneId !== undefined && (typeof t.milestoneId !== 'string' || !idValid(t.milestoneId))) fail(`${label}: invalid milestone reference.`);
    const subIds = new Set<string>();
    const subs = t.subtasks === undefined ? [] : t.subtasks;
    if (!Array.isArray(subs)) fail(`${label}: subtasks must be an array.`);
    for (const s of subs) {
      if (!object(s) || !idValid(s.id) || subIds.has(s.id) || typeof s.title !== 'string' || !s.title.trim() || typeof s.completed !== 'boolean') fail(`${label}: invalid or duplicate subtask.`);
      subIds.add(s.id);
      if (s.url && (typeof s.url !== 'string' || !isSafeUrl(s.url))) fail(`${label}: subtask links must use http or https.`);
      if (s.estimatedMinutes !== undefined && (typeof s.estimatedMinutes !== 'number' || !Number.isFinite(s.estimatedMinutes) || s.estimatedMinutes < 0)) fail(`${label}: invalid subtask duration.`);
    }
    return {
      ...t,
      title: t.title.trim(),
      projectId,
      isSomeday,
      createdAt,
      ...(updatedAt !== undefined ? { updatedAt } : {}),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(deletedAt !== undefined ? { deletedAt } : {}),
      ...(archivedAt !== undefined ? { archivedAt } : {}),
      subtasks: subs,
    } as unknown as Task;
  });
  for (const task of tasks) for (const blocker of task.blockedBy || []) {
    if (!taskIds.has(blocker)) fail(`Task "${task.title}" references a missing dependency.`);
    if (wouldCreateCycle(task.id, blocker, tasks)) fail(`Task "${task.title}" has a circular dependency.`);
  }
  const milestonesByProject = new Map(projects.map(project => [project.id, new Set((project.milestones || []).map(milestone => milestone.id))]));
  for (const task of tasks) if (task.milestoneId && !milestonesByProject.get(task.projectId)?.has(task.milestoneId)) fail(`Task "${task.title}" references a missing project milestone.`);
  return { tasks, projects };
}

import type { Area } from '../types/area';
import type { Goal, GoalStatus } from '../types/goal';
import type { Routine, RoutineRun } from '../types/routine';
import type { WorkBlock, WorkBlockStatus } from '../types/task';
import type { ReviewEntry } from '../types/review';

export function validateAreas(raw: unknown): Area[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail('Areas must be an array.');
  if (raw.length > 1000) fail('Areas collection exceeds maximum of 1,000 items.');
  const ids = new Set<string>();
  return raw.map((a, i) => {
    const label = `Area ${i + 1}`;
    if (!object(a) || !idValid(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 200) {
      fail(`${label}: valid ID and name required.`);
    }
    if (ids.has(a.id)) fail(`Duplicate area ID: ${a.id}`);
    ids.add(a.id);
    return {
      id: a.id,
      name: a.name.trim(),
      description: typeof a.description === 'string' ? a.description.slice(0, 1000) : undefined,
      color: typeof a.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(a.color) ? a.color : undefined,
      icon: typeof a.icon === 'string' ? a.icon.slice(0, 50) : undefined,
      sortOrder: typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder) ? Math.max(0, a.sortOrder) : i,
      archivedAt: typeof a.archivedAt === 'number' && Number.isFinite(a.archivedAt) ? Math.max(0, a.archivedAt) : undefined,
      revision: typeof a.revision === 'number' && Number.isFinite(a.revision) ? Math.max(1, a.revision) : 1,
      createdAt: typeof a.createdAt === 'number' && Number.isFinite(a.createdAt) ? a.createdAt : Date.now(),
      updatedAt: typeof a.updatedAt === 'number' && Number.isFinite(a.updatedAt) ? a.updatedAt : Date.now(),
    };
  });
}

export function validateGoals(raw: unknown): Goal[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail('Goals must be an array.');
  if (raw.length > 1000) fail('Goals collection exceeds maximum of 1,000 items.');
  const ids = new Set<string>();
  return raw.map((g, i) => {
    const label = `Goal ${i + 1}`;
    if (!object(g) || !idValid(g.id) || typeof g.title !== 'string' || !g.title.trim() || g.title.length > 300) {
      fail(`${label}: valid ID and title required.`);
    }
    if (ids.has(g.id)) fail(`Duplicate goal ID: ${g.id}`);
    ids.add(g.id);

    let status: GoalStatus = 'not_started';
    const rawStatus = String(g.status || 'not_started');
    if (rawStatus === 'active' || rawStatus === 'in_progress') status = 'in_progress';
    else if (rawStatus === 'achieved') status = 'achieved';
    else if (rawStatus === 'paused') status = 'paused';
    else if (rawStatus === 'deferred') status = 'paused';
    else status = 'not_started';

    const projectIds = Array.isArray(g.projectIds) ? g.projectIds.filter((p: unknown): p is string => typeof p === 'string' && idValid(p)) : [];

    return {
      id: g.id,
      title: g.title.trim(),
      description: typeof g.description === 'string' ? g.description.slice(0, 5000) : undefined,
      targetQuarter: typeof g.targetQuarter === 'string' ? g.targetQuarter.slice(0, 50) : undefined,
      targetDate: typeof g.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.targetDate) ? g.targetDate : undefined,
      areaId: typeof g.areaId === 'string' && idValid(g.areaId) ? g.areaId : undefined,
      projectIds,
      status,
      progressMode: g.progressMode === 'tasks' ? 'tasks' : 'manual',
      manualProgress: typeof g.manualProgress === 'number' && Number.isFinite(g.manualProgress) ? Math.min(100, Math.max(0, Math.round(g.manualProgress))) : undefined,
      successCriteria: Array.isArray(g.successCriteria) ? g.successCriteria.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 50) : undefined,
      archivedAt: typeof g.archivedAt === 'number' && Number.isFinite(g.archivedAt) ? Math.max(0, g.archivedAt) : undefined,
      revision: typeof g.revision === 'number' && Number.isFinite(g.revision) ? Math.max(1, g.revision) : 1,
      createdAt: typeof g.createdAt === 'number' && Number.isFinite(g.createdAt) ? g.createdAt : Date.now(),
      updatedAt: typeof g.updatedAt === 'number' && Number.isFinite(g.updatedAt) ? g.updatedAt : Date.now(),
    };
  });
}

export function validateRoutines(raw: unknown): Routine[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail('Routines must be an array.');
  if (raw.length > 500) fail('Routines collection exceeds maximum of 500 items.');
  const ids = new Set<string>();
  return raw.map((r, i) => {
    const label = `Routine ${i + 1}`;
    if (!object(r) || !idValid(r.id) || typeof r.title !== 'string' || !r.title.trim() || r.title.length > 200) {
      fail(`${label}: valid ID and title required.`);
    }
    if (ids.has(r.id)) fail(`Duplicate routine ID: ${r.id}`);
    ids.add(r.id);

    const cadence = ['morning', 'evening', 'workday_start', 'weekly'].includes(String(r.cadence))
      ? (r.cadence as Routine['cadence'])
      : 'morning';

    const rawSteps = Array.isArray(r.steps) ? r.steps : [];
    const stepIds = new Set<string>();
    const steps = rawSteps.map((s, stepIdx) => {
      if (!object(s) || !idValid(s.id) || stepIds.has(s.id) || typeof s.title !== 'string' || !s.title.trim()) {
        fail(`${label} step ${stepIdx + 1}: valid step ID and title required.`);
      }
      stepIds.add(s.id);
      return {
        id: s.id,
        title: s.title.trim().slice(0, 200),
        durationMinutes: typeof s.durationMinutes === 'number' && Number.isFinite(s.durationMinutes) && s.durationMinutes > 0 ? Math.min(240, Math.round(s.durationMinutes)) : 2,
      };
    });

    return {
      id: r.id,
      title: r.title.trim(),
      cadence,
      steps,
      archivedAt: typeof r.archivedAt === 'number' && Number.isFinite(r.archivedAt) ? Math.max(0, r.archivedAt) : undefined,
      revision: typeof r.revision === 'number' && Number.isFinite(r.revision) ? Math.max(1, r.revision) : 1,
      createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now(),
      updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now(),
    };
  });
}

export function validateRoutineRuns(raw: unknown): RoutineRun[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail('Routine runs must be an array.');
  if (raw.length > 10000) fail('Routine runs collection exceeds maximum of 10,000 items.');
  const ids = new Set<string>();
  return raw.map((run, i) => {
    const label = `RoutineRun ${i + 1}`;
    if (!object(run) || !idValid(run.id) || !idValid(run.routineId)) {
      fail(`${label}: valid ID and routine reference required.`);
    }
    if (ids.has(run.id)) fail(`Duplicate routine run ID: ${run.id}`);
    ids.add(run.id);

    return {
      id: run.id,
      routineId: run.routineId,
      startedAt: typeof run.startedAt === 'number' && Number.isFinite(run.startedAt) ? run.startedAt : Date.now(),
      completedAt: typeof run.completedAt === 'number' && Number.isFinite(run.completedAt) ? run.completedAt : Date.now(),
      completedStepsCount: typeof run.completedStepsCount === 'number' && Number.isFinite(run.completedStepsCount) ? Math.max(0, run.completedStepsCount) : 0,
      totalStepsCount: typeof run.totalStepsCount === 'number' && Number.isFinite(run.totalStepsCount) ? Math.max(0, run.totalStepsCount) : 0,
      totalDurationSeconds: typeof run.totalDurationSeconds === 'number' && Number.isFinite(run.totalDurationSeconds) ? Math.max(0, run.totalDurationSeconds) : 0,
      revision: typeof run.revision === 'number' && Number.isFinite(run.revision) ? Math.max(1, run.revision) : 1,
      createdAt: typeof run.createdAt === 'number' && Number.isFinite(run.createdAt) ? run.createdAt : Date.now(),
      updatedAt: typeof run.updatedAt === 'number' && Number.isFinite(run.updatedAt) ? run.updatedAt : Date.now(),
    };
  });
}

export function validateWorkBlocks(raw: unknown, validTaskIds?: Set<string>): WorkBlock[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail('Work blocks must be an array.');
  if (raw.length > 50000) fail('Work blocks collection exceeds maximum of 50,000 items.');
  const ids = new Set<string>();
  const defaultTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';

  return raw.map((b, i) => {
    const label = `WorkBlock ${i + 1}`;
    if (!object(b) || !idValid(b.id) || !idValid(b.taskId)) {
      fail(`${label}: valid ID and task ID required.`);
    }
    if (ids.has(b.id)) fail(`Duplicate work block ID: ${b.id}`);
    ids.add(b.id);

    if (validTaskIds && !validTaskIds.has(b.taskId)) {
      fail(`${label}: references unknown task ${b.taskId}.`);
    }

    const timezone = typeof b.timezone === 'string' && b.timezone.length <= 100 ? b.timezone : defaultTz;

    // Resolve instants: support legacy date + startTime or direct startInstant
    let startInstant: number;
    let endInstant: number;

    if (typeof b.startInstant === 'number' && Number.isFinite(b.startInstant) && b.startInstant > 0) {
      startInstant = b.startInstant;
      endInstant = typeof b.endInstant === 'number' && Number.isFinite(b.endInstant) && b.endInstant >= startInstant
        ? b.endInstant
        : startInstant + (Number(b.durationMinutes) || 30) * 60000;
    } else if (typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
      const startTimeStr = typeof b.startTime === 'string' && /^\d{2}:\d{2}$/.test(b.startTime) ? b.startTime : '09:00';
      const duration = typeof b.durationMinutes === 'number' && b.durationMinutes > 0 ? b.durationMinutes : 30;
      const parsedStart = Date.parse(`${b.date}T${startTimeStr}:00Z`);
      startInstant = Number.isFinite(parsedStart) ? parsedStart : Date.now();
      endInstant = startInstant + duration * 60000;
    } else {
      startInstant = Date.now();
      endInstant = startInstant + 30 * 60000;
    }

    const durationMinutes = Math.max(5, Math.round((endInstant - startInstant) / 60000));
    const status: WorkBlockStatus = ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(String(b.status))
      ? (b.status as WorkBlockStatus)
      : b.completedAt ? 'completed' : 'scheduled';

    // Derived compatibility projections
    const startDate = new Date(startInstant);
    const dateStr = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date)
      ? b.date
      : startDate.toISOString().slice(0, 10);
    const startTimeStr = typeof b.startTime === 'string' && /^\d{2}:\d{2}$/.test(b.startTime)
      ? b.startTime
      : `${String(startDate.getUTCHours()).padStart(2, '0')}:${String(startDate.getUTCMinutes()).padStart(2, '0')}`;

    const endDate = new Date(endInstant);
    const endTimeStr = typeof b.endTime === 'string' && /^\d{2}:\d{2}$/.test(b.endTime)
      ? b.endTime
      : `${String(endDate.getUTCHours()).padStart(2, '0')}:${String(endDate.getUTCMinutes()).padStart(2, '0')}`;

    return {
      id: b.id,
      taskId: b.taskId,
      startInstant,
      endInstant,
      timezone,
      status,
      durationMinutes,
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      title: typeof b.title === 'string' ? b.title.slice(0, 500) : undefined,
      isLocked: Boolean(b.isLocked),
      completedAt: typeof b.completedAt === 'number' && Number.isFinite(b.completedAt) ? b.completedAt : undefined,
      externalEventId: typeof b.externalEventId === 'string' ? b.externalEventId.slice(0, 200) : undefined,
      revision: typeof b.revision === 'number' && Number.isFinite(b.revision) ? Math.max(1, b.revision) : 1,
      createdAt: typeof b.createdAt === 'number' && Number.isFinite(b.createdAt) ? b.createdAt : Date.now(),
      updatedAt: typeof b.updatedAt === 'number' && Number.isFinite(b.updatedAt) ? b.updatedAt : Date.now(),
    };
  });
}

export function validateReviews(raw: unknown): ReviewEntry[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) fail('Reviews must be an array.');
  if (raw.length > 5000) fail('Reviews collection exceeds maximum of 5,000 items.');
  const ids = new Set<string>();
  return raw.map((r, i) => {
    const label = `Review ${i + 1}`;
    if (!object(r) || !idValid(r.id)) {
      fail(`${label}: valid ID required.`);
    }
    if (ids.has(r.id)) fail(`Duplicate review ID: ${r.id}`);
    ids.add(r.id);

    validateDate(r.periodStart, `${label} period start`);
    validateDate(r.periodEnd, `${label} period end`);

    const nextPriorities = Array.isArray(r.nextPriorities)
      ? r.nextPriorities.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0).slice(0, 20)
      : [];

    return {
      id: r.id,
      periodStart: typeof r.periodStart === 'string' ? r.periodStart : new Date().toISOString().slice(0, 10),
      periodEnd: typeof r.periodEnd === 'string' ? r.periodEnd : new Date().toISOString().slice(0, 10),
      reviewedAt: typeof r.reviewedAt === 'number' && Number.isFinite(r.reviewedAt) ? r.reviewedAt : Date.now(),
      reflection: typeof r.reflection === 'string' ? r.reflection.slice(0, 50000) : '',
      nextPriorities,
      completedTasksCount: typeof r.completedTasksCount === 'number' && Number.isFinite(r.completedTasksCount) ? Math.max(0, r.completedTasksCount) : 0,
      totalEstimatedMinutes: typeof r.totalEstimatedMinutes === 'number' && Number.isFinite(r.totalEstimatedMinutes) ? Math.max(0, r.totalEstimatedMinutes) : 0,
      totalFocusSeconds: typeof r.totalFocusSeconds === 'number' && Number.isFinite(r.totalFocusSeconds) ? Math.max(0, r.totalFocusSeconds) : 0,
      revision: typeof r.revision === 'number' && Number.isFinite(r.revision) ? Math.max(1, r.revision) : 1,
      createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : Date.now(),
      updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now(),
    };
  });
}
