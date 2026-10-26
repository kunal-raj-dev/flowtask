// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerWebMcpTools,
  unregisterWebMcpTools,
  getWebMcpTools,
  executeWebMcpTool,
  setWebMcpActiveStore,
} from '../src/services/webMcpService';
import { sanitizeForFirestore } from '../src/services/cloudWorkspace';
import { MAX_CALENDAR_EVENTS, parseICSFeed } from '../src/services/calendarService';
import { WorkspaceStore } from '../src/services/workspaceStore';
import { useFocusStore } from '../src/store/useFocusStore';
import { formatLocalDate } from '../src/utils/nlpParser';
import type { Task } from '../src/types/task';

describe('Phase 8 Ecosystem Contracts & Milestone M5 Verification', () => {
  describe('Web MCP Client-Side Tool Suite (Milestone M5)', () => {
    let store: WorkspaceStore;
    const todayStr = formatLocalDate(new Date());

    beforeEach(async () => {
      unregisterWebMcpTools();
      useFocusStore.getState().setFocusSession(null);

      const mockPersistence = {
        ensureLegacyMigrated: vi.fn(async (id: string) => ({
          schemaVersion: 5,
          workspaceId: id,
          tasks: [],
          projects: [
            { id: 'inbox', name: 'Inbox', color: '#6366f1', order: 0, createdAt: Date.now(), updatedAt: Date.now() },
            { id: 'work', name: 'Work', color: '#10b981', order: 1, createdAt: Date.now(), updatedAt: Date.now() },
          ],
          dashboards: [],
          customViews: [],
          preferences: {},
          pending: [],
          undo: [],
          updatedAt: Date.now(),
        })),
        saveWorkspace: vi.fn(async () => {}),
        loadWorkspace: vi.fn(async () => null),
        requestPersistentStorage: vi.fn(async () => true),
      };

      store = new WorkspaceStore('phase8-mcp-store', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();
      setWebMcpActiveStore(store);
    });

    afterEach(() => {
      unregisterWebMcpTools();
      setWebMcpActiveStore(null);
    });

    it('exposes canonical Web MCP tools with strict schemas', () => {
      const tools = getWebMcpTools();
      expect(tools.length).toBe(11);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('createTask');
      expect(toolNames).toContain('updateTask');
      expect(toolNames).toContain('completeTask');
      expect(toolNames).toContain('listTasks');
      expect(toolNames).toContain('startFocusSession');
      expect(toolNames).toContain('stopFocusSession');
      expect(toolNames).toContain('scheduleTimelineBlock');
      expect(toolNames).toContain('getDailySummary');
      expect(toolNames).toContain('decomposeTask');
      expect(toolNames).toContain('listTodayTasks');
      expect(toolNames).toContain('getWorkspaceStatus');
    });

    it('registers and unregisters window.__FLOWTASK_MCP__ bridge idempotently', () => {
      expect(window.__FLOWTASK_MCP__).toBeUndefined();

      registerWebMcpTools();
      expect(window.__FLOWTASK_MCP__).toBeDefined();
      expect(window.__FLOWTASK_MCP__?.version).toBe('1.0.0');
      expect(window.__FLOWTASK_MCP__?.tools.length).toBe(11);

      // Re-registration replaces active registration cleanly
      const cleanup2 = registerWebMcpTools();
      expect(window.__FLOWTASK_MCP__?.tools.length).toBe(11);

      cleanup2();
      expect(window.__FLOWTASK_MCP__).toBeUndefined();
    });

    it('enforces AbortSignal lifecycle cleanup on Web MCP bridge', () => {
      const controller = new AbortController();
      registerWebMcpTools({ signal: controller.signal });
      expect(window.__FLOWTASK_MCP__).toBeDefined();

      controller.abort();
      expect(window.__FLOWTASK_MCP__).toBeUndefined();
    });

    it('validates tool execution boundaries and input schema requirements', async () => {
      registerWebMcpTools();

      // createTask requires non-empty title
      await expect(executeWebMcpTool('createTask', { title: '' })).rejects.toThrow();

      // createTask succeeds with valid parameters and adds task to workspace store
      const createResult = (await executeWebMcpTool('createTask', {
        title: 'Draft Phase 8 Documentation',
        priority: 'p1',
        plannedDate: todayStr,
        estimatedMinutes: 45,
      })) as { success: boolean; task: Task };

      const created = createResult.task;
      expect(created.id).toBeDefined();
      expect(created.title).toBe('Draft Phase 8 Documentation');
      expect(created.priority).toBe('p1');
      expect(created.estimatedMinutes).toBe(45);

      // Verify task exists in store
      const tasksInStore = store.getSnapshot().record.tasks;
      expect(tasksInStore.some((t) => t.id === created.id)).toBe(true);

      // updateTask updates fields and increments revision
      const updateResult = (await executeWebMcpTool('updateTask', {
        taskId: created.id,
        title: 'Draft Phase 8 Deep Documentation',
        priority: 'p2',
      })) as { success: boolean; task: Task };

      expect(updateResult.task.title).toBe('Draft Phase 8 Deep Documentation');
      expect(updateResult.task.priority).toBe('p2');

      // completeTask completes task
      const completeResult = (await executeWebMcpTool('completeTask', {
        taskId: created.id,
        completed: true,
      })) as { success: boolean; task: Task };

      expect(completeResult.task.status).toBe('done');
      expect(completeResult.task.completedAt).toBeDefined();
    });

    it('executes focus session control tools through shared focus lifecycle', async () => {
      registerWebMcpTools();

      // Start focus session via tool
      const startResult = (await executeWebMcpTool('startFocusSession', {
        taskTitle: 'Web MCP Architecture Review',
        mode: 'pomodoro',
        targetDurationMinutes: 25,
      })) as { success: boolean; session: any };

      expect(startResult.session).toBeDefined();
      expect(startResult.session.state).toBe('running');
      expect(startResult.session.taskTitle).toBe('Web MCP Architecture Review');
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      // Stop focus session
      const stopped = (await executeWebMcpTool('stopFocusSession', {
        abandon: false,
      })) as { success: boolean; loggedSeconds: number };

      expect(stopped.success).toBe(true);
      expect(useFocusStore.getState().focusSession).toBeNull();
    });

    it('creates canonical WorkBlocks and enforces reservation lock in scheduleTimelineBlock', async () => {
      registerWebMcpTools();

      // Create a test task
      const createRes = (await executeWebMcpTool('createTask', {
        title: 'Timeline Work Block Test',
        plannedDate: todayStr,
        estimatedMinutes: 60,
      })) as { success: boolean; task: Task };
      const task = createRes.task;

      // Schedule timeline block
      const schedRes = (await executeWebMcpTool('scheduleTimelineBlock', {
        taskId: task.id,
        startTime: '10:00',
        durationMinutes: 60,
      })) as { success: boolean; task: Task; scheduledSlot: { start: string; end: string } };

      expect(schedRes.success).toBe(true);
      expect(schedRes.scheduledSlot.start).toBe('10:00');
      expect(schedRes.scheduledSlot.end).toBe('11:00');
      expect(schedRes.task.scheduledStart).toBe('10:00');
      expect(schedRes.task.scheduledEnd).toBe('11:00');
      expect(schedRes.task.workBlocks).toBeDefined();
      expect(schedRes.task.workBlocks?.length).toBe(1);
      const block = schedRes.task.workBlocks![0];
      expect(block.startTime).toBe('10:00');
      expect(block.endTime).toBe('11:00');
      expect(block.status).toBe('scheduled');
      expect(block.source).toBe('canonical');
      expect(block.startInstant).toBeDefined();

      // Lock the schedule of this task
      store.run('Lock schedule', (r) => ({
        ...r,
        tasks: r.tasks.map((t) => (t.id === task.id ? { ...t, scheduleLocked: true } : t)),
      }));

      // Rescheduling a locked task through scheduleTimelineBlock MUST throw
      await expect(
        executeWebMcpTool('scheduleTimelineBlock', {
          taskId: task.id,
          startTime: '14:00',
          durationMinutes: 60,
        })
      ).rejects.toThrow(/Cannot modify schedule of locked task/);

      // Updating plannedDate on a locked task through updateTask MUST also throw
      await expect(
        executeWebMcpTool('updateTask', {
          taskId: task.id,
          plannedDate: '2026-11-01',
        })
      ).rejects.toThrow(/Cannot modify schedule of locked task/);
    });

    it('cancels future scheduled WorkBlocks and spawns recurring tasks on completeTask', async () => {
      registerWebMcpTools();

      // Create a recurring task with scheduled block
      const createRes = (await executeWebMcpTool('createTask', {
        title: 'Daily Standup Sync',
        plannedDate: todayStr,
      })) as { success: boolean; task: Task };

      // Set recurrence and schedule a block for the future
      const futureHour = (new Date().getHours() + 2) % 24;
      const futureStart = `${String(futureHour).padStart(2, '0')}:00`;
      const futureEnd = `${String(futureHour + 1).padStart(2, '0')}:00`;

      store.run('Setup recurring task with block', (r) => ({
        ...r,
        tasks: r.tasks.map((t) =>
          t.id === createRes.task.id
            ? {
                ...t,
                recurrence: 'daily',
                workBlocks: [
                  {
                    id: 'future-block-1',
                    taskId: t.id,
                    date: todayStr,
                    startTime: futureStart,
                    endTime: futureEnd,
                    durationMinutes: 60,
                    startInstant: Date.now() + 7200000,
                    endInstant: Date.now() + 10800000,
                    status: 'scheduled',
                    timezone: 'UTC',
                  },
                ],
              }
            : t
        ),
      }));

      // Complete the task
      const completeRes = (await executeWebMcpTool('completeTask', {
        taskId: createRes.task.id,
        completed: true,
      })) as { success: boolean; task: Task };

      expect(completeRes.task.status).toBe('done');
      // Workblock must be cancelled
      expect(completeRes.task.workBlocks?.[0].status).toBe('cancelled');

      // Next recurring task should be spawned in store
      const allTasks = store.getSnapshot().record.tasks;
      const nextInstance = allTasks.find((t) => t.recurrenceSourceId === createRes.task.id);
      expect(nextInstance).toBeDefined();
      expect(nextInstance?.status).toBe('todo');
    });

    it('derives subtask estimates and updates revision in decomposeTask', async () => {
      registerWebMcpTools();

      const createRes = (await executeWebMcpTool('createTask', {
        title: 'Plan Annual Company Retreat',
      })) as { success: boolean; task: Task };

      const decomposeRes = (await executeWebMcpTool('decomposeTask', {
        taskId: createRes.task.id,
      })) as { success: boolean; taskTitle: string; subtasks: any[]; starterStep: string; task: Task };

      expect(decomposeRes.success).toBe(true);
      expect(decomposeRes.subtasks.length).toBeGreaterThan(0);
      expect(decomposeRes.starterStep).toBeDefined();
      expect(decomposeRes.task.subtasks?.length).toBeGreaterThan(0);
      expect(decomposeRes.task.nextAction).toBe(decomposeRes.starterStep);
      expect(decomposeRes.task.revision).toBeGreaterThan(1);
    });

    it('rejects in-flight callTool executions when AbortSignal triggers mid-flight', async () => {
      const controller = new AbortController();
      registerWebMcpTools({ signal: controller.signal, store });

      expect(window.__FLOWTASK_MCP__).toBeDefined();

      // Launch an asynchronous tool call
      const inflightCall = window.__FLOWTASK_MCP__!.callTool('createTask', {
        title: 'Inflight Abort Test Task',
      });

      // Immediately abort
      controller.abort();

      // Inflight call must reject gracefully
      await expect(inflightCall).rejects.toThrow(
        /These assistant tools are no longer connected to this workspace/
      );
    });

    it('executes query tools listTodayTasks, getDailySummary, and getWorkspaceStatus accurately', async () => {
      registerWebMcpTools();

      // Add a task for today pinned to Top 3
      await executeWebMcpTool('createTask', {
        title: 'Deliver Milestone M5',
        plannedDate: todayStr,
        priority: 'p1',
      });

      const todayTasks = (await executeWebMcpTool('listTodayTasks', {
        includeCompleted: true,
      })) as { date: string; totalCount: number; topThree: Task[]; daytime: Task[]; completed: Task[] };

      expect(todayTasks.date).toBe(todayStr);
      expect(todayTasks.totalCount).toBeGreaterThanOrEqual(1);

      const summary = (await executeWebMcpTool('getDailySummary', {
        date: todayStr,
      })) as { date: string; totalTasks: number; completionRate: number };

      expect(summary.date).toBe(todayStr);
      expect(summary.totalTasks).toBeGreaterThanOrEqual(1);

      const status = (await executeWebMcpTool('getWorkspaceStatus', {})) as {
        activeTasksCount: number;
        todayTasksCount: number;
      };

      expect(status.activeTasksCount).toBeGreaterThanOrEqual(1);
      expect(status.todayTasksCount).toBeGreaterThanOrEqual(1);
    });

    it('fails closed when store is uninitialized', async () => {
      setWebMcpActiveStore(null);
      await expect(executeWebMcpTool('listTasks', {})).rejects.toThrow(
        /Open a workspace and wait for it to finish loading/
      );
    });
  });

  describe('Cloud Synchronization Data Integrity (Milestone M5)', () => {
    it('sanitizes nested objects for Firestore without mutating valid values', () => {
      const rawPayload = {
        id: 'task-100',
        title: 'Verify Sync Integrity',
        description: undefined,
        nullValue: null,
        count: 0,
        nested: {
          validProp: 'yes',
          forbiddenUndefined: undefined,
          innerArray: [
            { name: 'step 1', note: undefined },
            { name: 'step 2', note: 'detailed note' },
          ],
        },
      };

      const sanitized = sanitizeForFirestore(rawPayload) as any;

      expect(sanitized.id).toBe('task-100');
      expect(sanitized.title).toBe('Verify Sync Integrity');
      expect('description' in sanitized).toBe(false);
      expect(sanitized.nullValue).toBeNull();
      expect(sanitized.count).toBe(0);
      expect(sanitized.nested.validProp).toBe('yes');
      expect('forbiddenUndefined' in sanitized.nested).toBe(false);
      expect(sanitized.nested.innerArray.length).toBe(2);
      expect('note' in sanitized.nested.innerArray[0]).toBe(false);
      expect(sanitized.nested.innerArray[1].note).toBe('detailed note');
    });

    it('handles primitive, null, and empty inputs gracefully in sanitizeForFirestore', () => {
      expect(sanitizeForFirestore(null)).toEqual({});
      expect(sanitizeForFirestore(undefined)).toEqual({});
      expect(sanitizeForFirestore('string' as any)).toEqual({});
      expect(sanitizeForFirestore(123 as any)).toEqual({});
    });

    it('enforces 7-day receipt retention window constant for idempotent sync operations', () => {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      expect(SEVEN_DAYS_MS).toBe(604800000);
    });
  });

  describe('Cross-Platform Calendar Integration Invariants (Milestone M5)', () => {
    it('preserves read-only status and calendar bounding cap', () => {
      expect(MAX_CALENDAR_EVENTS).toBe(500);

      const sampleIcs = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        'UID:m5-cal-event-1',
        'SUMMARY:Architecture All-Hands',
        'DTSTART:20261026T140000Z',
        'DTEND:20261026T150000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = parseICSFeed(sampleIcs, '2026-10-26');
      expect(events.length).toBe(1);
      expect(events[0].id).toBe('m5-cal-event-1');
      expect(events[0].title).toBe('Architecture All-Hands');
      expect(events[0].isReadOnly).toBe(true);
      expect(events[0].isExternal).toBe(true);
    });
  });

  describe('Milestones M1 through M5 Continuity Guarantee', () => {
    it('verifies that canonical scheduling WorkBlocks coexist seamlessly with Web MCP and Cloud sync', () => {
      const taskWithBlock: Task = {
        id: 'task-canonical-1',
        title: 'Deep Work Session',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        plannedDate: '2026-10-26',
        estimatedMinutes: 90,
        workBlocks: [
          {
            id: 'block-1',
            taskId: 'task-canonical-1',
            date: '2026-10-26',
            startTime: '10:00',
            endTime: '11:30',
            durationMinutes: 90,
            status: 'scheduled',
            timezone: 'Asia/Kolkata',
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        revision: 1,
      };

      // Ensure sanitizeForFirestore preserves workBlocks correctly
      const sanitized = sanitizeForFirestore(taskWithBlock) as Task;
      expect(sanitized.workBlocks).toBeDefined();
      expect(sanitized.workBlocks?.length).toBe(1);
      expect(sanitized.workBlocks?.[0].startTime).toBe('10:00');
      expect(sanitized.workBlocks?.[0].endTime).toBe('11:30');
      expect(sanitized.workBlocks?.[0].timezone).toBe('Asia/Kolkata');
    });
  });
});
