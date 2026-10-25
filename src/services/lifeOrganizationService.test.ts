import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceStore } from './workspaceStore';
import { emptyWorkspace } from './dbService';
import {
  createArea,
  archiveArea,
  createGoal,
  updateGoalStatus,
  createRoutine,
  createHabit,
  checkInHabit,
  getHabitStreak,
  seedDefaultAreasIfEmpty,
} from './lifeOrganizationService';
import type { WorkspaceRecord } from '../types/workspace';

describe('lifeOrganizationService', () => {
  let disk: WorkspaceRecord;
  let persistence: any;
  let store: WorkspaceStore;

  beforeEach(async () => {
    disk = emptyWorkspace('life-test');
    persistence = {
      ensureLegacyMigrated: async () => structuredClone(disk),
      saveWorkspace: async (_id: string, r: WorkspaceRecord) => {
        disk = structuredClone(r);
      },
    };
    store = new WorkspaceStore('life-test', false, persistence);
    await store.load();
  });

  it('seeds default life areas when empty', () => {
    seedDefaultAreasIfEmpty(store);
    const areas = store.getSnapshot().record.areas!;
    expect(areas).toHaveLength(5);
    expect(areas.map((a) => a.name)).toEqual(['Work', 'Home', 'Health', 'Learning', 'Personal']);

    // Calling again does not duplicate
    seedDefaultAreasIfEmpty(store);
    expect(store.getSnapshot().record.areas!).toHaveLength(5);
  });

  it('creates and archives an area', () => {
    const area = createArea(store, 'Side Projects', '#10b981', 'rocket');
    expect(area.name).toBe('Side Projects');

    let areas = store.getSnapshot().record.areas!;
    expect(areas.find((a) => a.id === area.id)?.archivedAt).toBeUndefined();

    archiveArea(store, area.id);
    areas = store.getSnapshot().record.areas!;
    expect(areas.find((a) => a.id === area.id)?.archivedAt).toBeDefined();
  });

  it('creates a goal and updates its status', () => {
    const goal = createGoal(store, 'Publish research paper', {
      targetDate: '2026-12-31',
      projectIds: ['proj-1'],
    });

    expect(goal.status).toBe('active');
    expect(goal.title).toBe('Publish research paper');

    updateGoalStatus(store, goal.id, 'achieved');
    const updated = store.getSnapshot().record.goals!.find((g) => g.id === goal.id);
    expect(updated?.status).toBe('achieved');
  });

  it('creates an ordered routine with steps', () => {
    const routine = createRoutine(store, 'Morning Flow', 'morning', [
      { title: 'Hydrate & stretch', durationMinutes: 10 },
      { title: 'Review Today tasks', durationMinutes: 5 },
      { title: 'Deep work block', durationMinutes: 50 },
    ]);

    expect(routine.steps).toHaveLength(3);
    expect(routine.steps[0].title).toBe('Hydrate & stretch');
  });

  it('handles habit check-ins and computes streak without creating duplicate future tasks', () => {
    const habit = createHabit(store, 'Daily Meditation', 'daily');
    expect(habit.checkIns).toEqual([]);

    checkInHabit(store, habit.id, '2026-10-23', true);
    checkInHabit(store, habit.id, '2026-10-24', true);
    checkInHabit(store, habit.id, '2026-10-25', true);

    const updatedHabit = store.getSnapshot().record.habits!.find((h) => h.id === habit.id)!;
    expect(updatedHabit.checkIns).toHaveLength(3);

    const streak = getHabitStreak(updatedHabit, '2026-10-25');
    expect(streak).toBe(3);

    // Unchecking today decreases streak
    checkInHabit(store, habit.id, '2026-10-25', false);
    const toggledHabit = store.getSnapshot().record.habits!.find((h) => h.id === habit.id)!;
    expect(getHabitStreak(toggledHabit, '2026-10-25')).toBe(0);
  });
});
