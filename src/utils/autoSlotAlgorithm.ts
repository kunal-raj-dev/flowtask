import type { Task, CalendarEvent } from '../types/task';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
} from './timelineUtils';
import { calculateTaskPriorityScore } from './priorityScoring';

export interface AutoSlotOptions {
  startHour?: number;
  endHour?: number;
  bufferMinutes?: number;
  alignToQuarterHour?: boolean;
  maxCapacityMinutes?: number;
}

export interface SlottedTaskAssignment {
  taskId: string;
  taskTitle: string;
  scheduledStart: string;
  dueTime: string;
  startMinutes: number;
  durationMinutes: number;
}

export interface AutoSlotResult {
  slotted: SlottedTaskAssignment[];
  unslotted: Task[];
  totalSlottedMinutes: number;
  message: string;
}

interface OccupiedInterval {
  start: number;
  end: number;
}

/**
 * Deterministic Auto-Slot Algorithm:
 * Places unscheduled tasks into available schedule gaps based on priority and calendar constraints.
 * Zero AI hallucination; 100% predictable, conflict-free, and respectful of external calendar events.
 */
export function computeAutoSlotSchedule(
  unscheduledTasks: Task[],
  existingScheduledTasks: { task: Task; startMin: number; duration: number }[],
  calendarEvents: CalendarEvent[] = [],
  options: AutoSlotOptions = {}
): AutoSlotResult {
  const startHour = options.startHour ?? TIMELINE_START_HOUR;
  const endHour = options.endHour ?? TIMELINE_END_HOUR;
  const bufferMinutes = options.bufferMinutes ?? 5;
  const alignToQuarter = options.alignToQuarterHour ?? true;
  const maxCapacity = options.maxCapacityMinutes ?? (endHour - startHour) * 60;

  const dayStartMin = startHour * 60;
  const dayEndMin = endHour * 60;

  // 1. Build occupied intervals
  const occupied: OccupiedInterval[] = [];

  // Add existing scheduled tasks (plus buffer to ensure resting time)
  existingScheduledTasks.forEach(({ startMin, duration }) => {
    occupied.push({
      start: startMin,
      end: startMin + duration + bufferMinutes,
    });
  });

  // Add external calendar events
  calendarEvents.forEach((ev) => {
    if (ev.isAllDay) return;
    const start = parseTimeToMinutes(ev.startTime);
    const end = parseTimeToMinutes(ev.endTime);
    if (start !== null) {
      const duration = end !== null ? Math.max(15, end - start) : 30;
      occupied.push({
        start,
        end: start + duration,
      });
    }
  });

  // Sort and merge overlapping occupied intervals
  occupied.sort((a, b) => a.start - b.start);
  const mergedOccupied: OccupiedInterval[] = [];
  for (const interval of occupied) {
    if (mergedOccupied.length === 0) {
      mergedOccupied.push({ ...interval });
    } else {
      const last = mergedOccupied[mergedOccupied.length - 1];
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        mergedOccupied.push({ ...interval });
      }
    }
  }

  // 2. Sort unscheduled tasks deterministically:
  // - Pinned Top 3 tasks first
  // - Then by composite priority score (from priorityScoring engine)
  // - Then by priority grade (p1 > p2 > p3 > p4)
  const priorityGradeWeight = { p1: 4, p2: 3, p3: 2, p4: 1 };
  const sortedTasks = [...unscheduledTasks].sort((a, b) => {
    if (a.isPinnedToday && !b.isPinnedToday) return -1;
    if (!a.isPinnedToday && b.isPinnedToday) return 1;

    const scoreA = calculateTaskPriorityScore(a, unscheduledTasks).compositeScore;
    const scoreB = calculateTaskPriorityScore(b, unscheduledTasks).compositeScore;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    const gradeA = priorityGradeWeight[a.priority || 'p4'] || 1;
    const gradeB = priorityGradeWeight[b.priority || 'p4'] || 1;
    return gradeB - gradeA;
  });

  const slotted: SlottedTaskAssignment[] = [];
  const unslotted: Task[] = [];
  let totalSlottedMinutes = 0;

  // 3. Greedily find earliest free gap for each task
  for (const task of sortedTasks) {
    const duration = task.estimatedMinutes || 30;

    // Check if adding this task would exceed max capacity
    if (totalSlottedMinutes + duration > maxCapacity) {
      unslotted.push(task);
      continue;
    }

    // Find next available gap starting from dayStartMin
    let candidateStart = dayStartMin;
    let foundSlot: number | null = null;

    while (candidateStart + duration <= dayEndMin) {
      // Check collision with merged occupied intervals
      const candidateEnd = candidateStart + duration;
      const collision = mergedOccupied.find(
        (occ) => candidateStart < occ.end && candidateEnd > occ.start
      );

      if (collision) {
        // Jump candidateStart past the end of the collision
        candidateStart = collision.end;
        if (alignToQuarter) {
          candidateStart = Math.ceil(candidateStart / 15) * 15;
        }
      } else {
        foundSlot = candidateStart;
        break;
      }
    }

    if (foundSlot !== null) {
      const scheduledStart = minutesToTimeStr(foundSlot);
      const dueTime = minutesToTimeStr(foundSlot + duration);

      slotted.push({
        taskId: task.id,
        taskTitle: task.title,
        scheduledStart,
        dueTime,
        startMinutes: foundSlot,
        durationMinutes: duration,
      });

      totalSlottedMinutes += duration;

      // Add new occupied slot including buffer
      const newIntervalEnd = foundSlot + duration + bufferMinutes;
      mergedOccupied.push({
        start: foundSlot,
        end: newIntervalEnd,
      });
      // Keep sorted and merged
      mergedOccupied.sort((a, b) => a.start - b.start);
      // Fast re-merge
      for (let i = 0; i < mergedOccupied.length - 1; i++) {
        if (mergedOccupied[i + 1].start <= mergedOccupied[i].end) {
          mergedOccupied[i].end = Math.max(mergedOccupied[i].end, mergedOccupied[i + 1].end);
          mergedOccupied.splice(i + 1, 1);
          i--;
        }
      }
    } else {
      unslotted.push(task);
    }
  }

  let message = `Successfully auto-slotted ${slotted.length} task${slotted.length === 1 ? '' : 's'}.`;
  if (unslotted.length > 0) {
    message += ` ${unslotted.length} could not fit in today's calendar window.`;
  }

  return {
    slotted,
    unslotted,
    totalSlottedMinutes,
    message,
  };
}
