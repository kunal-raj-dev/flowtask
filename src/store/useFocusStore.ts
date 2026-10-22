import { create } from 'zustand';
import type { FocusSession, FocusSessionMode } from '../types/task';
import { focusSessionService } from '../services/focusSessionService';

export interface FocusState {
  focusSession: FocusSession | null;
  focusElapsedSeconds: number;
  activeTimerTaskId: string | null;
  activeTimerSeconds: number;

  setFocusSession: (session: FocusSession | null) => void;
  startFocusSession: (
    mode: FocusSessionMode,
    taskId?: string | null,
    title?: string | null,
    targetSec?: number,
    subtaskId?: string | null,
    subtaskTitle?: string | null,
    pacingSec?: number
  ) => FocusSession;
  updateFocusSession: (updates: Partial<FocusSession>) => void;
  switchSubtask: (subtaskId: string, subtaskTitle: string, targetSec: number) => void;
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

// Workspace focus state is persisted with its workspace, not in a device-global
// localStorage record. Hydration is performed by TaskContext after the active
// workspace has been identified. Starting from a global cached session here
// could briefly expose the preceding account's task title on a shared device.
const initialStored: FocusSession | null = null;
const initialElapsed = 0;

export const useFocusStore = create<FocusState>((set, get) => ({
  focusSession: initialStored,
  focusElapsedSeconds: initialElapsed,
  activeTimerTaskId: null,
  activeTimerSeconds: initialElapsed,

  setFocusSession: (session: FocusSession | null) => {
    const elapsed = session ? focusSessionService.getElapsedSeconds(session) : 0;
    set({
      focusSession: session,
      focusElapsedSeconds: elapsed,
      activeTimerTaskId: session?.taskId || null,
      activeTimerSeconds: elapsed,
    });
    // Older standalone focus surfaces used a device-global persistence key.
    // Clear it when a workspace-owned session reaches this display store so
    // it cannot be picked up before a different account finishes hydration.
    if (session?.workspaceId) focusSessionService.saveSession(null);
    syncTicker(get, set);
  },

  startFocusSession: (
    mode: FocusSessionMode,
    taskId = null,
    title = null,
    targetSec = mode === 'pomodoro' ? 1500 : 0,
    subtaskId = null,
    subtaskTitle = null,
    pacingSec = 0
  ) => {
    const session = focusSessionService.startSession(
      mode,
      taskId,
      title,
      targetSec,
      subtaskId,
      subtaskTitle,
      pacingSec
    );
    set({
      focusSession: session,
      focusElapsedSeconds: 0,
      activeTimerTaskId: taskId,
      activeTimerSeconds: 0,
    });
    syncTicker(get, set);
    return session;
  },

  updateFocusSession: (updates: Partial<FocusSession>) => {
    const { focusSession } = get();
    if (!focusSession) return;
    const updated = focusSessionService.updateSession(focusSession, updates);
    const elapsed = focusSessionService.getElapsedSeconds(updated);
    set({
      focusSession: updated,
      focusElapsedSeconds: elapsed,
      activeTimerSeconds: elapsed,
    });
    syncTicker(get, set);
  },

  switchSubtask: (subtaskId: string, subtaskTitle: string, targetSec: number) => {
    const { focusSession } = get();
    if (!focusSession) return;
    const now = Date.now();
    const updated: FocusSession = {
      ...focusSession,
      subtaskId,
      subtaskTitle,
      targetDurationSec: targetSec,
      pacingSecondsPerUnit: targetSec,
      startedAt: now,
      accumulatedElapsedMs: 0,
    };
    focusSessionService.saveSession(updated);
    set({
      focusSession: updated,
      focusElapsedSeconds: 0,
      activeTimerSeconds: 0,
    });
    syncTicker(get, set);
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
    const result = focusSession ? focusSessionService.stopSession(focusSession) : { finalElapsedSeconds: 0, session: null };
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

// Granular selector hooks for high performance focus / stopwatch tracking
export const useFocus = () => {
  const focusSession = useFocusStore((s) => s.focusSession);
  const focusElapsedSeconds = useFocusStore((s) => s.focusElapsedSeconds);
  const activeTimerTaskId = useFocusStore((s) => s.activeTimerTaskId);
  const activeTimerSeconds = useFocusStore((s) => s.activeTimerSeconds);
  const startFocusSession = useFocusStore((s) => s.startFocusSession);
  const updateFocusSession = useFocusStore((s) => s.updateFocusSession);
  const switchSubtask = useFocusStore((s) => s.switchSubtask);
  const pauseFocusSession = useFocusStore((s) => s.pauseFocusSession);
  const resumeFocusSession = useFocusStore((s) => s.resumeFocusSession);
  const stopFocusSession = useFocusStore((s) => s.stopFocusSession);
  const setFocusSession = useFocusStore((s) => s.setFocusSession);

  return {
    focusSession,
    focusElapsedSeconds,
    activeTimerTaskId,
    activeTimerSeconds,
    startFocusSession,
    updateFocusSession,
    switchSubtask,
    pauseFocusSession,
    resumeFocusSession,
    stopFocusSession,
    setFocusSession,
  };
};

export const useIsTaskTimerActive = (taskId: string) => {
  const isActive = useFocusStore((s) => s.activeTimerTaskId === taskId);
  const isRunning = useFocusStore((s) => s.activeTimerTaskId === taskId && s.focusSession?.state === 'running');
  const seconds = useFocusStore((s) => (s.activeTimerTaskId === taskId ? s.activeTimerSeconds : 0));
  return { isActive, isRunning, seconds };
};

export const useFocusElapsedSeconds = () => useFocusStore((s) => s.focusElapsedSeconds);
export const useActiveTimerSeconds = () => useFocusStore((s) => s.activeTimerSeconds);
export const useActiveTimerTaskId = () => useFocusStore((s) => s.activeTimerTaskId);
