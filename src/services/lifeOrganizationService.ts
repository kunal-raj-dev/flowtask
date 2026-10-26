import type { Area } from '../types/area';
import type { Goal, GoalStatus } from '../types/goal';
import type { Routine, RoutineRun, Habit } from '../types/routine';
import type { ReviewEntry, WorkspaceReview } from '../types/review';
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
  icon = 'folder',
  description?: string
): Area {
  const now = Date.now();
  const area: Area = {
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
    icon,
    description: description?.trim() || undefined,
    sortOrder: (store.getSnapshot().record.areas || []).length,
    createdAt: now,
    updatedAt: now,
  };

  store.run('Create life area', (record) => ({
    ...record,
    areas: [...(record.areas || []), area],
  }));

  return area;
}

export function updateArea(
  store: WorkspaceStore,
  areaId: string,
  updates: Partial<Omit<Area, 'id' | 'revision' | 'createdAt'>>
): void {
  store.run('Update life area', (record) => ({
    ...record,
    areas: (record.areas || []).map((a) =>
      a.id === areaId ? { ...a, ...updates, updatedAt: Date.now() } : a
    ),
  }));
}

export function archiveArea(store: WorkspaceStore, areaId: string): void {
  store.run('Archive life area', (record) => ({
    ...record,
    areas: (record.areas || []).map((a) =>
      a.id === areaId ? { ...a, archivedAt: Date.now(), updatedAt: Date.now() } : a
    ),
  }));
}

export function deleteArea(
  store: WorkspaceStore,
  areaId: string,
  reassignToAreaId?: string
): void {
  store.run('Delete life area', (record) => {
    const areas = (record.areas || []).filter((a) => a.id !== areaId);
    const projects = (record.projects || []).map((p) =>
      p.areaId === areaId ? { ...p, areaId: reassignToAreaId || undefined, updatedAt: Date.now() } : p
    );
    const tasks = (record.tasks || []).map((t) =>
      t.areaId === areaId ? { ...t, areaId: reassignToAreaId || undefined, updatedAt: Date.now() } : t
    );
    const goals = (record.goals || []).map((g) =>
      g.areaId === areaId ? { ...g, areaId: reassignToAreaId || undefined, updatedAt: Date.now() } : g
    );

    return {
      ...record,
      areas,
      projects,
      tasks,
      goals,
    };
  });
}

export function reorderAreas(store: WorkspaceStore, areaIds: string[]): void {
  store.run('Reorder life areas', (record) => {
    const areaMap = new Map((record.areas || []).map((a) => [a.id, a]));
    const reordered: Area[] = [];

    areaIds.forEach((id, index) => {
      const area = areaMap.get(id);
      if (area) {
        reordered.push({ ...area, sortOrder: index, updatedAt: Date.now() });
        areaMap.delete(id);
      }
    });

    // Append any remaining
    Array.from(areaMap.values()).forEach((remaining, index) => {
      reordered.push({ ...remaining, sortOrder: reordered.length + index, updatedAt: Date.now() });
    });

    return {
      ...record,
      areas: reordered,
    };
  });
}

export function createGoal(
  store: WorkspaceStore,
  title: string,
  extras: {
    description?: string;
    targetQuarter?: string;
    targetDate?: string;
    areaId?: string;
    projectIds?: string[];
    status?: GoalStatus;
    progressMode?: 'manual' | 'tasks';
    manualProgress?: number;
    successCriteria?: string[];
  } = {}
): Goal {
  const now = Date.now();
  const goal: Goal = {
    id: crypto.randomUUID(),
    title: title.trim(),
    description: extras.description?.trim() || undefined,
    targetQuarter: extras.targetQuarter,
    targetDate: extras.targetDate,
    areaId: extras.areaId,
    projectIds: extras.projectIds || [],
    status: extras.status || 'active',
    progressMode: extras.progressMode || 'tasks',
    manualProgress: extras.manualProgress,
    successCriteria: extras.successCriteria || [],
    createdAt: now,
    updatedAt: now,
  };

  store.run('Create goal', (record) => ({
    ...record,
    goals: [...(record.goals || []), goal],
  }));

  return goal;
}

export function updateGoal(
  store: WorkspaceStore,
  goalId: string,
  updates: Partial<Omit<Goal, 'id' | 'revision' | 'createdAt'>>
): void {
  store.run('Update goal', (record) => ({
    ...record,
    goals: (record.goals || []).map((g) =>
      g.id === goalId ? { ...g, ...updates, updatedAt: Date.now() } : g
    ),
  }));
}

export function updateGoalStatus(
  store: WorkspaceStore,
  goalId: string,
  status: GoalStatus
): void {
  store.run('Update goal status', (record) => ({
    ...record,
    goals: (record.goals || []).map((g) =>
      g.id === goalId ? { ...g, status, updatedAt: Date.now() } : g
    ),
  }));
}

export function archiveGoal(store: WorkspaceStore, goalId: string): void {
  store.run('Archive goal', (record) => ({
    ...record,
    goals: (record.goals || []).map((g) =>
      g.id === goalId ? { ...g, archivedAt: Date.now(), updatedAt: Date.now() } : g
    ),
  }));
}

export function deleteGoal(store: WorkspaceStore, goalId: string): void {
  store.run('Delete goal', (record) => ({
    ...record,
    goals: (record.goals || []).filter((g) => g.id !== goalId),
  }));
}

export function createRoutine(
  store: WorkspaceStore,
  title: string,
  cadence: 'morning' | 'evening' | 'workday_start' | 'weekly',
  steps: Array<{ title: string; durationMinutes?: number }> = []
): Routine {
  const now = Date.now();
  const routine: Routine = {
    id: crypto.randomUUID(),
    title: title.trim(),
    cadence,
    steps: steps.map((s) => ({
      id: crypto.randomUUID(),
      title: s.title.trim(),
      durationMinutes: s.durationMinutes,
    })),
    createdAt: now,
    updatedAt: now,
  };

  store.run('Create routine', (record) => ({
    ...record,
    routines: [...(record.routines || []), routine],
  }));

  return routine;
}

export function updateRoutine(
  store: WorkspaceStore,
  routineId: string,
  updates: Partial<Omit<Routine, 'id' | 'revision' | 'createdAt'>>
): void {
  store.run('Update routine', (record) => ({
    ...record,
    routines: (record.routines || []).map((r) =>
      r.id === routineId ? { ...r, ...updates, updatedAt: Date.now() } : r
    ),
  }));
}

export function deleteRoutine(store: WorkspaceStore, routineId: string): void {
  store.run('Delete routine', (record) => ({
    ...record,
    routines: (record.routines || []).filter((r) => r.id !== routineId),
  }));
}

export function recordRoutineRun(
  store: WorkspaceStore,
  runData: Omit<RoutineRun, 'id' | 'createdAt' | 'updatedAt' | 'revision'>
): RoutineRun {
  const now = Date.now();
  const run: RoutineRun = {
    id: crypto.randomUUID(),
    status: runData.status || (runData.completedStepsCount === runData.totalStepsCount ? 'completed' : 'partial'),
    revision: 1,
    ...runData,
    createdAt: now,
    updatedAt: now,
  };

  store.run('Record routine run', (record) => ({
    ...record,
    routineRuns: [...(record.routineRuns || []), run],
  }));

  return run;
}

export function recordWorkspaceReview(
  store: WorkspaceStore,
  reviewData: Omit<WorkspaceReview, 'id' | 'createdAt' | 'updatedAt' | 'revision'>
): WorkspaceReview {
  const now = Date.now();
  const review: WorkspaceReview = {
    id: crypto.randomUUID(),
    revision: 1,
    ...reviewData,
    createdAt: now,
    updatedAt: now,
  };

  store.run(reviewData.type === 'daily_shutdown' ? 'Record daily shutdown' : 'Record weekly review', (record) => ({
    ...record,
    reviews: [...(record.reviews || []), review as ReviewEntry],
  }));

  return review;
}

export function saveReviewEntry(
  store: WorkspaceStore,
  entryData: Omit<ReviewEntry, 'id' | 'createdAt' | 'updatedAt' | 'revision'>
): ReviewEntry {
  const now = Date.now();
  const entry: ReviewEntry = {
    id: crypto.randomUUID(),
    type: entryData.type || 'weekly_review',
    revision: 1,
    ...entryData,
    createdAt: now,
    updatedAt: now,
  };

  store.run('Save weekly review', (record) => ({
    ...record,
    reviews: [...(record.reviews || []), entry],
  }));

  return entry;
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
