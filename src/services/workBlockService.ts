import type { WorkBlock, Task } from '../types/task';
import type { WorkspaceStore } from './workspaceStore';

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
  }
): WorkBlock {
  const now = new Date().toISOString();
  const workBlock: WorkBlock = {
    id: crypto.randomUUID(),
    taskId,
    date: blockData.date,
    durationMinutes: blockData.durationMinutes,
    startTime: blockData.startTime,
    endTime: blockData.endTime,
    title: blockData.title,
    isLocked: blockData.isLocked ?? false,
    createdAt: now,
    updatedAt: now,
  };

  store.run('Add work block to task', (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error('Task not found.');

    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        workBlocks: [...(t.workBlocks || []), workBlock],
      };
    });

    return {
      ...record,
      tasks: updatedTasks,
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
  const now = new Date().toISOString();

  store.run('Update work block', (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error('Task not found.');

    const blockExists = (task.workBlocks || []).some((b) => b.id === blockId);
    if (!blockExists) throw new Error('Work block not found.');

    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        workBlocks: (t.workBlocks || []).map((b) =>
          b.id === blockId ? { ...b, ...updates, updatedAt: now } : b
        ),
      };
    });

    return {
      ...record,
      tasks: updatedTasks,
    };
  });
}

export function removeWorkBlock(
  store: WorkspaceStore,
  taskId: string,
  blockId: string
): void {
  store.run('Remove work block', (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error('Task not found.');

    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        workBlocks: (t.workBlocks || []).filter((b) => b.id !== blockId),
      };
    });

    return {
      ...record,
      tasks: updatedTasks,
    };
  });
}

export function getWorkBlocksForDate(
  tasks: Task[],
  date: string
): Array<{ block: WorkBlock; task: Task }> {
  const results: Array<{ block: WorkBlock; task: Task }> = [];
  tasks.forEach((task) => {
    if (task.deletedAt || task.archivedAt) return;
    (task.workBlocks || []).forEach((block) => {
      if (block.date === date) {
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
