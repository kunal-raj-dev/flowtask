import type { Task, Project, RecurrenceFrequency, CustomRecurrenceRule } from '../types/task';
import { formatLocalDate } from './nlpParser';


export const DEFAULT_PROJECTS: Project[] = [
  { id: 'inbox', name: 'Inbox', color: '#64748B', icon: 'Inbox' },
  { id: 'work', name: 'Work', color: '#3B82F6', icon: 'Briefcase' },
  { id: 'personal', name: 'Personal', color: '#10B981', icon: 'User' },
  { id: 'ideas', name: 'Ideas & Someday', color: '#8B5CF6', icon: 'Lightbulb' },
];

export function getInitialTasks(): Task[] {
  const todayStr = formatLocalDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  return [
    {
      id: 'task-welcome-1',
      title: 'Welcome to FlowTask! Star this as Top 3 Focus ☀️',
      description: 'FlowTask is designed to give you frictionless capture and deep focus. Click any task to expand details or press spacebar to mark it complete.',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      dueDate: todayStr,
      estimatedMinutes: 10,
      isPinnedToday: true,
      subtasks: [
        { id: 'sub-1', title: 'Try pressing "N" to quick-add a new task', completed: false },
        { id: 'sub-2', title: 'Press "Ctrl+K" or "Cmd+K" to open the Command Palette', completed: false },
        { id: 'sub-3', title: 'Start a Pomodoro focus timer with ambient sound', completed: false },
      ],
      recurrence: 'none',
      createdAt: Date.now() - 3600000,
    },
    {
      id: 'task-welcome-2',
      title: 'Review team weekly sprint goals #work p2 ~30m',
      description: 'Notice how typing "#work", "p2", and "~30m" automatically tags your task without touching the mouse.',
      status: 'todo',
      priority: 'p2',
      projectId: 'work',
      dueDate: todayStr,
      estimatedMinutes: 30,
      isPinnedToday: true,
      subtasks: [],
      recurrence: 'weekly',
      createdAt: Date.now() - 7200000,
    },
    {
      id: 'task-welcome-3',
      title: 'Afternoon 15-minute walk & recharge 🚶‍♂️',
      description: 'Quick wins and regular breaks keep your executive function sharp.',
      status: 'todo',
      priority: 'p3',
      projectId: 'personal',
      dueDate: todayStr,
      estimatedMinutes: 15,
      isPinnedToday: false,
      subtasks: [],
      recurrence: 'daily',
      createdAt: Date.now() - 10800000,
    },
    {
      id: 'task-welcome-4',
      title: 'Plan weekend hiking trip with Alex #personal',
      description: 'Upcoming tasks keep your schedule clean without cluttering today.',
      status: 'todo',
      priority: 'p4',
      projectId: 'personal',
      dueDate: tomorrowStr,
      estimatedMinutes: 20,
      isPinnedToday: false,
      subtasks: [],
      recurrence: 'none',
      createdAt: Date.now() - 14400000,
    },
  ];
}

export { exportToCSV, exportToJSON, exportToMarkdown } from './fileExporter';

/**
 * Calculates the next due date for a recurring task
 */
export function calculateNextDueDate(
  currentDueDateStr?: string,
  freq: RecurrenceFrequency = 'none',
  customRule?: CustomRecurrenceRule,
  completedAt?: number
): string | undefined {
  if (freq === 'none') return undefined;

  let baseDate: Date;
  if (freq === 'custom' && customRule?.mode === 'completion' && completedAt) {
    baseDate = new Date(completedAt);
  } else if (currentDueDateStr && currentDueDateStr.includes('-')) {
    const [y, m, d] = currentDueDateStr.split('-').map(Number);
    baseDate = new Date(y, m - 1, d);
  } else {
    baseDate = new Date();
  }

  const next = new Date(baseDate);
  const addMonths = (count: number) => { const day = next.getDate(); next.setDate(1); next.setMonth(next.getMonth() + count); const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate(); next.setDate(Math.min(day, last)); };

  if (freq === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (freq === 'weekdays') {
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6); // skip Sun (0) and Sat (6)
  } else if (freq === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (freq === 'biweekly') {
    next.setDate(next.getDate() + 14);
  } else if (freq === 'monthly') {
    addMonths(1);
  } else if (freq === 'yearly') {
    addMonths(12);
  } else if (freq === 'custom' && customRule) {
    const interval = Math.max(1, customRule.interval || 1);
    if (customRule.unit === 'days') {
      next.setDate(next.getDate() + interval);
    } else if (customRule.unit === 'weeks') {
      if (customRule.daysOfWeek && customRule.daysOfWeek.length > 0) {
        const sortedDays = [...customRule.daysOfWeek].sort((a, b) => a - b);
        const currentDay = next.getDay();
        const nextDayInWeek = sortedDays.find((d) => d > currentDay);
        if (nextDayInWeek !== undefined) {
          next.setDate(next.getDate() + (nextDayInWeek - currentDay));
        } else {
          // Wrap around to next interval cycle's first day
          const daysUntilNextWeek = 7 - currentDay + sortedDays[0];
          const extraWeeks = Math.max(0, interval - 1) * 7;
          next.setDate(next.getDate() + daysUntilNextWeek + extraWeeks);
        }
      } else {
        next.setDate(next.getDate() + interval * 7);
      }
    } else if (customRule.unit === 'months') {
      addMonths(interval);
    }
  }

  return formatLocalDate(next);
}


/**
 * Parses and migrates imported JSON payload (supports version 1 and 2)
 */
export function parseImportPayload(rawJson: string): {
  tasks: Task[];
  projects: Project[];
  version: number;
} {
  const data = JSON.parse(rawJson);
  const version = typeof data.version === 'number' ? data.version : 1;
  const rawTasks: Task[] = Array.isArray(data.tasks) ? data.tasks : [];
  const rawProjects: Project[] = Array.isArray(data.projects) ? data.projects : DEFAULT_PROJECTS;

  const todayStr = formatLocalDate(new Date());

  // Migrate tasks: ensure plannedDate, Someday, and Top 3 are properly populated
  const migratedTasks: Task[] = rawTasks.map((t) => {
    const plannedDate = t.plannedDate || t.dueDate;
    const isSomeday = t.isSomeday || t.projectId === 'ideas';
    const topThreeDate = t.topThreeDate || (t.isPinnedToday ? todayStr : undefined);

    return {
      ...t,
      plannedDate,
      isSomeday,
      topThreeDate,
      isPinnedToday: Boolean(t.isPinnedToday || (topThreeDate && topThreeDate === todayStr)),
    };
  });

  return {
    tasks: migratedTasks,
    projects: rawProjects,
    version,
  };
}


