import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createFocusSession,
  resetWorkspaceFocus,
  restartWorkspaceFocusRound,
  changeWorkspaceFocusState,
  elapsedFocusSeconds,
  startWorkspaceFocus,
} from './focusLifecycle';
import { WorkspaceStore } from './workspaceStore';
import { dbService, emptyWorkspace } from './dbService';
import type { Task, FocusSession } from '../types/task';

describe('focusLifecycle reliable reset and ready state contract', () => {
  let store: WorkspaceStore;
  const sampleTask: Task = {
    id: 'task-1',
    title: 'Implement Parser',
    status: 'in_progress',
    priority: 'p1',
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 10000,
    projectId: 'inbox',
    subtasks: [
      { id: 'sub-1', title: 'Lexer', completed: true },
      { id: 'sub-2', title: 'AST', completed: false },
    ],
    timeSpentMinutes: 1,
  };

  beforeEach(async () => {
    let disk = emptyWorkspace('test');
    disk.tasks = [sampleTask];
    const persistence = {
      ...dbService,
      ensureLegacyMigrated: vi.fn(async () => structuredClone(disk)),
      saveWorkspace: vi.fn(async (_id: string, data: typeof disk) => {
        disk = structuredClone(data);
      }),
    };
    store = new WorkspaceStore('test', false, persistence);
    await store.load();
  });

  it('creates ready focus session that counts 0 elapsed seconds while waiting', () => {
    const session = createFocusSession(
      {
        mode: 'pomodoro',
        taskId: 'task-1',
        taskTitle: 'Implement Parser',
        targetDurationSec: 1500,
        state: 'ready',
      },
      'test',
      1000
    );

    expect(session.state).toBe('ready');
    // Waiting 10 minutes in ready state
    expect(elapsedFocusSeconds(session, 1000 + 600000)).toBe(0);
  });

  it('rejects unavailable tasks before creating a checkpoint, then permits an unblocked five-minute attempt', () => {
    store.run('Add dependency', record => ({ ...record, tasks: [
      { ...sampleTask, blockedBy: ['blocker'] },
      { ...sampleTask, id: 'blocker', title: 'Do this first', subtasks: [] },
    ] }));
    expect(() => startWorkspaceFocus(store, { mode: 'countdown', taskId: sampleTask.id, targetDurationSec: 300 })).toThrow(/dependency/);
    expect(store.getSnapshot().record.preferences.focusSession).toBeFalsy();
    store.run('Finish blocker', record => ({ ...record, tasks: record.tasks.map(t => t.id === 'blocker' ? { ...t, status: 'done' } : t) }));
    const session = startWorkspaceFocus(store, { mode: 'countdown', taskId: sampleTask.id, targetDurationSec: 300 });
    expect(session.targetDurationSec).toBe(300);
    expect(store.getSnapshot().record.tasks[0].estimatedMinutes).toBe(sampleTask.estimatedMinutes);
  });

  it('resets timer with save choice: creates interrupted log and returns frozen config ready session', () => {
    const now = 100000;
    const session = createFocusSession(
      {
        mode: 'pomodoro',
        taskId: 'task-1',
        taskTitle: 'Implement Parser',
        targetDurationSec: 1500,
        pomodoroPhase: 'focus',
        pomodoroCycle: 2,
        state: 'running',
      },
      'test',
      now
    );

    store.run('Set Session', (draft) => ({
      ...draft,
      preferences: {
        ...draft.preferences,
        focusSession: session,
      },
    }));

    // 120 seconds elapsed
    const resetTime = now + 120000;
    const result = resetWorkspaceFocus(store, {
      choice: 'save',
      expectedSessionId: session.id,
      now: resetTime,
    });

    expect(result).not.toBeNull();
    expect(result?.session.state).toBe('ready');
    expect(result?.session.pomodoroPhase).toBe('focus');
    expect(result?.session.pomodoroCycle).toBe(2);

    const snap = store.getSnapshot().record;
    // 1. Ready session in store
    const storedSession = snap.preferences.focusSession as FocusSession;
    expect(storedSession.state).toBe('ready');
    expect(storedSession.pomodoroPhase).toBe('focus');
    expect(storedSession.pomodoroCycle).toBe(2);
    expect(storedSession.targetDurationSec).toBe(1500);

    // 2. Interrupted focus log created exactly once
    const logs = snap.preferences.focusLogs as any[];
    expect(logs).toHaveLength(1);
    expect(logs[0].outcome).toBe('interrupted');
    expect(logs[0].seconds).toBe(120);
    expect(logs[0].taskId).toBe('task-1');

    // 3. Task focus time credited
    const task = snap.tasks.find((t) => t.id === 'task-1');
    expect(task?.timeSpentMinutes).toBe(3); // 1 + 2 minutes
    expect(task?.subtasks[0].completed).toBe(true);
  });

  it('resets timer with discard choice: no history, no time credit, returns frozen config ready session', () => {
    const now = 100000;
    const session = createFocusSession(
      {
        mode: 'pomodoro',
        taskId: 'task-1',
        taskTitle: 'Implement Parser',
        targetDurationSec: 1500,
        pomodoroPhase: 'short_break',
        pomodoroCycle: 3,
        state: 'running',
      },
      'test',
      now
    );

    store.run('Set Session', (draft) => ({
      ...draft,
      preferences: {
        ...draft.preferences,
        focusSession: session,
      },
    }));

    const resetTime = now + 90000;
    const result = resetWorkspaceFocus(store, {
      choice: 'discard',
      expectedSessionId: session.id,
      now: resetTime,
    });

    expect(result).not.toBeNull();

    const snap = store.getSnapshot().record;
    // 1. Ready session replacement retains phase & cycle
    const storedSession = snap.preferences.focusSession as FocusSession;
    expect(storedSession.state).toBe('ready');
    expect(storedSession.pomodoroPhase).toBe('short_break');
    expect(storedSession.pomodoroCycle).toBe(3);

    // 2. No history entry
    const logs = snap.preferences.focusLogs as any[];
    expect(logs).toHaveLength(0);

    // 3. Task time uncredited
    const task = snap.tasks.find((t) => t.id === 'task-1');
    expect(task?.timeSpentMinutes).toBe(1);
  });

  it('restarts Pomodoro round: returns cycle 1, focus phase, ready state', () => {
    const now = 100000;
    const session = createFocusSession(
      {
        mode: 'pomodoro',
        taskId: 'task-1',
        taskTitle: 'Implement Parser',
        targetDurationSec: 300,
        pomodoroPhase: 'short_break',
        pomodoroCycle: 3,
        state: 'running',
      },
      'test',
      now
    );

    store.run('Set Session', (draft) => ({
      ...draft,
      preferences: {
        ...draft.preferences,
        focusSession: session,
      },
    }));

    const result = restartWorkspaceFocusRound(store, {
      choice: 'save',
      expectedSessionId: session.id,
      now: now + 50000,
    });

    expect(result).not.toBeNull();

    const snap = store.getSnapshot().record;
    const storedSession = snap.preferences.focusSession as FocusSession;
    // Round reset to focus, cycle 1, ready
    expect(storedSession.pomodoroPhase).toBe('focus');
    expect(storedSession.pomodoroCycle).toBe(1);
    expect(storedSession.state).toBe('ready');
  });

  it('returns null on stale sessionId to avoid race conditions with multiple clicks', () => {
    const now = 100000;
    const session = createFocusSession(
      {
        mode: 'pomodoro',
        taskId: 'task-1',
        targetDurationSec: 1500,
      },
      'test',
      now
    );

    store.run('Set Session', (draft) => ({
      ...draft,
      preferences: {
        ...draft.preferences,
        focusSession: session,
      },
    }));

    const result = resetWorkspaceFocus(store, {
      choice: 'discard',
      expectedSessionId: 'stale-id-999',
      now,
    });

    expect(result).toBeNull();
  });

  it('transitions from ready to running accurately without counting prior waiting time', () => {
    const session = createFocusSession(
      {
        mode: 'pomodoro',
        taskId: 'task-1',
        targetDurationSec: 1500,
        state: 'ready',
      },
      'test',
      1000
    );

    store.run('Set Session', (draft) => ({
      ...draft,
      preferences: {
        ...draft.preferences,
        focusSession: session,
      },
    }));

    // 5 minutes later, user presses Play
    const startTime = 1000 + 300000;
    changeWorkspaceFocusState(store, 'running', startTime);

    const snap = store.getSnapshot().record;
    const storedSession = snap.preferences.focusSession as FocusSession;
    expect(storedSession.state).toBe('running');
    expect(storedSession.startedAt).toBe(startTime);

    // 10 seconds into running
    expect(elapsedFocusSeconds(storedSession, startTime + 10000)).toBe(10);
  });
});
