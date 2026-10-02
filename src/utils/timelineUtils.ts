import type { Task, CalendarEvent, CognitiveIntensity } from '../types/task';

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

/**
 * Classifies a task into Cognitive Intensity:
 * - deep: P1, pinned as top focus, or >= 45m duration
 * - admin: P4, or <= 15m duration
 * - medium: Standard tasks
 */
export function classifyTaskCognitiveIntensity(task: Task): CognitiveIntensity {
  if (task.priority === 'p1' || task.isPinnedToday || (task.estimatedMinutes && task.estimatedMinutes >= 45)) {
    return 'deep';
  }
  if (task.priority === 'p4' || (task.estimatedMinutes && task.estimatedMinutes <= 15)) {
    return 'admin';
  }
  return 'medium';
}

export interface CognitiveTopology {
  deepWorkMinutes: number;
  deepWorkHours: string;
  adminMinutes: number;
  adminHours: string;
  meetingMinutes: number;
  meetingHours: string;
  totalLoadMinutes: number;
  hasHighCognitiveStrain: boolean;
  maxConsecutiveStrainMinutes: number;
  strainWarning?: string;
}

/**
 * Analyzes the cognitive distribution and identifies fatigue blocks (>= 3h back-to-back without rest).
 */
export function analyzeCognitiveTopology(
  tasks: Task[],
  calendarEvents: CalendarEvent[] = []
): CognitiveTopology {
  let deepWorkMinutes = 0;
  let adminMinutes = 0;

  tasks.forEach((t) => {
    const duration = t.estimatedMinutes || 30;
    const intensity = classifyTaskCognitiveIntensity(t);
    if (intensity === 'deep') deepWorkMinutes += duration;
    else if (intensity === 'admin') adminMinutes += duration;
  });

  const meetingMinutes = calendarEvents.reduce((acc, ev) => {
    if (ev.isAllDay) return acc;
    const s = parseTimeToMinutes(ev.startTime);
    const e = parseTimeToMinutes(ev.endTime);
    if (s === null) return acc;
    const dur = e !== null ? Math.max(15, e - s) : 30;
    return acc + dur;
  }, 0);

  // Detect high-cognitive strain blocks (meetings + deep work tasks scheduled back to back)
  interface TimeBlock {
    start: number;
    end: number;
    isHighStrain: boolean;
  }

  const blocks: TimeBlock[] = [];

  tasks.forEach((t) => {
    const timeStr = t.scheduledStart || t.dueTime;
    const start = parseTimeToMinutes(timeStr);
    if (start !== null) {
      const dur = t.estimatedMinutes || 30;
      const intensity = classifyTaskCognitiveIntensity(t);
      blocks.push({
        start,
        end: start + dur,
        isHighStrain: intensity === 'deep',
      });
    }
  });

  calendarEvents.forEach((ev) => {
    if (ev.isAllDay) return;
    const start = parseTimeToMinutes(ev.startTime);
    const end = parseTimeToMinutes(ev.endTime);
    if (start !== null) {
      const dur = end !== null ? Math.max(15, end - start) : 30;
      blocks.push({
        start,
        end: start + dur,
        isHighStrain: true, // Meetings consume executive attention
      });
    }
  });

  blocks.sort((a, b) => a.start - b.start);

  let currentStreak = 0;
  let maxConsecutiveStrainMinutes = 0;
  let lastEnd = -1;

  for (const b of blocks) {
    if (!b.isHighStrain) {
      if (lastEnd !== -1 && b.start - lastEnd >= 15) {
        currentStreak = 0;
      }
      lastEnd = Math.max(lastEnd, b.end);
      continue;
    }

    const dur = b.end - b.start;
    if (lastEnd === -1 || b.start - lastEnd <= 15) {
      currentStreak += dur;
    } else {
      currentStreak = dur;
    }
    lastEnd = Math.max(lastEnd, b.end);

    if (currentStreak > maxConsecutiveStrainMinutes) {
      maxConsecutiveStrainMinutes = currentStreak;
    }
  }

  const hasHighCognitiveStrain = maxConsecutiveStrainMinutes >= 180; // 3+ hours
  let strainWarning: string | undefined;
  if (hasHighCognitiveStrain) {
    const hours = (maxConsecutiveStrainMinutes / 60).toFixed(1);
    strainWarning = `High continuous cognitive strain detected (${hours}h without rest). Insert a 15–20m restorative buffer or admin task.`;
  }

  return {
    deepWorkMinutes,
    deepWorkHours: (deepWorkMinutes / 60).toFixed(1),
    adminMinutes,
    adminHours: (adminMinutes / 60).toFixed(1),
    meetingMinutes,
    meetingHours: (meetingMinutes / 60).toFixed(1),
    totalLoadMinutes: deepWorkMinutes + adminMinutes + meetingMinutes,
    hasHighCognitiveStrain,
    maxConsecutiveStrainMinutes,
    strainWarning,
  };
}

/**
 * Detects if a scheduled time slot [startMin, startMin + duration] collides with any calendar event.
 */
export function findOverlappingCalendarEvent(
  startMin: number,
  duration: number,
  events: CalendarEvent[]
): CalendarEvent | null {
  const taskEnd = startMin + duration;
  for (const ev of events) {
    if (ev.isAllDay) continue;
    const evStart = parseTimeToMinutes(ev.startTime);
    const evEnd = parseTimeToMinutes(ev.endTime);
    if (evStart === null) continue;
    const actualEvEnd = evEnd !== null ? Math.max(evStart + 15, evEnd) : evStart + 30;

    // Overlap condition: startMin < actualEvEnd && taskEnd > evStart
    if (startMin < actualEvEnd && taskEnd > evStart) {
      return ev;
    }
  }
  return null;
}

/**
 * Finds the next available free 15-minute aligned gap of at least `durationMinutes`
 * on the daily schedule rail, avoiding both existing scheduled tasks and calendar events.
 */
export function findNextFreeGap(
  durationMinutes: number,
  tasks: Task[],
  events: CalendarEvent[],
  fromMin: number = TIMELINE_START_HOUR * 60
): number | null {
  const effectiveFrom = Math.max(TIMELINE_START_HOUR * 60, Math.ceil(fromMin / 15) * 15);
  const endLimit = TIMELINE_END_HOUR * 60;

  // Build list of occupied intervals
  interface OccupiedInterval {
    start: number;
    end: number;
  }
  const occupied: OccupiedInterval[] = [];

  tasks.forEach((t) => {
    const timeStr = t.scheduledStart || t.dueTime;
    const s = parseTimeToMinutes(timeStr);
    if (s !== null) {
      const dur = t.estimatedMinutes || 30;
      occupied.push({ start: s, end: s + dur });
    }
  });

  events.forEach((ev) => {
    if (ev.isAllDay) return;
    const s = parseTimeToMinutes(ev.startTime);
    const e = parseTimeToMinutes(ev.endTime);
    if (s !== null) {
      const dur = e !== null ? Math.max(15, e - s) : 30;
      occupied.push({ start: s, end: s + dur });
    }
  });

  // Step through in 15-minute increments
  for (let candidate = effectiveFrom; candidate + durationMinutes <= endLimit; candidate += 15) {
    const candidateEnd = candidate + durationMinutes;
    const hasCollision = occupied.some(
      (occ) => candidate < occ.end && candidateEnd > occ.start
    );
    if (!hasCollision) {
      return candidate;
    }
  }

  return null;
}
