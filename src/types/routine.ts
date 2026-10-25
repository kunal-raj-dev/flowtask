export interface RoutineStep {
  id: string;
  title: string;
  durationMinutes?: number;
}

export interface Routine {
  id: string;
  title: string;
  steps: RoutineStep[];
  cadence: 'morning' | 'evening' | 'workday_start' | 'weekly';
  archivedAt?: number;
}

export interface HabitCheckIn {
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface Habit {
  id: string;
  title: string;
  frequency: 'daily' | 'weekdays' | 'weekly';
  checkIns: HabitCheckIn[];
  archivedAt?: number;
}
