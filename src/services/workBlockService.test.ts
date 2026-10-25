import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceStore } from './workspaceStore';
import {
  addWorkBlock,
  updateWorkBlock,
  removeWorkBlock,
  getWorkBlocksForDate,
  formatCapacitySummary,
  formatMinutesHuman,
  calculateEstimationBias,
  suggestCalibratedDuration,
  calculateDeficitBudget,
} from './workBlockService';
import { emptyWorkspace } from './dbService';
import type { WorkspaceRecord } from '../types/workspace';
import type { Task } from '../types/task';

describe('workBlockService', () => {
  let disk: WorkspaceRecord;
  let persistence: any;
  let store: WorkspaceStore;

  beforeEach(async () => {
    disk = emptyWorkspace('blocks-test');
    disk.tasks = [
      {
        id: 'task-1',
        title: 'Write dissertation chapter',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        subtasks: [],
        createdAt: 1000,
        dueDate: '2026-10-31',
        plannedDate: '2026-10-25',
        estimatedMinutes: 240,
      },
    ];
    persistence = {
      ensureLegacyMigrated: async () => structuredClone(disk),
      saveWorkspace: async (_id: string, r: WorkspaceRecord) => {
        disk = structuredClone(r);
      },
    };
    store = new WorkspaceStore('blocks-test', false, persistence);
    await store.load();
  });

  it('formats capacity summary with honest labels', () => {
    expect(formatCapacitySummary(135, 360, 60, 2)).toBe(
      '2h 15m selected · 3h 45m remaining · 1h calendar commitments · 2 unestimated'
    );
    expect(formatCapacitySummary(60, 60, 0, 0)).toBe('1h selected · 0m remaining');
    expect(formatMinutesHuman(0)).toBe('0m');
    expect(formatMinutesHuman(45)).toBe('45m');
    expect(formatMinutesHuman(120)).toBe('2h');
  });

  it('adds multiple work blocks across different days to a single task without mutating dueDate', () => {
    const block1 = addWorkBlock(store, 'task-1', {
      date: '2026-10-26',
      durationMinutes: 90,
      startTime: '10:00',
      endTime: '11:30',
      title: 'Literature review block',
    });

    const block2 = addWorkBlock(store, 'task-1', {
      date: '2026-10-27',
      durationMinutes: 120,
      startTime: '14:00',
      endTime: '16:00',
      title: 'Drafting block',
    });

    const task = store.getSnapshot().record.tasks.find((t) => t.id === 'task-1')!;
    expect(task.workBlocks).toHaveLength(2);
    expect(task.workBlocks![0].id).toBe(block1.id);
    expect(task.workBlocks![1].id).toBe(block2.id);
    // Hard deadline remains unchanged
    expect(task.dueDate).toBe('2026-10-31');
  });

  it('updates a work block to a new date and preserves task.dueDate', () => {
    const block = addWorkBlock(store, 'task-1', {
      date: '2026-10-26',
      durationMinutes: 90,
    });

    updateWorkBlock(store, 'task-1', block.id, {
      date: '2026-10-28',
      durationMinutes: 105,
      isLocked: true,
    });

    const task = store.getSnapshot().record.tasks.find((t) => t.id === 'task-1')!;
    const updated = task.workBlocks!.find((b) => b.id === block.id)!;
    expect(updated.date).toBe('2026-10-28');
    expect(updated.durationMinutes).toBe(105);
    expect(updated.isLocked).toBe(true);
    expect(task.dueDate).toBe('2026-10-31');
  });

  it('removes a work block safely', () => {
    const block = addWorkBlock(store, 'task-1', {
      date: '2026-10-26',
      durationMinutes: 60,
    });

    removeWorkBlock(store, 'task-1', block.id);
    const task = store.getSnapshot().record.tasks.find((t) => t.id === 'task-1')!;
    expect(task.workBlocks).toEqual([]);
  });

  it('retrieves work blocks for a specific date across tasks', () => {
    addWorkBlock(store, 'task-1', {
      date: '2026-10-26',
      durationMinutes: 60,
    });
    addWorkBlock(store, 'task-1', {
      date: '2026-10-27',
      durationMinutes: 60,
    });

    const tasks = store.getSnapshot().record.tasks;
    const blocks26 = getWorkBlocksForDate(tasks, '2026-10-26');
    const blocks27 = getWorkBlocksForDate(tasks, '2026-10-27');
    const blocks28 = getWorkBlocksForDate(tasks, '2026-10-28');

    expect(blocks26).toHaveLength(1);
    expect(blocks26[0].task.id).toBe('task-1');
    expect(blocks27).toHaveLength(1);
    expect(blocks28).toHaveLength(0);
  });

  describe('Estimation Bias Calibration Engine', () => {
    it('returns default 1.0 bias with insufficient completed samples', () => {
      const emptyTasks: Task[] = [];
      const res = calculateEstimationBias(emptyTasks);
      expect(res.rBias).toBe(1.0);
      expect(res.sampleCount).toBe(0);
      expect(res.status).toBe('accurate');
    });

    it('calculates empirical bias R_bias = sum(actual) / sum(estimated) accurately', () => {
      const sampleTasks: Task[] = [
        {
          id: 't-1',
          title: 'Task 1',
          status: 'done',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          createdAt: 100,
          estimatedMinutes: 30,
          timeSpentMinutes: 45, // 1.5x
        },
        {
          id: 't-2',
          title: 'Task 2',
          status: 'done',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          createdAt: 200,
          estimatedMinutes: 60,
          timeSpentMinutes: 90, // 1.5x
        },
      ];
      const res = calculateEstimationBias(sampleTasks);
      expect(res.sampleCount).toBe(2);
      expect(res.totalEstimatedMinutes).toBe(90);
      expect(res.totalActualMinutes).toBe(135);
      expect(res.rBias).toBe(1.5);
      expect(res.status).toBe('underestimating');
    });

    it('suggests calibrated duration rounded to nearest 5 minutes', () => {
      expect(suggestCalibratedDuration(30, 1.45)).toBe(45);
      expect(suggestCalibratedDuration(60, 1.0)).toBe(60);
      expect(suggestCalibratedDuration(20, 0.75)).toBe(15);
      expect(suggestCalibratedDuration(0, 1.5)).toBe(30); // fallback
    });
  });

  describe('Deficit Budgeting', () => {
    it('calculates available whitespace and detects deficit when overallocated', () => {
      // 8-hour workday (9am - 5pm = 480m)
      // Calendar events: 120m (2 hours)
      // Buffers: 30m
      // Whitespace: 480 - 120 - 30 = 330m
      // Tasks: 400m -> Deficit: 70m
      const budget = calculateDeficitBudget({
        workdayStartHour: 9,
        workdayEndHour: 17,
        calendarEventsMinutes: 120,
        bufferMinutes: 30,
        tasksMinutes: 400,
      });

      expect(budget.totalWorkdayMinutes).toBe(480);
      expect(budget.whitespaceMinutes).toBe(330);
      expect(budget.deficitMinutes).toBe(70);
      expect(budget.isOverallocated).toBe(true);
      expect(budget.allocationPercent).toBe(121);
    });

    it('returns zero deficit when tasks fit comfortably within whitespace', () => {
      const budget = calculateDeficitBudget({
        workdayStartHour: 9,
        workdayEndHour: 17,
        calendarEventsMinutes: 60,
        bufferMinutes: 30,
        tasksMinutes: 180,
      });

      expect(budget.whitespaceMinutes).toBe(390);
      expect(budget.deficitMinutes).toBe(0);
      expect(budget.isOverallocated).toBe(false);
      expect(budget.allocationPercent).toBe(46);
    });
  });
});
