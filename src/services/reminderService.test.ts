import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  getReminderCapability,
  computeSnoozeTimestamp,
  addReminderToTask,
  snoozeReminder,
  dismissReminder,
  removeReminder,
  reminderManager,
} from './reminderService';
import { WorkspaceStore } from './workspaceStore';
import { dbService, emptyWorkspace } from './dbService';

async function createTestHarness() {
  let disk = emptyWorkspace('reminders-test');
  disk.tasks = [
    {
      id: 'task-rem-1',
      title: 'Review proposal',
      status: 'todo',
      priority: 'p2',
      projectId: 'work',
      createdAt: Date.now(),
      subtasks: [],
    },
  ];

  const persistence = {
    ...dbService,
    ensureLegacyMigrated: async () => structuredClone(disk),
    saveWorkspace: vi.fn(async (_id: string, value: typeof disk) => {
      disk = structuredClone(value);
    }),
  };

  const store = new WorkspaceStore('reminders-test', false, persistence);
  await store.load();
  return { store };
}

describe('reminderService', () => {
  beforeEach(() => {
    reminderManager.clearAll();
  });

  afterEach(() => {
    reminderManager.clearAll();
  });

  it('detects reminder capability in environment', () => {
    const cap = getReminderCapability();
    expect(['granted', 'denied', 'default', 'unsupported']).toContain(cap);
  });

  it('computes correct timestamps for snooze presets', () => {
    const now = 1700000000000;
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(computeSnoozeTimestamp('5m')).toBe(now + 5 * 60 * 1000);
    expect(computeSnoozeTimestamp('15m')).toBe(now + 15 * 60 * 1000);
    expect(computeSnoozeTimestamp('1h')).toBe(now + 60 * 60 * 1000);

    const tomorrow9am = computeSnoozeTimestamp('tomorrow_9am');
    const d = new Date(tomorrow9am);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
    vi.useRealTimers();
  });

  it('adds a reminder to a task and stores it on the task record', async () => {
    const { store } = await createTestHarness();
    const remindAt = Date.now() + 60000;

    const reminder = addReminderToTask(store, 'task-rem-1', remindAt, 15);
    expect(reminder.id).toBeTruthy();
    expect(reminder.taskId).toBe('task-rem-1');
    expect(reminder.status).toBe('scheduled');
    expect(reminder.remindAt).toBe(remindAt);

    const task = store.getSnapshot().record.tasks.find((t) => t.id === 'task-rem-1');
    expect(task?.reminders?.length).toBe(1);
    expect(task?.reminders?.[0].id).toBe(reminder.id);
  });

  it('snoozes an existing reminder and sets snoozedUntil', async () => {
    const { store } = await createTestHarness();
    const remindAt = Date.now() + 60000;
    const reminder = addReminderToTask(store, 'task-rem-1', remindAt);

    snoozeReminder(store, 'task-rem-1', reminder.id, '15m');

    const task = store.getSnapshot().record.tasks.find((t) => t.id === 'task-rem-1');
    const updated = task?.reminders?.find((r) => r.id === reminder.id);
    expect(updated?.status).toBe('snoozed');
    expect(updated?.snoozedUntil).toBeDefined();
    expect(updated?.snoozedUntil).toBeGreaterThan(remindAt);
  });

  it('dismisses a reminder and marks status as dismissed', async () => {
    const { store } = await createTestHarness();
    const reminder = addReminderToTask(store, 'task-rem-1', Date.now() + 60000);

    dismissReminder(store, 'task-rem-1', reminder.id);

    const task = store.getSnapshot().record.tasks.find((t) => t.id === 'task-rem-1');
    const updated = task?.reminders?.find((r) => r.id === reminder.id);
    expect(updated?.status).toBe('dismissed');
  });

  it('removes a reminder from a task completely', async () => {
    const { store } = await createTestHarness();
    const reminder = addReminderToTask(store, 'task-rem-1', Date.now() + 60000);

    removeReminder(store, 'task-rem-1', reminder.id);

    const task = store.getSnapshot().record.tasks.find((t) => t.id === 'task-rem-1');
    expect(task?.reminders?.length).toBe(0);
  });

  it('triggers onTrigger callback when scheduled reminder reaches execution time', async () => {
    const { store } = await createTestHarness();
    vi.useFakeTimers();
    const now = Date.now();
    const remindAt = now + 1000;
    const reminder = addReminderToTask(store, 'task-rem-1', remindAt);

    const onTrigger = vi.fn();
    reminderManager.schedule(reminder, 'Review proposal', onTrigger);

    expect(onTrigger).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1100);

    expect(onTrigger).toHaveBeenCalledTimes(1);
    expect(onTrigger).toHaveBeenCalledWith(reminder, 'Review proposal');
    vi.useRealTimers();
  });

  it('rejects adding a reminder with non-finite timestamp', async () => {
    const { store } = await createTestHarness();
    expect(() => addReminderToTask(store, 'task-rem-1', NaN)).toThrow('Invalid remindAt timestamp.');
    expect(() => addReminderToTask(store, 'task-rem-1', Infinity)).toThrow('Invalid remindAt timestamp.');
  });

  it('ignores reminder with non-finite timestamp in schedule', () => {
    const onTrigger = vi.fn();
    const badReminder = {
      id: 'bad-1',
      taskId: 'task-rem-1',
      remindAt: NaN,
      channel: 'browser_notification' as const,
      status: 'scheduled' as const,
      createdAt: Date.now(),
    };
    reminderManager.schedule(badReminder, 'Test Task', onTrigger);
    expect(onTrigger).not.toHaveBeenCalled();
  });
});

