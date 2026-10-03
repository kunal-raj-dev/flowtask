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
