import { create } from 'zustand';
import type { FocusSession, FocusSessionMode } from '../types/task';
import { focusSessionService } from '../services/focusSessionService';

interface FocusState {
  focusSession: FocusSession | null;
  focusElapsedSeconds: number;
  activeTimerTaskId: string | null;
  activeTimerSeconds: number;

  setFocusSession: (session: FocusSession | null) => void;
  startFocusSession: (mode: FocusSessionMode, taskId?: string | null, title?: string | null, targetSec?: number) => FocusSession;
  pauseFocusSession: () => void;
  resumeFocusSession: () => void;
  stopFocusSession: () => { finalElapsedSeconds: number; session: FocusSession | null };
  tick: () => void;
}

let tickerInterval: ReturnType<typeof setInterval> | null = null;

function syncTicker(get: () => FocusState, set: (partial: Partial<FocusState>) => void) {
  const { focusSession } = get();
  if (focusSession?.state === 'running') {
    if (!tickerInterval) {
      tickerInterval = setInterval(() => {
        const current = get().focusSession;
        if (current && current.state === 'running') {
          const elapsed = focusSessionService.getElapsedSeconds(current);
          set({ focusElapsedSeconds: elapsed, activeTimerSeconds: elapsed });
        }
      }, 1000);
    }
  } else {
    if (tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = null;
    }
  }
}

export const useFocusStore = create<FocusState>((set, get) => ({
  focusSession: null,
  focusElapsedSeconds: 0,
  activeTimerTaskId: null,
  activeTimerSeconds: 0,

  setFocusSession: (session: FocusSession | null) => {
    const elapsed = session ? focusSessionService.getElapsedSeconds(session) : 0;
    set({
      focusSession: session,
      focusElapsedSeconds: elapsed,
      activeTimerTaskId: session?.taskId || null,
      activeTimerSeconds: elapsed,
    });
    syncTicker(get, set);
  },

  startFocusSession: (mode: FocusSessionMode, taskId = null, title = null, targetSec = mode === 'pomodoro' ? 1500 : 0) => {
    const session = focusSessionService.startSession(mode, taskId, title, targetSec);
    set({
      focusSession: session,
      focusElapsedSeconds: 0,
      activeTimerTaskId: taskId,
      activeTimerSeconds: 0,
    });
    syncTicker(get, set);
    return session;
  },

  pauseFocusSession: () => {
    const { focusSession } = get();
    if (focusSession && focusSession.state === 'running') {
      const updated = focusSessionService.pauseSession(focusSession);
      const elapsed = focusSessionService.getElapsedSeconds(updated);
      set({
        focusSession: updated,
        focusElapsedSeconds: elapsed,
        activeTimerSeconds: elapsed,
      });
      syncTicker(get, set);
    }
  },

  resumeFocusSession: () => {
    const { focusSession } = get();
    if (focusSession && focusSession.state === 'paused') {
      const updated = focusSessionService.resumeSession(focusSession);
      const elapsed = focusSessionService.getElapsedSeconds(updated);
      set({
        focusSession: updated,
        focusElapsedSeconds: elapsed,
        activeTimerSeconds: elapsed,
      });
      syncTicker(get, set);
    }
  },

  stopFocusSession: () => {
    const { focusSession } = get();
    const result = focusSession ? focusSessionService.stopSession(focusSession) : { finalElapsedSeconds: 0 };
    set({
      focusSession: null,
      focusElapsedSeconds: 0,
      activeTimerTaskId: null,
      activeTimerSeconds: 0,
    });
    syncTicker(get, set);
    return { finalElapsedSeconds: result.finalElapsedSeconds, session: focusSession };
  },

  tick: () => {
    const { focusSession } = get();
    if (focusSession && focusSession.state === 'running') {
      const elapsed = focusSessionService.getElapsedSeconds(focusSession);
      set({ focusElapsedSeconds: elapsed, activeTimerSeconds: elapsed });
    }
  },
}));
