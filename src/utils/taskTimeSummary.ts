import type { Task, SubTask } from '../types/task';

export interface TaskTimeSummary {
  /** The total estimated duration in minutes for the task (subtask sum if timed subtasks exist, else task.estimatedMinutes or 0) */
  totalEstimateMinutes: number;
  /** Whether the estimate was automatically derived from timed subtasks */
  isDerivedFromSubtasks: boolean;
  /** Number of subtasks with estimates > 0 */
  timedSubtaskCount: number;
  /** Number of subtasks that do not have an estimate set */
  untimedSubtaskCount: number;
  /** Human-friendly indicator string if there are untimed subtasks */
  untimedSubtaskIndicator?: string;
  /** Estimated minutes of unfinished work (subtracts recorded time once) */
  remainingWorkMinutes: number;
  /** Time spent/recorded in minutes */
  recordedMinutes: number;
  /** Estimated minutes of completed subtasks */
  completedSubtaskMinutes: number;
  /** Estimated minutes of unfinished timed subtasks */
  unfinishedSubtaskMinutes: number;
}

/**
 * Calculates sum of subtasks if any have positive estimates, otherwise null.
 */
export function getDerivedSubtaskEstimate(subtasks?: SubTask[]): number | null {
  if (!subtasks || subtasks.length === 0) return null;
  const timed = subtasks.filter(
    (s) => typeof s.estimatedMinutes === 'number' && Number.isFinite(s.estimatedMinutes) && s.estimatedMinutes > 0
  );
  if (timed.length === 0) return null;
  return timed.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0);
}

/**
 * Read-time normalizer returning the effective estimate in minutes for a task.
 * Returns subtask sum if any timed subtasks exist, otherwise task.estimatedMinutes or 0.
 */
export function getEffectiveTaskEstimate(task: Partial<Task>): number {
  const derived = getDerivedSubtaskEstimate(task.subtasks);
  if (derived !== null) return derived;
  return typeof task.estimatedMinutes === 'number' && Number.isFinite(task.estimatedMinutes) && task.estimatedMinutes > 0
    ? task.estimatedMinutes
    : 0;
}

/**
 * Central time summary helper for FlowTask.
 * Implements the automatic subtask-time sync policy:
 * - Parent estimate = sum of timed subtasks
 * - Remaining work subtracts recorded time once
 * - Untimed subtask count indication
 * - Read-time normalization
 */
export function calculateTaskTimeSummary(
  task: Partial<Task>,
  recordedMinutesOverride?: number
): TaskTimeSummary {
  const subtasks = task.subtasks || [];
  const timedSubs = subtasks.filter(
    (s) => typeof s.estimatedMinutes === 'number' && Number.isFinite(s.estimatedMinutes) && s.estimatedMinutes > 0
  );
  const untimedSubs = subtasks.filter(
    (s) => typeof s.estimatedMinutes !== 'number' || !Number.isFinite(s.estimatedMinutes) || s.estimatedMinutes <= 0
  );

  const isDerivedFromSubtasks = timedSubs.length > 0;
  const totalSubEstimate = timedSubs.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0);
  const baseEstimate = typeof task.estimatedMinutes === 'number' && Number.isFinite(task.estimatedMinutes) && task.estimatedMinutes > 0
    ? task.estimatedMinutes
    : 0;
  const totalEstimateMinutes = isDerivedFromSubtasks ? totalSubEstimate : baseEstimate;

  const untimedSubtaskCount = untimedSubs.length;
  const untimedSubtaskIndicator =
    subtasks.length > 0 && untimedSubtaskCount > 0
      ? `${untimedSubtaskCount} subtask${untimedSubtaskCount > 1 ? 's need' : ' needs'} estimates`
      : undefined;

  const recordedMinutes =
    recordedMinutesOverride !== undefined
      ? Math.max(0, recordedMinutesOverride)
      : Math.max(0, task.timeSpentMinutes || 0);

  const completedSubs = timedSubs.filter((s) => s.completed);
  const unfinishedSubs = timedSubs.filter((s) => !s.completed);

  const completedSubtaskMinutes = completedSubs.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0);
  const unfinishedSubtaskMinutes = unfinishedSubs.reduce((acc, s) => acc + (s.estimatedMinutes || 0), 0);

  let remainingWorkMinutes = 0;
  if (task.status !== 'done') {
    if (isDerivedFromSubtasks) {
      // Attributed recorded work on subtasks
      const completedAttributed = subtasks.filter(s => s.completed).reduce(
        (acc, s) => acc + Math.max(0, s.timeSpentMinutes || 0),
        0
      );
      const unfinishedAttributed = subtasks.filter(s => !s.completed).reduce(
        (acc, s) => acc + Math.max(0, s.timeSpentMinutes || 0),
        0
      );
      const totalAttributed = completedAttributed + unfinishedAttributed;

      // If time was recorded directly on the parent task beyond attributed subtasks:
      const unattributedRecorded = Math.max(0, recordedMinutes - totalAttributed);

      // Calculate unfinished remaining estimates after their attributed work:
      const unfinishedRemainingAfterAttributed = unfinishedSubs.reduce(
        (acc, s) => acc + Math.max(0, (s.estimatedMinutes || 0) - (s.timeSpentMinutes || 0)),
        0
      );

      // Subtract remaining unattributed recorded work once (result non-negative)
      remainingWorkMinutes = Math.max(0, unfinishedRemainingAfterAttributed - unattributedRecorded);
    } else {
      remainingWorkMinutes = Math.max(0, totalEstimateMinutes - recordedMinutes);
    }
  }

  return {
    totalEstimateMinutes,
    isDerivedFromSubtasks,
    timedSubtaskCount: timedSubs.length,
    untimedSubtaskCount,
    untimedSubtaskIndicator,
    remainingWorkMinutes,
    recordedMinutes,
    completedSubtaskMinutes,
    unfinishedSubtaskMinutes,
  };
}

/** Shared budget fallback; task and subtask recorded work is counted once. */
export function getRemainingTaskEstimate(task: Partial<Task>, fallback = 30): number {
  const summary = calculateTaskTimeSummary(task);
  return summary.totalEstimateMinutes > 0 || task.status === "done"
    ? summary.remainingWorkMinutes
    : Math.max(0, fallback - summary.recordedMinutes);
}

// Snapshot tasks are immutable. Cache the normalized read model so timer and sync
// publications do not replace every row's identity or write a migration to disk.
const normalizedTaskLists = new WeakMap<Task[], Task[]>();
export function normalizeTaskEstimates(tasks: Task[]): Task[] {
  const cached = normalizedTaskLists.get(tasks);
  if (cached) return cached;
  let changed = false;
  const normalized = tasks.map(task => {
    const derived = getDerivedSubtaskEstimate(task.subtasks);
    if (derived === null || derived === task.estimatedMinutes) return task;
    changed = true;
    return { ...task, estimatedMinutes: derived };
  });
  const result = changed ? normalized : tasks;
  normalizedTaskLists.set(tasks, result);
  return result;
}
