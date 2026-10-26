import type { Task, CalendarEvent, Project } from "../types/task";
import type { DayPlanSummary } from "../types/dashboard";
import type { UserWorkflowSettings } from "../types/settings";
import { parseTimeToMinutes } from "./timelineUtils";
import { isTodayTask } from "./taskSelectors";
import { formatLocalDate } from "./nlpParser";
import { calculateTaskTimeSummary } from "./taskTimeSummary";

export interface DayPlanCalculationOptions {
  date: string; // YYYY-MM-DD
  tasks: Task[];
  projects?: Project[];
  calendarEvents?: CalendarEvent[];
  settings?: Partial<UserWorkflowSettings>;
  focusLogsSecondsToday?: number;
  todayStr?: string;
}

export function calculateWeekPlanSummary(
  options: Omit<DayPlanCalculationOptions, "date"> & { startDate: string },
) {
  const [year, month, day] = options.startDate.split("-").map(Number);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(year, month - 1, day + index),
      key = formatLocalDate(date);
    return {
      key,
      date,
      summary: calculateDayPlanSummary({ ...options, date: key }),
      deadlinesCount: new Set(
        options.tasks
          .filter(
            (t) =>
              !t.deletedAt &&
              !t.archivedAt &&
              t.status !== "done" &&
              t.dueDate === key,
          )
          .map((t) => t.id),
      ).size,
    };
  });
}

/**
 * Merges overlapping intervals [start, end] and returns total unique minutes.
 */
export function calculateUniqueIntervalMinutes(
  intervals: Array<[number, number]>,
): number {
  if (intervals.length === 0) return 0;

  // Filter invalid intervals and sort by start
  const sorted = intervals
    .filter(
      ([start, end]) =>
        Number.isFinite(start) && Number.isFinite(end) && end > start,
    )
    .sort((a, b) => a[0] - b[0]);

  if (sorted.length === 0) return 0;

  let total = 0;
  let currentStart = sorted[0][0];
  let currentEnd = sorted[0][1];

  for (let i = 1; i < sorted.length; i++) {
    const [nextStart, nextEnd] = sorted[i];
    if (nextStart <= currentEnd) {
      // Overlap or contiguous - extend end
      currentEnd = Math.max(currentEnd, nextEnd);
    } else {
      // Gap - commit previous interval
      total += currentEnd - currentStart;
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
  }

  // Commit last interval
  total += currentEnd - currentStart;
  return total;
}

/**
 * Shared daily-summary calculation used across Today widgets, guided planning, Plan, and Upcoming.
 * - Available task budget = configured capacity minus unique timed calendar commitments within working hours.
 * - Scheduled tasks count once.
 * - Missing estimates use configured default and are identified as estimates.
 * - Remaining task work and recorded focus time are separate measures.
 * - Calendar all-day events display separately from timed capacity.
 * - Planning a task changes its planned date; deadlines remain independent.
 */
export function calculateDayPlanSummary(
  options: DayPlanCalculationOptions,
): DayPlanSummary {
  const {
    date,
    tasks,
    projects = [],
    calendarEvents = [],
    settings = {},
    focusLogsSecondsToday = 0,
    todayStr = date,
  } = options;

  const targetWorkCapacityHours = settings.targetWorkCapacityHours ?? 6.0;
  const configuredCapacityMinutes = Math.round(targetWorkCapacityHours * 60);
  const defaultTaskDuration = settings.defaultTaskDuration ?? 30;

  const startHour = settings.timelineStartHour ?? 7;
  const endHour = settings.timelineEndHour ?? 22;
  const windowStartMin = startHour * 60;
  const windowEndMin = endHour * 60;

  // Separate all-day and timed events for the given date
  const eventsForDay = calendarEvents.filter(
    (e) => e.date === date || (!e.date && date === todayStr),
  );

  const allDayEvents: Array<{ id: string; title: string }> = [];
  const timedEvents: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  }> = [];

  const timedIntervalsInWorkingHours: Array<[number, number]> = [];

  for (const event of eventsForDay) {
    if (event.isAllDay) {
      allDayEvents.push({
        id: event.id,
        title: event.title || "All-day event",
      });
    } else {
      const startMin = parseTimeToMinutes(event.startTime);
      const endMin = parseTimeToMinutes(event.endTime);

      if (startMin !== null && endMin !== null && endMin > startMin) {
        const duration = endMin - startMin;
        timedEvents.push({
          id: event.id,
          title: event.title || "Event",
          startTime: event.startTime,
          endTime: event.endTime,
          durationMinutes: duration,
        });

        // Clamped interval within configured working hours
        const clampedStart = Math.max(windowStartMin, startMin);
        const clampedEnd = Math.min(windowEndMin, endMin);
        if (clampedEnd > clampedStart) {
          timedIntervalsInWorkingHours.push([clampedStart, clampedEnd]);
        }
      }
    }
  }

  const timedCalendarMinutes = calculateUniqueIntervalMinutes(
    timedIntervalsInWorkingHours,
  );
  const availableTaskBudgetMinutes = Math.max(
    0,
    configuredCapacityMinutes - timedCalendarMinutes,
  );

  // Filter tasks planned for this date
  const isDateToday = date === todayStr;
  const dayTasks = tasks.filter((t) => {
    if (t.deletedAt || t.archivedAt) return false;
    const hasBlockForDate = Boolean(t.workBlocks && t.workBlocks.some((b) => b.date === date));
    if (hasBlockForDate) return true;
    if (t.status === "done") {
      if (t.completedAt) {
        return formatLocalDate(new Date(t.completedAt)) === date;
      }
      return t.plannedDate === date || (!t.plannedDate && t.dueDate === date);
    }
    if (isDateToday) {
      return isTodayTask(t, todayStr, { tasks, projects });
    }
    return t.plannedDate === date || (!t.plannedDate && t.dueDate === date);
  });

  let totalDemandMinutes = 0;
  let remainingTaskWorkMinutes = 0;
  let scheduledTaskMinutes = 0;
  let missingEstimatesCount = 0;
  let completedTaskCount = 0;
  const scheduledTaskIntervals: Array<[number, number]> = [];

  // Import and sync retries must never double-count an ID.
  const uniqueTasks = [
    ...new Map(dayTasks.map((task) => [task.id, task])).values(),
  ];
  for (const task of uniqueTasks) {
    const isDone = task.status === "done";
    if (isDone) {
      completedTaskCount++;
    }

    const timeSummary = calculateTaskTimeSummary(task);
    const hasEstimate = timeSummary.totalEstimateMinutes > 0;

    if (!hasEstimate) {
      missingEstimatesCount++;
    }

    const estimate = hasEstimate ? timeSummary.totalEstimateMinutes : defaultTaskDuration;
    totalDemandMinutes += estimate;

    if (!isDone) {
      remainingTaskWorkMinutes += hasEstimate
        ? timeSummary.remainingWorkMinutes
        : Math.max(0, defaultTaskDuration - (task.timeSpentMinutes || 0));
    }

    const blocksOnDay = (task.workBlocks || []).filter((b) => b.date === date && b.status !== 'cancelled');
    if (blocksOnDay.length > 0) {
      for (const b of blocksOnDay) {
        const s = b.startTime ? parseTimeToMinutes(b.startTime) : null;
        const e = b.endTime ? parseTimeToMinutes(b.endTime) : (s !== null ? s + b.durationMinutes : null);
        const blockMins = b.durationMinutes || (s !== null && e !== null && e > s ? e - s : 0);
        scheduledTaskMinutes += blockMins;
        if (s !== null && e !== null && e > s) {
          scheduledTaskIntervals.push([s, e]);
        }
      }
    } else if (task.scheduledStart) {
      const s = parseTimeToMinutes(task.scheduledStart);
      const e =
        parseTimeToMinutes(task.scheduledEnd) ??
        (s === null ? null : s + estimate);
      if (s !== null && e !== null && e > s) {
        scheduledTaskMinutes += e - s;
        scheduledTaskIntervals.push([s, e]);
      }
    }
  }

  const allOccupiedIntervals = [...timedIntervalsInWorkingHours, ...scheduledTaskIntervals];
  const uniqueOccupiedMinutes = calculateUniqueIntervalMinutes(allOccupiedIntervals);
  const rawOccupiedTotal = timedCalendarMinutes + scheduledTaskMinutes;
  const conflictMinutes = Math.max(0, rawOccupiedTotal - uniqueOccupiedMinutes);
  const freeCalendarMinutes = Math.max(0, configuredCapacityMinutes - uniqueOccupiedMinutes);

  const recordedFocusMinutes = Math.round(focusLogsSecondsToday / 60);
  const overbooked = totalDemandMinutes > availableTaskBudgetMinutes;
  const overbookedMinutes = Math.max(
    0,
    totalDemandMinutes - availableTaskBudgetMinutes,
  );

  return {
    date,
    configuredCapacityMinutes,
    timedCalendarMinutes,
    availableTaskBudgetMinutes,
    totalDemandMinutes,
    scheduledTaskMinutes,
    uniqueOccupiedMinutes,
    conflictMinutes,
    freeCalendarMinutes,
    remainingTaskWorkMinutes,
    recordedFocusMinutes,
    completedTaskCount,
    totalTaskCount: uniqueTasks.length,
    overbooked,
    overbookedMinutes,
    allDayCalendarEvents: allDayEvents,
    timedCalendarEvents: timedEvents,
    missingEstimatesCount,
  };
}

export type TimedCalendarEvent = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
};

/**
 * Calculates a realistic projected finish time (HH:MM) starting from nowDate,
 * accounting for remaining task work and hopping over active or upcoming calendar commitments.
 */
function calculateFinishMinutes(
  nowDate: Date,
  remainingWorkMinutes: number,
  timedCalendarEvents: TimedCalendarEvent[] = []
): number {
  const safeDate = Number.isNaN(nowDate?.getTime?.() ?? NaN) ? new Date() : nowDate;
  const currentMin = safeDate.getHours() * 60 + safeDate.getMinutes();
  if (remainingWorkMinutes <= 0) {
    return currentMin;
  }

  // Find intervals of active or upcoming calendar events
  const intervals: Array<[number, number]> = [];
  for (const ev of timedCalendarEvents) {
    const s = parseTimeToMinutes(ev.startTime);
    const e = parseTimeToMinutes(ev.endTime);
    if (s !== null && e !== null && e > currentMin && e > s) {
      intervals.push([Math.max(currentMin, s), e]);
    }
  }

  // Merge overlapping or contiguous blocked intervals
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push(interval);
    } else {
      const last = merged[merged.length - 1];
      if (interval[0] <= last[1]) {
        last[1] = Math.max(last[1], interval[1]);
      } else {
        merged.push(interval);
      }
    }
  }

  let t = currentMin;
  let rem = remainingWorkMinutes;

  for (const [start, end] of merged) {
    if (t < start) {
      const gap = start - t;
      if (rem <= gap) {
        t += rem;
        rem = 0;
        break;
      } else {
        rem -= gap;
        t = end;
      }
    } else if (t >= start && t < end) {
      t = end;
    }
  }

  if (rem > 0) {
    t += rem;
  }

  return t;
}

export function calculateFinishForecast(now: Date, remainingMinutes: number, events: TimedCalendarEvent[] = [], endHour = 24) {
  const minutes = calculateFinishMinutes(now, remainingMinutes, events);
  return { time: `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`,
    dayOffset: Math.floor(minutes / 1440), outsideWorkHours: remainingMinutes > 0 && minutes > endHour * 60 };
}

/** Compatibility clock label; callers displaying a forecast should also expose day offset and work-hour limits. */
export function calculateFeasibleFinishTime(now: Date, remainingMinutes: number, events: TimedCalendarEvent[] = []): string {
  return calculateFinishForecast(now, remainingMinutes, events).time;
}

