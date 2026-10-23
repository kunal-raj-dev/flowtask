import { describe, it, expect } from 'vitest';
import {
  calculateTaskTimeSummary,
  getDerivedSubtaskEstimate,
  getEffectiveTaskEstimate,
} from './taskTimeSummary';
import type { Task } from '../types/task';

describe('taskTimeSummary', () => {
  const baseTask: Task = {
    id: 'task-1',
    title: 'Test Task',
    projectId: 'inbox',
    status: 'todo',
    priority: 'p3',
    subtasks: [],
    createdAt: 1000,
    updatedAt: 1000,
  };

  it('handles task with no subtasks and explicit estimate', () => {
    const task: Task = { ...baseTask, estimatedMinutes: 45, timeSpentMinutes: 15 };
    const summary = calculateTaskTimeSummary(task);

    expect(summary.totalEstimateMinutes).toBe(45);
    expect(summary.isDerivedFromSubtasks).toBe(false);
    expect(summary.timedSubtaskCount).toBe(0);
    expect(summary.untimedSubtaskCount).toBe(0);
    expect(summary.untimedSubtaskIndicator).toBeUndefined();
    expect(summary.remainingWorkMinutes).toBe(30);
    expect(summary.recordedMinutes).toBe(15);
  });

  it('automatically derives parent estimate from sum of timed subtasks', () => {
    const task: Task = {
      ...baseTask,
      estimatedMinutes: 20, // Should be overridden by subtasks sum
      subtasks: [
        { id: 's1', title: 'Step 1', completed: true, estimatedMinutes: 30 },
        { id: 's2', title: 'Step 2', completed: false, estimatedMinutes: 25 },
        { id: 's3', title: 'Step 3', completed: false }, // untimed
      ],
      timeSpentMinutes: 10,
    };

    const summary = calculateTaskTimeSummary(task);
    expect(summary.isDerivedFromSubtasks).toBe(true);
    expect(summary.totalEstimateMinutes).toBe(55); // 30 + 25
    expect(summary.timedSubtaskCount).toBe(2);
    expect(summary.untimedSubtaskCount).toBe(1);
    expect(summary.untimedSubtaskIndicator).toBe('1 subtask needs estimates');
    expect(summary.completedSubtaskMinutes).toBe(30);
    expect(summary.unfinishedSubtaskMinutes).toBe(25);
    // Parent-only recorded time is unattributed; subtract it from remaining work once.
    expect(summary.remainingWorkMinutes).toBe(15);
  });

  it('preserves unfinished subtask work when completed subtasks have recorded time', () => {
    const task: Task = {
      ...baseTask,
      subtasks: [
        { id: 's1', title: 'Step 1', completed: true, estimatedMinutes: 50, timeSpentMinutes: 50 },
        { id: 's2', title: 'Step 2', completed: false, estimatedMinutes: 50, timeSpentMinutes: 10 },
      ],
      timeSpentMinutes: 60,
    };

    const summary = calculateTaskTimeSummary(task);
    expect(summary.totalEstimateMinutes).toBe(100);
    expect(summary.completedSubtaskMinutes).toBe(50);
    expect(summary.unfinishedSubtaskMinutes).toBe(50);
    // Unfinished subtask 2 had 10m spent out of 50m estimate -> remaining is 40m
    expect(summary.remainingWorkMinutes).toBe(40);
  });

  it('subtracts recorded time once without producing negative remaining work', () => {
    const task: Task = {
      ...baseTask,
      subtasks: [
        { id: 's1', title: 'Step 1', completed: false, estimatedMinutes: 20 },
      ],
      timeSpentMinutes: 35,
    };

    const summary = calculateTaskTimeSummary(task);
    expect(summary.remainingWorkMinutes).toBe(0);
  });

  it('returns 0 remaining work if task status is done', () => {
    const task: Task = {
      ...baseTask,
      status: 'done',
      estimatedMinutes: 60,
      timeSpentMinutes: 10,
      subtasks: [
        { id: 's1', title: 'Step 1', completed: false, estimatedMinutes: 30 },
      ],
    };

    const summary = calculateTaskTimeSummary(task);
    expect(summary.remainingWorkMinutes).toBe(0);
  });

  it('handles plural subtask indicator for multiple untimed subtasks', () => {
    const task: Task = {
      ...baseTask,
      subtasks: [
        { id: 's1', title: 'A', completed: false },
        { id: 's2', title: 'B', completed: false },
      ],
    };

    const summary = calculateTaskTimeSummary(task);
    expect(summary.untimedSubtaskCount).toBe(2);
    expect(summary.untimedSubtaskIndicator).toBe('2 subtasks need estimates');
  });

  it('normalizes effective task estimate via getEffectiveTaskEstimate', () => {
    expect(getEffectiveTaskEstimate({ estimatedMinutes: 40 })).toBe(40);
    expect(getEffectiveTaskEstimate({})).toBe(0);
    expect(
      getEffectiveTaskEstimate({
        estimatedMinutes: 10,
        subtasks: [
          { id: '1', title: 's1', completed: false, estimatedMinutes: 15 },
          { id: '2', title: 's2', completed: false, estimatedMinutes: 25 },
        ],
      })
    ).toBe(40);
  });

  it('returns derived estimate correctly via getDerivedSubtaskEstimate', () => {
    expect(getDerivedSubtaskEstimate([])).toBeNull();
    expect(getDerivedSubtaskEstimate([{ id: '1', title: 'no estimate', completed: false }])).toBeNull();
    expect(
      getDerivedSubtaskEstimate([
        { id: '1', title: 'a', completed: false, estimatedMinutes: 10 },
        { id: '2', title: 'b', completed: true, estimatedMinutes: 20 },
      ])
    ).toBe(30);
  });
});
