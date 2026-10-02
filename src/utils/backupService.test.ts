import { describe, it, expect, beforeEach } from 'vitest';
import {
  createLocalSnapshot,
  getStoredSnapshots,
  restoreSnapshot,
  deleteSnapshot,
  checkAndTriggerDailyAutoSnapshot,
} from './backupService';
import type { Task, Project } from '../types/task';

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};
(globalThis as any).localStorage = localStorageMock;

describe('backupService', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Test task 1',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      subtasks: [],
      createdAt: 1000,
    },
  ];

  const mockProjects: Project[] = [
    { id: 'work', name: 'Work', color: '#3B82F6' },
  ];

  it('creates and retrieves a local snapshot', () => {
    const snap = createLocalSnapshot(mockTasks, mockProjects, 'My First Snapshot', 'manual');
    expect(snap.id).toBeDefined();
    expect(snap.label).toBe('My First Snapshot');
    expect(snap.taskCount).toBe(1);
    expect(snap.trigger).toBe('manual');

    const stored = getStoredSnapshots();
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(snap.id);
  });

  it('restores tasks and projects cleanly from a snapshot', () => {
    const snap = createLocalSnapshot(mockTasks, mockProjects, 'Snapshot to restore');
    const restored = restoreSnapshot(snap.id);
    expect(restored).not.toBeNull();
    expect(restored?.tasks.length).toBe(1);
    expect(restored?.tasks[0].title).toBe('Test task 1');
    expect(restored?.projects[0].name).toBe('Work');
  });

  it('deletes a snapshot by id', () => {
    const snap1 = createLocalSnapshot(mockTasks, mockProjects, 'Snap 1');
    const snap2 = createLocalSnapshot(mockTasks, mockProjects, 'Snap 2');
    expect(getStoredSnapshots().length).toBe(2);

    deleteSnapshot(snap1.id);
    const remaining = getStoredSnapshots();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(snap2.id);
  });

  it('triggers daily auto-snapshot when none exists or when >20h old', () => {
    const triggered = checkAndTriggerDailyAutoSnapshot(mockTasks, mockProjects);
    expect(triggered).toBe(true);

    const stored = getStoredSnapshots();
    expect(stored.length).toBe(1);
    expect(stored[0].trigger).toBe('auto_daily');

    // Second check immediately after should not trigger
    const triggeredAgain = checkAndTriggerDailyAutoSnapshot(mockTasks, mockProjects);
    expect(triggeredAgain).toBe(false);
  });
});
