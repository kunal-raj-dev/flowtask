import type { Task, Project, SmartFilterView, FocusLog, TaskReminder, WorkBlock } from './task';
import type { FocusRecipe } from './studio';
import type { WorkspaceDashboard } from './dashboard';
import type { Note } from './note';
import type { Area } from './area';
import type { Goal } from './goal';
import type { Routine, Habit } from './routine';

export interface SyncedPreference { id: string; value: unknown; revision?: number; updatedAt?: number }
export type SyncedEntity = Task | Project | Note | WorkspaceDashboard | FocusLog | FocusRecipe | SyncedPreference;
export type SyncCollection = 'tasks' | 'projects' | 'dashboards' | 'focusLogs' | 'recipes' | 'preferences' | 'notes';

export interface EntityChange {
  collection: SyncCollection;
  id: string;
  before: SyncedEntity | null;
  after: SyncedEntity | null;
}
export interface PendingOperation {
  id: string;
  description: string;
  changes: EntityChange[];
  createdAt: number;
  attempts?: number;
  nextAttemptAt?: number;
}
export interface WorkspaceRecord {
  writeVersion?: number;
  schemaVersion: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  notes?: Note[];
  reminders?: TaskReminder[];
  workBlocks?: WorkBlock[];
  areas?: Area[];
  goals?: Goal[];
  routines?: Routine[];
  habits?: Habit[];
  workspaceId: string;
  tasks: Task[];
  projects: Project[];
  dashboards: WorkspaceDashboard[];
  customViews: SmartFilterView[];
  preferences: Record<string, unknown>;
  pending: PendingOperation[];
  undo: PendingOperation[];
  updatedAt: number;
}

