export interface WorkspaceReview {
  id: string;
  type: 'daily_shutdown' | 'weekly_review';
  reviewedAt: number; // UTC timestamp
  completedTaskIds: string[];
  focusSecondsRecorded: number;
  interruptedSecondsRecorded?: number;
  interruptedSessionsCount?: number;
  notes?: string;
  nextDayFocusTaskIds?: string[];
  revision: number;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ReviewEntry {
  id: string;
  type?: 'daily_shutdown' | 'weekly_review';
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string; // YYYY-MM-DD
  reviewedAt: number;
  reflection?: string;
  notes?: string;
  nextPriorities?: string[];
  nextDayFocusTaskIds?: string[];
  completedTasksCount?: number;
  completedTaskIds?: string[];
  totalEstimatedMinutes?: number;
  totalFocusSeconds?: number; // Measured actual time from FocusLogs
  focusSecondsRecorded?: number;
  interruptedSecondsRecorded?: number;
  interruptedSessionsCount?: number;
  revision?: number;
  createdAt?: number;
  updatedAt?: number;
}
