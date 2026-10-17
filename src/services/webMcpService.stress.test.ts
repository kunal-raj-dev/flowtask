import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerWebMcpTools,
  unregisterWebMcpTools,
  setWebMcpActiveStore,
  createTaskTool,
  listTodayTasksTool,
  startFocusSessionTool,
  getWorkspaceStatusTool,
} from './webMcpService';
import { WorkspaceStore } from './workspaceStore';
import { useFocusStore } from '../store/useFocusStore';
import { formatLocalDate } from '../utils/nlpParser';
import type { Task } from '../types/task';

describe('WebMCP Empirical Stress Harness', () => {
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

    store = new WorkspaceStore('mcp-stress-ws', false, mockPersistence as unknown as typeof import('./dbService').dbService);
    await store.load();
    setWebMcpActiveStore(store);
  });

  afterEach(() => {
    unregisterWebMcpTools();
    setWebMcpActiveStore(null);
    useFocusStore.getState().setFocusSession(null);
  });

  describe('Adversarial & Edge Case Parameters', () => {
    it('handles null, undefined, empty, or whitespace-only params in all tools without crashing', async () => {
      // @ts-expect-error testing invalid type null
      await expect(createTaskTool.execute(null)).rejects.toThrow();
      await expect(createTaskTool.execute(undefined)).rejects.toThrow();
      await expect(createTaskTool.execute({ title: '   \t\n  ' })).rejects.toThrow();

      // listTodayTasks should safely handle empty/undefined
      const listEmpty = await listTodayTasksTool.execute(undefined);
      expect(listEmpty.totalCount).toBe(0);
      expect(listEmpty.topThree).toEqual([]);

      // startFocusSession should safely handle undefined
      const sessionEmpty = await startFocusSessionTool.execute(undefined);
      expect(sessionEmpty.success).toBe(true);
      expect(sessionEmpty.session.mode).toBe('pomodoro');
      expect(sessionEmpty.session.targetDurationSec).toBe(1500);

      // getWorkspaceStatus handles execution cleanly
      const status = await getWorkspaceStatusTool.execute();
      expect(status.activeTasksCount).toBe(0);
      expect(status.todayTasksCount).toBe(0);
    });

    it('rejects prototype pollution and malicious keys in createTask', async () => {
      const maliciousParams = JSON.parse(
        '{"title":"Pollution test","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}'
      );
      const res = await createTaskTool.execute(maliciousParams);
      expect(res.success).toBe(true);
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('handles unicode, emojis, and massive string lengths in createTask', async () => {
      const longTitle = '🚀 Deep Work '.repeat(500) + ' #work p1';
      const longDescription = '📝 Notes '.repeat(1000);
      const res = await createTaskTool.execute({
        title: longTitle,
        description: longDescription,
      });

      expect(res.success).toBe(true);
      expect(res.task.description).toBe(longDescription);
      expect(store.getSnapshot().record.tasks).toHaveLength(1);
    });

    it('handles zero, negative, and extreme numbers in startFocusSession', async () => {
      // Negative duration should fall back to default
      const resNegative = await startFocusSessionTool.execute({
        targetDurationMinutes: -25,
      });
      expect(resNegative.session.targetDurationSec).toBe(1500);
      useFocusStore.getState().setFocusSession(null);

      // 0 duration should fall back to default
      const resZero = await startFocusSessionTool.execute({
        targetDurationMinutes: 0,
      });
      expect(resZero.session.targetDurationSec).toBe(1500);
      useFocusStore.getState().setFocusSession(null);

      // Fractional duration (e.g. 0.5 minutes = 30 seconds)
      const resFraction = await startFocusSessionTool.execute({
        targetDurationMinutes: 0.5,
      });
      expect(resFraction.session.targetDurationSec).toBe(30);
      useFocusStore.getState().setFocusSession(null);

      // Large duration (e.g. 180 minutes = 10800 seconds)
      const resLarge = await startFocusSessionTool.execute({
        mode: 'sprint',
        targetDurationMinutes: 180,
      });
      expect(resLarge.session.targetDurationSec).toBe(10800);
    });

    it('handles unexpected focus modes gracefully by falling back to pomodoro', async () => {
      // @ts-expect-error testing invalid mode
      const res = await startFocusSessionTool.execute({ mode: 'zen-ultra' });
      expect(res.session.mode).toBe('pomodoro');
      expect(res.session.targetDurationSec).toBe(1500);
    });

    it('handles stress scale: 500 tasks queried and aggregated in getWorkspaceStatus', async () => {
      const tasks: Task[] = [];
      for (let i = 0; i < 500; i++) {
        tasks.push({
          id: `task-${i}`,
          title: `Task ${i}`,
          status: i % 5 === 0 ? 'done' : 'todo',
          priority: 'p2',
          projectId: 'inbox',
          subtasks: [],
          createdAt: Date.now() - i * 1000,
          plannedDate: i % 2 === 0 ? todayStr : '2026-12-31',
          dueDate: i % 7 === 0 ? '2020-01-01' : undefined,
          completedAt: i % 5 === 0 ? Date.now() : undefined,
        });
      }

      store.run('Seed 500 tasks', (r) => ({ ...r, tasks }));

      const status = await getWorkspaceStatusTool.execute();
      expect(status.activeTasksCount).toBe(400); // 500 - 100 done
      expect(status.todayTasksCount).toBe(200); // i % 2 === 0 (active today)
      expect(status.overdueCount).toBeGreaterThan(0);
    });
  });

  describe('AbortSignal & Lifecycle Edge Cases', () => {
    it('handles multiple sequential registrations and aborts without leaks', () => {
      for (let i = 0; i < 10; i++) {
        const controller = new AbortController();
        const cleanup = registerWebMcpTools({ signal: controller.signal, store });
        expect(window.__FLOWTASK_MCP__).toBeDefined();
        if (i % 2 === 0) {
          controller.abort();
        } else {
          cleanup();
        }
        expect(window.__FLOWTASK_MCP__).toBeUndefined();
      }
    });

    it('calling unregisterWebMcpTools multiple times is idempotent and safe', () => {
      expect(() => {
        unregisterWebMcpTools();
        unregisterWebMcpTools();
        unregisterWebMcpTools();
      }).not.toThrow();
      expect(window.__FLOWTASK_MCP__).toBeUndefined();
    });

    it('calling cleanup after abort does not throw or double-trigger', () => {
      const controller = new AbortController();
      const onUnregistered = vi.fn();
      const cleanup = registerWebMcpTools({ signal: controller.signal, store, onUnregistered });

      controller.abort();
      expect(onUnregistered).toHaveBeenCalledTimes(1);

      // Secondary manual cleanup invocation
      expect(() => cleanup()).not.toThrow();
      expect(onUnregistered).toHaveBeenCalledTimes(1);
    });
  });
});
