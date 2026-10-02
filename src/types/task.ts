export type Priority = 'p1' | 'p2' | 'p3' | 'p4';

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type RecurrenceFrequency =
  | 'none'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'yearly'
  | 'custom';

export interface CustomRecurrenceRule {
  interval: number;
  unit: 'days' | 'weeks' | 'months';
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  mode?: 'scheduled' | 'completion';
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes?: number;
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
  customRecurrence?: CustomRecurrenceRule;
  isPinnedToday?: boolean; // Rule of 3 (Top Focus for Today)
  scheduledStart?: string; // HH:mm (e.g. '09:30')
  scheduledEnd?: string; // HH:mm (e.g. '10:30')
  tags?: string[]; // Flexible custom hashtags/labels, e.g. ['frontend', 'v2']
  contextTags?: string[]; // GTD context tags, e.g. ['calls', 'computer', 'errands']
  blockedBy?: string[]; // IDs of tasks that block this task
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
  | 'timeline'
  | 'someday'
  | 'matrix'
  | 'kanban'
  | 'insights'
  | 'logbook'
  | `project:${string}`
  | `smart:${string}`;

export interface ParsedTaskInput {
  cleanTitle: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority?: Priority;
  projectTag?: string;
  tags?: string[];
  contextTags?: string[];
  estimatedMinutes?: number;
  recurrence?: RecurrenceFrequency;
  customRecurrence?: CustomRecurrenceRule;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string; // HH:mm (e.g. '10:00')
  endTime: string;   // HH:mm (e.g. '11:00')
  description?: string;
  location?: string;
  isAllDay?: boolean;
}

export type CognitiveIntensity = 'deep' | 'medium' | 'admin';

export interface InterruptionStash {
  taskId: string;
  taskTitle: string;
  elapsedSeconds: number;
  stashedAt: number;
  projectId?: string;
}

export interface SmartFilterPredicate {
  priorities?: Priority[];
  maxMinutes?: number;
  minMinutes?: number;
  dueRange?: 'today' | 'tomorrow' | 'this_week' | 'overdue' | 'unscheduled' | 'any';
  projectIds?: string[];
  status?: 'active' | 'done' | 'all';
  searchQuery?: string;
}

export interface SmartFilterView {
  id: string;
  name: string;
  icon: string;
  color: string;
  predicate: SmartFilterPredicate;
  isBuiltIn?: boolean;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  defaultPriority: Priority;
  defaultEstimatedMinutes?: number;
  subtaskTitles: string[];
  contextTags?: string[];
  isCustom?: boolean;
}

