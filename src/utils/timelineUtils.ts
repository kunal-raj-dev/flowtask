import type { Task } from '../types/task';

export const TIMELINE_START_HOUR = 7;
export const TIMELINE_END_HOUR = 22;
export const TIMELINE_HOUR_HEIGHT_PX = 80;

/**
 * Converts a time string "HH:mm" into minutes from midnight (0-1439).
 */
export function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Converts minutes from midnight into a formatted 24h string "HH:mm".
 */
export function minutesToTimeStr(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export interface CapacityMetrics {
  totalPlannedMinutes: number;
  totalPlannedHours: string;
  targetHours: number;
  capacityPercent: number;
  status: 'healthy' | 'full' | 'overbooked';
}

/**
 * Computes workload capacity metrics for a set of daily tasks.
 */
export function calculateCapacityMetrics(
  tasks: Task[],
  targetWorkCapacityHours: number = 6.0
): CapacityMetrics {
  const totalPlannedMinutes = tasks.reduce(
    (acc, t) => acc + (t.estimatedMinutes || 30),
    0
  );
  const totalPlannedHours = (totalPlannedMinutes / 60).toFixed(1);
  const targetMinutes = targetWorkCapacityHours * 60;
  const capacityPercent = Math.min(
    150,
    Math.round((totalPlannedMinutes / targetMinutes) * 100)
  );

  let status: 'healthy' | 'full' | 'overbooked' = 'healthy';
  if (capacityPercent > 100) {
    status = 'overbooked';
  } else if (capacityPercent > 75) {
    status = 'full';
  }

  return {
    totalPlannedMinutes,
    totalPlannedHours,
    targetHours: targetWorkCapacityHours,
    capacityPercent,
    status,
  };
}

/**
 * Calculates CSS top and height offsets for a scheduled block.
 */
export function calculateBlockPosition(
  startMin: number,
  duration: number,
  startHour: number = TIMELINE_START_HOUR,
  hourHeightPx: number = TIMELINE_HOUR_HEIGHT_PX
): { topPx: number; heightPx: number } {
  const topPx = ((startMin - startHour * 60) / 60) * hourHeightPx;
  const heightPx = Math.max(38, (duration / 60) * hourHeightPx);
  return { topPx, heightPx };
}
