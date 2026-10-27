import type { Task, Project } from './task';

export type WidgetType =
  | 'top3'
  | 'taskList'
  | 'dayAgenda'
  | 'capacityProgress'
  | 'focusLaunchpad'
  | 'projects'
  | 'studyContinuation'
  | 'quickNotes'
  | 'weeklyWorkload'
  | 'recentActivity'
  | 'resources'
  | 'quietScene';

export interface DashboardLayoutItem {
  i: string; // widget instance ID
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
  static?: boolean;
}

export interface ResponsiveLayouts {
  lg: DashboardLayoutItem[]; // 12 columns (>= 960px)
  md?: DashboardLayoutItem[]; // 6 columns (640-959px)
  sm?: DashboardLayoutItem[]; // 1 column (< 640px)
}

export interface DashboardWidget<TConfig = Record<string, unknown>> {
  id: string; // Stable instance ID, e.g. "w-top3-1"
  type: WidgetType;
  title?: string;
  config: TConfig;
  minW?: number;
  minH?: number;
}

export interface WorkspaceDashboard {
  id: string;
  name: string;
  icon?: string;
  coverImage?: string;
  coverFocalPoint?: { x: number; y: number };
  isDefault?: boolean;
  order: number;
  widgets: DashboardWidget[];
  layouts: ResponsiveLayouts;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface WidgetSizePreset {
  label: string;
  w: number;
  h: number;
}

export interface WidgetComponentProps<TConfig = Record<string, unknown>> {
  widget: DashboardWidget<TConfig>;
  isEditing?: boolean;
  onSelectTask?: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
  onUpdateConfig?: (newConfig: Partial<TConfig>) => void;
  onRemove?: () => void;
  onMoveEarlier?: () => void;
  onMoveLater?: () => void;
  onResizePreset?: (w: number, h: number) => void;
}

export interface WidgetSettingsProps<TConfig = Record<string, unknown>> {
  config: TConfig;
  onChange: (config: TConfig) => void;
  projects: Project[];
  tasks: Task[];
}

export interface WidgetDefinition<TConfig = Record<string, unknown>> {
  type: WidgetType;
  name: string;
  description: string;
  defaultTitle: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
  presets: WidgetSizePreset[];
  defaultConfig: TConfig;
  validateConfig: (config: unknown) => TConfig;
}

export interface DashboardDraft {
  dashboardId: string;
  dashboard: WorkspaceDashboard;
  undoStack: WorkspaceDashboard[];
  redoStack: WorkspaceDashboard[];
  previewBreakpoint: 'lg' | 'md' | 'sm';
  hasUnsavedChanges: boolean;
  lastEditedAt: number;
}

export interface ViewDisplaySettings {
  groupBy?: 'none' | 'project' | 'priority' | 'status' | 'date';
  sortBy?: 'priority' | 'date' | 'title' | 'estimate';
  sortOrder?: 'asc' | 'desc';
  showCompleted?: boolean;
  showEstimates?: boolean;
  density?: 'comfortable' | 'compact';
}

export interface WorkspacePreferences {
  todayLayout?: TodayLayoutPreferences;
  presentation?: WorkspacePresentation;
  defaultDashboardId?: string;
  activeDashboardId?: string;
  pinnedDestinations?: string[];
  viewDisplaySettings?: Record<string, ViewDisplaySettings>;
  scratchpad?: string;
  density?: 'comfortable' | 'compact';
  showCovers?: boolean;
  [key: string]: unknown;
}

export type TodaySectionId = 'capture' | 'capacity' | 'priorities' | 'morning' | 'tasks' | 'evening' | 'goals' | 'dailyNote' | 'focusCard';
export interface TodayLayoutPreferences {
  version: 1;
  sections: Array<{ id: TodaySectionId; visible: boolean }>;
  contextPanel: 'none' | 'schedule';
}

export interface WorkspacePresentation {
  version: 1;
  offerDismissed?: boolean;
  dailyDeskId?: string;
  intensity?: number;
  plainBackground?: boolean;
}

export interface DayPlanSummary {
  date: string; // YYYY-MM-DD
  configuredCapacityMinutes: number;
  timedCalendarMinutes: number;
  availableTaskBudgetMinutes: number;
  totalDemandMinutes: number;
  scheduledTaskMinutes: number;
  remainingTaskWorkMinutes: number;
  recordedFocusMinutes: number;
  completedTaskCount: number;
  totalTaskCount: number;
  overbooked: boolean;
  overbookedMinutes: number;
  allDayCalendarEvents: Array<{ id: string; title: string }>;
  timedCalendarEvents: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
  }>;
  missingEstimatesCount: number;
  uniqueOccupiedMinutes?: number;
  conflictMinutes?: number;
  freeCalendarMinutes?: number;
}
