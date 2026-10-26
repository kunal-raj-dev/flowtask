// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Task, WorkBlock } from '../src/types/task';
import type { WorkspaceRecord } from '../src/types/workspace';
import { WorkspaceStore } from '../src/services/workspaceStore';
import { emptyWorkspace } from '../src/services/dbService';
import {
  getEffectiveWorkBlocks,
  getAllEffectiveWorkBlocks,
  isLegacyClockOnly,
  syncTaskLegacySchedule,
} from '../src/services/scheduleAdapter';
import {
  createWorkSession,
  moveWorkSession,
  deleteWorkSession,
} from '../src/services/workBlockService';
import { commandService } from '../src/services/commandService';
import {
  runScheduleMigration,
  getPreM1Snapshot,
  rollbackPreM1Snapshot,
  PRE_M1_SNAPSHOT_ID,
} from '../src/services/migrationEngine';
import {
  createWorkspaceBackup,
  validateBackupExtras,
  mergeBackupExtras,
} from '../src/utils/workspaceBackup';
import { ownWorkspace } from '../src/services/workspaceOwnership';

describe('Phase 2: Canonical Scheduling, Durability, and Recovery (Milestone M1)', () => {
  let disk: WorkspaceRecord;
  let persistence: any;
  let store: WorkspaceStore;

  beforeEach(async () => {
    vi.unstubAllGlobals();
    disk = emptyWorkspace('phase2-test');
    persistence = {
      ensureLegacyMigrated: async () => structuredClone(disk),
      saveWorkspace: async (_id: string, r: WorkspaceRecord) => {
        disk = structuredClone(r);
      },
      loadWorkspace: async () => structuredClone(disk),
    };
    store = new WorkspaceStore('phase2-test', false, persistence);
    await store.load();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // 1. Canonical Reservation & Read Adapter Tests
  // =========================================================================
  describe('Canonical Reservation & Read Adapter (scheduleAdapter.ts)', () => {
    it('reads global record.workBlocks for the task when present', () => {
      const task: Task = {
        id: 'task-canonical-1',
        title: 'Review System Architecture',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        subtasks: [],
      };

      const globalBlock: WorkBlock = {
        id: 'block-global-1',
        taskId: task.id,
        startInstant: Date.parse('2026-10-27T09:00:00Z'),
        endInstant: Date.parse('2026-10-27T10:30:00Z'),
        timezone: 'UTC',
        status: 'scheduled',
        date: '2026-10-27',
        startTime: '09:00',
        endTime: '10:30',
        durationMinutes: 90,
        source: 'canonical',
        revision: 1,
      };

      const effective = getEffectiveWorkBlocks(task, [globalBlock]);
      expect(effective).toHaveLength(1);
      expect(effective[0].id).toBe('block-global-1');
      expect(effective[0].durationMinutes).toBe(90);
    });

    it('falls back to embedded task.workBlocks when global recordBlocks has no entry', () => {
      const embeddedBlock: WorkBlock = {
        id: 'block-emb-1',
        taskId: 'task-emb',
        startInstant: Date.parse('2026-10-27T14:00:00Z'),
        endInstant: Date.parse('2026-10-27T15:00:00Z'),
        timezone: 'UTC',
        status: 'scheduled',
        date: '2026-10-27',
        startTime: '14:00',
        endTime: '15:00',
        durationMinutes: 60,
        source: 'embedded',
        revision: 1,
      };

      const task: Task = {
        id: 'task-emb',
        title: 'Draft API Specification',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        subtasks: [],
        workBlocks: [embeddedBlock],
      };

      const effective = getEffectiveWorkBlocks(task, []);
      expect(effective).toHaveLength(1);
      expect(effective[0].id).toBe('block-emb-1');
      expect(effective[0].source).toBe('embedded');
    });

    it('falls back to legacy task clocks (scheduledStart/scheduledEnd + plannedDate) dynamically', () => {
      const task: Task = {
        id: 'task-legacy-1',
        title: 'Legacy Scheduled Consultation',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        subtasks: [],
        plannedDate: '2026-10-28',
        scheduledStart: '11:00',
        scheduledEnd: '12:00',
        estimatedMinutes: 60,
        scheduleLocked: true,
      };

      const effective = getEffectiveWorkBlocks(task, []);
      expect(effective).toHaveLength(1);
      const synth = effective[0];
      expect(synth.source).toBe('legacy_clock');
      expect(synth.date).toBe('2026-10-28');
      expect(synth.startTime).toBe('11:00');
      expect(synth.endTime).toBe('12:00');
      expect(synth.durationMinutes).toBe(60);
      expect(synth.isLocked).toBe(true);
    });

    it('deduplicates identical intervals between global blocks, embedded blocks, and legacy clocks', () => {
      const task: Task = {
        id: 'task-dedup-1',
        title: 'Weekly Standup',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        subtasks: [],
        plannedDate: '2026-10-27',
        scheduledStart: '10:00',
        scheduledEnd: '11:00',
        workBlocks: [
          {
            id: 'emb-dedup',
            taskId: 'task-dedup-1',
            startInstant: Date.parse('2026-10-27T10:00:00Z'),
            endInstant: Date.parse('2026-10-27T11:00:00Z'),
            timezone: 'UTC',
            status: 'scheduled',
            date: '2026-10-27',
            startTime: '10:00',
            endTime: '11:00',
            durationMinutes: 60,
          },
        ],
      };

      const globalBlock: WorkBlock = {
        id: 'global-dedup',
        taskId: 'task-dedup-1',
        startInstant: Date.parse('2026-10-27T10:00:00Z'),
        endInstant: Date.parse('2026-10-27T11:00:00Z'),
        timezone: 'UTC',
        status: 'scheduled',
        date: '2026-10-27',
        startTime: '10:00',
        endTime: '11:00',
        durationMinutes: 60,
        source: 'canonical',
      };

      // Even though task has legacy clock, embedded block, and global block with identical interval:
      const effective = getEffectiveWorkBlocks(task, [globalBlock]);
      // Must return exactly 1 deduplicated slot, preferring global canonical block
      expect(effective).toHaveLength(1);
      expect(effective[0].id).toBe('global-dedup');
      expect(effective[0].source).toBe('canonical');
    });

    it('getAllEffectiveWorkBlocks flattens and deduplicates across entire workspace', () => {
      const taskA: Task = {
        id: 'task-a',
        title: 'Task A',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        subtasks: [],
        plannedDate: '2026-10-27',
        scheduledStart: '09:00',
        scheduledEnd: '09:45',
      };

      const taskB: Task = {
        id: 'task-b',
        title: 'Task B',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        subtasks: [],
      };

      const blockB: WorkBlock = {
        id: 'block-b',
        taskId: 'task-b',
        startInstant: Date.parse('2026-10-27T10:00:00Z'),
        endInstant: Date.parse('2026-10-27T11:00:00Z'),
        timezone: 'UTC',
        status: 'scheduled',
        date: '2026-10-27',
        startTime: '10:00',
        endTime: '11:00',
        durationMinutes: 60,
      };

      const all = getAllEffectiveWorkBlocks([taskA, taskB], [blockB]);
      expect(all).toHaveLength(2);
      expect(all.map((b) => b.taskId)).toEqual(['task-a', 'task-b']);
    });

    it('isLegacyClockOnly accurately flags tasks without canonical blocks', () => {
      const legacyTask: Task = {
        id: 't-legacy',
        title: 'Legacy',
        status: 'todo',
        priority: 'p3',
        projectId: 'inbox',
        subtasks: [],
        plannedDate: '2026-10-29',
        scheduledStart: '15:00',
      };

      const canonicalTask: Task = {
        id: 't-canon',
        title: 'Canon',
        status: 'todo',
        priority: 'p3',
        projectId: 'inbox',
        subtasks: [],
        workBlocks: [
          {
            id: 'wb-canon',
            taskId: 't-canon',
            startInstant: 1000,
            endInstant: 2000,
            timezone: 'UTC',
            status: 'scheduled',
            durationMinutes: 30,
          },
        ],
      };

      expect(isLegacyClockOnly(legacyTask, [])).toBe(true);
      expect(isLegacyClockOnly(canonicalTask, [])).toBe(false);
    });

    it('syncTaskLegacySchedule projects primary work block to task legacy fields', () => {
      const task: Task = {
        id: 't-sync',
        title: 'Sync Task',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        subtasks: [],
      };

      const block1: WorkBlock = {
        id: 'b1',
        taskId: 't-sync',
        startInstant: Date.parse('2026-10-27T09:00:00Z'),
        endInstant: Date.parse('2026-10-27T10:00:00Z'),
        timezone: 'UTC',
        status: 'scheduled',
        date: '2026-10-27',
        startTime: '09:00',
        endTime: '10:00',
        durationMinutes: 60,
        isLocked: true,
      };

      const block2: WorkBlock = {
        id: 'b2',
        taskId: 't-sync',
        startInstant: Date.parse('2026-10-27T14:00:00Z'),
        endInstant: Date.parse('2026-10-27T15:00:00Z'),
        timezone: 'UTC',
        status: 'scheduled',
        date: '2026-10-27',
        startTime: '14:00',
        endTime: '15:00',
        durationMinutes: 60,
      };

      const projected = syncTaskLegacySchedule(task, [block2, block1]);
      // Earliest active block (b1) projected
      expect(projected.scheduledStart).toBe('09:00');
      expect(projected.scheduledEnd).toBe('10:00');
      expect(projected.plannedDate).toBe('2026-10-27');
      expect(projected.scheduleLocked).toBe(true);
    });
  });

  // =========================================================================
  // 2. Authoritative Write Pipeline & Projections Sync
  // =========================================================================
  describe('Authoritative Write Pipeline (workBlockService.ts)', () => {
    it('createWorkSession creates canonical work block and syncs projections to legacy fields', () => {
      store.run('Add task', (r) => ({
        ...r,
        tasks: [
          ...r.tasks,
          {
            id: 'task-authoritative-1',
            title: 'Prepare Board Deck',
            status: 'todo',
            priority: 'p1',
            projectId: 'inbox',
            subtasks: [],
            createdAt: 1000,
          },
        ],
      }));

      const start = Date.parse('2026-10-27T09:00:00Z');
      const end = Date.parse('2026-10-27T10:30:00Z');

      const block = createWorkSession(store, {
        taskId: 'task-authoritative-1',
        startInstant: start,
        endInstant: end,
        timezone: 'UTC',
        isLocked: true,
      });

      expect(block.source).toBe('canonical');
      expect(block.durationMinutes).toBe(90);

      const record = store.getSnapshot().record;
      expect(record.workBlocks).toHaveLength(1);
      expect(record.workBlocks![0].id).toBe(block.id);

      const updatedTask = record.tasks.find((task) => task.id === 'task-authoritative-1')!;
      expect(updatedTask.workBlocks).toHaveLength(1);
      // Legacy projections synced automatically
      expect(updatedTask.scheduledStart).toBe('09:00');
      expect(updatedTask.scheduledEnd).toBe('10:30');
      expect(updatedTask.plannedDate).toBe('2026-10-27');
      expect(updatedTask.scheduleLocked).toBe(true);
    });

    it('moveWorkSession updates intervals and syncs task legacy projections', () => {
      store.run('Add task', (r) => ({
        ...r,
        tasks: [
          ...r.tasks,
          {
            id: 'task-move-1',
            title: 'Sprint Planning',
            status: 'todo',
            priority: 'p2',
            projectId: 'inbox',
            subtasks: [],
            createdAt: 1000,
          },
        ],
      }));

      const block = createWorkSession(store, {
        taskId: 'task-move-1',
        startInstant: Date.parse('2026-10-27T10:00:00Z'),
        endInstant: Date.parse('2026-10-27T11:00:00Z'),
        timezone: 'UTC',
      });

      // Move to next day afternoon
      const newStart = Date.parse('2026-10-28T14:00:00Z');
      const newEnd = Date.parse('2026-10-28T15:00:00Z');
      moveWorkSession(store, block.id, newStart, newEnd);

      const task = store.getSnapshot().record.tasks.find((t) => t.id === 'task-move-1')!;
      expect(task.plannedDate).toBe('2026-10-28');
      expect(task.scheduledStart).toBe('14:00');
      expect(task.scheduledEnd).toBe('15:00');
    });

    it('deleteWorkSession removes block and clears task legacy clocks when no blocks remain', () => {
      store.run('Add task', (r) => ({
        ...r,
        tasks: [
          ...r.tasks,
          {
            id: 'task-del-1',
            title: 'Temporary Session',
            status: 'todo',
            priority: 'p3',
            projectId: 'inbox',
            subtasks: [],
            createdAt: 1000,
          },
        ],
      }));

      const block = createWorkSession(store, {
        taskId: 'task-del-1',
        startInstant: Date.parse('2026-10-27T10:00:00Z'),
        endInstant: Date.parse('2026-10-27T10:30:00Z'),
        timezone: 'UTC',
      });

      expect(store.getSnapshot().record.workBlocks).toHaveLength(1);

      deleteWorkSession(store, block.id);

      const record = store.getSnapshot().record;
      expect(record.workBlocks).toHaveLength(0);
      const task = record.tasks.find((t) => t.id === 'task-del-1')!;
      expect(task.workBlocks).toHaveLength(0);
      expect(task.scheduledStart).toBeUndefined();
      expect(task.scheduledEnd).toBeUndefined();
    });

    it('prevents modifying or deleting locked sessions without allowLocked', () => {
      store.run('Add task', (r) => ({
        ...r,
        tasks: [
          ...r.tasks,
          {
            id: 'task-locked-1',
            title: 'Locked Client Meeting',
            status: 'todo',
            priority: 'p1',
            projectId: 'inbox',
            subtasks: [],
            createdAt: 1000,
          },
        ],
      }));

      const block = createWorkSession(store, {
        taskId: 'task-locked-1',
        startInstant: Date.parse('2026-10-27T10:00:00Z'),
        endInstant: Date.parse('2026-10-27T11:00:00Z'),
        timezone: 'UTC',
        isLocked: true,
      });

      expect(() =>
        moveWorkSession(store, block.id, Date.parse('2026-10-27T11:00:00Z'), Date.parse('2026-10-27T12:00:00Z'))
      ).toThrow(/locked/);

      expect(() => deleteWorkSession(store, block.id)).toThrow(/locked/);

      // Succeeded when allowLocked is true
      expect(() => deleteWorkSession(store, block.id, { allowLocked: true })).not.toThrow();
    });
  });

  // =========================================================================
  // 3. Canonical Command Service with Atomic Rollback
  // =========================================================================
  describe('Canonical Command Service (commandService.ts)', () => {
    const sampleTask: Task = {
      id: 'cmd-task-1',
      title: 'Analyze Performance Metrics',
      status: 'todo',
      priority: 'p2',
      projectId: 'work',
      subtasks: [],
      createdAt: 1000,
    };

    it('scheduleTask sets canonical work block and provides atomic undo/redo', () => {
      const initialTasks = [sampleTask];
      const result = commandService.scheduleTask(initialTasks, 'cmd-task-1', {
        date: '2026-10-27',
        startTime: '10:00',
        endTime: '11:00',
        isLocked: true,
      });

      const updated = result.updatedTasks[0];
      expect(updated.plannedDate).toBe('2026-10-27');
      expect(updated.scheduledStart).toBe('10:00');
      expect(updated.scheduledEnd).toBe('11:00');
      expect(updated.scheduleLocked).toBe(true);
      expect(updated.workBlocks).toHaveLength(1);
      expect(updated.workBlocks![0].source).toBe('canonical');

      // Undo restores exact pristine state
      const reverted = result.inverse(result.updatedTasks);
      expect(reverted[0].scheduledStart).toBeUndefined();
      expect(reverted[0].workBlocks).toBeUndefined();

      // Forward reapplies
      const redone = result.forward!(reverted);
      expect(redone[0].scheduledStart).toBe('10:00');
      expect(redone[0].workBlocks).toHaveLength(1);
    });

    it('moveTask alters schedule with surgical inverse', () => {
      const scheduledTask: Task = {
        ...sampleTask,
        plannedDate: '2026-10-27',
        scheduledStart: '09:00',
        scheduledEnd: '10:00',
        workBlocks: [
          {
            id: 'wb-move',
            taskId: 'cmd-task-1',
            startInstant: Date.parse('2026-10-27T09:00:00Z'),
            endInstant: Date.parse('2026-10-27T10:00:00Z'),
            timezone: 'UTC',
            status: 'scheduled',
            durationMinutes: 60,
          },
        ],
      };

      const result = commandService.moveTask([scheduledTask], 'cmd-task-1', '2026-10-28', '14:00');
      expect(result.updatedTasks[0].plannedDate).toBe('2026-10-28');
      expect(result.updatedTasks[0].scheduledStart).toBe('14:00');

      const restored = result.inverse(result.updatedTasks);
      expect(restored[0].plannedDate).toBe('2026-10-27');
      expect(restored[0].scheduledStart).toBe('09:00');
    });

    it('unscheduleTask clears schedule and marks work blocks cancelled with atomic rollback', () => {
      const scheduledTask: Task = {
        ...sampleTask,
        plannedDate: '2026-10-27',
        scheduledStart: '09:00',
        scheduledEnd: '10:00',
        workBlocks: [
          {
            id: 'wb-unsched',
            taskId: 'cmd-task-1',
            startInstant: 1000,
            endInstant: 2000,
            timezone: 'UTC',
            status: 'scheduled',
            durationMinutes: 60,
          },
        ],
      };

      const result = commandService.unscheduleTask([scheduledTask], 'cmd-task-1');
      expect(result.updatedTasks[0].scheduledStart).toBeUndefined();
      expect(result.updatedTasks[0].scheduledEnd).toBeUndefined();
      expect(result.updatedTasks[0].workBlocks![0].status).toBe('cancelled');

      // Undo restores original workBlocks and schedule
      const undone = result.inverse(result.updatedTasks);
      expect(undone[0].scheduledStart).toBe('09:00');
      expect(undone[0].workBlocks![0].status).toBe('scheduled');
    });

    it('enforces scheduleLocked on schedule, move, and unschedule operations', () => {
      const lockedTask: Task = {
        ...sampleTask,
        scheduleLocked: true,
        plannedDate: '2026-10-27',
        scheduledStart: '09:00',
        scheduledEnd: '10:00',
      };

      expect(() => commandService.scheduleTask([lockedTask], 'cmd-task-1', { date: '2026-10-28', startTime: '10:00' }))
        .toThrow(/locked/);

      expect(() => commandService.moveTask([lockedTask], 'cmd-task-1', '2026-10-28'))
        .toThrow(/locked/);

      expect(() => commandService.unscheduleTask([lockedTask], 'cmd-task-1'))
        .toThrow(/locked/);
    });

    it('executeCommand dispatcher routes all scheduling commands properly', () => {
      const tasks = [sampleTask];
      const sched = commandService.executeCommand(tasks, {
        type: 'schedule_task',
        taskId: 'cmd-task-1',
        payload: { date: '2026-10-27', startTime: '11:00', durationMinutes: 45 },
      });
      expect(sched.updatedTasks[0].scheduledStart).toBe('11:00');

      const moved = commandService.executeCommand(sched.updatedTasks, {
        type: 'move_task',
        taskId: 'cmd-task-1',
        payload: { newDate: '2026-10-28', newStartTime: '12:00' },
      });
      expect(moved.updatedTasks[0].plannedDate).toBe('2026-10-28');

      const unsched = commandService.executeCommand(moved.updatedTasks, {
        type: 'unschedule_task',
        taskId: 'cmd-task-1',
      });
      expect(unsched.updatedTasks[0].scheduledStart).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. Conservative Migration, Snapshot & Restore
  // =========================================================================
  describe('Conservative Migration Engine (migrationEngine.ts)', () => {
    it('supports dry-run mode generating diff reports without mutating store', async () => {
      const record = emptyWorkspace('mig-test');
      record.tasks = [
        {
          id: 'task-leg-ok',
          title: 'Unambiguous Legacy Task',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          plannedDate: '2026-10-27',
          scheduledStart: '09:00',
          scheduledEnd: '10:00',
        },
        {
          id: 'task-leg-ambig',
          title: 'Ambiguous Missing Date Task',
          status: 'todo',
          priority: 'p3',
          projectId: 'inbox',
          subtasks: [],
          scheduledStart: '14:00', // Missing date!
        },
      ];

      const report = await runScheduleMigration(record, { dryRun: true, timezone: 'UTC' });

      expect(report.dryRun).toBe(true);
      expect(report.totalTasksScanned).toBe(2);
      expect(report.convertedCount).toBe(1);
      expect(report.ambiguousCount).toBe(1);
      expect(report.convertedBlocks[0].taskId).toBe('task-leg-ok');
      expect(report.reviewQueue[0].reason).toBe('missing_date');

      // Record was NOT mutated during dry-run
      expect(record.workBlocks).toEqual([]);
      expect(record.tasks[0].workBlocks).toBeUndefined();
    });

    it('performs live conversion, stores pre-M1 snapshot, and supports rollback', async () => {
      const initialRecord = emptyWorkspace('rollback-test');
      initialRecord.tasks = [
        {
          id: 'task-to-convert',
          title: 'Quarterly Financial Review',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          subtasks: [],
          createdAt: 1000,
          plannedDate: '2026-10-27',
          scheduledStart: '10:00',
          scheduledEnd: '11:30',
          scheduleLocked: true,
        },
      ];

      const report = await runScheduleMigration(initialRecord, { dryRun: false, timezone: 'UTC' });

      expect(report.dryRun).toBe(false);
      expect(report.snapshotId).toBe(PRE_M1_SNAPSHOT_ID);
      expect(report.convertedCount).toBe(1);
      expect(initialRecord.workBlocks).toHaveLength(1);
      expect(initialRecord.workBlocks![0].isLocked).toBe(true);
      expect(initialRecord.workBlocks![0].source).toBe('canonical');

      // Verify snapshot can be retrieved
      const snapshot = await getPreM1Snapshot('rollback-test');
      expect(snapshot).not.toBeNull();
      expect(snapshot!.workBlocks).toEqual([]); // Snapshot has pre-migration state

      // Test store rollback
      const rollbackStore = new WorkspaceStore('rollback-test', false, {
        ensureLegacyMigrated: async () => initialRecord,
        saveWorkspace: async () => {},
      } as any);
      await rollbackStore.load();

      await rollbackPreM1Snapshot(rollbackStore);
      expect(rollbackStore.getSnapshot().record.workBlocks).toEqual([]);
    });

    it('flags conflicting intervals into review queue without overwriting', async () => {
      const record = emptyWorkspace('conflict-test');
      record.workBlocks = [
        {
          id: 'existing-block',
          taskId: 'existing-task',
          startInstant: Date.parse('2026-10-27T09:00:00Z'),
          endInstant: Date.parse('2026-10-27T10:00:00Z'),
          timezone: 'UTC',
          status: 'scheduled',
          durationMinutes: 60,
        },
      ];
      record.tasks = [
        {
          id: 'conflicting-legacy',
          title: 'Overlapping Legacy Task',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          plannedDate: '2026-10-27',
          scheduledStart: '09:30', // Overlaps with existing-block!
          scheduledEnd: '10:30',
        },
      ];

      const report = await runScheduleMigration(record, { dryRun: false, timezone: 'UTC' });
      expect(report.convertedCount).toBe(0);
      expect(report.ambiguousCount).toBe(1);
      expect(report.reviewQueue[0].reason).toBe('schedule_conflict');

      // Original task remains untouched
      expect(record.tasks[0].scheduledStart).toBe('09:30');
      expect(record.workBlocks).toHaveLength(1);
      expect(record.workBlocks![0].id).toBe('existing-block');
    });

    it('is strictly idempotent on repeated runs with zero duplicate blocks created', async () => {
      const record = emptyWorkspace('idempotent-test');
      record.tasks = [
        {
          id: 'task-idem',
          title: 'Idempotency Target',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          plannedDate: '2026-10-27',
          scheduledStart: '13:00',
          scheduledEnd: '14:00',
        },
      ];

      // Run 1: Converts 1 task
      const report1 = await runScheduleMigration(record, { dryRun: false, timezone: 'UTC' });
      expect(report1.convertedCount).toBe(1);
      expect(record.workBlocks).toHaveLength(1);

      // Run 2: Already canonical, converts 0 tasks
      const report2 = await runScheduleMigration(record, { dryRun: false, timezone: 'UTC' });
      expect(report2.convertedCount).toBe(0);
      expect(report2.alreadyCanonicalCount).toBe(1);
      expect(record.workBlocks).toHaveLength(1); // No duplicates!
    });
  });

  // =========================================================================
  // 5. Backup & Restore Round-Trip with Referential Integrity
  // =========================================================================
  describe('Backup & Restore Round-Trip (workspaceBackup.ts)', () => {
    it('serializes schema version 9 and verifies round-trip with referential integrity', () => {
      const record = emptyWorkspace('backup-test');
      record.tasks = [
        {
          id: 't-parent',
          title: 'System Infrastructure Upgrade',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          subtasks: [],
          createdAt: 1000,
        },
      ];
      record.workBlocks = [
        {
          id: 'wb-valid',
          taskId: 't-parent',
          startInstant: Date.parse('2026-10-27T09:00:00Z'),
          endInstant: Date.parse('2026-10-27T10:00:00Z'),
          timezone: 'UTC',
          status: 'scheduled',
          date: '2026-10-27',
          startTime: '09:00',
          endTime: '10:00',
          durationMinutes: 60,
          source: 'canonical',
        },
        {
          id: 'wb-orphan',
          taskId: 't-non-existent-task', // Orphan block
          startInstant: Date.parse('2026-10-27T11:00:00Z'),
          endInstant: Date.parse('2026-10-27T12:00:00Z'),
          timezone: 'UTC',
          status: 'scheduled',
          date: '2026-10-27',
          durationMinutes: 60,
        },
      ];

      // Export backup
      const backup = createWorkspaceBackup(record);
      expect(backup.schemaVersion).toBe(9);
      expect(backup.version).toBe(9);
      // Orphan block filtered out by referential integrity
      expect(backup.workBlocks).toHaveLength(1);
      expect(backup.workBlocks[0].id).toBe('wb-valid');

      // Validate extras
      const extras = validateBackupExtras(backup);
      expect(extras?.workBlocks).toHaveLength(1);
      expect(extras?.workBlocks![0].id).toBe('wb-valid');

      // Merge into clean workspace
      const target = emptyWorkspace('clean-target');
      const merged = mergeBackupExtras(target as any, extras!, true);
      expect(merged.workBlocks).toHaveLength(1);
      expect(merged.workBlocks![0].taskId).toBe('t-parent');
    });
  });

  // =========================================================================
  // 6. Multi-Tab Ownership & Split-Brain Prevention
  // =========================================================================
  describe('Multi-Tab Ownership (workspaceOwnership.ts)', () => {
    it('primary tab acquires ownership while secondary tab degrades to read-only follower', async () => {
      let busy = false;
      const request = vi.fn(
        async (_name: string, options: { ifAvailable?: boolean }, callback: (lock: object | null) => Promise<void>) => {
          if (busy && options.ifAvailable) return callback(null);
          busy = true;
          try {
            await callback({ name: 'local' });
          } finally {
            busy = false;
          }
        }
      );
      vi.stubGlobal('navigator', { locks: { request } });
      vi.stubGlobal('BroadcastChannel', undefined);

      let tab1ReadOnly = false;
      const tab1Store = {
        id: 'tab-test',
        subscribe: vi.fn(() => vi.fn()),
        getSnapshot: () => ({ lastSavedAt: 0 }),
        reload: vi.fn(async () => {}),
        settled: vi.fn(async () => {}),
        setReadOnly: vi.fn((val: boolean) => {
          tab1ReadOnly = val;
        }),
      } as unknown as WorkspaceStore;

      let tab2ReadOnly = false;
      const tab2Store = {
        id: 'tab-test',
        subscribe: vi.fn(() => vi.fn()),
        getSnapshot: () => ({ lastSavedAt: 0 }),
        reload: vi.fn(async () => {}),
        settled: vi.fn(async () => {}),
        setReadOnly: vi.fn((val: boolean) => {
          tab2ReadOnly = val;
        }),
      } as unknown as WorkspaceStore;

      const owner1 = ownWorkspace(tab1Store);
      await vi.waitFor(() => expect(owner1.isOwner()).toBe(true));
      expect(tab1ReadOnly).toBe(false);

      const owner2 = ownWorkspace(tab2Store);
      await vi.waitFor(() => expect(tab2ReadOnly).toBe(true));
      expect(owner2.isOwner()).toBe(false);

      owner1.close();
      owner2.close();
    });

    it('takeover transfer: secondary tab claims ownership via takeover and primary tab yields', async () => {
      let busy = false;
      const waiters: Array<() => void> = [];
      const request = vi.fn(
        async (_name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, callback: (lock: object | null) => Promise<void>) => {
          if (busy && options.ifAvailable) return callback(null);
          if (busy) {
            await new Promise<void>((resolve) => waiters.push(resolve));
          }
          busy = true;
          try {
            await callback({ name: 'local' });
          } finally {
            busy = false;
            const next = waiters.shift();
            if (next) next();
          }
        }
      );
      vi.stubGlobal('navigator', { locks: { request } });
      vi.stubGlobal('BroadcastChannel', undefined);

      let tab1ReadOnly = false;
      const tab1Store = {
        id: 'tab-takeover',
        subscribe: vi.fn(() => vi.fn()),
        getSnapshot: () => ({ lastSavedAt: 0 }),
        reload: vi.fn(async () => {}),
        settled: vi.fn(async () => {}),
        setReadOnly: vi.fn((val: boolean) => {
          tab1ReadOnly = val;
        }),
      } as unknown as WorkspaceStore;

      const owner1 = ownWorkspace(tab1Store);
      await vi.waitFor(() => expect(owner1.isOwner()).toBe(true));
      expect(tab1ReadOnly).toBe(false);

      let tab2ReadOnly = false;
      const tab2Store = {
        id: 'tab-takeover',
        subscribe: vi.fn(() => vi.fn()),
        getSnapshot: () => ({ lastSavedAt: 0 }),
        reload: vi.fn(async () => {}),
        settled: vi.fn(async () => {}),
        setReadOnly: vi.fn((val: boolean) => {
          tab2ReadOnly = val;
        }),
      } as unknown as WorkspaceStore;

      const owner2 = ownWorkspace(tab2Store);
      await vi.waitFor(() => expect(tab2ReadOnly).toBe(true));

      // Close primary tab (e.g. navigation or window close)
      owner1.close();
      await vi.waitFor(() => expect(owner1.isClosed()).toBe(true));

      // Owner 2 claims ownership via takeOver
      await owner2.takeOver();
      await vi.waitFor(() => expect(owner2.isOwner()).toBe(true));
      expect(tab2ReadOnly).toBe(false);

      owner2.close();
    });
  });

  // =========================================================================
  // 7. Targeted Adversarial & Edge Cases
  // =========================================================================
  describe('Targeted Adversarial & Edge Cases', () => {
    it('getEffectiveWorkBlocks gracefully ignores deleted tasks and empty objects', () => {
      const deletedTask: Task = {
        id: 't-del',
        title: 'Deleted Task',
        status: 'todo',
        priority: 'p3',
        projectId: 'inbox',
        subtasks: [],
        deletedAt: Date.now(),
        scheduledStart: '10:00',
        plannedDate: '2026-10-27',
      };
      expect(getEffectiveWorkBlocks(deletedTask, [])).toEqual([]);
      expect(getEffectiveWorkBlocks(null as any, [])).toEqual([]);
    });

    it('syncTaskLegacySchedule selects earliest unfinished block among multiple active sessions', () => {
      const task: Task = {
        id: 't-multi',
        title: 'Multi-session task',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        subtasks: [],
      };

      const blocks: WorkBlock[] = [
        {
          id: 'b-done',
          taskId: 't-multi',
          startInstant: Date.parse('2026-10-26T08:00:00Z'),
          endInstant: Date.parse('2026-10-26T09:00:00Z'),
          timezone: 'UTC',
          status: 'completed',
          date: '2026-10-26',
          startTime: '08:00',
          endTime: '09:00',
          durationMinutes: 60,
        },
        {
          id: 'b-later',
          taskId: 't-multi',
          startInstant: Date.parse('2026-10-27T14:00:00Z'),
          endInstant: Date.parse('2026-10-27T15:00:00Z'),
          timezone: 'UTC',
          status: 'scheduled',
          date: '2026-10-27',
          startTime: '14:00',
          endTime: '15:00',
          durationMinutes: 60,
        },
        {
          id: 'b-earlier',
          taskId: 't-multi',
          startInstant: Date.parse('2026-10-27T10:00:00Z'),
          endInstant: Date.parse('2026-10-27T11:00:00Z'),
          timezone: 'UTC',
          status: 'scheduled',
          date: '2026-10-27',
          startTime: '10:00',
          endTime: '11:00',
          durationMinutes: 60,
        },
      ];

      const proj = syncTaskLegacySchedule(task, blocks);
      // Must select b-earlier (10:00 on 2026-10-27), skipping already completed b-done
      expect(proj.plannedDate).toBe('2026-10-27');
      expect(proj.scheduledStart).toBe('10:00');
      expect(proj.scheduledEnd).toBe('11:00');
    });

    it('commandService undo/redo cycle operates 5 times without drift', () => {
      const task: Task = {
        id: 'cycle-task',
        title: 'Cycle Task',
        status: 'todo',
        priority: 'p3',
        projectId: 'inbox',
        subtasks: [],
        createdAt: 1000,
      };

      const result = commandService.scheduleTask([task], 'cycle-task', {
        date: '2026-10-27',
        startTime: '10:00',
        endTime: '11:00',
      });

      let current = result.updatedTasks;
      for (let i = 0; i < 5; i++) {
        current = result.inverse(current);
        expect(current[0].scheduledStart).toBeUndefined();
        expect(current[0].workBlocks).toBeUndefined();

        current = result.forward!(current);
        expect(current[0].scheduledStart).toBe('10:00');
        expect(current[0].workBlocks).toHaveLength(1);
      }
    });

    it('large migration fixture drill: processes 50 mixed tasks without loss or duplicates', async () => {
      const record = emptyWorkspace('fixture-50');
      const tasks: Task[] = [];
      const globalBlocks: WorkBlock[] = [];

      for (let i = 0; i < 50; i++) {
        const id = `task-fixture-${i}`;
        const hasExistingCanon = i % 5 === 0;
        const isAmbiguousMissingDate = i % 15 === 1;
        const isAmbiguousInvalidTime = i % 15 === 2;

        if (hasExistingCanon) {
          globalBlocks.push({
            id: `wb-canon-${i}`,
            taskId: id,
            startInstant: Date.parse('2026-10-27T08:00:00Z') + i * 3600000,
            endInstant: Date.parse('2026-10-27T09:00:00Z') + i * 3600000,
            timezone: 'UTC',
            status: 'scheduled',
            durationMinutes: 60,
            date: '2026-10-27',
          });
        }

        tasks.push({
          id,
          title: `Fixture Task ${i}`,
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          createdAt: 1000 + i,
          plannedDate: isAmbiguousMissingDate ? undefined : '2026-10-28',
          scheduledStart: isAmbiguousInvalidTime ? 'invalid-hour' : '10:00',
          scheduledEnd: '11:00',
        });
      }

      record.tasks = tasks;
      record.workBlocks = globalBlocks;

      const report = await runScheduleMigration(record, { dryRun: false, timezone: 'UTC' });

      expect(report.totalTasksScanned).toBe(50);
      expect(report.alreadyCanonicalCount).toBe(10); // 50 / 5 = 10
      expect(report.convertedCount).toBeGreaterThan(0);
      expect(report.ambiguousCount).toBeGreaterThan(0);

      // Verify idempotence on repeat run
      const repeatReport = await runScheduleMigration(record, { dryRun: false, timezone: 'UTC' });
      expect(repeatReport.convertedCount).toBe(0); // 0 new conversions on repeat
      expect(record.workBlocks!.length).toBe(report.convertedBlocks.length + 10);
    });

    it('does not resurrect a cancelled work block from embedded task.workBlocks when cancelled in recordBlocks', () => {
      const task: Task = {
        id: 'task-no-resurrect',
        title: 'Cancelled session task',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        subtasks: [],
        workBlocks: [
          {
            id: 'wb-cancelled-global',
            taskId: 'task-no-resurrect',
            startInstant: Date.parse('2026-10-27T09:00:00Z'),
            endInstant: Date.parse('2026-10-27T10:00:00Z'),
            timezone: 'UTC',
            status: 'scheduled', // Stale embedded says scheduled
            date: '2026-10-27',
            startTime: '09:00',
            endTime: '10:00',
            durationMinutes: 60,
          },
        ],
      };

      const globalBlocks: WorkBlock[] = [
        {
          id: 'wb-cancelled-global',
          taskId: 'task-no-resurrect',
          startInstant: Date.parse('2026-10-27T09:00:00Z'),
          endInstant: Date.parse('2026-10-27T10:00:00Z'),
          timezone: 'UTC',
          status: 'cancelled', // Authoritative global record says cancelled!
          date: '2026-10-27',
          startTime: '09:00',
          endTime: '10:00',
          durationMinutes: 60,
        },
      ];

      const effective = getEffectiveWorkBlocks(task, globalBlocks);
      expect(effective).toEqual([]);
    });

    it('does not synthesize a legacy block when the exact interval was explicitly cancelled in recordBlocks', () => {
      const task: Task = {
        id: 'task-legacy-cancelled',
        title: 'Legacy with cancelled interval',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        subtasks: [],
        plannedDate: '2026-10-27',
        scheduledStart: '09:00',
        scheduledEnd: '10:00',
      };

      const globalBlocks: WorkBlock[] = [
        {
          id: 'wb-old-cancelled',
          taskId: 'task-legacy-cancelled',
          startInstant: Date.parse('2026-10-27T09:00:00Z'),
          endInstant: Date.parse('2026-10-27T10:00:00Z'),
          timezone: 'UTC',
          status: 'cancelled',
          date: '2026-10-27',
          startTime: '09:00',
          endTime: '10:00',
          durationMinutes: 60,
        },
      ];

      const effective = getEffectiveWorkBlocks(task, globalBlocks);
      expect(effective).toEqual([]);
    });

    it('commandService preserves completed session history when scheduling, moving, and unscheduling', () => {
      const completedBlock: WorkBlock = {
        id: 'wb-hist-completed',
        taskId: 'multi-session-task',
        startInstant: Date.parse('2026-10-27T08:00:00Z'),
        endInstant: Date.parse('2026-10-27T09:00:00Z'),
        timezone: 'UTC',
        status: 'completed',
        date: '2026-10-27',
        startTime: '08:00',
        endTime: '09:00',
        durationMinutes: 60,
      };

      const initialTask: Task = {
        id: 'multi-session-task',
        title: 'Multi Session Task',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        subtasks: [],
        workBlocks: [completedBlock],
      };

      // 1. Schedule a new afternoon session
      const schedResult = commandService.scheduleTask([initialTask], 'multi-session-task', {
        date: '2026-10-27',
        startTime: '14:00',
        endTime: '15:00',
      });

      const schedTask = schedResult.updatedTasks[0];
      expect(schedTask.workBlocks).toHaveLength(2);
      expect(schedTask.workBlocks!.some((b) => b.id === 'wb-hist-completed' && b.status === 'completed')).toBe(true);
      expect(schedTask.workBlocks!.some((b) => b.status === 'scheduled' && b.startTime === '14:00')).toBe(true);

      // 2. Move the afternoon session to 15:30
      const moveResult = commandService.moveTask([schedTask], 'multi-session-task', '2026-10-27', '15:30');
      const movedTask = moveResult.updatedTasks[0];
      expect(movedTask.workBlocks).toHaveLength(2);
      expect(movedTask.workBlocks!.some((b) => b.id === 'wb-hist-completed' && b.status === 'completed')).toBe(true);
      expect(movedTask.workBlocks!.some((b) => b.status === 'scheduled' && b.startTime === '15:30')).toBe(true);

      // 3. Unschedule the task: should cancel the scheduled session, NOT the completed session!
      const unschedResult = commandService.unscheduleTask([movedTask], 'multi-session-task');
      const unschedTask = unschedResult.updatedTasks[0];
      expect(unschedTask.workBlocks).toHaveLength(2);
      const hist = unschedTask.workBlocks!.find((b) => b.id === 'wb-hist-completed')!;
      expect(hist.status).toBe('completed'); // Intact!
      const active = unschedTask.workBlocks!.find((b) => b.id !== 'wb-hist-completed')!;
      expect(active.status).toBe('cancelled'); // Cancelled!
    });

    it('migrationEngine accurately categorizes corrupted legacy dates, corrupted times, and invalid timezones', async () => {
      const record = emptyWorkspace('corrupted-data-test');
      record.tasks = [
        {
          id: 'corrupt-tz',
          title: 'Corrupted Timezone',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          plannedDate: '2026-10-27',
          scheduledStart: '10:00',
          timezone: 'Narnia/Cair_Paravel',
        },
        {
          id: 'corrupt-date',
          title: 'Non-existent Date',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          plannedDate: '2025-02-29', // 2025 is not a leap year!
          scheduledStart: '10:00',
        },
        {
          id: 'corrupt-end-time',
          title: 'Corrupted End Time string',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          plannedDate: '2026-10-27',
          scheduledStart: '10:00',
          scheduledEnd: 'bad-end-time',
        },
      ];

      const report = await runScheduleMigration(record, { dryRun: false, timezone: 'UTC' });

      expect(report.convertedCount).toBe(0);
      expect(report.ambiguousCount).toBe(3);

      const tzItem = report.reviewQueue.find((q) => q.taskId === 'corrupt-tz')!;
      expect(tzItem.reason).toBe('invalid_timezone');

      const dateItem = report.reviewQueue.find((q) => q.taskId === 'corrupt-date')!;
      expect(dateItem.reason).toBe('invalid_date');

      const endTimeItem = report.reviewQueue.find((q) => q.taskId === 'corrupt-end-time')!;
      expect(endTimeItem.reason).toBe('invalid_time');

      // Verify no invalid blocks were written to the store
      expect(record.workBlocks).toEqual([]);
    });

    it('multi-tab leader election without navigator.locks uses BroadcastChannel to degrade secondary tab to read-only', async () => {
      // Mock environments where navigator.locks is completely undefined
      delete (navigator as any).locks;

      const channels: MockBroadcastChannel[] = [];
      class MockBroadcastChannel {
        name: string;
        onmessage: ((event: any) => void) | null = null;
        private listeners: Array<(event: any) => void> = [];
        constructor(name: string) {
          this.name = name;
          channels.push(this);
        }
        addEventListener(_type: string, fn: (event: any) => void) {
          this.listeners.push(fn);
        }
        removeEventListener(_type: string, fn: (event: any) => void) {
          const idx = this.listeners.indexOf(fn);
          if (idx >= 0) this.listeners.splice(idx, 1);
        }
        postMessage(data: any) {
          setTimeout(() => {
            for (const other of channels) {
              if (other !== this && other.name === this.name) {
                other.listeners.forEach((l) => l({ data }));
                if (other.onmessage) other.onmessage({ data });
              }
            }
          }, 0);
        }
        close() {
          const idx = channels.indexOf(this);
          if (idx >= 0) channels.splice(idx, 1);
        }
      }
      vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

      let tab1ReadOnly = false;
      const tab1Store = {
        id: 'no-locks-ws',
        subscribe: vi.fn(() => vi.fn()),
        getSnapshot: () => ({ lastSavedAt: 0 }),
        reload: vi.fn(async () => {}),
        settled: vi.fn(async () => {}),
        setReadOnly: vi.fn((val: boolean) => {
          tab1ReadOnly = val;
        }),
      } as unknown as WorkspaceStore;

      let tab2ReadOnly = false;
      const tab2Store = {
        id: 'no-locks-ws',
        subscribe: vi.fn(() => vi.fn()),
        getSnapshot: () => ({ lastSavedAt: 0 }),
        reload: vi.fn(async () => {}),
        settled: vi.fn(async () => {}),
        setReadOnly: vi.fn((val: boolean) => {
          tab2ReadOnly = val;
        }),
      } as unknown as WorkspaceStore;

      const owner1 = ownWorkspace(tab1Store);
      await vi.waitFor(() => expect(owner1.isOwner()).toBe(true));
      expect(tab1ReadOnly).toBe(false);

      const owner2 = ownWorkspace(tab2Store);
      // Tab 2 queries owner via BroadcastChannel and degrades to read-only follower
      await vi.waitFor(() => expect(tab2ReadOnly).toBe(true));
      expect(owner2.isOwner()).toBe(false);

      // Tab 1 closes
      owner1.close();
      expect(owner1.isClosed()).toBe(true);

      // Tab 2 takes over
      await owner2.takeOver();
      await vi.waitFor(() => expect(owner2.isOwner()).toBe(true));
      expect(tab2ReadOnly).toBe(false);

      owner2.close();
    });
  });
});
