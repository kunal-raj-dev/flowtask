import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTaskAvailabilityClock } from './useTaskAvailabilityClock';
import { getTaskEligibility } from '../utils/taskEligibility';
import type { Task } from '../types/task';

afterEach(() => vi.useRealTimers());
const task: Task = { id: 'a', title: 'Later', status: 'todo', priority: 'p3', projectId: 'inbox', subtasks: [], createdAt: 1, deferUntil: '2026-10-25T10:00:00Z' };
it('makes a deferred task available at its boundary without an unrelated workspace edit', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T09:59:00Z'));
  const tasks = [task];
  const { result, unmount } = renderHook(() => getTaskEligibility(task, { tasks, now: useTaskAvailabilityClock(tasks) }));
  expect(result.current.reason).toBe('deferred');
  act(() => vi.advanceTimersByTime(60_002));
  expect(result.current.actionable).toBe(true);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it('reconciles on return from a sleeping tab', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T09:00:00Z'));
  const tasks = [task];
  const { result } = renderHook(() => useTaskAvailabilityClock(tasks));
  act(() => { vi.setSystemTime(new Date('2026-10-25T11:00:00Z')); window.dispatchEvent(new Event('focus')); });
  expect(getTaskEligibility(task, { tasks, now: result.current }).actionable).toBe(true);
});
it('keeps one timer when a consumer recreates its task array', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T09:00:00Z'));
  const { rerender, unmount } = renderHook(() => useTaskAvailabilityClock([{ ...task }]));
  for (let i = 0; i < 5; i++) rerender();
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
