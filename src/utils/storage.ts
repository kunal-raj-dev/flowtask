import type { Task, Project, RecurrenceFrequency } from '../types/task';
import { formatLocalDate } from './nlpParser';

const STORAGE_KEY_TASKS = 'flowtask_tasks_v1';
const STORAGE_KEY_PROJECTS = 'flowtask_projects_v1';

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

export function loadTasksFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    if (!raw) {
      const initial = getInitialTasks();
      saveTasksToStorage(initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load tasks from storage', err);
    return getInitialTasks();
  }
}

export function saveTasksToStorage(tasks: Task[]) {
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save tasks to storage', err);
  }
}

export function loadProjectsFromStorage(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) {
      saveProjectsToStorage(DEFAULT_PROJECTS);
      return DEFAULT_PROJECTS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load projects from storage', err);
    return DEFAULT_PROJECTS;
  }
}

export function saveProjectsToStorage(projects: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  } catch (err) {
    console.error('Failed to save projects to storage', err);
  }
}

/**
 * Calculates the next due date for a recurring task
 */
export function calculateNextDueDate(currentDueDateStr?: string, freq: RecurrenceFrequency = 'none'): string | undefined {
  if (freq === 'none') return undefined;

  const baseDate = currentDueDateStr ? new Date(currentDueDateStr) : new Date();
  const next = new Date(baseDate.getTime());

  if (freq === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (freq === 'weekdays') {
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6); // skip Sun (0) and Sat (6)
  } else if (freq === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (freq === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  }

  return formatLocalDate(next);
}

/**
 * Exports tasks to a clean, markdown formatted document
 */
export function exportToMarkdown(tasks: Task[], projects: Project[]): string {
  const lines: string[] = [
    '# FlowTask Export',
    `*Generated on ${new Date().toLocaleString()}*`,
    '',
  ];

  // Group by project
  for (const project of projects) {
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    if (projectTasks.length === 0) continue;

    lines.push(`## ${project.name}`);
    lines.push('');

    for (const task of projectTasks) {
      const checkbox = task.status === 'done' ? '[x]' : '[ ]';
      const meta: string[] = [];
      if (task.priority !== 'p4') meta.push(`Priority: ${task.priority.toUpperCase()}`);
      if (task.dueDate) meta.push(`Due: ${task.dueDate}`);
      if (task.estimatedMinutes) meta.push(`~${task.estimatedMinutes}m`);

      const metaStr = meta.length > 0 ? ` *(${meta.join(', ')})*` : '';
      lines.push(`- ${checkbox} **${task.title}**${metaStr}`);

      if (task.description) {
        lines.push(`  > ${task.description.replace(/\n/g, '\n  > ')}`);
      }

      if (task.subtasks && task.subtasks.length > 0) {
        for (const sub of task.subtasks) {
          const subCheck = sub.completed ? '[x]' : '[ ]';
          lines.push(`  - ${subCheck} ${sub.title}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Exports data to JSON
 */
export function exportToJSON(tasks: Task[], projects: Project[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks, projects }, null, 2);
}
