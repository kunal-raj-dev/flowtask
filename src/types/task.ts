export type Priority = 'p1' | 'p2' | 'p3' | 'p4';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type RecurrenceFrequency = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  projectId: string; // 'inbox', 'work', 'personal', etc.
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  estimatedMinutes?: number;
  timeSpentMinutes?: number;
  subtasks: SubTask[];
  recurrence?: RecurrenceFrequency;
  isPinnedToday?: boolean; // Rule of 3 (Top Focus for Today)
  scheduledStart?: string; // HH:mm (e.g. '09:30')
  scheduledEnd?: string; // HH:mm (e.g. '10:30')
  createdAt: number;
  completedAt?: number;
}

export interface Project {
  id: string;
  name: string;
  color: string; // hex or tailwind color class
  icon?: string;
}

export type ViewId =
  | 'today'
  | 'inbox'
  | 'upcoming'
  | 'someday'
  | 'matrix'
  | 'kanban'
  | 'insights'
  | 'logbook'
  | `project:${string}`;

export interface ParsedTaskInput {
  cleanTitle: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority?: Priority;
  projectTag?: string;
  estimatedMinutes?: number;
}
