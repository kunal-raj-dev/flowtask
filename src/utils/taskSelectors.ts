import type { Task } from '../types/task';
import { formatLocalDate } from './nlpParser';
import { getTaskEligibility, isDeferred, type TaskEligibilityContext } from './taskEligibility';

export const isVisibleTask = (task: Task) => !task.deletedAt && !task.archivedAt;
export const isActiveTask = (task: Task) => isVisibleTask(task) && task.status !== 'done';

export const isTaskDeferred = (task: Task, date = formatLocalDate(new Date()), context: TaskEligibilityContext = {}): boolean =>
  isDeferred(task, { ...context, date });

export const isTaskActionable = (task: Task, date = formatLocalDate(new Date()), context: TaskEligibilityContext = {}): boolean =>
  getTaskEligibility(task, { ...context, date }).actionable;

export const isTaskPinnedForDate = (task: Task, date: string) =>
  isActiveTask(task) && (task.topThreeDate === date || (!task.topThreeDate && !!task.isPinnedToday && (task.plannedDate === date || (!task.plannedDate && task.dueDate === date))));

export const isFocusTask = (task: Task, date = formatLocalDate(new Date()), context: TaskEligibilityContext = {}) =>
  isTaskActionable(task, date, context) && isTaskPinnedForDate(task, date);

export const isTodayTask = (task: Task, date = formatLocalDate(new Date()), context: TaskEligibilityContext = {}) =>
  isTaskActionable(task, date, context) && (task.plannedDate === date || isFocusTask(task, date, context) || (!task.plannedDate && task.dueDate === date));

export const isInboxTask = (task: Task, date = formatLocalDate(new Date()), context: TaskEligibilityContext = {}) =>
  isActiveTask(task) && !task.isSomeday && !isTaskDeferred(task, date, context) && task.projectId === 'inbox' && !task.plannedDate && !task.dueDate;

export const isSomedayTask = (task: Task) => isActiveTask(task) && !!task.isSomeday;

export const isUpcomingTask = (task: Task, date = formatLocalDate(new Date())) =>
  isActiveTask(task) && !task.isSomeday && (task.plannedDate || task.dueDate || '') > date;

export const isDeferredTask = (task: Task, date = formatLocalDate(new Date())) =>
  isActiveTask(task) && isTaskDeferred(task, date);

export const completedOn = (task: Task, date: string) => isVisibleTask(task) && task.status === 'done' && !!task.completedAt && formatLocalDate(new Date(task.completedAt)) === date;
export const recordedMinutes = (task: Task) => Math.max(0, task.timeSpentMinutes || 0);

export const isStudyTask = (task: Task): boolean => {
  // Only classify as study if explicitly flagged as study, tagged with 'study', or assigned to study project/pacing.
  // Mere existence of a scheduled session does NOT make a task a study task!
  return Boolean(
    task.isStudy ||
    task.sessionMetadata?.targetPacingMinutes ||
    task.projectId === 'study' ||
    task.tags?.includes('study')
  );
};
