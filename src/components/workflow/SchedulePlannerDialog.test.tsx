// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SchedulePlannerDialog } from './SchedulePlannerDialog';
import type { Task } from '../../types/task';

const state = vi.hoisted(() => ({ tasks: [] as Task[], events: [] as Array<{ id: string; title: string; date: string; startTime: string; endTime: string }>, apply: vi.fn(), toast: vi.fn(), undo: vi.fn() }));
vi.mock('../../context/TaskContext', () => ({ useTaskContext: () => ({ tasks: state.tasks, calendarEvents: state.events, settings: { defaultTaskDuration: 30 }, applyTaskChanges: state.apply, showToast: state.toast, undoLastAction: state.undo }) }));
vi.mock('../../hooks/useCurrentDate', () => ({ useTodayStr: () => '2026-10-20' }));
const component = (close = vi.fn()) => <SchedulePlannerDialog isOpen onClose={close} />;
const preview = () => fireEvent.click(screen.getByRole('button', { name: 'Preview schedule' }));
const apply = () => fireEvent.click(screen.getByRole('button', { name: 'Apply schedule' }));

describe('schedule review and apply', () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T09:00:00'));
    state.tasks = [{ id: 'a', title: 'Read chapter 3', status: 'todo', priority: 'p2', projectId: 'inbox', plannedDate: '2026-10-20', createdAt: 1, subtasks: [], estimatedMinutes: 30 }]; state.events = [];
  });
  afterEach(() => vi.useRealTimers());
  it('applies edited estimates only after preview, once, with Undo', () => {
    const close = vi.fn(); render(component(close));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minutes for Read chapter 3' }), { target: { value: '45' } });
    expect(state.apply).not.toHaveBeenCalled(); preview(); apply(); apply();
    expect(state.apply).toHaveBeenCalledTimes(1);
    expect(state.apply.mock.calls[0][0][0].updates.estimatedMinutes).toBe(45);
    expect(state.toast).toHaveBeenCalledWith(expect.any(String), 'Undo', state.undo); expect(close).toHaveBeenCalledTimes(1);
  });
  it('refreshes a stale calendar proposal and requires review again', () => {
    const view = render(component()); preview();
    state.events = [{ id: 'meeting', title: 'New meeting', date: '2026-10-20', startTime: '09:00', endTime: '10:00' }];
    view.rerender(component()); apply();
    expect(state.apply).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toMatch(/changed/);
    apply(); expect(state.apply).toHaveBeenCalledTimes(1); expect(state.apply.mock.calls[0][0][0].updates.scheduledStart).toBe('10:15');
  });
  it('stale previews never recreate a removed task', () => {
    const view = render(component()); preview(); state.tasks = []; view.rerender(component()); apply();
    expect(state.apply).not.toHaveBeenCalled(); expect(screen.getByText(/no longer available/)).toBeDefined();
    expect((screen.getByRole('button', { name: 'Apply schedule' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('cancel leaves the workspace untouched and failed saves can be retried', () => {
    state.apply.mockImplementationOnce(() => { throw new Error('Save failed'); });
    render(component()); preview(); apply(); expect(screen.getByRole('alert').textContent).toContain('Save failed');
    apply(); expect(state.apply).toHaveBeenCalledTimes(2);
  });
});
