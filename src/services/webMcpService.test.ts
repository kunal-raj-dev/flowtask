import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerWebMcpTools,
  unregisterWebMcpTools,
  getWebMcpTools,
  executeWebMcpTool,
  setWebMcpActiveStore,
  webMcpService,
  createTaskTool,
  updateTaskTool,
  completeTaskTool,
  listTasksTool,
  startFocusSessionTool,
  stopFocusSessionTool,
  scheduleTimelineBlockTool,
  getDailySummaryTool,
  decomposeTaskTool,
} from './webMcpService';
import { WorkspaceStore } from './workspaceStore';
import { useFocusStore } from '../store/useFocusStore';
import { formatLocalDate } from '../utils/nlpParser';

describe('webMcpService (Client-Side WebMCP Tools)', () => {
  let store: WorkspaceStore;
  const todayStr = formatLocalDate(new Date());

  beforeEach(async () => {
    unregisterWebMcpTools();
    useFocusStore.getState().setFocusSession(null);

    // Create an isolated in-memory WorkspaceStore with mock persistence
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

    store = new WorkspaceStore('mcp-test-ws', false, mockPersistence as unknown as typeof import('./dbService').dbService);
    await store.load();
    setWebMcpActiveStore(store);
  });

  afterEach(() => {
    unregisterWebMcpTools();
    setWebMcpActiveStore(null);
    useFocusStore.getState().setFocusSession(null);
  });

  describe('Tool Definitions and Metadata', () => {
    it('exposes all atomic tools with valid JSON Schemas', () => {
      const tools = getWebMcpTools();
      expect(tools.length).toBeGreaterThanOrEqual(8);

      const names = tools.map((t) => t.name);
      expect(names).toContain('createTask');
      expect(names).toContain('updateTask');
      expect(names).toContain('completeTask');
      expect(names).toContain('listTasks');
      expect(names).toContain('startFocusSession');
      expect(names).toContain('stopFocusSession');
      expect(names).toContain('scheduleTimelineBlock');
      expect(names).toContain('getDailySummary');
      expect(names).toContain('decomposeTask');
      expect(names).toContain('listTodayTasks');
      expect(names).toContain('getWorkspaceStatus');

      for (const tool of tools) {
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(tool.parameters).toBeDefined();
        expect(tool.parameters.type).toBe('object');
        expect(tool.inputSchema).toEqual(tool.parameters);
        expect(typeof tool.execute).toBe('function');
      }
    });

    it('webMcpService wrapper delegates correctly to getTools and executeTool', async () => {
      expect(webMcpService.getTools().length).toBeGreaterThanOrEqual(8);

      const status = (await webMcpService.executeTool('getWorkspaceStatus', {})) as {
        activeTasksCount: number;
      };
      expect(status.activeTasksCount).toBe(0);
    });

    it('executeWebMcpTool throws for non-existent tool names', async () => {
      await expect(executeWebMcpTool('nonExistentTool', {})).rejects.toThrow(
        /WebMCP tool not found: "nonExistentTool"/
      );
    });
  });

  describe('Lifecycle Registration and AbortSignal Cleanup', () => {
    it('mounts tools to window.__FLOWTASK_MCP__ upon registration', () => {
      const cleanup = registerWebMcpTools({ store });
      expect(window.__FLOWTASK_MCP__).toBeDefined();
      expect(window.__FLOWTASK_MCP__?.version).toBe('1.0.0');
      expect(window.__FLOWTASK_MCP__?.tools.length).toBeGreaterThanOrEqual(8);
      expect(typeof window.__FLOWTASK_MCP__?.callTool).toBe('function');
      expect(typeof window.__FLOWTASK_MCP__?.executeTool).toBe('function');

      cleanup();
      expect(window.__FLOWTASK_MCP__).toBeUndefined();
    });

    it('unregisters cleanly when AbortSignal fires', () => {
      const controller = new AbortController();
      registerWebMcpTools({ signal: controller.signal, store });
      expect(window.__FLOWTASK_MCP__).toBeDefined();

      controller.abort();
      expect(window.__FLOWTASK_MCP__).toBeUndefined();
    });

    it('does not register if AbortSignal is already aborted', () => {
      const controller = new AbortController();
      controller.abort();
      const onUnregistered = vi.fn();
      registerWebMcpTools({ signal: controller.signal, store, onUnregistered });
      expect(window.__FLOWTASK_MCP__).toBeUndefined();
      expect(onUnregistered).toHaveBeenCalled();
    });
  });

  describe('createTask Tool', () => {
    it('creates a task with explicit parameters and adds to store', async () => {
      const res = await createTaskTool.execute({
        title: 'Draft quarterly product roadmap',
        priority: 'p1',
        plannedDate: todayStr,
        estimatedMinutes: 60,
      });

      expect(res.success).toBe(true);
      expect(res.task.title).toBe('Draft quarterly product roadmap');
      expect(res.task.priority).toBe('p1');
      expect(res.task.plannedDate).toBe(todayStr);
      expect(res.task.estimatedMinutes).toBe(60);

      const inStore = store.getSnapshot().record.tasks;
      expect(inStore).toHaveLength(1);
      expect(inStore[0].id).toBe(res.task.id);
    });

    it('throws validation errors on invalid inputs', async () => {
      await expect(createTaskTool.execute({ title: '' })).rejects.toThrow(
        /requires a non-empty "title"/
      );

      await expect(
        createTaskTool.execute({ title: 'Task', priority: 'invalid' as any })
      ).rejects.toThrow(/Invalid priority/);

      await expect(
        createTaskTool.execute({ title: 'Task', estimatedMinutes: -10 })
      ).rejects.toThrow(/must be a non-negative number/);
    });
  });

  describe('updateTask Tool', () => {
    it('updates priority, plannedDate, and estimatedMinutes of existing task', async () => {
      const created = await createTaskTool.execute({ title: 'Initial task' });
      const taskId = created.task.id;

      const updated = await updateTaskTool.execute({
        taskId,
        title: 'Renamed task',
        priority: 'p2',
        plannedDate: '2026-11-01',
        estimatedMinutes: 45,
      });

      expect(updated.success).toBe(true);
      expect(updated.task.title).toBe('Renamed task');
      expect(updated.task.priority).toBe('p2');
      expect(updated.task.plannedDate).toBe('2026-11-01');
      expect(updated.task.estimatedMinutes).toBe(45);

      const inStore = store.getSnapshot().record.tasks.find((t) => t.id === taskId);
      expect(inStore?.title).toBe('Renamed task');
    });

    it('throws error when taskId does not exist', async () => {
      await expect(
        updateTaskTool.execute({ taskId: 'non-existent', title: 'Test' })
      ).rejects.toThrow(/not found in workspace/);
    });
  });

  describe('completeTask Tool', () => {
    it('marks a task as done and toggles back to todo', async () => {
      const created = await createTaskTool.execute({ title: 'Incomplete task' });
      const taskId = created.task.id;

      const doneResult = await completeTaskTool.execute({ taskId, completed: true });
      expect(doneResult.task.status).toBe('done');
      expect(doneResult.task.completedAt).toBeDefined();

      const undoneResult = await completeTaskTool.execute({ taskId, completed: false });
      expect(undoneResult.task.status).toBe('todo');
      expect(undoneResult.task.completedAt).toBeUndefined();
    });
  });

  describe('listTasks Tool', () => {
    it('filters tasks by status, priority, and search query', async () => {
      await createTaskTool.execute({ title: 'Important bug fix #work', priority: 'p1' });
      await createTaskTool.execute({ title: 'Write unit tests', priority: 'p2' });
      const doneTask = await createTaskTool.execute({ title: 'Archived task' });
      await completeTaskTool.execute({ taskId: doneTask.task.id, completed: true });

      const all = await listTasksTool.execute({});
      expect(all.totalCount).toBe(3);

      const activeOnly = await listTasksTool.execute({ status: 'todo' });
      expect(activeOnly.totalCount).toBe(2);

      const p1Only = await listTasksTool.execute({ priority: 'p1' });
      expect(p1Only.totalCount).toBe(1);
      expect(p1Only.tasks[0].title).toContain('Important bug fix');

      const searchResult = await listTasksTool.execute({ searchQuery: 'unit tests' });
      expect(searchResult.totalCount).toBe(1);
      expect(searchResult.tasks[0].title).toBe('Write unit tests');
    });
  });

  describe('scheduleTimelineBlock Tool', () => {
    it('snaps arbitrary start time to 15-minute grid and sets scheduledEnd', async () => {
      const created = await createTaskTool.execute({
        title: 'Deep Architecture Design',
        estimatedMinutes: 45,
      });

      const res = await scheduleTimelineBlockTool.execute({
        taskId: created.task.id,
        startTime: '09:18', // should snap to 09:15
        durationMinutes: 45,
      });

      expect(res.success).toBe(true);
      expect(res.scheduledSlot.start).toBe('09:15');
      expect(res.scheduledSlot.end).toBe('10:00');
      expect(res.task.scheduledStart).toBe('09:15');
      expect(res.task.scheduledEnd).toBe('10:00');
    });

    it('rejects malformed time strings', async () => {
      await expect(
        scheduleTimelineBlockTool.execute({ taskId: 't1', startTime: 'invalid-time' })
      ).rejects.toThrow(/valid "startTime"/);
    });
  });

  describe('getDailySummary Tool', () => {
    it('computes daily completion rate and planned minutes', async () => {
      await createTaskTool.execute({
        title: 'Task 1',
        plannedDate: todayStr,
        estimatedMinutes: 30,
      });

      const t2 = await createTaskTool.execute({
        title: 'Task 2',
        plannedDate: todayStr,
        estimatedMinutes: 30,
      });

      await completeTaskTool.execute({ taskId: t2.task.id, completed: true });

      const summary = await getDailySummaryTool.execute({ date: todayStr });
      expect(summary.totalTasks).toBe(2);
      expect(summary.completedTasks).toBe(1);
      expect(summary.completionRate).toBe(50);
      expect(summary.totalPlannedMinutes).toBe(60);
    });
  });

  describe('decomposeTask Tool', () => {
    it('generates structured subtasks and 2-min starter step for coding defect', async () => {
      const res = await decomposeTaskTool.execute({
        taskTitle: 'Fix memory leak in focus audio engine',
      });

      expect(res.success).toBe(true);
      expect(res.subtasks.length).toBeGreaterThanOrEqual(3);
      expect(res.starterStep).toContain('2-Min Starter');
    });

    it('attaches subtasks directly to existing task in store', async () => {
      const created = await createTaskTool.execute({ title: 'Implement OAuth Login Flow' });
      const res = await decomposeTaskTool.execute({ taskId: created.task.id });

      expect(res.success).toBe(true);
      expect(res.task?.subtasks?.length).toBeGreaterThanOrEqual(3);
      expect(res.task?.nextAction).toBeDefined();

      const inStore = store.getSnapshot().record.tasks.find((t) => t.id === created.task.id);
      expect(inStore?.subtasks?.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('startFocusSession and stopFocusSession Tools', () => {
    it('starts focus session and stops with recorded focus log', async () => {
      const task = await createTaskTool.execute({ title: 'Deep Work Task' });

      const startRes = await startFocusSessionTool.execute({
        taskId: task.task.id,
        targetDurationMinutes: 25,
      });

      expect(startRes.success).toBe(true);
      expect(startRes.session.taskId).toBe(task.task.id);
      expect(useFocusStore.getState().focusSession).toBeDefined();

      // Simulate 60 seconds elapsed
      store.run('Simulate elapsed session', record => ({ ...record, preferences: { ...record.preferences, focusSession: { ...startRes.session, startedAt: Date.now() - 60000 } } }), false);

      const stopRes = await stopFocusSessionTool.execute({ abandon: false });
      expect(stopRes.success).toBe(true);
      expect(stopRes.loggedSeconds).toBe(60);
      expect(useFocusStore.getState().focusSession).toBeNull();
    });
  });
  it('persists optional subtasks and starter action in one undoable creation', async () => {
    const result = await createTaskTool.execute({ title: 'Prepare the release', nextAction: 'Open the checklist', subtasks: [{ title: 'Review changes', estimatedMinutes: 20 }, { title: 'Verify build', estimatedMinutes: 10 }] });
    expect(result.task.nextAction).toBe('Open the checklist');
    expect(result.task.subtasks).toHaveLength(2);
    expect(result.task.subtasks[0]).toMatchObject({ id: expect.any(String), title: 'Review changes', completed: false, estimatedMinutes: 20 });
    expect(store.getSnapshot().record.tasks[0].subtasks).toHaveLength(2);
    store.undo(); expect(store.getSnapshot().record.tasks).toHaveLength(0);
    store.redo(); expect(store.getSnapshot().record.tasks[0].nextAction).toBe('Open the checklist');
  });
  it('rejects malformed subtasks without partially creating a task', async () => {
    await expect(createTaskTool.execute({ title: 'Invalid', subtasks: [{ title: ' ', estimatedMinutes: 10 }] })).rejects.toThrow(/subtasks/);
    await expect(createTaskTool.execute({ title: 'Invalid', subtasks: [{ title: 'Step', estimatedMinutes: -1 }] })).rejects.toThrow(/subtasks/);
    expect(store.getSnapshot().record.tasks).toHaveLength(0);
  });

});
