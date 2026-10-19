import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { TaskProvider, useTaskContext } from './TaskContext';
import { dbService, emptyWorkspace } from '../services/dbService';
import { useFocusStore } from '../store/useFocusStore';
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
beforeEach(() => {
  localStorage.clear(); useFocusStore.getState().setFocusSession(null);
  const record = emptyWorkspace('local');
  record.tasks = ['original', 'urgent'].map(id => ({ id, title: id, projectId: 'inbox', status: 'todo', priority: 'p3', subtasks: [], createdAt: 1 }));
  vi.spyOn(dbService, 'ensureLegacyMigrated').mockResolvedValue(record);
  vi.spyOn(dbService, 'saveWorkspace').mockResolvedValue();
});
afterEach(async () => {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  cleanup(); vi.restoreAllMocks();
});
async function ready() {
  const hook = renderHook(() => useTaskContext(), { wrapper: TaskProvider });
  await waitFor(() => expect(hook.result.current?.workspaceId).toBe('local'));
  return hook.result;
}
it('keeps saved interruption context when another session prevents restoration', async () => {
  const result = await ready();
  act(() => { result.current.startFocusSession('stopwatch', 'original'); result.current.stashActiveFocus(); result.current.startFocusSession('stopwatch', 'urgent'); });
  const session = result.current.focusSession!.id;
  act(() => result.current.restoreStashedFocus());
  expect(result.current.focusSession?.id).toBe(session);
  expect(result.current.interruptionStash?.taskId).toBe('original');
});
it('restores the original task once the current session has been explicitly finished', async () => {
  const result = await ready();
  act(() => { result.current.startFocusSession('stopwatch', 'original'); result.current.stashActiveFocus(); result.current.startFocusSession('stopwatch', 'urgent'); });
  act(() => { result.current.stopFocusSession(); result.current.restoreStashedFocus(); });
  expect(result.current.focusSession?.taskId).toBe('original');
  expect(result.current.interruptionStash).toBeNull();
});
