import type { FocusLog, FocusSession, FocusSessionMode } from '../types/task';
import { DEFAULT_TIMER } from '../types/studio';
import type { TimerConfiguration } from '../types/studio';
import type { WorkspaceStore, MutationReceipt } from './workspaceStore';
import { writeFocusCheckpoint } from './focusCheckpoint';
import { nextStudioPhase, pausedSeconds } from './studioSessionEngine';

export interface FocusStartInput {
  mode: FocusSessionMode;
  taskId?: string | null;
  taskTitle?: string | null;
  targetDurationSec?: number;
  durationSec?: number;
  subtaskId?: string | null;
  subtaskTitle?: string | null;
  pacingSecondsPerUnit?: number;
  timerConfiguration?: TimerConfiguration;
  pomodoroPhase?: 'focus' | 'short_break' | 'long_break';
  pomodoroCycle?: number;
  recipeId?: string;
  nextAction?: string;
  projectId?: string;
  workspaceId?: string;
  state?: 'ready' | 'running';
  expectedSessionId?: string;
}

export interface ResetFocusOptions {
  choice: 'save' | 'discard';
  expectedSessionId?: string;
  now?: number;
}

function requireWritable(store: WorkspaceStore) {
  const snapshot = store.getSnapshot();
  if (!snapshot.ready) throw new Error('Wait for the workspace to finish loading.');
  if (snapshot.readOnly) throw new Error('This tab is a read-only preview. Choose Use this tab to make changes.');
}

export function createFocusSession(input: FocusStartInput, workspaceId?: string, now = Date.now()): FocusSession {
  if (!['stopwatch', 'pomodoro', 'sprint', 'countdown'].includes(input.mode)) throw new Error('Choose a supported focus mode.');
  const target = input.targetDurationSec ?? input.durationSec ?? (input.mode === 'stopwatch' ? 0 : 1500);
  if (!Number.isFinite(target) || target < 0 || target > 86400) throw new Error('Choose a focus duration between zero and 24 hours.');
  const timerConfiguration = { ...DEFAULT_TIMER, focusMinutes: target / 60, ...input.timerConfiguration, mode: input.mode };
  if (target > 0 && (['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes'] as const).some(key => !Number.isFinite(timerConfiguration[key]) || timerConfiguration[key] <= 0 || timerConfiguration[key] > 1440)) throw new Error('Choose timer intervals between one second and 24 hours.');
  if (!Number.isInteger(timerConfiguration.cyclesBeforeLongBreak) || timerConfiguration.cyclesBeforeLongBreak < 1 || timerConfiguration.cyclesBeforeLongBreak > 100 || typeof timerConfiguration.autoStart !== 'boolean') throw new Error('Choose valid timer cycle and automatic start settings.');
  
  const initialState = input.state || 'running';
  return {
    id: crypto.randomUUID(),
    workspaceId: workspaceId || input.workspaceId,
    mode: input.mode,
    taskId: input.taskId || null,
    taskTitle: input.taskTitle || 'Focus session',
    subtaskId: input.subtaskId || undefined,
    subtaskTitle: input.subtaskTitle || undefined,
    projectId: input.projectId || undefined,
    recipeId: input.recipeId || undefined,
    nextAction: input.nextAction || undefined,
    startedAt: now,
    originalStartedAt: now,
    accumulatedElapsedMs: 0,
    targetDurationSec: target,
    state: initialState,
    pomodoroCycle: input.pomodoroCycle || 1,
    pomodoroPhase: input.pomodoroPhase || 'focus',
    loggedSegments: [],
    bankedSeconds: 0,
    pacingSecondsPerUnit: input.pacingSecondsPerUnit || undefined,
    ...(target > 0 ? { timerConfiguration } : {}),
  };
}

export function startWorkspaceFocus(store: WorkspaceStore, input: FocusStartInput): FocusSession {
  requireWritable(store);
  const record = store.getSnapshot().record;
  const currentSession = record.preferences.focusSession as FocusSession | null;
  if (currentSession && currentSession.state !== 'completed') {
    if (!input.expectedSessionId || input.expectedSessionId !== currentSession.id) {
      throw new Error('Return to your current focus session, or finish it before starting another.');
    }
  }
  if (input.taskId && !record.tasks.some(task => task.id === input.taskId && !task.deletedAt)) {
    throw new Error('Choose an available task before starting focus.');
  }
  const session = createFocusSession(input, store.id);
  const at = writeFocusCheckpoint(store.id, session);
  store.run('Start focus session', current => ({
    ...current,
    preferences: { ...current.preferences, focusSession: session, focusCheckpointAt: at }
  }), false);
  return session;
}

export function isFocusComplete(session: FocusSession, now = Date.now()): boolean {
  return ['pomodoro', 'countdown'].includes(session.mode) && session.state === 'running' && session.targetDurationSec > 0 &&
    session.accumulatedElapsedMs + Math.max(0, now - session.startedAt) >= session.targetDurationSec * 1000;
}

export function elapsedFocusSeconds(session: FocusSession, now = Date.now()): number {
  if (session.state === 'ready' || session.state === 'idle') return 0;
  const elapsed = Math.floor((session.accumulatedElapsedMs + (session.state === 'running' ? Math.max(0, now - session.startedAt) : 0)) / 1000);
  return Math.max(0, ['pomodoro', 'countdown'].includes(session.mode) && session.targetDurationSec > 0 ? Math.min(session.targetDurationSec, elapsed) : elapsed);
}

export function changeWorkspaceFocusState(
  store: WorkspaceStore,
  state: 'paused' | 'running',
  now = Date.now(),
  options: { expectedSessionId?: string } = {}
): FocusSession | null {
  requireWritable(store);
  const session = store.getSnapshot().record.preferences.focusSession as FocusSession | null;
  if (!session || session.state === state || session.state === 'completed') return session;
  if (options.expectedSessionId && session.id !== options.expectedSessionId) return session;

  let updated: FocusSession;
  if (state === 'paused') {
    if (session.state !== 'running') return session;
    updated = {
      ...session,
      state: 'paused',
      pausedAt: now,
      accumulatedElapsedMs: session.accumulatedElapsedMs + Math.max(0, now - session.startedAt),
    };
  } else {
    const wasReady = session.state === 'ready';
    updated = {
      ...session,
      state: 'running',
      startedAt: now,
      originalStartedAt: wasReady ? now : (session.originalStartedAt || now),
      pausedAt: null,
      totalPausedMs: wasReady ? 0 : (session.totalPausedMs || 0) + Math.max(0, now - (session.pausedAt || now)),
    };
  }
  const at = writeFocusCheckpoint(store.id, updated);
  store.run(
    state === 'paused' ? 'Pause focus session' : (session.state === 'ready' ? 'Start focus session' : 'Resume focus session'),
    record => ({ ...record, preferences: { ...record.preferences, focusSession: updated, focusCheckpointAt: at } }),
    false
  );
  return updated;
}

export function resetWorkspaceFocus(
  store: WorkspaceStore,
  options: ResetFocusOptions
): { session: FocusSession; receipt?: MutationReceipt } | null {
  requireWritable(store);
  const session = store.getSnapshot().record.preferences.focusSession as FocusSession | null;
  if (!session || (session.workspaceId && session.workspaceId !== store.id)) return null;
  if (options.expectedSessionId && session.id !== options.expectedSessionId) return null;

  const now = options.now ?? Date.now();
  const elapsed = elapsedFocusSeconds(session, now);
  const config = session.timerConfiguration || DEFAULT_TIMER;

  // Determine frozen target duration for the current phase/mode
  let targetDuration = session.targetDurationSec;
  if (session.mode === 'stopwatch') {
    targetDuration = 0;
  } else if (session.mode === 'pomodoro') {
    targetDuration = (session.pomodoroPhase === 'short_break'
      ? config.shortBreakMinutes
      : session.pomodoroPhase === 'long_break'
        ? config.longBreakMinutes
        : config.focusMinutes) * 60;
  } else if (session.mode === 'countdown') {
    targetDuration = (config.focusMinutes || 25) * 60;
  }

  const readySession: FocusSession = {
    id: crypto.randomUUID(),
    workspaceId: store.id,
    mode: session.mode,
    taskId: session.taskId,
    taskTitle: session.taskTitle,
    subtaskId: session.subtaskId,
    subtaskTitle: session.subtaskTitle,
    projectId: session.projectId,
    recipeId: session.recipeId,
    nextAction: session.nextAction,
    timerConfiguration: config,
    targetDurationSec: targetDuration,
    pacingSecondsPerUnit: session.pacingSecondsPerUnit,
    pomodoroPhase: session.pomodoroPhase || 'focus',
    pomodoroCycle: session.pomodoroCycle || 1,
    loggedSegments: session.loggedSegments || [],
    bankedSeconds: session.bankedSeconds || 0,
    state: 'ready',
    startedAt: now,
    originalStartedAt: now,
    pausedAt: null,
    accumulatedElapsedMs: 0,
    totalPausedMs: 0,
  };

  const shouldSaveLog = options.choice === 'save' && elapsed > 0;
  const minutes = shouldSaveLog && session.pomodoroPhase === 'focus' ? elapsed / 60 : 0;
  const at = writeFocusCheckpoint(store.id, readySession);

  const receipt = store.run('Reset focus timer', record => {
    const logs = (record.preferences.focusLogs || []) as FocusLog[];
    let newLogs = logs;
    if (shouldSaveLog && !logs.some(l => l.id === session.id)) {
      const log: FocusLog = {
        id: session.id,
        seconds: elapsed,
        taskId: session.taskId,
        taskTitle: session.taskTitle,
        subtaskId: session.subtaskId,
        subtaskTitle: session.subtaskTitle,
        mode: session.mode,
        startedAt: session.originalStartedAt || session.startedAt,
        endedAt: now,
        phase: session.pomodoroPhase || 'focus',
        recipeId: session.recipeId,
        outcome: 'interrupted',
        rating: session.rating,
        pausedSeconds: pausedSeconds(session, now),
      };
      newLogs = [...logs, log];
    }

    const updatedTasks = minutes > 0 && session.taskId
      ? record.tasks.map(task => task.id === session.taskId
          ? {
              ...task,
              timeSpentMinutes: (task.timeSpentMinutes || 0) + minutes,
              subtasks: session.subtaskId
                ? task.subtasks.map(s => s.id === session.subtaskId ? { ...s, timeSpentMinutes: (s.timeSpentMinutes || 0) + minutes } : s)
                : task.subtasks,
            }
          : task)
      : record.tasks;

    return {
      ...record,
      tasks: updatedTasks,
      preferences: {
        ...record.preferences,
        focusSession: readySession,
        focusCheckpointAt: at,
        focusLogs: newLogs,
      },
    };
  }, false);

  return { session: readySession, receipt };
}

export function restartWorkspaceFocusRound(
  store: WorkspaceStore,
  options: ResetFocusOptions
): { session: FocusSession; receipt?: MutationReceipt } | null {
  requireWritable(store);
  const session = store.getSnapshot().record.preferences.focusSession as FocusSession | null;
  if (!session || (session.workspaceId && session.workspaceId !== store.id)) return null;
  if (options.expectedSessionId && session.id !== options.expectedSessionId) return null;

  const now = options.now ?? Date.now();
  const elapsed = elapsedFocusSeconds(session, now);
  const config = session.timerConfiguration || DEFAULT_TIMER;
  const focusDuration = (config.focusMinutes || 25) * 60;

  const readySession: FocusSession = {
    id: crypto.randomUUID(),
    workspaceId: store.id,
    mode: session.mode,
    taskId: session.taskId,
    taskTitle: session.taskTitle,
    subtaskId: session.subtaskId,
    subtaskTitle: session.subtaskTitle,
    projectId: session.projectId,
    recipeId: session.recipeId,
    nextAction: session.nextAction,
    timerConfiguration: config,
    targetDurationSec: focusDuration,
    pacingSecondsPerUnit: session.pacingSecondsPerUnit,
    pomodoroPhase: 'focus',
    pomodoroCycle: 1,
    loggedSegments: session.loggedSegments || [],
    bankedSeconds: session.bankedSeconds || 0,
    state: 'ready',
    startedAt: now,
    originalStartedAt: now,
    pausedAt: null,
    accumulatedElapsedMs: 0,
    totalPausedMs: 0,
  };

  const shouldSaveLog = options.choice === 'save' && elapsed > 0;
  const minutes = shouldSaveLog && session.pomodoroPhase === 'focus' ? elapsed / 60 : 0;
  const at = writeFocusCheckpoint(store.id, readySession);

  const receipt = store.run('Restart Pomodoro round', record => {
    const logs = (record.preferences.focusLogs || []) as FocusLog[];
    let newLogs = logs;
    if (shouldSaveLog && !logs.some(l => l.id === session.id)) {
      const log: FocusLog = {
        id: session.id,
        seconds: elapsed,
        taskId: session.taskId,
        taskTitle: session.taskTitle,
        subtaskId: session.subtaskId,
        subtaskTitle: session.subtaskTitle,
        mode: session.mode,
        startedAt: session.originalStartedAt || session.startedAt,
        endedAt: now,
        phase: session.pomodoroPhase || 'focus',
        recipeId: session.recipeId,
        outcome: 'interrupted',
        rating: session.rating,
        pausedSeconds: pausedSeconds(session, now),
      };
      newLogs = [...logs, log];
    }

    const updatedTasks = minutes > 0 && session.taskId
      ? record.tasks.map(task => task.id === session.taskId
          ? {
              ...task,
              timeSpentMinutes: (task.timeSpentMinutes || 0) + minutes,
              subtasks: session.subtaskId
                ? task.subtasks.map(s => s.id === session.subtaskId ? { ...s, timeSpentMinutes: (s.timeSpentMinutes || 0) + minutes } : s)
                : task.subtasks,
            }
          : task)
      : record.tasks;

    return {
      ...record,
      tasks: updatedTasks,
      preferences: {
        ...record.preferences,
        focusSession: readySession,
        focusCheckpointAt: at,
        focusLogs: newLogs,
      },
    };
  }, false);

  return { session: readySession, receipt };
}

/** One idempotent completion contract for UI, background runtime and assistant commands. */
export function finishWorkspaceFocus(
  store: WorkspaceStore,
  options: { abandon?: boolean; now?: number; expectedSessionId?: string } = {}
): number {
  requireWritable(store);
  const session = store.getSnapshot().record.preferences.focusSession as FocusSession | null;
  if (!session || (session.workspaceId && session.workspaceId !== store.id)) return 0;
  if (options.expectedSessionId && session.id !== options.expectedSessionId) return 0;

  const now = options.now ?? Date.now();
  const seconds = options.abandon ? 0 : elapsedFocusSeconds(session, now);
  const finishedAt = session.finishedAt || now;
  const finished: FocusSession = {
    ...session,
    finishedAt,
    state: 'completed',
    accumulatedElapsedMs: seconds * 1000,
    totalPausedMs: (session.totalPausedMs || 0) + (session.state === 'paused' ? Math.max(0, finishedAt - (session.pausedAt || finishedAt)) : 0),
  };
  const at = writeFocusCheckpoint(store.id, seconds > 0 ? finished : null, seconds > 0);
  store.run('Finish focus session', record => {
    const logs = (record.preferences.focusLogs || []) as FocusLog[];
    if (seconds <= 0 || logs.some(log => log.id === session.id)) {
      return { ...record, preferences: { ...record.preferences, focusSession: null, focusCheckpointAt: at } };
    }
    const log: FocusLog = {
      id: session.id,
      seconds,
      taskId: session.taskId,
      taskTitle: session.taskTitle,
      subtaskId: session.subtaskId,
      subtaskTitle: session.subtaskTitle,
      mode: session.mode,
      startedAt: session.originalStartedAt || session.startedAt,
      endedAt: finishedAt,
      phase: session.pomodoroPhase || 'focus',
      recipeId: session.recipeId,
      outcome: session.outcome || 'interrupted',
      rating: session.rating,
      pausedSeconds: pausedSeconds(session, now),
    };
    const minutes = session.pomodoroPhase && session.pomodoroPhase !== 'focus' ? 0 : seconds / 60;
    const studio = record.preferences.studio as { sceneId: string; favorites?: string[]; shuffleAtBoundary?: boolean } | undefined;
    const choices = studio?.shuffleAtBoundary ? (studio.favorites || []).filter(id => id !== studio.sceneId) : [];
    return {
      ...record,
      tasks: record.tasks.map(task => task.id === session.taskId
        ? {
            ...task,
            timeSpentMinutes: (task.timeSpentMinutes || 0) + minutes,
            subtasks: session.subtaskId
              ? task.subtasks.map(subtask => subtask.id === session.subtaskId ? { ...subtask, timeSpentMinutes: (subtask.timeSpentMinutes || 0) + minutes } : subtask)
              : task.subtasks,
          }
        : task),
      preferences: {
        ...record.preferences,
        focusSession: null,
        focusCheckpointAt: at,
        focusLogs: [...logs, log],
        ...(session.timerConfiguration ? { studioLastSession: { session: { ...finished, outcome: session.outcome || 'interrupted' }, seconds, ...nextStudioPhase(session), finishedAt } } : {}),
        ...(choices.length ? { studio: { ...studio, sceneId: choices[Math.floor(Math.random() * choices.length)] } } : {}),
      },
    };
  }, false);
  return seconds;
}
