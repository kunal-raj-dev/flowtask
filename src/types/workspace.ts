import type { Task, Project, SmartFilterView } from './task';

export interface EntityChange {
  collection: 'tasks' | 'projects';
  id: string;
  before: Task | Project | null;
  after: Task | Project | null;
}
export interface PendingOperation {
  id: string;
  description: string;
  changes: EntityChange[];
  createdAt: number;
}
export interface WorkspaceRecord {
  schemaVersion: 3;
  workspaceId: string;
  tasks: Task[];
  projects: Project[];
  customViews: SmartFilterView[];
  preferences: Record<string, unknown>;
  pending: PendingOperation[];
  undo: PendingOperation[];
  updatedAt: number;
}
