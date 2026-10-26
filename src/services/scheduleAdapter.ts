import type { Task, WorkBlock, WorkBlockStatus } from '../types/task';
import { clockInTimezone, wallTimeToInstant } from '../utils/zonedTime';
import { parseTimeToMinutes, minutesToTimeStr } from '../utils/timelineUtils';

function getDefaultTimezone(): string {
  return typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    : 'UTC';
}

/**
 * Creates a synthetic WorkBlock from legacy Task clock fields:
 * task.scheduledStart, task.scheduledEnd, task.plannedDate (or dueDate).
 */
export function createSyntheticLegacyWorkBlock(task: Task): WorkBlock | null {
  if (!task.scheduledStart || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.scheduledStart)) return null;

  const tz = task.timezone || getDefaultTimezone();
  const targetRaw = task.plannedDate || task.dueDate;
  const dateStr = (targetRaw && /^\d{4}-\d{2}-\d{2}$/.test(targetRaw))
    ? targetRaw
    : clockInTimezone(Date.now(), tz).date;
  const startTime = task.scheduledStart;

  const startMin = parseTimeToMinutes(startTime) ?? 9 * 60;
  const isEndValid = Boolean(task.scheduledEnd && /^([01]\d|2[0-3]):[0-5]\d$/.test(task.scheduledEnd));
  const explicitEndMin = isEndValid ? parseTimeToMinutes(task.scheduledEnd!) : null;
  const durationMinutes =
    explicitEndMin && explicitEndMin > startMin
      ? explicitEndMin - startMin
      : task.estimatedMinutes && task.estimatedMinutes > 0
      ? task.estimatedMinutes
      : 30;

  const endTime = (isEndValid && task.scheduledEnd) || minutesToTimeStr(startMin + durationMinutes);

  let startInstant: number;
  let endInstant: number;

  try {
    startInstant = wallTimeToInstant(dateStr, startTime, tz, 'earlier');
    endInstant = startInstant + durationMinutes * 60000;
  } catch {
    // Fallback if local wall time is non-standard or fails parse
    const fallbackParse = Date.parse(`${dateStr}T${startTime}:00Z`);
    startInstant = Number.isFinite(fallbackParse) ? fallbackParse : Date.now();
    endInstant = startInstant + durationMinutes * 60000;
  }

  const status: WorkBlockStatus = task.status === 'done' ? 'completed' : 'scheduled';

  return {
    id: `wb-legacy-${task.id}`,
    taskId: task.id,
    startInstant,
    endInstant,
    timezone: tz,
    status,
    date: dateStr,
    startTime,
    endTime,
    durationMinutes,
    title: task.title,
    isLocked: Boolean(task.scheduleLocked),
    source: 'legacy_clock',
    revision: 1,
    createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
    updatedAt: typeof task.updatedAt === 'number' ? task.updatedAt : Date.now(),
  };
}

/**
 * Helper to check if two work blocks represent identical intervals.
 */
function areIntervalsIdentical(a: WorkBlock, b: WorkBlock): boolean {
  if (a.startInstant === b.startInstant && a.endInstant === b.endInstant) {
    return true;
  }
  if (a.date && b.date && a.date === b.date && a.startTime && b.startTime && a.startTime === b.startTime) {
    return (a.endTime || '') === (b.endTime || '') || a.durationMinutes === b.durationMinutes;
  }
  return false;
}

/**
 * Single Canonical Read Adapter:
 * Reads global record.workBlocks, falls back to task.workBlocks, and falls back to
 * legacy task clocks (scheduledStart/scheduledEnd + plannedDate), deduplicating
 * identical intervals so no duplicate slots appear on timelines or calendars.
 */
export function getEffectiveWorkBlocks(task: Task, recordBlocks?: WorkBlock[]): WorkBlock[] {
  if (!task || task.deletedAt) return [];

  // 1. Gather all global blocks for this task (both active and cancelled)
  const allGlobalBlocksForTask = (recordBlocks || []).filter((b) => b.taskId === task.id);
  const globalIdSet = new Set(allGlobalBlocksForTask.map((b) => b.id));
  const activeGlobalBlocks = allGlobalBlocksForTask.filter((b) => b.status !== 'cancelled');

  // 2. Gather embedded task blocks that are not already present in global blocks by ID
  // If a block ID exists in recordBlocks (even if cancelled), recordBlocks is authoritative.
  const embeddedBlocks = (task.workBlocks || []).filter(
    (b) => b.taskId === task.id && b.status !== 'cancelled' && !globalIdSet.has(b.id)
  );

  // 3. Pool canonical blocks with priority: activeGlobalBlocks > embeddedBlocks
  const candidateBlocks: WorkBlock[] = [...activeGlobalBlocks];

  for (const emb of embeddedBlocks) {
    // Check if this embedded block has an identical interval to an already included global block
    const isDuplicate = candidateBlocks.some((existing) => areIntervalsIdentical(existing, emb));
    if (!isDuplicate) {
      candidateBlocks.push({ ...emb, source: emb.source || 'embedded' });
    }
  }

  // 4. Fallback to legacy task clocks if no canonical blocks exist,
  // or if candidate blocks do not cover the legacy clock interval
  if (task.scheduledStart) {
    const legacyBlock = createSyntheticLegacyWorkBlock(task);
    if (legacyBlock) {
      const isAlreadyRepresented = candidateBlocks.some((existing) =>
        areIntervalsIdentical(existing, legacyBlock)
      );
      if (!isAlreadyRepresented) {
        if (candidateBlocks.length === 0) {
          // Verify this interval was not explicitly cancelled in global or task blocks
          const wasExplicitlyCancelled =
            allGlobalBlocksForTask.some((b) => b.status === 'cancelled' && areIntervalsIdentical(b, legacyBlock)) ||
            (task.workBlocks || []).some((b) => b.status === 'cancelled' && areIntervalsIdentical(b, legacyBlock));

          if (!wasExplicitlyCancelled) {
            candidateBlocks.push(legacyBlock);
          }
        }
      }
    }
  }

  return candidateBlocks;
}

/**
 * Returns all effective work blocks across all tasks in the workspace, deduplicated.
 */
export function getAllEffectiveWorkBlocks(tasks: Task[], recordBlocks?: WorkBlock[]): WorkBlock[] {
  const result: WorkBlock[] = [];
  const seenIntervalKeys = new Set<string>();

  for (const task of tasks) {
    if (task.deletedAt || task.archivedAt) continue;
    const taskEffectiveBlocks = getEffectiveWorkBlocks(task, recordBlocks);
    for (const block of taskEffectiveBlocks) {
      const intervalKey = `${block.taskId}:${block.startInstant}:${block.endInstant}`;
      if (!seenIntervalKeys.has(intervalKey)) {
        seenIntervalKeys.add(intervalKey);
        result.push(block);
      }
    }
  }

  return result;
}

/**
 * Detects if a task solely relies on legacy clock fields without any canonical WorkBlock.
 */
export function isLegacyClockOnly(task: Task, recordBlocks?: WorkBlock[]): boolean {
  if (!task.scheduledStart || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.scheduledStart)) return false;
  const hasGlobal = (recordBlocks || []).some(
    (b) => b.taskId === task.id && b.status !== 'cancelled' && b.source !== 'legacy_clock'
  );
  if (hasGlobal) return false;
  const hasEmbedded = (task.workBlocks || []).some(
    (b) => b.taskId === task.id && b.status !== 'cancelled' && b.source !== 'legacy_clock'
  );
  return !hasEmbedded;
}

/**
 * Projects canonical work blocks back into backward-compatible legacy Task fields.
 */
export function syncTaskLegacySchedule(
  task: Task,
  workBlocks?: WorkBlock[]
): {
  scheduledStart?: string;
  scheduledEnd?: string;
  plannedDate?: string;
  scheduleLocked?: boolean;
} {
  const activeBlocks = (workBlocks || []).filter(
    (b) => b.taskId === task.id && b.status !== 'cancelled'
  );

  if (activeBlocks.length === 0) {
    return {
      scheduledStart: undefined,
      scheduledEnd: undefined,
      plannedDate: task.plannedDate,
      scheduleLocked: task.scheduleLocked,
    };
  }

  // Pick earliest scheduled/unfinished block, or latest completed block
  const unfinished = activeBlocks
    .filter((b) => b.status !== 'completed')
    .sort((a, b) => a.startInstant - b.startInstant);

  const chosen = unfinished[0] || [...activeBlocks].sort((a, b) => b.startInstant - a.startInstant)[0];

  return {
    scheduledStart: chosen.startTime || undefined,
    scheduledEnd: chosen.endTime || undefined,
    plannedDate: chosen.date || task.plannedDate,
    scheduleLocked: chosen.isLocked ?? task.scheduleLocked,
  };
}
