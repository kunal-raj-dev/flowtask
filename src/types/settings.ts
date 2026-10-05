export interface UserWorkflowSettings {
  targetWorkCapacityHours: number; // default 6.0
  defaultTaskDuration: number; // default 30
  timelineStartHour: number; // default 7
  timelineEndHour: number; // default 22
  autoSlotBufferMinutes: number; // default 10
  weekStartDay: 'sunday' | 'monday'; // default 'monday'
  onboardingCompleted: boolean;
}

export const DEFAULT_WORKFLOW_SETTINGS: UserWorkflowSettings = {
  targetWorkCapacityHours: 6.0,
  defaultTaskDuration: 30,
  timelineStartHour: 7,
  timelineEndHour: 22,
  autoSlotBufferMinutes: 10,
  weekStartDay: 'monday',
  onboardingCompleted: false,
};

export const MIN_CAPACITY_HOURS = 1.0;
export const MAX_CAPACITY_HOURS = 24.0;
export const CAPACITY_PRESETS = [4, 6, 8, 10, 12, 14] as const;
export const DURATION_PRESETS = [15, 25, 30, 45, 60, 90, 120] as const;
export const BUFFER_PRESETS = [0, 5, 10, 15, 30] as const;

