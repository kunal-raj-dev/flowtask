import { getEffectiveTaskEstimate, getDerivedSubtaskEstimate } from '../utils/taskTimeSummary';
import type { Task, CalendarEvent, Project } from '../types/task';
import { DEFAULT_WORKFLOW_SETTINGS, type UserWorkflowSettings } from '../types/settings';
import { calculateDayPlanSummary } from '../utils/dayPlanSummary';
import { computeAutoSlotSchedule } from '../utils/autoSlotAlgorithm';
import { getTaskEligibility, eligibilityMessage } from '../utils/taskEligibility';
import { formatLocalDate } from '../utils/nlpParser';
import { isFocusTask, isTaskPinnedForDate } from '../utils/taskSelectors';
import { parseTimeToMinutes } from '../utils/timelineUtils';

export interface SchedulePlannerInput {
  date: string;
  tasks: Task[];
  projects?: Project[];
  calendarEvents?: CalendarEvent[];
  settings?: Partial<UserWorkflowSettings>;
  selectedIds?: string[];
  estimates?: Record<string, number>;
  now?: Date;
}

export function isPlanDate(value: string) {
  const date = new Date(value + 'T12:00:00');
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && formatLocalDate(date) === value;
}

export function belongsToPlanDay(task: Task, date: string, today: string) {
  return task.plannedDate === date || (!task.plannedDate && task.dueDate === date)
    || (date === today && isTaskPinnedForDate(task, today));
}

export function scheduleExclusion(task: Task, tasks: Task[], projects: Project[] = [], date?: string, now?: Date) {
  if (task.deletedAt || task.archivedAt || task.status === 'done') return 'This task is no longer active.';
  if (task.scheduleLocked) return 'This task is locked. Unlock it in task details to schedule it.';
  if (task.scheduledStart) return 'Already scheduled; its existing block stays in place.';
  // Choosing a task explicitly may promote it from Someday, but never overrides availability.
  const eligibility = getTaskEligibility({ ...task, isSomeday: false }, { tasks, projects, date, now });
  if (!eligibility.actionable) return eligibilityMessage(eligibility);
  return '';
}

/** Read-only proposal; every entry point uses the same constraints and capacity. */
export function createSchedulePreview(input: SchedulePlannerInput) {
  const now = input.now ?? new Date();
  const today = formatLocalDate(now);
  const validDate = isPlanDate(input.date);
  const settings = { ...DEFAULT_WORKFLOW_SETTINGS, ...input.settings };
  const projects = input.projects ?? [];
  const eligibilityNow = validDate && input.date !== today ? new Date(input.date + 'T23:59:59') : now;
  const ids = input.selectedIds ?? input.tasks.filter(t => !t.isSomeday && belongsToPlanDay(t, input.date, today) && !scheduleExclusion(t, input.tasks, projects, input.date, eligibilityNow)).map(t => t.id);
  const selected = new Set(ids);
  const tasks = [...new Map(input.tasks.map(t => [t.id, t])).values()].map(t => ({ ...t, estimatedMinutes: getDerivedSubtaskEstimate(t.subtasks) ?? input.estimates?.[t.id] ?? t.estimatedMinutes }));
  const events = (input.calendarEvents ?? []).filter(e => e.date === input.date || (!e.date && input.date === today));
  const dayTasks = tasks.filter(t => !t.deletedAt && !t.archivedAt && belongsToPlanDay(t, input.date, today));
  const scheduled = dayTasks.flatMap(task => {
    const startMin = parseTimeToMinutes(task.scheduledStart);
    const endMin = parseTimeToMinutes(task.scheduledEnd);
    return startMin === null ? [] : [{ task, startMin, duration: endMin !== null && endMin > startMin ? endMin - startMin : getEffectiveTaskEstimate(task) || settings.defaultTaskDuration }];
  });
  const summary = calculateDayPlanSummary({ date: input.date, todayStr: today, tasks, projects, calendarEvents: events, settings });
  const budget = Math.max(0, summary.availableTaskBudgetMinutes - summary.scheduledTaskMinutes);
  const reasons: Record<string, string> = {};
  const candidates = tasks.filter(task => {
    if (!selected.has(task.id)) return false;
    const reason = !validDate || input.date < today ? 'Choose today or a future date.' : scheduleExclusion(task, tasks, projects, input.date, eligibilityNow);
    if (reason) { reasons[task.id] = reason; return false; }
    return true;
  }).map(t => ({ ...t, isPinnedToday: isFocusTask(t, input.date, { tasks, projects, now: eligibilityNow }) }));
  for (const id of selected) if (!tasks.some(t => t.id === id)) reasons[id] = 'This task is no longer available.';
  const validEvents = events.filter(event => {
    const start = parseTimeToMinutes(event.startTime), end = parseTimeToMinutes(event.endTime);
    return event.isAllDay || start !== null && end !== null && end > start;
  });
  const result = computeAutoSlotSchedule(candidates, scheduled, validEvents, {
    startHour: settings.timelineStartHour, endHour: settings.timelineEndHour,
    bufferMinutes: settings.autoSlotBufferMinutes, maxCapacityMinutes: budget,
    earliestStartMinutes: input.date === today ? now.getHours() * 60 + now.getMinutes() + 1 : 0,
    defaultTaskMinutes: settings.defaultTaskDuration, date: input.date,
    allTasks: tasks, referenceDate: validDate ? new Date(input.date + 'T12:00:00') : now, bufferCalendarEvents: true,
  });
  // Deliberately covers workspace edits as well as slot changes: no stale review is applied.
  const fingerprint = JSON.stringify({ date: input.date, tasks, projects, events, settings, ids: [...selected].sort(), slots: result.slotted });
  return { ...result, date: input.date, fingerprint, budget, settings, reasons: { ...reasons, ...result.reasons },
    warnings: candidates.filter(t => t.dueDate && t.dueDate < input.date).map(t => `${t.title}: its deadline has already passed.`),
  };
}

export type SchedulePreview = ReturnType<typeof createSchedulePreview>;

export function scheduleChanges(preview: SchedulePreview) {
  return preview.slotted.map(slot => ({ id: slot.taskId, updates: {
    plannedDate: preview.date, isSomeday: false, scheduledStart: slot.scheduledStart,
    scheduledEnd: slot.dueTime, estimatedMinutes: slot.durationMinutes,
  } }));
}
