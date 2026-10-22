import type { FocusLog, FocusSession, FocusSessionMode } from '../types/task';
import { DEFAULT_TIMER } from '../types/studio';
import type { TimerConfiguration } from '../types/studio';
import type { WorkspaceStore } from './workspaceStore';
import { writeFocusCheckpoint } from './focusCheckpoint';
import { nextStudioPhase, pausedSeconds } from './studioSessionEngine';

export interface FocusStartInput {
  mode: FocusSessionMode;
  taskId?: string | null;
  taskTitle?: string | null;
  targetDurationSec?: number;
  subtaskId?: string | null;
  subtaskTitle?: string | null;
  pacingSecondsPerUnit?: number;
  timerConfiguration?: TimerConfiguration;
}
function requireWritable(store: WorkspaceStore) {
  const snapshot = store.getSnapshot();
  if (!snapshot.ready) throw new Error('Wait for the workspace to finish loading.');
  if (snapshot.readOnly) throw new Error('This tab is a read-only preview. Choose Use this tab to make changes.');
}
export function createFocusSession(input: FocusStartInput, workspaceId?: string, now = Date.now()): FocusSession {
  if (!['stopwatch', 'pomodoro', 'sprint', 'countdown'].includes(input.mode)) throw new Error('Choose a supported focus mode.');
  const target = input.targetDurationSec ?? (input.mode === 'stopwatch' ? 0 : 1500);
  if (!Number.isFinite(target) || target < 0 || target > 86400) throw new Error('Choose a focus duration between zero and 24 hours.');
  const timerConfiguration = { ...DEFAULT_TIMER, focusMinutes: target / 60, ...input.timerConfiguration, mode: input.mode };
  if (target > 0 && (['focusMinutes', 'shortBreakMinutes', 'longBreakMinutes'] as const).some(key => !Number.isFinite(timerConfiguration[key]) || timerConfiguration[key] <= 0 || timerConfiguration[key] > 1440)) throw new Error('Choose timer intervals between one second and 24 hours.');
  if (!Number.isInteger(timerConfiguration.cyclesBeforeLongBreak) || timerConfiguration.cyclesBeforeLongBreak < 1 || timerConfiguration.cyclesBeforeLongBreak > 100 || typeof timerConfiguration.autoStart !== 'boolean') throw new Error('Choose valid timer cycle and automatic start settings.');
  return {
    id: crypto.randomUUID(), workspaceId, mode: input.mode, taskId: input.taskId || null,
    taskTitle: input.taskTitle || 'Focus session', subtaskId: input.subtaskId || undefined, subtaskTitle: input.subtaskTitle || undefined,
    startedAt: now, originalStartedAt: now, accumulatedElapsedMs: 0, targetDurationSec: target,
    state: 'running', pomodoroCycle: 1, pomodoroPhase: 'focus', loggedSegments: [], bankedSeconds: 0,
    pacingSecondsPerUnit: input.pacingSecondsPerUnit || undefined,
    ...(target > 0 ? { timerConfiguration } : {}),
  };
}
export function startWorkspaceFocus(store: WorkspaceStore, input: FocusStartInput): FocusSession {
  requireWritable(store);
  const record = store.getSnapshot().record;
  if (record.preferences.focusSession) throw new Error('Return to your current focus session, or finish it before starting another.');
  if (input.taskId && !record.tasks.some(task => task.id === input.taskId && !task.deletedAt)) throw new Error('Choose an available task before starting focus.');
  const session = createFocusSession(input, store.id);
  const at = writeFocusCheckpoint(store.id, session);
  store.run('Start focus session', current => ({ ...current, preferences: { ...current.preferences, focusSession: session, focusCheckpointAt: at } }), false);
  return session;
}
export function isFocusComplete(session: FocusSession, now = Date.now()): boolean {
  return ['pomodoro', 'countdown'].includes(session.mode) && session.state === 'running' && session.targetDurationSec > 0 &&
    session.accumulatedElapsedMs + Math.max(0, now - session.startedAt) >= session.targetDurationSec * 1000;
}

export function elapsedFocusSeconds(session: FocusSession, now = Date.now()): number {
  const elapsed = Math.floor((session.accumulatedElapsedMs + (session.state === 'running' ? Math.max(0, now - session.startedAt) : 0)) / 1000);
  return Math.max(0, ['pomodoro', 'countdown'].includes(session.mode) && session.targetDurationSec > 0 ? Math.min(session.targetDurationSec, elapsed) : elapsed);
}

export function changeWorkspaceFocusState(store: WorkspaceStore, state: 'paused' | 'running', now = Date.now()): FocusSession | null {
  requireWritable(store);
  const session = store.getSnapshot().record.preferences.focusSession as FocusSession | null;
  if (!session || session.state === state || session.state === 'completed') return session;
  const updated: FocusSession = state === 'paused'
    ? { ...session, state, pausedAt: now, accumulatedElapsedMs: session.accumulatedElapsedMs + Math.max(0, now - session.startedAt) }
    : { ...session, state, startedAt: now, pausedAt: null, totalPausedMs: (session.totalPausedMs || 0) + Math.max(0, now - (session.pausedAt || now)) };
  const at = writeFocusCheckpoint(store.id, updated);
  store.run(state === 'paused' ? 'Pause focus session' : 'Resume focus session', record => ({ ...record, preferences: { ...record.preferences, focusSession: updated, focusCheckpointAt: at } }), false);
  return updated;
}

/** One idempotent completion contract for UI, background runtime and assistant commands. */
export function finishWorkspaceFocus(store: WorkspaceStore, options: { abandon?: boolean; now?: number } = {}): number {
  requireWritable(store);
  const session = store.getSnapshot().record.preferences.focusSession as FocusSession | null;
  if (!session || (session.workspaceId && session.workspaceId !== store.id)) return 0;
  const now = options.now ?? Date.now();
  const seconds = options.abandon ? 0 : elapsedFocusSeconds(session, now);
  const finishedAt = session.finishedAt || now;
  const finished: FocusSession = { ...session, finishedAt, state: 'completed', accumulatedElapsedMs: seconds * 1000,
    totalPausedMs: (session.totalPausedMs || 0) + (session.state === 'paused' ? Math.max(0, finishedAt - (session.pausedAt || finishedAt)) : 0) };
  const at = writeFocusCheckpoint(store.id, seconds > 0 ? finished : null, seconds > 0);
  store.run('Finish focus session', record => {
    const logs = (record.preferences.focusLogs || []) as FocusLog[];
    if (seconds <= 0 || logs.some(log => log.id === session.id)) return { ...record, preferences: { ...record.preferences, focusSession: null, focusCheckpointAt: at } };
    const log: FocusLog = { id: session.id, seconds, taskId: session.taskId, taskTitle: session.taskTitle, subtaskId: session.subtaskId, subtaskTitle: session.subtaskTitle,
      mode: session.mode, startedAt: session.originalStartedAt || session.startedAt, endedAt: finishedAt, phase: session.pomodoroPhase || 'focus', recipeId: session.recipeId,
      outcome: session.outcome || 'interrupted', rating: session.rating, pausedSeconds: pausedSeconds(session, now) };
    const minutes = session.pomodoroPhase && session.pomodoroPhase !== 'focus' ? 0 : seconds / 60;
    const studio = record.preferences.studio as { sceneId: string; favorites?: string[]; shuffleAtBoundary?: boolean } | undefined;
    const choices = studio?.shuffleAtBoundary ? (studio.favorites || []).filter(id => id !== studio.sceneId) : [];
    return { ...record,
      tasks: record.tasks.map(task => task.id === session.taskId ? { ...task, timeSpentMinutes: (task.timeSpentMinutes || 0) + minutes,
        subtasks: session.subtaskId ? task.subtasks.map(subtask => subtask.id === session.subtaskId ? { ...subtask, timeSpentMinutes: (subtask.timeSpentMinutes || 0) + minutes } : subtask) : task.subtasks } : task),
      preferences: { ...record.preferences, focusSession: null, focusCheckpointAt: at, focusLogs: [...logs, log],
        ...(session.timerConfiguration ? { studioLastSession: { session: { ...finished, outcome: session.outcome || 'interrupted' }, seconds, ...nextStudioPhase(session), finishedAt } } : {}),
        ...(choices.length ? { studio: { ...studio, sceneId: choices[Math.floor(Math.random() * choices.length)] } } : {}),
      } };
  }, false);
  return seconds;
}
