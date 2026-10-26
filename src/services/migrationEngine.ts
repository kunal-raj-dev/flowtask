import type { WorkBlock } from '../types/task';
import type { WorkspaceRecord } from '../types/workspace';
import type { WorkspaceStore } from './workspaceStore';
import { getDatabase } from './dbService';
import { wallTimeToInstant, isCalendarDate } from '../utils/zonedTime';
import { parseTimeToMinutes, minutesToTimeStr } from '../utils/timelineUtils';
import { syncTaskLegacySchedule } from './scheduleAdapter';

export const PRE_M1_SNAPSHOT_ID = 'flowtask_snapshot_pre_m1';

// In-memory fallback cache for environments where IndexedDB is mocked or unavailable
const inMemorySnapshots = new Map<string, { id: string; workspaceId: string; record: WorkspaceRecord; timestamp: number }>();

export type ReviewReason =
  | 'missing_date'
  | 'invalid_date'
  | 'invalid_time'
  | 'invalid_timezone'
  | 'dst_gap'
  | 'end_before_start'
  | 'schedule_conflict';

export interface MigrationReviewItem {
  taskId: string;
  taskTitle: string;
  reason: ReviewReason;
  details: string;
  legacySchedule: {
    scheduledStart?: string;
    scheduledEnd?: string;
    plannedDate?: string;
    dueDate?: string;
    scheduleLocked?: boolean;
  };
}

export interface MigrationReport {
  dryRun: boolean;
  snapshotId?: string;
  totalTasksScanned: number;
  alreadyCanonicalCount: number;
  convertedCount: number;
  ambiguousCount: number;
  convertedBlocks: WorkBlock[];
  reviewQueue: MigrationReviewItem[];
  timestamp: number;
}

export interface MigrationOptions {
  dryRun?: boolean;
  timezone?: string;
}

function getDefaultTimezone(): string {
  return typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    : 'UTC';
}

/**
 * Saves a pre-migration snapshot into IndexedDB (object store: 'snapshots').
 */
export async function savePreM1Snapshot(record: WorkspaceRecord): Promise<string> {
  const snapshotData = {
    id: PRE_M1_SNAPSHOT_ID,
    workspaceId: record.workspaceId,
    record: structuredClone(record),
    timestamp: Date.now(),
  };

  try {
    const db = await getDatabase();
    await db.put('snapshots', snapshotData);
  } catch {
    // Fallback for test or headless environments
    inMemorySnapshots.set(PRE_M1_SNAPSHOT_ID, snapshotData);
  }

  // Also cache in-memory for instant synchronous verification
  inMemorySnapshots.set(PRE_M1_SNAPSHOT_ID, snapshotData);
  return PRE_M1_SNAPSHOT_ID;
}

/**
 * Retrieves the pre-migration snapshot from IndexedDB or memory cache.
 */
export async function getPreM1Snapshot(workspaceId?: string): Promise<WorkspaceRecord | null> {
  try {
    const db = await getDatabase();
    const snapshot = await db.get('snapshots', PRE_M1_SNAPSHOT_ID);
    if (snapshot?.record) {
      if (!workspaceId || snapshot.workspaceId === workspaceId) {
        return snapshot.record;
      }
    }
  } catch {
    // Ignore and fallback to inMemory
  }

  const mem = inMemorySnapshots.get(PRE_M1_SNAPSHOT_ID);
  if (mem?.record) {
    if (!workspaceId || mem.workspaceId === workspaceId) {
      return mem.record;
    }
  }
  return null;
}

/**
 * Rolls back the workspace to the pre-M1 snapshot.
 */
export async function rollbackPreM1Snapshot(store: WorkspaceStore): Promise<WorkspaceRecord> {
  const snapshotRecord = await getPreM1Snapshot(store.id);
  if (!snapshotRecord) {
    throw new Error('No pre-M1 snapshot found to rollback.');
  }

  store.run('Rollback to pre-M1 snapshot', () => {
    return structuredClone(snapshotRecord);
  });

  return snapshotRecord;
}

/**
 * Conservative Migration Engine:
 * Analyzes legacy tasks, converts unambiguous ones to canonical WorkBlocks,
 * flags ambiguous/conflicting intervals into a review queue, and creates
 * a pre-migration snapshot when dryRun is false.
 */
function isWorkspaceStore(target: WorkspaceStore | WorkspaceRecord): target is WorkspaceStore {
  return typeof (target as WorkspaceStore).getSnapshot === 'function';
}

export async function runScheduleMigration(
  target: WorkspaceStore | WorkspaceRecord,
  options: MigrationOptions = {}
): Promise<MigrationReport> {
  const dryRun = options.dryRun ?? false;
  const store = isWorkspaceStore(target) ? target : null;
  const record: WorkspaceRecord = isWorkspaceStore(target) ? target.getSnapshot().record : target;
  const defaultTz = options.timezone || getDefaultTimezone();

  const totalTasksScanned = record.tasks.length;
  let alreadyCanonicalCount = 0;
  const convertedBlocks: WorkBlock[] = [];
  const reviewQueue: MigrationReviewItem[] = [];

  const existingGlobalBlocks = (record.workBlocks || []).filter((b) => b.status !== 'cancelled');
  const activeIntervals: Array<{ start: number; end: number; taskId: string }> = existingGlobalBlocks.map((b) => ({
    start: b.startInstant,
    end: b.endInstant,
    taskId: b.taskId,
  }));

  for (const task of record.tasks) {
    if (task.deletedAt || task.archivedAt) continue;

    // Check if task already has canonical WorkBlocks in record or embedded
    const hasGlobal = existingGlobalBlocks.some((b) => b.taskId === task.id);
    const hasEmbedded = (task.workBlocks || []).some(
      (b) => b.status !== 'cancelled' && b.source !== 'legacy_clock'
    );

    if (hasGlobal || hasEmbedded) {
      alreadyCanonicalCount++;
      continue;
    }

    // Check if task has legacy schedule fields
    if (!task.scheduledStart) {
      continue;
    }

    const legacySchedule = {
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      plannedDate: task.plannedDate,
      dueDate: task.dueDate,
      scheduleLocked: task.scheduleLocked,
    };

    // Ambiguity Check 1: Missing or invalid planning date and due date
    const targetDate = task.plannedDate || task.dueDate;
    if (!targetDate) {
      reviewQueue.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: 'missing_date',
        details: 'Task has scheduled time but lacks plannedDate or dueDate.',
        legacySchedule,
      });
      continue;
    }

    if (!isCalendarDate(targetDate)) {
      reviewQueue.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: 'invalid_date',
        details: `Invalid calendar date format: "${targetDate}". Expected YYYY-MM-DD.`,
        legacySchedule,
      });
      continue;
    }

    // Ambiguity Check 2: Invalid scheduledStart time format
    const startMin = parseTimeToMinutes(task.scheduledStart);
    if (startMin === null || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.scheduledStart)) {
      reviewQueue.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: 'invalid_time',
        details: `Invalid scheduledStart time format: "${task.scheduledStart}".`,
        legacySchedule,
      });
      continue;
    }

    // Ambiguity Check 3: Invalid scheduledEnd time format or end time precedes/equals start time
    let explicitEndMin: number | null = null;
    if (task.scheduledEnd) {
      explicitEndMin = parseTimeToMinutes(task.scheduledEnd);
      if (explicitEndMin === null || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.scheduledEnd)) {
        reviewQueue.push({
          taskId: task.id,
          taskTitle: task.title,
          reason: 'invalid_time',
          details: `Invalid scheduledEnd time format: "${task.scheduledEnd}".`,
          legacySchedule,
        });
        continue;
      }
      if (explicitEndMin <= startMin) {
        reviewQueue.push({
          taskId: task.id,
          taskTitle: task.title,
          reason: 'end_before_start',
          details: `scheduledEnd (${task.scheduledEnd}) is earlier than or equal to scheduledStart (${task.scheduledStart}).`,
          legacySchedule,
        });
        continue;
      }
    }

    const duration = explicitEndMin !== null
      ? explicitEndMin - startMin
      : task.estimatedMinutes && task.estimatedMinutes > 0
      ? task.estimatedMinutes
      : 30;

    const tz = task.timezone || defaultTz;

    // Ambiguity Check 4: Validate IANA timezone
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        new Intl.DateTimeFormat(undefined, { timeZone: tz });
      }
    } catch {
      reviewQueue.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: 'invalid_timezone',
        details: `Invalid IANA timezone: "${tz}".`,
        legacySchedule,
      });
      continue;
    }

    // Ambiguity Check 5: Nonexistent wall-clock time (DST gap)
    let startInstant: number;
    let endInstant: number;
    try {
      startInstant = wallTimeToInstant(targetDate, task.scheduledStart, tz, 'reject');
      endInstant = startInstant + duration * 60000;
    } catch (err: any) {
      reviewQueue.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: 'dst_gap',
        details: `Local time ${task.scheduledStart} on ${targetDate} in ${tz} is invalid or ambiguous (e.g. DST change): ${err.message}`,
        legacySchedule,
      });
      continue;
    }

    // Ambiguity Check 6: Conflicting overlap with existing blocks or previously converted blocks
    const hasConflict = activeIntervals.some(
      (interval) => startInstant < interval.end && endInstant > interval.start
    );

    if (hasConflict) {
      reviewQueue.push({
        taskId: task.id,
        taskTitle: task.title,
        reason: 'schedule_conflict',
        details: `Reservation interval [${targetDate} ${task.scheduledStart}] conflicts with another scheduled block.`,
        legacySchedule,
      });
      continue;
    }

    // Unambiguous conversion
    const blockId = `wb-migrated-${task.id}`;
    const endTimeStr = task.scheduledEnd || minutesToTimeStr(startMin + duration);
    const convertedBlock: WorkBlock = {
      id: blockId,
      taskId: task.id,
      startInstant,
      endInstant,
      timezone: tz,
      status: task.status === 'done' ? 'completed' : 'scheduled',
      date: targetDate,
      startTime: task.scheduledStart,
      endTime: endTimeStr,
      durationMinutes: duration,
      title: task.title,
      isLocked: Boolean(task.scheduleLocked),
      source: 'canonical',
      revision: 1,
      createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
      updatedAt: Date.now(),
    };

    convertedBlocks.push(convertedBlock);
    activeIntervals.push({ start: startInstant, end: endInstant, taskId: task.id });
  }

  let snapshotId: string | undefined;

  // If not dry-run, apply changes and save snapshot
  if (!dryRun) {
    snapshotId = await savePreM1Snapshot(record);

    if (convertedBlocks.length > 0) {
      const convertedMap = new Map<string, WorkBlock>();
      for (const b of convertedBlocks) {
        convertedMap.set(b.taskId, b);
      }
      const newIds = new Set(convertedBlocks.map((b) => b.id));

      if (store) {
        store.run('Migrate legacy schedule to canonical WorkBlocks', (current) => {
          const updatedBlocks = [...(current.workBlocks || []).filter((b) => !newIds.has(b.id)), ...convertedBlocks];
          const updatedTasks = current.tasks.map((t) => {
            const block = convertedMap.get(t.id);
            if (!block) return t;
            const taskBlocks = [...(t.workBlocks || []).filter((b) => !newIds.has(b.id)), block];
            const sync = syncTaskLegacySchedule(t, taskBlocks);
            return {
              ...t,
              workBlocks: taskBlocks,
              scheduledStart: sync.scheduledStart,
              scheduledEnd: sync.scheduledEnd,
              plannedDate: sync.plannedDate,
              scheduleLocked: sync.scheduleLocked,
              revision: (t.revision || 1) + 1,
              updatedAt: Date.now(),
            };
          });

          return {
            ...current,
            tasks: updatedTasks,
            workBlocks: updatedBlocks,
          };
        });
      } else {
        // Direct record mutation
        record.workBlocks = [...(record.workBlocks || []).filter((b) => !newIds.has(b.id)), ...convertedBlocks];
        record.tasks = record.tasks.map((t) => {
          const block = convertedMap.get(t.id);
          if (!block) return t;
          const taskBlocks = [...(t.workBlocks || []).filter((b) => !newIds.has(b.id)), block];
          const sync = syncTaskLegacySchedule(t, taskBlocks);
          return {
            ...t,
            workBlocks: taskBlocks,
            scheduledStart: sync.scheduledStart,
            scheduledEnd: sync.scheduledEnd,
            plannedDate: sync.plannedDate,
            scheduleLocked: sync.scheduleLocked,
            revision: (t.revision || 1) + 1,
            updatedAt: Date.now(),
          };
        });
      }
    }
  }

  return {
    dryRun,
    snapshotId,
    totalTasksScanned,
    alreadyCanonicalCount,
    convertedCount: convertedBlocks.length,
    ambiguousCount: reviewQueue.length,
    convertedBlocks,
    reviewQueue,
    timestamp: Date.now(),
  };
}
