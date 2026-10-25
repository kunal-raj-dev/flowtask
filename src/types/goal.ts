export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetQuarter?: string; // e.g. "2026-Q4"
  targetDate?: string;
  areaId?: string;
  projectIds: string[];
  status: 'active' | 'achieved' | 'paused' | 'not_started' | 'in_progress' | 'deferred';
}
