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

export type TargetDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes?: number;
  url?: string;
  difficulty?: TargetDifficulty;
  tags?: string[];
  problemNumber?: number | string;
}

export interface SessionMetadata {
  isSession: boolean;
  sessionNumber?: number;
  sessionTopic?: string;
  focusArea?: string;
  targetCount?: number;
  targetPacingMinutes?: number;
  pacingMinutesPerQuestion?: number;
  targetUnit?: string;
  secondaryMilestone?: string;
  contingencyGoal?: string;
}

export interface Task {
  recurrenceSourceId?: string;
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  projectId: string; // 'inbox', 'work', 'personal', etc.
  plannedDate?: string; // YYYY-MM-DD (Planning date, distinct from deadline)
  dueDate?: string; // YYYY-MM-DD (Actual deadline)
  dueTime?: string; // HH:mm
  topThreeDate?: string; // YYYY-MM-DD (Date-scoped Top 3 Focus)
  isPinnedToday?: boolean; // Backwards compatible with Top 3
  isSomeday?: boolean; // Intentional deferral separate from project
  isEvening?: boolean; // Things 3-style "This Evening" designation for today's tasks
  archivedAt?: number; // Timestamp if archived (not counted as completed)
  deletedAt?: number; // Timestamp if moved to trash
  revision?: number; // Revision counter for conflict resolution
  updatedAt?: number; // Last modification timestamp
  estimatedMinutes?: number;
  timeSpentMinutes?: number;
  subtasks: SubTask[];
  recurrence?: RecurrenceFrequency;
  customRecurrence?: CustomRecurrenceRule;
  scheduledStart?: string; // HH:mm (e.g. '09:30')
  scheduledEnd?: string; // HH:mm (e.g. '10:30')
  timezone?: string; // Explicit timezone
  tags?: string[]; // Flexible custom hashtags/labels, e.g. ['frontend', 'v2']
  contextTags?: string[]; // GTD context tags, e.g. ['calls', 'computer', 'errands']
  blockedBy?: string[]; // IDs of tasks that block this task
  sessionMetadata?: SessionMetadata; // Study/Sprint Session configuration & pacing
  createdAt: number;
  completedAt?: number;
}

export interface Project {
  revision?: number;
  id: string;
  name: string;
  color: string; // hex or tailwind color class
  icon?: string;
  isArchived?: boolean;
  archivedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

export type ViewId =
  | 'today'
  | 'inbox'
  | 'upcoming'
  | 'projects'
  | 'timeline'
  | 'someday'
  | 'matrix'
  | 'kanban'
  | 'insights'
  | 'logbook'
  | 'review'
  | 'all'
  | 'trash'
  | 'archive'
  | 'settings'
  | `project:${string}`
  | `smart:${string}`;

export interface ParsedTaskInput {
  cleanTitle: string;
  plannedDate?: string; // YYYY-MM-DD
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
  date?: string;
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
  isBlocked?: boolean;
  isStale?: boolean;
  isEvening?: boolean;
  contextTag?: string;
  hasSubtasks?: boolean;
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

export type FocusSessionMode = 'stopwatch' | 'pomodoro' | 'sprint';

export interface FocusSessionSegment {
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  subtaskId?: string;
  subtaskTitle?: string;
}

export interface FocusLog {
  id: string;
  seconds: number;
  taskId: string | null;
  taskTitle?: string;
  subtaskId?: string;
  subtaskTitle?: string;
  mode: FocusSessionMode;
  startedAt: number;
  endedAt: number;
}

export interface FocusSession {
  id: string;
  mode: FocusSessionMode;
  taskId: string | null;
  taskTitle?: string;
  subtaskId?: string;
  subtaskTitle?: string;
  projectId?: string;
  startedAt: number;
  pausedAt?: number | null;
  accumulatedElapsedMs: number;
  targetDurationSec: number;
  state: 'idle' | 'running' | 'paused' | 'completed';
  pomodoroCycle?: number;
  pomodoroPhase?: 'focus' | 'short_break' | 'long_break';
  pacingSecondsPerUnit?: number;
  bankedSeconds?: number;
  loggedSegments?: FocusSessionSegment[];
}

export type CommandType =
  | 'create_task'
  | 'update_task'
  | 'complete_task'
  | 'schedule_task'
  | 'move_task'
  | 'merge_tasks'
  | 'archive_task'
  | 'delete_task'
  | 'restore_task'
  | 'bulk_update';

export interface TaskCommand {
  id: string;
  type: CommandType;
  timestamp: number;
  payload: Record<string, unknown>;
  description: string;
}

export interface InverseOperation {
  description: string;
  undo: () => void | Promise<void>;
}


