import type { TaskReminder } from '../types/task';
import type { WorkspaceStore } from './workspaceStore';
import { audioEngine } from '../utils/audioEngine';

export type ReminderCapability = 'granted' | 'denied' | 'default' | 'unsupported';

export function getReminderCapability(): ReminderCapability {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission as ReminderCapability;
}

export async function requestReminderPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  } catch {
    return false;
  }
}

export function computeSnoozeTimestamp(preset: '5m' | '15m' | '1h' | 'tomorrow_9am'): number {
  const now = Date.now();
  switch (preset) {
    case '5m':
      return now + 5 * 60 * 1000;
    case '15m':
      return now + 15 * 60 * 1000;
    case '1h':
      return now + 60 * 60 * 1000;
    case 'tomorrow_9am': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    }
  }
}

export function triggerReminderNotification(
  reminder: TaskReminder,
  taskTitle: string,
  onSnooze?: (preset: '5m' | '15m' | '1h' | 'tomorrow_9am') => void,
  onDismiss?: () => void
) {
  // Play sound
  try {
    audioEngine.playCompletionChime();
  } catch {
    // Audio engine fallback
  }

  // System notification if supported
  if (getReminderCapability() === 'granted') {
    try {
      const notif = new Notification(`Reminder: ${taskTitle}`, {
        body: 'FlowTask reminder',
        icon: '/favicon.ico',
        tag: `flowtask-reminder-${reminder.id}`,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch {
      // Notification creation failed or ignored
    }
  }

  // Dispatch custom event for UI toast
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('flowtask:reminder-triggered', {
      detail: {
        reminder,
        taskTitle,
        onSnooze,
        onDismiss,
      },
    });
    window.dispatchEvent(event);
  }
}

class ReminderManager {
  private activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  public schedule(
    reminder: TaskReminder,
    taskTitle: string,
    onTrigger?: (reminder: TaskReminder, taskTitle: string) => void
  ) {
    this.cancel(reminder.id);
    if (reminder.status === 'dismissed' || reminder.status === 'triggered') {
      return;
    }

    const targetTime = reminder.status === 'snoozed' && reminder.snoozedUntil
      ? reminder.snoozedUntil
      : reminder.remindAt;

    if (!Number.isFinite(targetTime)) {
      return;
    }

    const delay = targetTime - Date.now();
    if (delay <= 0) {
      // Trigger immediately or within short tick
      const timer = setTimeout(() => {
        triggerReminderNotification(reminder, taskTitle);
        onTrigger?.(reminder, taskTitle);
        this.activeTimers.delete(reminder.id);
      }, 50);
      this.activeTimers.set(reminder.id, timer);
      return;
    }

    // If within 24 hours, schedule timer
    if (delay <= 24 * 60 * 60 * 1000) {
      const timer = setTimeout(() => {
        triggerReminderNotification(reminder, taskTitle);
        onTrigger?.(reminder, taskTitle);
        this.activeTimers.delete(reminder.id);
      }, delay);
      this.activeTimers.set(reminder.id, timer);
    }
  }

  public cancel(reminderId: string) {
    const existing = this.activeTimers.get(reminderId);
    if (existing) {
      clearTimeout(existing);
      this.activeTimers.delete(reminderId);
    }
  }

  public clearAll() {
    this.activeTimers.forEach((timer) => clearTimeout(timer));
    this.activeTimers.clear();
  }
}

export const reminderManager = new ReminderManager();

export function addReminderToTask(
  store: WorkspaceStore,
  taskId: string,
  remindAt: number,
  offsetMinutes = 0,
  channel: 'browser_notification' | 'sound' = 'browser_notification'
): TaskReminder {
  if (!Number.isFinite(remindAt)) {
    throw new Error('Invalid remindAt timestamp.');
  }
  const reminder: TaskReminder = {
    id: crypto.randomUUID(),
    taskId,
    remindAt,
    offsetMinutes,
    channel,
    status: 'scheduled',
    createdAt: Date.now(),
  };

  store.run('Add reminder to task', (record) => {
    const task = record.tasks.find((t) => t.id === taskId && !t.deletedAt);
    if (!task) throw new Error('Task not found.');

    const updatedTasks = record.tasks.map((t) =>
      t.id === taskId
        ? { ...t, reminders: [...(t.reminders || []), reminder] }
        : t
    );

    return {
      ...record,
      tasks: updatedTasks,
    };
  });

  const task = store.getSnapshot().record.tasks.find((t) => t.id === taskId);
  if (task) {
    reminderManager.schedule(reminder, task.title);
  }

  return reminder;
}

export function snoozeReminder(
  store: WorkspaceStore,
  taskId: string,
  reminderId: string,
  preset: '5m' | '15m' | '1h' | 'tomorrow_9am'
) {
  const snoozedUntil = computeSnoozeTimestamp(preset);

  store.run('Snooze task reminder', (record) => {
    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        reminders: (t.reminders || []).map((r) =>
          r.id === reminderId
            ? { ...r, status: 'snoozed' as const, snoozedUntil }
            : r
        ),
      };
    });

    return {
      ...record,
      tasks: updatedTasks,
    };
  });

  const task = store.getSnapshot().record.tasks.find((t) => t.id === taskId);
  const updatedReminder = task?.reminders?.find((r) => r.id === reminderId);
  if (task && updatedReminder) {
    reminderManager.schedule(updatedReminder, task.title);
  }
}

export function dismissReminder(
  store: WorkspaceStore,
  taskId: string,
  reminderId: string
) {
  reminderManager.cancel(reminderId);

  store.run('Dismiss task reminder', (record) => {
    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        reminders: (t.reminders || []).map((r) =>
          r.id === reminderId ? { ...r, status: 'dismissed' as const } : r
        ),
      };
    });

    return {
      ...record,
      tasks: updatedTasks,
    };
  });
}

export function removeReminder(
  store: WorkspaceStore,
  taskId: string,
  reminderId: string
) {
  reminderManager.cancel(reminderId);

  store.run('Remove task reminder', (record) => {
    const updatedTasks = record.tasks.map((t) => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        reminders: (t.reminders || []).filter((r) => r.id !== reminderId),
      };
    });

    return {
      ...record,
      tasks: updatedTasks,
    };
  });
}

export function syncRemindersWithStore(store: WorkspaceStore): () => void {
  const snap = store.getSnapshot();
  const tasks = snap.record?.tasks || [];
  tasks.forEach((task) => {
    if (task.deletedAt || task.archivedAt || task.status === 'done') return;
    (task.reminders || []).forEach((r) => {
      if (r.status === 'scheduled' || r.status === 'snoozed') {
        reminderManager.schedule(r, task.title, (firedReminder) => {
          store.run('Mark reminder triggered', (record) => ({
            ...record,
            tasks: record.tasks.map((t) =>
              t.id === firedReminder.taskId
                ? {
                    ...t,
                    reminders: (t.reminders || []).map((rem) =>
                      rem.id === firedReminder.id ? { ...rem, status: 'triggered' as const } : rem
                    ),
                  }
                : t
            ),
          }));
        });
      }
    });
  });

  return () => {
    reminderManager.clearAll();
  };
}
