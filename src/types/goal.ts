export type GoalStatus = 'not_started' | 'in_progress' | 'paused' | 'achieved' | 'active' | 'deferred';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetQuarter?: string; // e.g. "2026-Q4" or dynamic
  targetDate?: string; // YYYY-MM-DD
  areaId?: string;
  projectIds: string[]; // Associated projects
  status: GoalStatus;
  progressMode?: 'manual' | 'tasks';
  manualProgress?: number; // 0 to 100
  successCriteria?: string[];
  archivedAt?: number;
  revision?: number;
  createdAt?: number;
  updatedAt?: number;
}
