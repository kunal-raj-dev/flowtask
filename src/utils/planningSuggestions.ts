import type { Task } from '../types/task';

export interface EstimateSuggestion {
  taskId: string;
  currentMinutes: number;
  observedMinutes: number;
  suggestedMinutes: number;
}

/** Uses only work minutes already recorded on an unfinished task; never changes data. */
export function findEstimateSuggestion(tasks: Task[]): EstimateSuggestion | null {
  const task = tasks
    .filter((item) => item.status !== 'done' && !item.deletedAt && !item.archivedAt && item.estimatedMinutes && item.timeSpentMinutes)
    .filter((item) => (item.timeSpentMinutes || 0) >= (item.estimatedMinutes || 0) * 1.25)
    .sort((a, b) => (b.timeSpentMinutes || 0) / (b.estimatedMinutes || 1) - (a.timeSpentMinutes || 0) / (a.estimatedMinutes || 1))[0];
  if (!task) return null;
  const currentMinutes = task.estimatedMinutes || 0;
  const observedMinutes = Math.ceil(task.timeSpentMinutes || 0);
  const suggestedMinutes = Math.max(currentMinutes + 5, Math.ceil((observedMinutes * 1.15) / 5) * 5);
  return { taskId: task.id, currentMinutes, observedMinutes, suggestedMinutes };
}
