import type { Task } from '../types/task';
import { formatLocalDate } from './nlpParser';

export const isVisibleTask = (task: Task) => !task.deletedAt && !task.archivedAt;
export const isActiveTask = (task: Task) => isVisibleTask(task) && task.status !== 'done';
export const isFocusTask = (task: Task, date = formatLocalDate(new Date())) =>
  isActiveTask(task) && (task.topThreeDate === date || (!task.topThreeDate && !!task.isPinnedToday && task.plannedDate === date));
export const isTodayTask = (task: Task, date = formatLocalDate(new Date())) =>
  isActiveTask(task) && !task.isSomeday && (task.plannedDate === date || isFocusTask(task, date) || (!task.plannedDate && task.dueDate === date));
export const isInboxTask = (task: Task) => isActiveTask(task) && task.projectId === 'inbox' && !task.plannedDate && !task.dueDate && !task.isSomeday;
export const isSomedayTask = (task: Task) => isActiveTask(task) && !!task.isSomeday;
export const isUpcomingTask = (task: Task, date = formatLocalDate(new Date())) => isActiveTask(task) && !task.isSomeday && (task.plannedDate || task.dueDate || '') > date;
export const completedOn = (task: Task, date: string) => isVisibleTask(task) && task.status === 'done' && !!task.completedAt && formatLocalDate(new Date(task.completedAt)) === date;
export const recordedMinutes = (task: Task) => Math.max(0, task.timeSpentMinutes || 0);
