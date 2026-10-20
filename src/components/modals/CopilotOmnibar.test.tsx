// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopilotOmnibar } from './CopilotOmnibar';
import type { Task } from '../../types/task';

const state = vi.hoisted(() => ({ tasks: [] as Task[], session: null as null | { state: string; taskTitle: string }, add: vi.fn(), apply: vi.fn(), toast: vi.fn(), undo: vi.fn(), start: vi.fn(), resume: vi.fn(), modal: vi.fn(), execute: vi.fn() }));
vi.mock('../../context/TaskContext', () => ({ useTaskContext: () => ({ tasks: state.tasks, projects: [{ id: 'inbox', name: 'Inbox' }], settings: { defaultTaskDuration: 30 }, calendarEvents: [], focusSession: state.session, addTask: state.add, applyTaskChanges: state.apply, showToast: state.toast, undoLastAction: state.undo, startFocusSession: state.start, resumeFocusSession: state.resume }) }));
vi.mock('../../hooks/useCurrentDate', () => ({ useTodayStr: () => '2026-10-20' }));
vi.mock('../../store/useModalStore', () => ({ useModalStore: { getState: () => ({ openModal: state.modal }) } }));
vi.mock('../../services/webMcpService', () => ({ executeWebMcpTool: (...args: unknown[]) => state.execute(...args) }));
const open = () => render(<CopilotOmnibar isOpen onClose={vi.fn()} />);
const command = (value: string) => { fireEvent.change(screen.getByRole('textbox', { name: 'Copilot command' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: 'Use command' })); };
const task = (): Task => ({ id: 'existing', title: 'Prepare presentation', status: 'todo', priority: 'p2', projectId: 'inbox', createdAt: 1, subtasks: [{ id: 'old', title: 'Keep this step', completed: true }], estimatedMinutes: 30 });

describe('local Copilot', () => {
  beforeEach(() => { vi.resetAllMocks(); state.tasks = [task()]; state.session = null; });
  it('shows five clear actions and supported command help', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'FlowTask Copilot' })).toBeDefined();
    for (const name of ['Add task', 'Break into steps', 'Plan / schedule day', 'Start focus', 'Daily summary']) expect(screen.getByRole('button', { name })).toBeDefined();
    expect(screen.getByText('Supported commands')).toBeDefined();
  });
  it('does not render when closed', () => {
    const { container } = render(<CopilotOmnibar isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
  it('unknown task text never starts a focus session or silently creates a breakdown', () => {
    open(); command('Fix background focus timer');
    expect(screen.getByRole('alert').textContent).toMatch(/Choose an action/);
    expect(state.start).not.toHaveBeenCalled(); expect(state.add).not.toHaveBeenCalled();
  });
  it('saves edited subtasks, starter action and estimates as one new task after preview', () => {
    open(); command('decompose Fix login bug');
    fireEvent.change(screen.getByRole('textbox', { name: 'Step 1 title' }), { target: { value: 'Reproduce with expired token' } });
    expect((screen.getByRole('button', { name: 'Add task with subtasks' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Preview task' }));
    const apply = screen.getByRole('button', { name: 'Add task with subtasks' });
    fireEvent.click(apply); fireEvent.click(apply);
    expect(state.add).toHaveBeenCalledTimes(1);
    expect(state.add).toHaveBeenCalledWith('Fix login bug', expect.objectContaining({ plannedDate: '2026-10-20', nextAction: expect.stringContaining('2-Min Starter'), estimatedMinutes: 70, subtasks: expect.arrayContaining([expect.objectContaining({ title: 'Reproduce with expired token', completed: false, id: expect.any(String), estimatedMinutes: 15 })]) }));
    expect(state.toast).toHaveBeenCalledWith(expect.any(String), 'Undo', state.undo);
  });
  it('appends to an existing task without losing completed steps', () => {
    open(); fireEvent.click(screen.getByRole('button', { name: 'Break into steps' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Task to break down' }), { target: { value: 'existing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suggest steps' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add steps to task' }));
    expect(state.add).not.toHaveBeenCalled();
    expect(state.apply).toHaveBeenCalledTimes(1);
    const changes = state.apply.mock.calls[0][0];
    expect(changes[0].updates.subtasks[0]).toEqual(task().subtasks[0]);
    expect(changes[0].updates.subtasks).toHaveLength(5);
  });
  it('rejects stale existing-task previews and keeps concurrent subtasks', () => {
    const view = open(); fireEvent.click(screen.getByRole('button', { name: 'Break into steps' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Task to break down' }), { target: { value: 'existing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suggest steps' })); fireEvent.click(screen.getByRole('button', { name: 'Preview task' }));
    state.tasks = [{ ...task(), subtasks: [...task().subtasks, { id: 'new', title: 'Concurrent step', completed: false }] }];
    view.rerender(<CopilotOmnibar isOpen onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add steps to task' }));
    expect(state.apply).not.toHaveBeenCalled(); expect(screen.getByRole('alert').textContent).toMatch(/changed/);
    fireEvent.click(screen.getByRole('button', { name: 'Preview task' })); fireEvent.click(screen.getByRole('button', { name: 'Add steps to task' }));
    expect(state.apply.mock.calls[0][0][0].updates.subtasks.some((s: { id: string }) => s.id === 'new')).toBe(true);
  });
  it('shows save failures and allows retry without losing edits', () => {
    state.add.mockImplementationOnce(() => { throw new Error('Storage unavailable'); });
    open(); command('add Read chapter 3'); fireEvent.click(screen.getByRole('button', { name: 'Preview task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add task to workspace' }));
    expect(screen.getByRole('alert').textContent).toContain('Storage unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Add task to workspace' })); expect(state.add).toHaveBeenCalledTimes(2);
  });
  it('links focus to a real task and opens Studio', () => {
    open(); command('focus 45m on Prepare presentation');
    fireEvent.click(screen.getByRole('button', { name: 'Start focus session' }));
    expect(state.start).toHaveBeenCalledWith('pomodoro', 'existing', 'Prepare presentation', 2700);
    expect(state.modal).toHaveBeenCalledWith('pomodoro');
  });
  it('resumes an existing focus session instead of replacing it', () => {
    state.session = { state: 'paused', taskTitle: 'Current work' }; open(); fireEvent.click(screen.getByRole('button', { name: 'Start focus' })); fireEvent.click(screen.getByRole('button', { name: 'Resume focus' }));
    expect(state.resume).toHaveBeenCalledTimes(1); expect(state.start).not.toHaveBeenCalled();
  });
  it('loads daily summary with a visible retry after failure', async () => {
    state.execute.mockRejectedValueOnce(new Error('Not ready')).mockResolvedValueOnce({ totalTasks: 8, completedTasks: 6, completionRate: 75, topThreeCount: 3, topThreeCompleted: 3, focusedSeconds: 5400 });
    open(); fireEvent.click(screen.getByRole('button', { name: 'Daily summary' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Not ready'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry summary' }));
    await waitFor(() => expect(screen.getByText('75%')).toBeDefined());
    expect(screen.getByText('3 / 3')).toBeDefined();
  });
});
