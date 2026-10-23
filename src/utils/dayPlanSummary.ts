import type { Task, CalendarEvent } from "../types/task";
import type { DayPlanSummary } from "../types/dashboard";
import type { UserWorkflowSettings } from "../types/settings";
import { parseTimeToMinutes } from "./timelineUtils";
import { isTodayTask } from "./taskSelectors";
import { formatLocalDate } from "./nlpParser";
import { calculateTaskTimeSummary } from "./taskTimeSummary";

export interface DayPlanCalculationOptions {
  date: string; // YYYY-MM-DD
  tasks: Task[];
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
    if (t.status === "done") {
      if (t.completedAt) {
        return formatLocalDate(new Date(t.completedAt)) === date;
      }
      return t.plannedDate === date || (!t.plannedDate && t.dueDate === date);
    }
    if (isDateToday) {
      return isTodayTask(t, todayStr);
    }
    return t.plannedDate === date || (!t.plannedDate && t.dueDate === date);
  });

  let totalDemandMinutes = 0;
  let remainingTaskWorkMinutes = 0;
  let scheduledTaskMinutes = 0;
  let missingEstimatesCount = 0;
  let completedTaskCount = 0;

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

    if (task.scheduledStart) {
      const s = parseTimeToMinutes(task.scheduledStart);
      const e =
        parseTimeToMinutes(task.scheduledEnd) ??
        (s === null ? null : s + estimate);
      if (s !== null && e !== null && e > s) {
        scheduledTaskMinutes += e - s;
      }
    }
  }

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
