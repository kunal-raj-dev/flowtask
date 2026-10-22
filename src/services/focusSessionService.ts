import { createFocusSession, elapsedFocusSeconds } from './focusLifecycle';
import type { FocusSession, FocusSessionMode } from '../types/task';

const FOCUS_STORAGE_KEY = 'flowtask_active_focus_session';

export const focusSessionService = {
  getStoredSession(): FocusSession | null {
    try {
      if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return null;
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
      if (typeof localStorage !== 'undefined') {
        if (!session && typeof localStorage.removeItem === 'function') {
          localStorage.removeItem(FOCUS_STORAGE_KEY);
        } else if (session && typeof localStorage.setItem === 'function') {
          localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(session));
        }
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
    targetDurationSec: number = mode === 'pomodoro' ? 25 * 60 : 0,
    subtaskId: string | null = null,
    subtaskTitle: string | null = null,
    pacingSecondsPerUnit: number = 0
  ): FocusSession {
    const session = createFocusSession({ mode, taskId, taskTitle, targetDurationSec, subtaskId, subtaskTitle, pacingSecondsPerUnit });

    this.saveSession(session);
    return session;
  },

  updateSession(session: FocusSession, updates: Partial<FocusSession>): FocusSession {
    const updated: FocusSession = {
      ...session,
      ...updates,
    };
    this.saveSession(updated);
    return updated;
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
    const wasReady = session.state === 'ready';
    const updated: FocusSession = {
      ...session,
      state: 'running',
      startedAt: now,
      originalStartedAt: wasReady ? now : (session.originalStartedAt || session.startedAt),
      totalPausedMs: wasReady ? 0 : (session.totalPausedMs || 0) + Math.max(0, now - (session.pausedAt || now)),
      pausedAt: null,
    };

    this.saveSession(updated);
    return updated;
  },

  stopSession(session: FocusSession): { finalElapsedSeconds: number; session: FocusSession } {
    const totalElapsedSec = this.getElapsedSeconds(session);
    this.saveSession(null);
    return { finalElapsedSeconds: totalElapsedSec, session };
  },

  getElapsedSeconds(session: FocusSession, now: number = Date.now()): number {
    if (session.state === 'ready' || session.state === 'idle') return 0;
    return elapsedFocusSeconds(session, now);
  },

  getRemainingSeconds(session: FocusSession, now: number = Date.now()): number {
    if (!session.targetDurationSec || session.targetDurationSec <= 0) {
      return 0;
    }
    if (session.state === 'ready') {
      return session.targetDurationSec;
    }
    const elapsed = this.getElapsedSeconds(session, now);
    return Math.max(0, session.targetDurationSec - elapsed);
  },
};
