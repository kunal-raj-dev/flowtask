import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerWebMcpTools,
  unregisterWebMcpTools,
  getWebMcpTools,
  executeWebMcpTool,
  setWebMcpActiveStore,
  webMcpService,
  createTaskTool,
  listTodayTasksTool,
  startFocusSessionTool,
  getWorkspaceStatusTool,
} from './webMcpService';
import { WorkspaceStore } from './workspaceStore';
import { useFocusStore } from '../store/useFocusStore';
import { formatLocalDate } from '../utils/nlpParser';
import type { Task } from '../types/task';

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
    it('exposes all 4 required atomic tools with valid JSON Schemas', () => {
      const tools = getWebMcpTools();
      expect(tools).toHaveLength(4);

      const names = tools.map((t) => t.name);
      expect(names).toContain('createTask');
      expect(names).toContain('listTodayTasks');
      expect(names).toContain('startFocusSession');
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
      expect(webMcpService.getTools()).toHaveLength(4);

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
      expect(window.__FLOWTASK_MCP__?.tools).toHaveLength(4);
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

    it('allows executing tools via window.__FLOWTASK_MCP__.callTool', async () => {
      registerWebMcpTools({ store });
      const result = (await window.__FLOWTASK_MCP__!.callTool('createTask', {
        title: 'MCP Bridge Task',
      })) as { success: boolean; task: Task };

      expect(result.success).toBe(true);
      expect(result.task.title).toBe('MCP Bridge Task');
    });
  });

  describe('createTask Tool', () => {
    it('validates required arguments', async () => {
      // @ts-expect-error testing missing title
      await expect(createTaskTool.execute({})).rejects.toThrow(/non-empty "title"/);
      await expect(createTaskTool.execute({ title: '   ' })).rejects.toThrow(/non-empty "title"/);
      // @ts-expect-error testing invalid priority
      await expect(createTaskTool.execute({ title: 'Test', priority: 'p99' })).rejects.toThrow(/Invalid priority/);
      await expect(createTaskTool.execute({ title: 'Test', estimatedMinutes: -5 })).rejects.toThrow(
        /estimatedMinutes must be a non-negative number/
      );
    });

    it('creates a task with parsed natural language tokens', async () => {
      const result = await createTaskTool.execute({
        title: 'Draft architecture review #work p1 ~45m',
      });

      expect(result.success).toBe(true);
      expect(result.task.title).toBe('Draft architecture review');
      expect(result.task.priority).toBe('p1');
      expect(result.task.projectId).toBe('work');
      expect(result.task.estimatedMinutes).toBe(45);

      // Verify committed into WorkspaceStore
      const currentTasks = store.getSnapshot().record.tasks;
      expect(currentTasks).toHaveLength(1);
      expect(currentTasks[0].id).toBe(result.task.id);
    });

    it('respects explicit parameter overrides over title tokens', async () => {
      const result = await createTaskTool.execute({
        title: 'Review proposal #inbox p4',
        priority: 'p2',
        projectId: 'work',
        plannedDate: '2026-10-20',
        dueDate: '2026-10-25',
        estimatedMinutes: 60,
        description: 'Detailed scope notes',
      });

      expect(result.success).toBe(true);
      expect(result.task.priority).toBe('p2');
      expect(result.task.projectId).toBe('work');
      expect(result.task.plannedDate).toBe('2026-10-20');
      expect(result.task.dueDate).toBe('2026-10-25');
      expect(result.task.estimatedMinutes).toBe(60);
      expect(result.task.description).toBe('Detailed scope notes');
    });

    it('falls back to inbox project if target project does not exist', async () => {
      const result = await createTaskTool.execute({
        title: 'Task for unknown project',
        projectId: 'non-existent-project-xyz',
      });

      expect(result.success).toBe(true);
      expect(result.task.projectId).toBe('inbox');
    });
  });

  describe('listTodayTasks Tool', () => {
    beforeEach(async () => {
      // Seed some tasks for today and other days
      await createTaskTool.execute({
        title: 'Top 3 Focus Task',
        priority: 'p1',
        plannedDate: todayStr,
      });

      // Pin the first task to Top 3
      const firstTask = store.getSnapshot().record.tasks[0];
      store.run('Pin Top 3', (r) => ({
        ...r,
        tasks: r.tasks.map((t) => (t.id === firstTask.id ? { ...t, isPinnedToday: true, topThreeDate: todayStr } : t)),
      }));

      await createTaskTool.execute({
        title: 'Regular Daytime Task',
        priority: 'p2',
        plannedDate: todayStr,
      });

      await createTaskTool.execute({
        title: 'Work Project Sprint Task',
        priority: 'p3',
        plannedDate: todayStr,
        projectId: 'work',
      });

      await createTaskTool.execute({
        title: 'Future Task',
        priority: 'p2',
        plannedDate: '2099-12-31',
      });
    });

    it('queries and groups tasks into topThree and daytime', async () => {
      const result = await listTodayTasksTool.execute({});

      expect(result.date).toBe(todayStr);
      expect(result.topThree).toHaveLength(1);
      expect(result.topThree[0].title).toBe('Top 3 Focus Task');

      expect(result.daytime).toHaveLength(2);
      expect(result.completed).toHaveLength(0);
      expect(result.totalCount).toBe(3);
    });

    it('filters by projectId', async () => {
      const result = await listTodayTasksTool.execute({ projectId: 'work' });

      expect(result.totalCount).toBe(1);
      expect(result.daytime).toHaveLength(1);
      expect(result.daytime[0].title).toBe('Work Project Sprint Task');
    });

    it('includes completed tasks when requested', async () => {
      // Mark one task as completed today
      const regularTask = store.getSnapshot().record.tasks.find((t) => t.title === 'Regular Daytime Task')!;
      store.run('Complete task', (r) => ({
        ...r,
        tasks: r.tasks.map((t) =>
          t.id === regularTask.id ? { ...t, status: 'done', completedAt: Date.now() } : t
        ),
      }));

      const withoutCompleted = await listTodayTasksTool.execute({ includeCompleted: false });
      expect(withoutCompleted.completed).toHaveLength(0);
      expect(withoutCompleted.totalCount).toBe(2);

      const withCompleted = await listTodayTasksTool.execute({ includeCompleted: true });
      expect(withCompleted.completed).toHaveLength(1);
      expect(withCompleted.completed[0].id).toBe(regularTask.id);
      expect(withCompleted.totalCount).toBe(3);
    });
  });

  describe('startFocusSession Tool', () => {
    it('starts a pomodoro session with default duration (25m / 1500s)', async () => {
      const result = await startFocusSessionTool.execute({
        taskTitle: 'Write unit tests',
      });

      expect(result.success).toBe(true);
      expect(result.session.mode).toBe('pomodoro');
      expect(result.session.taskTitle).toBe('Write unit tests');
      expect(result.session.targetDurationSec).toBe(1500);
      expect(result.session.state).toBe('running');

      // Verify store state
      const currentSession = useFocusStore.getState().focusSession;
      expect(currentSession?.id).toBe(result.session.id);
    });

    it('starts a sprint session with custom duration', async () => {
      const { task } = await createTaskTool.execute({ title: 'Sprint session' });
      const result = await startFocusSessionTool.execute({
        mode: 'sprint',
        taskId: task.id,
        taskTitle: 'Sprint session',
        targetDurationMinutes: 45,
      });

      expect(result.success).toBe(true);
      expect(result.session.mode).toBe('sprint');
      expect(result.session.taskId).toBe(task.id);
      expect(result.session.targetDurationSec).toBe(2700); // 45 * 60
    });

    it('persists assistant sessions to the registered workspace and does not overwrite active work', async () => {
      const result = await startFocusSessionTool.execute({ taskTitle: 'Persisted session' });
      expect(store.getSnapshot().record.preferences.focusSession).toEqual(result.session);
      expect(result.session.workspaceId).toBe(store.id);
      await expect(startFocusSessionTool.execute({})).rejects.toThrow(/Finish the current/);
      expect(useFocusStore.getState().focusSession?.id).toBe(result.session.id);
    });

    it('rejects tasks outside this workspace', async () => {
      await expect(startFocusSessionTool.execute({ taskId: 'another-account-task' })).rejects.toThrow(/active task/);
      expect(useFocusStore.getState().focusSession).toBeNull();
    });
  });

  it('does not create a second local writer before registration or after cleanup', async () => {
    unregisterWebMcpTools();
    await expect(createTaskTool.execute({ title: 'Must not leak' })).rejects.toThrow(/Open a workspace/);
  });

  it('invalidates old bridges and ignores their cleanup after a newer registration', async () => {
    const oldCleanup = registerWebMcpTools({ store });
    const oldBridge = window.__FLOWTASK_MCP__!;
    registerWebMcpTools({ store });
    const currentBridge = window.__FLOWTASK_MCP__!;
    oldCleanup();
    expect(window.__FLOWTASK_MCP__).toBe(currentBridge);
    await expect(oldBridge.callTool('createTask', { title: 'Stale account' })).rejects.toThrow(/no longer connected/);
    expect(store.getSnapshot().record.tasks).toHaveLength(0);
  });

  describe('getWorkspaceStatus Tool', () => {
    it('aggregates workspace telemetry accurately', async () => {
      // Seed tasks: 1 today active, 1 overdue, 1 future, 1 completed
      await createTaskTool.execute({
        title: 'Active Today Task',
        plannedDate: todayStr,
      });

      await createTaskTool.execute({
        title: 'Overdue Task',
        dueDate: '2020-01-01',
      });

      await createTaskTool.execute({
        title: 'Future Task',
        plannedDate: '2099-01-01',
      });

      await createTaskTool.execute({
        title: 'Done Task',
        plannedDate: todayStr,
      });

      const doneTask = store.getSnapshot().record.tasks.find((t) => t.title === 'Done Task')!;
      store.run('Complete Done Task', (r) => ({
        ...r,
        tasks: r.tasks.map((t) => (t.id === doneTask.id ? { ...t, status: 'done', completedAt: Date.now() } : t)),
      }));

      // Add a focus log of 1200 seconds today
      store.run('Add Focus Log', (r) => ({
        ...r,
        preferences: {
          ...r.preferences,
          focusLogs: [
            { id: 'log-1', seconds: 1200, startedAt: Date.now() - 1200000, endedAt: Date.now() },
            { id: 'log-2', seconds: 600, startedAt: Date.parse('2020-01-01T11:00:00Z'), endedAt: Date.parse('2020-01-01T12:00:00Z') }, // past day
          ],
        },
      }));

      // Start an active focus session
      await startFocusSessionTool.execute({
        taskTitle: 'Active Study Sprint',
        mode: 'pomodoro',
      });

      const status = await getWorkspaceStatusTool.execute({});

      expect(status.activeTasksCount).toBe(3); // Active Today + Overdue + Future
      expect(status.todayTasksCount).toBe(1); // Active Today only
      expect(status.overdueCount).toBe(1); // Overdue Task
      expect(status.activeFocusSession).not.toBeNull();
      expect(status.activeFocusSession?.taskTitle).toBe('Active Study Sprint');
      expect(status.todayFocusedSeconds).toBeGreaterThanOrEqual(1200);
    });
  });
});
