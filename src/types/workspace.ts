import type { Task, Project, SmartFilterView, FocusLog } from './task';
import type { FocusRecipe } from './studio';
import type { WorkspaceDashboard } from './dashboard';

export interface SyncedPreference { id: string; value: unknown; revision?: number; updatedAt?: number }
export type SyncedEntity = Task | Project | WorkspaceDashboard | FocusLog | FocusRecipe | SyncedPreference;
export type SyncCollection = 'tasks' | 'projects' | 'dashboards' | 'focusLogs' | 'recipes' | 'preferences';

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
}
export interface WorkspaceRecord {
  schemaVersion: 3 | 4 | 5 | 6;
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
