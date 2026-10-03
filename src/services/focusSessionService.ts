import type { FocusSession, FocusSessionMode } from '../types/task';

const FOCUS_STORAGE_KEY = 'flowtask_active_focus_session';

export const focusSessionService = {
  getStoredSession(): FocusSession | null {
    try {
      const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as FocusSession;
    } catch (e) {
      console.warn('Failed to parse stored focus session:', e);
      return null;
    }
  },

  saveSession(session: FocusSession | null): void {
    try {
      if (!session) {
        localStorage.removeItem(FOCUS_STORAGE_KEY);
      } else {
        localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(session));
      }
      // Broadcast update to other tabs if BroadcastChannel is supported
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('flowtask_focus_channel');
        channel.postMessage({ type: 'FOCUS_SESSION_UPDATE', session });
        channel.close();
      }
    } catch (e) {
      console.warn('Failed to save focus session:', e);
    }
  },

  startSession(
    mode: FocusSessionMode,
    taskId: string | null = null,
    taskTitle: string | null = null,
    targetDurationSec: number = mode === 'pomodoro' ? 25 * 60 : 0
  ): FocusSession {
    const now = Date.now();
    const session: FocusSession = {
      id: `focus_${now}_${Math.random().toString(36).substring(2, 7)}`,
      mode,
      taskId,
      taskTitle: taskTitle || (taskId ? 'Active Task' : 'Focus Session'),
      startedAt: now,
      pausedAt: null,
      accumulatedElapsedMs: 0,
      targetDurationSec,
      state: 'running',
      pomodoroCycle: 1,
      pomodoroPhase: 'focus',
      loggedSegments: [],
    };

    this.saveSession(session);
    return session;
  },

  pauseSession(session: FocusSession): FocusSession {
    if (session.state !== 'running') return session;

    const now = Date.now();
    const currentRunMs = Math.max(0, now - session.startedAt);
    const updated: FocusSession = {
      ...session,
      state: 'paused',
      pausedAt: now,
      accumulatedElapsedMs: session.accumulatedElapsedMs + currentRunMs,
    };

    this.saveSession(updated);
    return updated;
  },

  resumeSession(session: FocusSession): FocusSession {
    if (session.state === 'running') return session;

    const now = Date.now();
    const updated: FocusSession = {
      ...session,
      state: 'running',
      startedAt: now,
      pausedAt: null,
    };

    this.saveSession(updated);
    return updated;
  },

  stopSession(session: FocusSession): { finalElapsedSeconds: number } {
    const totalElapsedSec = this.getElapsedSeconds(session);
    this.saveSession(null);
    return { finalElapsedSeconds: totalElapsedSec };
  },

  getElapsedSeconds(session: FocusSession, now: number = Date.now()): number {
    if (session.state === 'running') {
      const currentSegment = Math.max(0, now - session.startedAt);
      return Math.floor((session.accumulatedElapsedMs + currentSegment) / 1000);
    }
    return Math.floor(session.accumulatedElapsedMs / 1000);
  },

  getRemainingSeconds(session: FocusSession, now: number = Date.now()): number {
    if (!session.targetDurationSec || session.targetDurationSec <= 0) {
      return 0;
    }
    const elapsed = this.getElapsedSeconds(session, now);
    return Math.max(0, session.targetDurationSec - elapsed);
  },
};
