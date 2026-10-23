import { describe, expect, it } from 'vitest';
import type { Task } from '../types/task';
import { commandService } from './commandService';
import { calculateTaskTimeSummary } from '../utils/taskTimeSummary';
import { createStarterDashboards } from './starterDashboards';

const sample: Task = {
  id: 'dsa', title: 'DSA questions', status: 'in_progress', priority: 'p1', projectId: 'work',
  milestoneId: 'work-milestone', estimatedMinutes: 30, createdAt: 1,
  plannedDate: '2026-10-23', scheduledStart: '08:00', scheduledEnd: '11:00',
  timeSpentMinutes: 20, blockedBy: ['dependency'],
  subtasks: [50, 50, 35, 35, 25, 25].map((estimatedMinutes, i) => ({
    id: `s${i}`, title: `Question ${i}`, estimatedMinutes, completed: false,
  })),
};

describe('implementation review regressions', () => {
  it('uses the screenshot total of 220 minutes and keeps explicit calendar boundaries', () => {
    const result = commandService.updateTask([sample], sample.id, { estimatedMinutes: 10 });
    expect(result.updatedTasks[0]).toMatchObject({ estimatedMinutes: 220, scheduledStart: '08:00', scheduledEnd: '11:00' });
    expect(calculateTaskTimeSummary(result.updatedTasks[0]).remainingWorkMinutes).toBe(200);
  });

  it('moves and undoes a batch without losing dependencies, subtasks, dates or recorded work', () => {
    const result = commandService.batchUpdate([sample], [sample.id], { projectId: 'study' });
    const moved = result.updatedTasks[0];
    expect(moved).toMatchObject({ ...sample, projectId: 'study', milestoneId: undefined, estimatedMinutes: 220 });
    expect(moved.subtasks).toEqual(sample.subtasks);
    const restored = result.inverse(result.updatedTasks)[0];
    expect(restored).toMatchObject({ ...sample });
    expect(result.forward!([restored])[0]).toMatchObject({ projectId: 'study', estimatedMinutes: 220 });
  });

  it('keeps completed estimates in the total and subtracts attributed work only once', () => {
    const task = { ...sample, timeSpentMinutes: 70, subtasks: [
      { id: 'done', title: 'Finished', completed: true, estimatedMinutes: 50, timeSpentMinutes: 50 },
      { id: 'open', title: 'Remaining', completed: false, estimatedMinutes: 50, timeSpentMinutes: 10 },
      { id: 'untimed', title: 'Research', completed: true, timeSpentMinutes: 5 },
    ] };
    const summary = calculateTaskTimeSummary(task);
    expect(summary.totalEstimateMinutes).toBe(100);
    expect(summary.remainingWorkMinutes).toBe(35); // 50 - 10 attributed - 5 parent-only
    expect(summary.untimedSubtaskCount).toBe(1);
  });

  it('clears the derived parent when the last timed subtask is removed and restores it on undo', () => {
    const original = { ...sample, estimatedMinutes: 220 };
    const result = commandService.updateTask([original], sample.id, { subtasks: [] });
    expect(result.updatedTasks[0].estimatedMinutes).toBeUndefined();
    expect(result.inverse(result.updatedTasks)[0]).toMatchObject(original);
  });

  it('provides four genuinely different starter arrangements at all breakpoints', () => {
    const desks = createStarterDashboards(1);
    for (const breakpoint of ['lg', 'md', 'sm'] as const) {
      const signatures = desks.map(d => JSON.stringify(d.layouts[breakpoint]?.map(item => {
        const type = d.widgets.find(w => w.id === item.i)?.type;
        return { type, x: item.x, y: item.y, w: item.w, h: item.h };
      })));
      expect(new Set(signatures).size).toBe(4);
    }
  });
});
