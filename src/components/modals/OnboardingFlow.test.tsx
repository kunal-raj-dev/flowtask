import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OnboardingFlow } from './OnboardingFlow';
const mocks = vi.hoisted(() => ({ add: vi.fn(() => ({ id: 'first-task' })), settings: vi.fn(), start: vi.fn(), update: vi.fn(), open: vi.fn(), active: null as null | { taskId: string } }));
vi.mock('../../context/TaskContext', () => ({ useTaskContext: () => ({ addTask: mocks.add, updateSettings: mocks.settings, startFocusSession: mocks.start, updateFocusSession: mocks.update, focusSession: mocks.active, workspacePreferences: {} }) }));
vi.mock('../../context/ModalContext', () => ({ useModal: () => ({ openModal: mocks.open }) }));
vi.mock('../../hooks/useCurrentDate', () => ({ useTodayStr: () => '2026-10-19' }));
describe('first-task introduction', () => {
 beforeEach(() => { vi.clearAllMocks(); mocks.active = null; });
 it('does not block the planner with a dialog in inline mode', () => {
  render(<OnboardingFlow inline isOpen onClose={vi.fn()}/>);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Your first task' })).toBeDefined();
 });
 it('creates one task, then starts only after an explicit focus action', () => {
  const close = vi.fn(); render(<OnboardingFlow inline isOpen onClose={close}/>);
  fireEvent.change(screen.getByLabelText('Your first task'), { target: { value: 'Read chapter one' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  expect(mocks.add).toHaveBeenCalledExactlyOnceWith('Read chapter one', { plannedDate: '2026-10-19', isPinnedToday: true, topThreeDate: '2026-10-19' });
  expect(mocks.start).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Start 25-minute focus' }));
  expect(mocks.start).toHaveBeenCalledExactlyOnceWith('pomodoro', 'first-task', undefined, 1500);
  expect(mocks.open).toHaveBeenCalledWith('pomodoro', { taskId: 'first-task' });
  expect(mocks.settings).toHaveBeenCalledWith({ onboardingCompleted: true }); expect(close).toHaveBeenCalledOnce();
 });
 it('can dismiss without creating work or changing existing preferences', () => {
  const close = vi.fn(); render(<OnboardingFlow inline isOpen onClose={close}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Explore on my own' }));
  expect(mocks.add).not.toHaveBeenCalled(); expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.settings).toHaveBeenCalledExactlyOnceWith({ onboardingCompleted: true });
 });
 it('preserves a session that is already running', () => {
  mocks.active = { taskId: 'existing' }; render(<OnboardingFlow inline isOpen onClose={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Your first task'), { target: { value: 'Another task' } }); fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  fireEvent.click(screen.getByRole('button', { name: 'Return to focus' }));
  expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.open).toHaveBeenCalledWith('pomodoro', { taskId: 'existing' });
 });
});
