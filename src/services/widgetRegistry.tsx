import React from 'react';
import type {
  WidgetType,
  WidgetDefinition,
  DashboardWidget,
} from '../types/dashboard';
import {
  Target,
  CheckSquare,
  Calendar,
  PieChart,
  Flame,
  Folder,
  BookOpen,
  FileEdit,
  BarChart3,
  Clock,
  Bookmark,
  Sun,
} from 'lucide-react';

import { Top3Widget } from '../components/dashboard/widgets/Top3Widget';
import { TaskListWidget } from '../components/dashboard/widgets/TaskListWidget';
import { DayAgendaWidget } from '../components/dashboard/widgets/DayAgendaWidget';
import { CapacityProgressWidget } from '../components/dashboard/widgets/CapacityProgressWidget';
import { FocusLaunchpadWidget } from '../components/dashboard/widgets/FocusLaunchpadWidget';
import { ProjectsWidget } from '../components/dashboard/widgets/ProjectsWidget';
import { StudyContinuationWidget } from '../components/dashboard/widgets/StudyContinuationWidget';
import { QuickNotesWidget } from '../components/dashboard/widgets/QuickNotesWidget';
import { WeeklyWorkloadWidget } from '../components/dashboard/widgets/WeeklyWorkloadWidget';
import { RecentActivityWidget } from '../components/dashboard/widgets/RecentActivityWidget';
import { ResourcesWidget } from '../components/dashboard/widgets/ResourcesWidget';
import { QuietSceneWidget } from '../components/dashboard/widgets/QuietSceneWidget';

export interface RegisteredWidget<T = any> extends WidgetDefinition<T> {
  component: React.ComponentType<any>;
  icon: any;
}

export const WIDGET_REGISTRY: Record<WidgetType, RegisteredWidget> = {
  top3: {
    type: 'top3',
    name: 'Top 3 Priorities',
    description: 'Date-scoped priorities, next action, and 1-click focus start',
    defaultTitle: 'Top 3 Priorities',
    icon: Target,
    defaultSize: { w: 7, h: 4 },
    minSize: { w: 4, h: 3 },
    presets: [
      { label: 'Compact', w: 5, h: 3 },
      { label: 'Standard', w: 7, h: 4 },
      { label: 'Full Width', w: 12, h: 4 },
    ],
    defaultConfig: { showNextAction: true },
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : { showNextAction: true }),
    component: Top3Widget,
  },
  taskList: {
    type: 'taskList',
    name: 'Task List',
    description: 'Filtered task backlog from Today, Inbox, or selected Project',
    defaultTitle: "Today's Tasks",
    icon: CheckSquare,
    defaultSize: { w: 7, h: 7 },
    minSize: { w: 4, h: 4 },
    presets: [
      { label: 'Medium', w: 6, h: 6 },
      { label: 'Large', w: 7, h: 7 },
      { label: 'Full Width', w: 12, h: 8 },
    ],
    defaultConfig: { source: 'today', showCompleted: true },
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : { source: 'today' }),
    component: TaskListWidget,
  },
  dayAgenda: {
    type: 'dayAgenda',
    name: 'Day Agenda',
    description: 'Calendar overlay, scheduled tasks, current time rail, next block',
    defaultTitle: 'Day Agenda',
    icon: Calendar,
    defaultSize: { w: 5, h: 5 },
    minSize: { w: 3, h: 4 },
    presets: [
      { label: 'Narrow Column', w: 4, h: 5 },
      { label: 'Standard Column', w: 5, h: 5 },
      { label: 'Wide Agenda', w: 7, h: 6 },
    ],
    defaultConfig: { showCalendar: true, showScheduledTasks: true },
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : {}),
    component: DayAgendaWidget,
  },
  capacityProgress: {
    type: 'capacityProgress',
    name: 'Capacity & Progress',
    description: 'Planning budget, estimated remaining work, and logged focus',
    defaultTitle: 'Capacity & Budget',
    icon: PieChart,
    defaultSize: { w: 5, h: 3 },
    minSize: { w: 3, h: 2 },
    presets: [
      { label: 'Compact Card', w: 4, h: 3 },
      { label: 'Standard', w: 5, h: 3 },
      { label: 'Full Width', w: 12, h: 3 },
    ],
    defaultConfig: {},
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : {}),
    component: CapacityProgressWidget,
  },
  focusLaunchpad: {
    type: 'focusLaunchpad',
    name: 'Focus Launchpad',
    description: 'Favorite recipes and 1-click access to active or new sessions',
    defaultTitle: 'Focus Launchpad',
    icon: Flame,
    defaultSize: { w: 5, h: 3 },
    minSize: { w: 3, h: 2 },
    presets: [
      { label: 'Small', w: 4, h: 3 },
      { label: 'Standard', w: 5, h: 3 },
      { label: 'Wide Launcher', w: 8, h: 3 },
    ],
    defaultConfig: { maxRecipes: 3 },
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : {}),
    component: FocusLaunchpadWidget,
  },
  projects: {
    type: 'projects',
    name: 'Projects',
    description: 'Selected projects, target outcomes, deadlines, and remaining work',
    defaultTitle: 'Active Projects',
    icon: Folder,
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 4, h: 3 },
    presets: [
      { label: 'Half Width', w: 6, h: 5 },
      { label: 'Wide Gallery', w: 12, h: 5 },
    ],
    defaultConfig: {},
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : {}),
    component: ProjectsWidget,
  },
  studyContinuation: {
    type: 'studyContinuation',
    name: 'Study Continuation',
    description: 'Unfinished targets and next problem sprint to pick up quickly',
    defaultTitle: 'Continue Study',
    icon: BookOpen,
    defaultSize: { w: 7, h: 4 },
    minSize: { w: 4, h: 3 },
    presets: [
      { label: 'Standard', w: 7, h: 4 },
      { label: 'Full Width', w: 12, h: 4 },
    ],
    defaultConfig: {},
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : {}),
    component: StudyContinuationWidget,
  },
  quickNotes: {
    type: 'quickNotes',
    name: 'Quick Notes',
    description: 'Workspace scratchpad and selected task notes with task creation',
    defaultTitle: 'Quick Notes',
    icon: FileEdit,
    defaultSize: { w: 5, h: 4 },
    minSize: { w: 3, h: 3 },
    presets: [
      { label: 'Compact Notepad', w: 4, h: 4 },
      { label: 'Standard', w: 5, h: 5 },
      { label: 'Tall Notepad', w: 5, h: 7 },
    ],
    defaultConfig: { mode: 'both' },
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : { mode: 'both' }),
    component: QuickNotesWidget,
  },
  weeklyWorkload: {
    type: 'weeklyWorkload',
    name: 'Weekly Workload',
    description: 'Seven-day planning demand and deadline projection bars',
    defaultTitle: '7-Day Demand',
    icon: BarChart3,
    defaultSize: { w: 5, h: 4 },
    minSize: { w: 3, h: 3 },
    presets: [
      { label: 'Standard Bar', w: 5, h: 4 },
      { label: 'Wide Horizon', w: 8, h: 4 },
      { label: 'Full Width', w: 12, h: 4 },
    ],
    defaultConfig: {},
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : {}),
    component: WeeklyWorkloadWidget,
  },
  recentActivity: {
    type: 'recentActivity',
    name: 'Recent Activity',
    description: 'Log of recently completed tasks and finished focus sessions',
    defaultTitle: 'Recent Activity',
    icon: Clock,
    defaultSize: { w: 5, h: 4 },
    minSize: { w: 3, h: 3 },
    presets: [
      { label: 'Standard Stream', w: 5, h: 4 },
      { label: 'Full Width', w: 12, h: 4 },
    ],
    defaultConfig: {},
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : {}),
    component: RecentActivityWidget,
  },
  resources: {
    type: 'resources',
    name: 'Resources',
    description: 'Quick links, study references, and problem URLs',
    defaultTitle: 'Saved Resources',
    icon: Bookmark,
    defaultSize: { w: 5, h: 4 },
    minSize: { w: 3, h: 3 },
    presets: [
      { label: 'Compact List', w: 4, h: 4 },
      { label: 'Standard', w: 5, h: 4 },
    ],
    defaultConfig: {},
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : {}),
    component: ResourcesWidget,
  },
  quietScene: {
    type: 'quietScene',
    name: 'Quiet Scene & Clock',
    description: 'Serene desk atmosphere with real-time clock and inspirational quote',
    defaultTitle: 'Desk Atmosphere',
    icon: Sun,
    defaultSize: { w: 12, h: 4 },
    minSize: { w: 6, h: 3 },
    presets: [
      { label: 'Compact Clock', w: 6, h: 3 },
      { label: 'Wide Horizon', w: 12, h: 4 },
    ],
    defaultConfig: { showClock: true, clockFormat: '12h' },
    validateConfig: (c) => (typeof c === 'object' && c !== null ? c : { showClock: true, clockFormat: '12h' }),
    component: QuietSceneWidget,
  },
};

export function getWidgetDefinition(type: WidgetType): RegisteredWidget {
  return WIDGET_REGISTRY[type] || WIDGET_REGISTRY.top3;
}

export function createNewWidgetInstance(type: WidgetType): DashboardWidget {
  const def = getWidgetDefinition(type);
  const id = `w-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    type,
    title: def.defaultTitle,
    config: { ...def.defaultConfig },
    minW: def.minSize.w,
    minH: def.minSize.h,
  };
}
