import type { WorkBlock, Task, WorkBlockStatus } from '../types/task';
import type { WorkspaceStore } from './workspaceStore';
import { clockInTimezone, wallTimeToInstant, timezoneDayBounds, shiftCalendarDate } from '../utils/zonedTime';
import { syncTaskLegacySchedule } from './scheduleAdapter';

function projectTaskFields(task: Task, taskBlocks: WorkBlock[]): Task {
  const sync = syncTaskLegacySchedule(task, taskBlocks);
  return {
    ...task,
    workBlocks: taskBlocks,
    scheduledStart: sync.scheduledStart,
    scheduledEnd: sync.scheduledEnd,
    plannedDate: sync.plannedDate,
    scheduleLocked: sync.scheduleLocked,
    revision: (task.revision || 1) + 1,
    updatedAt: Date.now(),
  };
}

export function formatMinutesHuman(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatCapacitySummary(
  selectedMinutes: number,
  availableMinutes: number,
  calendarMinutes = 0,
  missingEstimatesCount = 0
): string {
  const remaining = Math.max(0, availableMinutes - selectedMinutes);
  const parts: string[] = [
    `${formatMinutesHuman(selectedMinutes)} selected`,
    `${formatMinutesHuman(remaining)} remaining`,
  ];
  if (calendarMinutes > 0) {
    parts.push(`${formatMinutesHuman(calendarMinutes)} calendar commitments`);
  }
  if (missingEstimatesCount > 0) {
    parts.push(`${missingEstimatesCount} unestimated`);
  }
  return parts.join(' · ');
}

function getDefaultTimezone(): string {
  return typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';
}

function sessionTimes(startInstant: number, endInstant: number, timezone: string) {
  if (!Number.isFinite(startInstant) || !Number.isFinite(endInstant) || endInstant <= startInstant) {
    throw new Error('Session end instant must be after start instant.');
  }
  const start = clockInTimezone(startInstant, timezone);
  return { startInstant, endInstant, date: start.date, startTime: start.time,
    endTime: clockInTimezone(endInstant, timezone).time, durationMinutes: (endInstant - startInstant) / 60000 };
}

function computeInstantsFromDate(date: string, startTime = '09:00', durationMinutes = 30, timezone = getDefaultTimezone()) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('Enter a positive session duration.');
  const startInstant = wallTimeToInstant(date, startTime, timezone);
  return sessionTimes(startInstant, startInstant + durationMinutes * 60000, timezone);
}

export function addWorkBlock(
  store: WorkspaceStore,
  taskId: string,
  blockData: {
    date: string;
    durationMinutes: number;
    startTime?: string;
    endTime?: string;
    title?: string;
    isLocked?: boolean;
    timezone?: string;
  }
): WorkBlock {
  const now = Date.now();
  const tz = blockData.timezone || getDefaultTimezone();
  const { startInstant, endInstant, startTime, endTime } = computeInstantsFromDate(
    blockData.date,
    blockData.startTime,
    blockData.durationMinutes,
    tz
  );
  if (blockData.endTime && blockData.endTime !== endTime) throw new Error('End time must match the session duration.');

  const workBlock: WorkBlock = {
    id: crypto.randomUUID(),
    taskId,
    startInstant,
    endInstant,
    timezone: tz,
    status: 'scheduled',
    date: blockData.date,
    durationMinutes: blockData.durationMinutes,
    startTime,
    endTime,
    title: blockData.title,
    isLocked: blockData.isLocked ?? false,
    source: 'canonical',
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };

  store.run('Add work block to task', (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error('Task not found.');

    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return projectTaskFields(t, [...(t.workBlocks || []), workBlock]);
    });

    const existingBlocks = record.workBlocks || [];
    return {
      ...record,
      tasks: updatedTasks,
      workBlocks: [...existingBlocks.filter(b => b.id !== workBlock.id), workBlock],
    };
  });

  return workBlock;
}

export function updateWorkBlock(
  store: WorkspaceStore,
  taskId: string,
  blockId: string,
  updates: Partial<Omit<WorkBlock, 'id' | 'taskId' | 'createdAt'>>
): void {
  const now = Date.now();

  store.run('Update work block', (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error('Task not found.');

    const block = (record.workBlocks || []).find(b => b.id === blockId && b.taskId === taskId)
      ?? task.workBlocks?.find(b => b.id === blockId && b.taskId === taskId);
    if (!block) throw new Error('Work block not found.');
    const merged = { ...block, ...updates, updatedAt: now };
    const changesTime = ['date', 'startTime', 'endTime', 'durationMinutes', 'startInstant', 'endInstant', 'timezone']
      .some(key => Object.hasOwn(updates, key));
    if (changesTime) {
      if (block.isLocked) throw new Error('This session is locked. Unlock it before changing its time.');
      const timezone = merged.timezone || getDefaultTimezone();
      if (updates.startInstant !== undefined || updates.endInstant !== undefined) {
        Object.assign(merged, sessionTimes(merged.startInstant, merged.endInstant, timezone));
      } else {
        const date = merged.date || clockInTimezone(block.startInstant, timezone).date;
        let times = computeInstantsFromDate(date, merged.startTime, merged.durationMinutes, timezone);
        if (updates.endTime !== undefined && updates.durationMinutes === undefined) {
          const endDate = updates.endTime <= times.startTime ? shiftCalendarDate(date, 1) : date;
          const endInstant = wallTimeToInstant(endDate, updates.endTime, timezone);
          times = sessionTimes(times.startInstant, endInstant, timezone);
        }
        if (updates.endTime !== undefined && updates.endTime !== times.endTime) {
          throw new Error('End time must match the session duration.');
        }
        Object.assign(merged, times);
      }
    }
    const updatedTasks = record.tasks.map(t => {
      if (t.id !== taskId) return t;
      const nextBlocks = [...(t.workBlocks || []).filter(b => b.id !== blockId), merged];
      return projectTaskFields(t, nextBlocks);
    });
    const updatedWorkBlocks = [...(record.workBlocks || []).filter(b => b.id !== blockId), merged];

    return {
      ...record,
      tasks: updatedTasks,
      workBlocks: updatedWorkBlocks,
    };
  });
}

export function removeWorkBlock(
  store: WorkspaceStore,
  taskId: string,
  blockId: string,
  options?: { allowLocked?: boolean }
): void {
  const currentRecord = store.getSnapshot().record;
  const block = (currentRecord.workBlocks || []).find(b => b.id === blockId && b.taskId === taskId)
    ?? currentRecord.tasks.find(t => t.id === taskId)?.workBlocks?.find(b => b.id === blockId);
  if (block?.isLocked && !options?.allowLocked) {
    throw new Error('This session is locked. Unlock it before removing.');
  }

  store.run('Remove work block', (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error('Task not found.');

    const updatedBlocks = (record.workBlocks || []).filter((b) => b.id !== blockId);
    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const nextBlocks = updatedBlocks.filter((b) => b.taskId === taskId);
      return projectTaskFields(t, nextBlocks);
    });

    return {
      ...record,
      tasks: updatedTasks,
      workBlocks: updatedBlocks,
    };
  });
}

export function createWorkSession(
  store: WorkspaceStore,
  params: {
    taskId: string;
    startInstant: number;
    endInstant: number;
    timezone?: string;
    title?: string;
    isLocked?: boolean;
    allowOverlap?: boolean;
  }
): WorkBlock {
  const { taskId, startInstant, endInstant, timezone, title, isLocked, allowOverlap } = params;
  if (endInstant <= startInstant) {
    throw new Error('Session end instant must be after start instant.');
  }
  const tz = timezone || getDefaultTimezone();
  const { durationMinutes, date: dateStr, startTime, endTime } = sessionTimes(startInstant, endInstant, tz);

  const currentRecord = store.getSnapshot().record;
  const existingBlocks = currentRecord.workBlocks || [];

  if (!allowOverlap) {
    const hasOverlap = existingBlocks.some(b =>
      b.status !== 'cancelled' &&
      startInstant < b.endInstant &&
      endInstant > b.startInstant
    );
    if (hasOverlap) {
      throw new Error('This session overlaps with an existing scheduled session. Confirm conflict to proceed.');
    }
  }

  const newBlock: WorkBlock = {
    id: crypto.randomUUID(),
    taskId,
    startInstant,
    endInstant,
    timezone: tz,
    status: 'scheduled',
    date: dateStr,
    startTime,
    endTime,
    durationMinutes,
    title,
    isLocked: Boolean(isLocked),
    source: 'canonical',
    revision: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  store.run('Create work session', (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error('Task not found.');

    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return projectTaskFields(t, [...(t.workBlocks || []), newBlock]);
    });

    return {
      ...record,
      tasks: updatedTasks,
      workBlocks: [...(record.workBlocks || []), newBlock],
    };
  });

  return newBlock;
}

export function moveWorkSession(
  store: WorkspaceStore,
  blockId: string,
  newStartInstant: number,
  newEndInstant: number,
  options?: { allowLocked?: boolean; allowOverlap?: boolean }
): void {
  const currentRecord = store.getSnapshot().record;
  const block = (currentRecord.workBlocks || []).find(b => b.id === blockId);
  if (!block) throw new Error('Work session not found.');
  if (block.isLocked && !options?.allowLocked) {
    throw new Error('This session is locked. Unlock it before moving.');
  }
  if (newEndInstant <= newStartInstant) {
    throw new Error('Session end instant must be after start instant.');
  }

  if (!options?.allowOverlap) {
    const hasOverlap = (currentRecord.workBlocks || []).some(b =>
      b.id !== blockId &&
      b.status !== 'cancelled' &&
      newStartInstant < b.endInstant &&
      newEndInstant > b.startInstant
    );
    if (hasOverlap) {
      throw new Error('Moving here causes a schedule conflict with another session.');
    }
  }

  const { durationMinutes, date: dateStr, startTime, endTime } = sessionTimes(newStartInstant, newEndInstant, block.timezone || getDefaultTimezone());
  const now = Date.now();

  store.run('Move work session', (record) => {
    const updatedBlocks = (record.workBlocks || []).map(b => {
      if (b.id !== blockId) return b;
      return {
        ...b,
        startInstant: newStartInstant,
        endInstant: newEndInstant,
        date: dateStr,
        startTime,
        endTime,
        durationMinutes,
        updatedAt: now,
      };
    });

    const updatedTasks = record.tasks.map((t) => {
      const isTargetTask = t.id === block.taskId || (t.workBlocks || []).some((b) => b.id === blockId);
      if (!isTargetTask) return t;
      const nextBlocks = updatedBlocks.filter((b) => b.taskId === t.id);
      return projectTaskFields(t, nextBlocks);
    });

    return {
      ...record,
      tasks: updatedTasks,
      workBlocks: updatedBlocks,
    };
  });
}

export function deleteWorkSession(
  store: WorkspaceStore,
  blockId: string,
  options?: { allowLocked?: boolean }
): void {
  const currentRecord = store.getSnapshot().record;
  const block = (currentRecord.workBlocks || []).find((b) => b.id === blockId)
    || currentRecord.tasks.flatMap((t) => t.workBlocks || []).find((b) => b.id === blockId);
  if (!block) throw new Error('Work session not found.');
  if (block.isLocked && !options?.allowLocked) {
    throw new Error('This session is locked. Unlock it before deleting.');
  }
  removeWorkBlock(store, block.taskId, blockId, options);
}

export function resizeWorkSession(
  store: WorkspaceStore,
  blockId: string,
  edge: 'start' | 'end',
  deltaMinutes: number,
  options?: { allowLocked?: boolean; allowOverlap?: boolean }
): void {
  const currentRecord = store.getSnapshot().record;
  const block = (currentRecord.workBlocks || []).find(b => b.id === blockId);
  if (!block) throw new Error('Work session not found.');
  if (block.isLocked && !options?.allowLocked) {
    throw new Error('This session is locked. Unlock it before resizing.');
  }

  let newStart = block.startInstant;
  let newEnd = block.endInstant;

  if (edge === 'start') {
    newStart = block.startInstant + deltaMinutes * 60000;
  } else {
    newEnd = block.endInstant + deltaMinutes * 60000;
  }

  if (newEnd - newStart < 5 * 60000) {
    throw new Error('Session must be at least 5 minutes long.');
  }

  moveWorkSession(store, blockId, newStart, newEnd, options);
}

export function cancelFutureTaskSessions(store: WorkspaceStore, taskId: string): void {
  const now = Date.now();
  store.run('Cancel future task sessions', (record) => {
    const updatedBlocks = (record.workBlocks || []).map(b => {
      if (b.taskId === taskId && b.status === 'scheduled' && b.startInstant >= now) {
        return { ...b, status: 'cancelled' as WorkBlockStatus, updatedAt: now };
      }
      return b;
    });

    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const nextBlocks = updatedBlocks.filter((b) => b.taskId === taskId);
      return projectTaskFields(t, nextBlocks);
    });

    return {
      ...record,
      tasks: updatedTasks,
      workBlocks: updatedBlocks,
    };
  });
}

export function restoreTaskSessions(store: WorkspaceStore, taskId: string): void {
  const now = Date.now();
  store.run('Restore task sessions', (record) => {
    const updatedBlocks = (record.workBlocks || []).map(b => {
      if (b.taskId === taskId && b.status === 'cancelled') {
        return { ...b, status: 'scheduled' as WorkBlockStatus, updatedAt: now };
      }
      return b;
    });

    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const nextBlocks = updatedBlocks.filter((b) => b.taskId === taskId);
      return projectTaskFields(t, nextBlocks);
    });

    return {
      ...record,
      tasks: updatedTasks,
      workBlocks: updatedBlocks,
    };
  });
}

export function getWorkBlocksForTask(blocks: WorkBlock[], taskId: string): WorkBlock[] {
  return (blocks || []).filter(b => b.taskId === taskId);
}

export function getWorkBlocksForDateRange(
  blocks: WorkBlock[],
  startInstant: number,
  endInstant: number,
  _timezone?: string
): WorkBlock[] {
  return (blocks || []).filter(b =>
    b.status !== 'cancelled' &&
    b.startInstant < endInstant &&
    b.endInstant > startInstant
  );
}

export function calculateDayCapacity(
  workBlocks: WorkBlock[],
  dateStr: string,
  timezone: string,
  targetHours: number,
  calendarEventsMinutes = 0
): {
  scheduledMinutes: number;
  availableMinutes: number;
  remainingMinutes: number;
  deficitMinutes: number;
  isOverallocated: boolean;
} {
  const { start, end } = timezoneDayBounds(dateStr, timezone);
  const dayBlocks = (workBlocks || []).filter(b => b.status !== 'cancelled' && b.startInstant < end && b.endInstant > start);
  const scheduledMinutes = [...new Map(dayBlocks.map(b => [b.id, b])).values()]
    .reduce((acc, b) => acc + Math.max(0, Math.min(b.endInstant, end) - Math.max(b.startInstant, start)) / 60000, 0);
  const totalTargetMinutes = Math.round(targetHours * 60);
  const availableMinutes = Math.max(0, totalTargetMinutes - calendarEventsMinutes);
  const remainingMinutes = Math.max(0, availableMinutes - scheduledMinutes);
  const deficitMinutes = Math.max(0, scheduledMinutes - availableMinutes);

  return {
    scheduledMinutes,
    availableMinutes,
    remainingMinutes,
    deficitMinutes,
    isOverallocated: deficitMinutes > 0,
  };
}

export function getWorkBlocksForDate(
  tasks: Task[],
  date: string
): Array<{ block: WorkBlock; task: Task }> {
  const results: Array<{ block: WorkBlock; task: Task }> = [];
  tasks.forEach((task) => {
    if (task.deletedAt || task.archivedAt) return;
    (task.workBlocks || []).forEach((block) => {
      if (block.date === date && block.status !== 'cancelled') {
        results.push({ block, task });
      }
    });
  });
  return results;
}

export interface EstimationBiasResult {
  rBias: number;
  ratio: number;
  sampleCount: number;
  completedCount: number;
  status: 'accurate' | 'underestimating' | 'overestimating';
  totalActualMinutes: number;
  totalEstimatedMinutes: number;
}

/**
 * Estimation Bias Calibration Engine (R_bias = sum(T_actual) / sum(T_estimated)).
 * Evaluates completed tasks with both estimated and actual durations.
 */
export function calculateEstimationBias(tasks: Task[]): EstimationBiasResult {
  let totalEstimated = 0;
  let totalActual = 0;
  let sampleCount = 0;

  tasks.forEach((task) => {
    if (task.deletedAt || task.archivedAt) return;
    const isCompleted = task.status === 'done' || Boolean(task.completedAt);
    if (!isCompleted) return;

    const estimated = task.estimatedMinutes || 0;
    const actual = task.timeSpentMinutes || 0;

    if (estimated > 0 && actual > 0) {
      totalEstimated += estimated;
      totalActual += actual;
      sampleCount += 1;
    }
  });

  if (sampleCount < 1 || totalEstimated === 0) {
    return {
      rBias: 1.0,
      ratio: 1.0,
      sampleCount,
      completedCount: sampleCount,
      status: 'accurate',
      totalActualMinutes: totalActual,
      totalEstimatedMinutes: totalEstimated,
    };
  }

  const rawBias = totalActual / totalEstimated;
  const rBias = Math.round(rawBias * 100) / 100;

  let status: 'accurate' | 'underestimating' | 'overestimating' = 'accurate';
  if (rBias > 1.15) {
    status = 'underestimating';
  } else if (rBias < 0.85) {
    status = 'overestimating';
  }

  return {
    rBias,
    ratio: rBias,
    sampleCount,
    completedCount: sampleCount,
    status,
    totalActualMinutes: totalActual,
    totalEstimatedMinutes: totalEstimated,
  };
}

export const calculateEstimationBiasRatio = calculateEstimationBias;

/**
 * Suggest a calibrated block duration based on user's empirical bias factor.
 */
export function suggestCalibratedDuration(estimatedMinutes: number, rBias: number): number {
  if (estimatedMinutes <= 0) return 30;
  const calibrated = Math.round((estimatedMinutes * rBias) / 5) * 5;
  return Math.max(5, calibrated);
}

export interface DeficitBudgetParams {
  workdayStartHour: number;
  workdayEndHour: number;
  calendarEventsMinutes: number;
  bufferMinutes?: number;
  tasksMinutes: number;
}

export interface DeficitBudgetResult {
  totalWorkdayMinutes: number;
  whitespaceMinutes: number;
  deficitMinutes: number;
  isOverallocated: boolean;
  allocationPercent: number;
}

/**
 * Deficit Budgeting:
 * T_whitespace = (T_workday_end - T_workday_start) - sum(T_calendar_events) - T_buffers
 * Delta T_deficit = sum(T_tasks) - T_whitespace
 */
export function calculateDeficitBudget({
  workdayStartHour,
  workdayEndHour,
  calendarEventsMinutes,
  bufferMinutes = 0,
  tasksMinutes,
}: DeficitBudgetParams): DeficitBudgetResult {
  const start = Math.min(workdayStartHour, workdayEndHour);
  const end = Math.max(workdayStartHour, workdayEndHour);
  const totalWorkdayMinutes = (end - start) * 60;

  const whitespaceMinutes = Math.max(
    0,
    totalWorkdayMinutes - calendarEventsMinutes - bufferMinutes
  );
  const deficitMinutes = Math.max(0, tasksMinutes - whitespaceMinutes);
  const isOverallocated = deficitMinutes > 0;
  const allocationPercent =
    whitespaceMinutes > 0
      ? Math.round((tasksMinutes / whitespaceMinutes) * 100)
      : tasksMinutes > 0
      ? 999
      : 0;

  return {
    totalWorkdayMinutes,
    whitespaceMinutes,
    deficitMinutes,
    isOverallocated,
    allocationPercent,
  };
}

/**
 * User-facing advisory message for schedule deficit.
 */
export function formatDeficitWarning(deficitMinutes: number): string {
  if (deficitMinutes <= 0) return '';
  return `Schedule Deficit: Planned tasks exceed available whitespace by ${formatMinutesHuman(
    deficitMinutes
  )}. Consider trimming or deferring blocks.`;
}
