import type { Task, SmartFilterView, SmartFilterPredicate } from '../types/task';
import { formatLocalDate } from './nlpParser';
import { isTaskBlocked } from './dependencyUtils';
import { checkTaskStaleness } from './staleTaskDetector';

export const BUILT_IN_SMART_VIEWS: SmartFilterView[] = [
  {
    id: 'quick-wins',
    name: 'Quick Wins',
    icon: 'zap',
    color: 'text-amber-500',
    predicate: {
      maxMinutes: 15,
      status: 'active',
    },
    isBuiltIn: true,
  },
  {
    id: 'deep-work',
    name: 'Deep Focus',
    icon: 'brain',
    color: 'text-indigo-500',
    predicate: {
      minMinutes: 45,
      status: 'active',
    },
    isBuiltIn: true,
  },
  {
    id: 'high-urgency',
    name: 'High Urgency',
    icon: 'flame',
    color: 'text-rose-500',
    predicate: {
      priorities: ['p1', 'p2'],
      status: 'active',
    },
    isBuiltIn: true,
  },
  {
    id: 'needs-momentum',
    name: 'Needs Momentum',
    icon: 'coffee',
    color: 'text-purple-500',
    predicate: {
      isStale: true,
      status: 'active',
    },
    isBuiltIn: true,
  },
  {
    id: 'evening',
    name: 'This Evening',
    icon: 'moon',
    color: 'text-indigo-400',
    predicate: {
      isEvening: true,
      status: 'active',
    },
    isBuiltIn: true,
  },
  {
    id: 'backlog',
    name: 'Unscheduled Backlog',
    icon: 'archive',
    color: 'text-blue-500',
    predicate: {
      dueRange: 'unscheduled',
      status: 'active',
    },
    isBuiltIn: true,
  },
];

/**
 * Filters a list of tasks against a smart filter predicate
 */
export function filterTasksByPredicate(
  tasks: Task[],
  predicate: SmartFilterPredicate,
  currentDate: Date = new Date()
): Task[] {
  const todayStr = formatLocalDate(currentDate);

  // Calculate tomorrow
  const tom = new Date(currentDate);
  tom.setDate(tom.getDate() + 1);
  const tomorrowStr = formatLocalDate(tom);

  // Calculate end of this week (7 days out)
  const weekEnd = new Date(currentDate);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = formatLocalDate(weekEnd);

  return tasks.filter((task) => {
    if (task.deletedAt || task.archivedAt) return false;
    // 1. Status Filter
    const targetStatus = predicate.status || 'active';
    if (targetStatus === 'active' && task.status === 'done') return false;
    if (targetStatus === 'done' && task.status !== 'done') return false;

    // 2. Priorities Filter
    if (predicate.priorities && predicate.priorities.length > 0) {
      if (!predicate.priorities.includes(task.priority)) return false;
    }

    // 3. Duration Filters
    const taskDuration = task.estimatedMinutes !== undefined ? task.estimatedMinutes : 30;
    if (predicate.maxMinutes !== undefined && taskDuration > predicate.maxMinutes) {
      return false;
    }
    if (predicate.minMinutes !== undefined && taskDuration < predicate.minMinutes) {
      // Allow P1 tasks with unspecified duration to count as deep work
      if (!(task.priority === 'p1' && task.estimatedMinutes === undefined)) {
        return false;
      }
    }

    // 4. Project Filter
    if (predicate.projectIds && predicate.projectIds.length > 0) {
      if (!predicate.projectIds.includes(task.projectId)) return false;
    }

    // 5. Search Query
    if (predicate.searchQuery && predicate.searchQuery.trim()) {
      const q = predicate.searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = (task.description || '').toLowerCase().includes(q);
      const matchTags = task.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchTags) return false;
    }

    // 6. Due / Planned Date Range Filter
    if (predicate.dueRange && predicate.dueRange !== 'any') {
      const taskDate = task.dueDate || task.plannedDate;
      switch (predicate.dueRange) {
        case 'today':
          if (taskDate !== todayStr && !(task.isPinnedToday && task.topThreeDate === todayStr)) return false;
          break;
        case 'tomorrow':
          if (taskDate !== tomorrowStr) return false;
          break;
        case 'this_week':
          if (!taskDate || taskDate < todayStr || taskDate > weekEndStr) {
            return false;
          }
          break;
        case 'overdue':
          if (!taskDate || taskDate >= todayStr || task.status === 'done') {
            return false;
          }
          break;
        case 'unscheduled':
          if (task.dueDate || task.plannedDate) return false;
          break;
      }
    }

    // 7. Blocked by Dependency
    if (predicate.isBlocked !== undefined) {
      const blocked = isTaskBlocked(task, tasks).isBlocked;
      if (blocked !== predicate.isBlocked) return false;
    }

    // 8. Stale / Avoidance Fatigue
    if (predicate.isStale !== undefined) {
      const stale = checkTaskStaleness(task, currentDate).isStale;
      if (stale !== predicate.isStale) return false;
    }

    // 9. Things 3-style "This Evening"
    if (predicate.isEvening !== undefined) {
      if (Boolean(task.isEvening) !== predicate.isEvening) return false;
    }

    // 10. GTD Context Tag
    if (predicate.contextTag) {
      if (!task.contextTags?.includes(predicate.contextTag)) return false;
    }

    // 11. Subtasks existence
    if (predicate.hasSubtasks !== undefined) {
      const hasSubs = Boolean(task.subtasks && task.subtasks.length > 0);
      if (hasSubs !== predicate.hasSubtasks) return false;
    }

    return true;
  });
}
