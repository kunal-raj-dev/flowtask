import type { Area } from '../types/area';
import type { Goal } from '../types/goal';
import type { Routine, Habit } from '../types/routine';
import type { WorkspaceStore } from './workspaceStore';

export const DEFAULT_AREAS_PRESET = [
  { name: 'Work', color: '#3b82f6', icon: 'briefcase' },
  { name: 'Home', color: '#10b981', icon: 'home' },
  { name: 'Health', color: '#ec4899', icon: 'heart' },
  { name: 'Learning', color: '#8b5cf6', icon: 'book' },
  { name: 'Personal', color: '#f59e0b', icon: 'user' },
];

export function seedDefaultAreasIfEmpty(store: WorkspaceStore): void {
  const currentAreas = store.getSnapshot().record.areas || [];
  if (currentAreas.length > 0) return;

  store.run('Seed default life areas', (record) => {
    const seeded: Area[] = DEFAULT_AREAS_PRESET.map((p, idx) => ({
      id: crypto.randomUUID(),
      name: p.name,
      color: p.color,
      icon: p.icon,
      sortOrder: idx,
    }));

    return {
      ...record,
      areas: seeded,
    };
  });
}

export function createArea(
  store: WorkspaceStore,
  name: string,
  color = '#6366f1',
  icon = 'folder'
): Area {
  const area: Area = {
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
    icon,
    sortOrder: (store.getSnapshot().record.areas || []).length,
  };

  store.run('Create life area', (record) => ({
    ...record,
    areas: [...(record.areas || []), area],
  }));

  return area;
}

export function archiveArea(store: WorkspaceStore, areaId: string): void {
  store.run('Archive life area', (record) => ({
    ...record,
    areas: (record.areas || []).map((a) =>
      a.id === areaId ? { ...a, archivedAt: Date.now() } : a
    ),
  }));
}

export function createGoal(
  store: WorkspaceStore,
  title: string,
  extras: { areaId?: string; targetDate?: string; projectIds?: string[] } = {}
): Goal {
  const goal: Goal = {
    id: crypto.randomUUID(),
    title: title.trim(),
    areaId: extras.areaId,
    targetDate: extras.targetDate,
    projectIds: extras.projectIds || [],
    status: 'active',
  };

  store.run('Create goal', (record) => ({
    ...record,
    goals: [...(record.goals || []), goal],
  }));

  return goal;
}

export function updateGoalStatus(
  store: WorkspaceStore,
  goalId: string,
  status: 'active' | 'achieved' | 'paused'
): void {
  store.run('Update goal status', (record) => ({
    ...record,
    goals: (record.goals || []).map((g) =>
      g.id === goalId ? { ...g, status } : g
    ),
  }));
}

export function createRoutine(
  store: WorkspaceStore,
  title: string,
  cadence: 'morning' | 'evening' | 'workday_start' | 'weekly',
  steps: Array<{ title: string; durationMinutes?: number }> = []
): Routine {
  const routine: Routine = {
    id: crypto.randomUUID(),
    title: title.trim(),
    cadence,
    steps: steps.map((s) => ({
      id: crypto.randomUUID(),
      title: s.title.trim(),
      durationMinutes: s.durationMinutes,
    })),
  };

  store.run('Create routine', (record) => ({
    ...record,
    routines: [...(record.routines || []), routine],
  }));

  return routine;
}

export function createHabit(
  store: WorkspaceStore,
  title: string,
  frequency: 'daily' | 'weekdays' | 'weekly' = 'daily'
): Habit {
  const habit: Habit = {
    id: crypto.randomUUID(),
    title: title.trim(),
    frequency,
    checkIns: [],
  };

  store.run('Create habit', (record) => ({
    ...record,
    habits: [...(record.habits || []), habit],
  }));

  return habit;
}

export function checkInHabit(
  store: WorkspaceStore,
  habitId: string,
  date: string, // YYYY-MM-DD
  completed: boolean
): void {
  store.run('Habit check-in', (record) => {
    const habits = (record.habits || []).map((h) => {
      if (h.id !== habitId) return h;
      const filtered = h.checkIns.filter((ci) => ci.date !== date);
      return {
        ...h,
        checkIns: completed ? [...filtered, { date, completed: true }] : filtered,
      };
    });

    return {
      ...record,
      habits,
    };
  });
}

import { formatLocalDate } from '../utils/nlpParser';

export function getHabitStreak(habit: Habit, referenceDateStr: string): number {
  const completedDates = new Set(
    habit.checkIns.filter((ci) => ci.completed).map((ci) => ci.date)
  );

  let streak = 0;
  const [y, m, d] = referenceDateStr.split('-').map(Number);
  const current = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);

  // Check today, then count backwards consecutive days
  while (true) {
    const dateStr = formatLocalDate(current);
    if (completedDates.has(dateStr)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
