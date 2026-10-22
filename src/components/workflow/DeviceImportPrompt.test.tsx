// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeviceImportPrompt } from './DeviceImportPrompt';
import { dbService, emptyWorkspace } from '../../services/dbService';
import { useTaskStore } from '../../store/useTaskStore';

const state = vi.hoisted(() => ({ user: { email: 'account-a@example.test' } as { email: string } | null, ctx: {} as Record<string, any> }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../../context/TaskContext', () => ({ useTaskContext: () => state.ctx }));
beforeEach(() => {
  cleanup(); vi.restoreAllMocks();
  state.user = { email: 'account-a@example.test' };
  state.ctx = { workspaceId: 'account-a', syncStatus: 'synced', workspacePreferences: {}, importTasks: vi.fn().mockResolvedValue(undefined), setWorkspacePreference: vi.fn() };
  useTaskStore.setState({ workspaceId: 'account-a' });
  const local = emptyWorkspace('local');
  local.tasks = [{ id: 'local-task', title: 'Device work', priority: 'p2', status: 'todo', projectId: 'inbox', subtasks: [], createdAt: 1 }];
  vi.spyOn(dbService, 'loadWorkspace').mockResolvedValue(local);
});

it('shows the destination and waits for explicit import before calling the mutation', async () => {
  render(<DeviceImportPrompt/>);
  await screen.findByText('account-a@example.test');
  expect(state.ctx.importTasks).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Import device tasks' }));
  await waitFor(() => expect(state.ctx.importTasks).toHaveBeenCalledOnce());
  await waitFor(() => expect(state.ctx.setWorkspacePreference).toHaveBeenCalledWith('_deviceImportChoice', 'imported'));
});

it('keeps device tasks separate without uploading when the offer is declined', async () => {
  render(<DeviceImportPrompt/>); await screen.findByText('account-a@example.test');
  fireEvent.click(screen.getByRole('button', { name: 'Keep separate' }));
  expect(state.ctx.importTasks).not.toHaveBeenCalled();
  expect(state.ctx.setWorkspacePreference).toHaveBeenCalledWith('_deviceImportChoice', 'separate');
});

it('does not offer import before account hydration or after a saved choice', async () => {
  state.ctx.syncStatus = 'syncing';
  const { rerender } = render(<DeviceImportPrompt/>);
  expect(dbService.loadWorkspace).not.toHaveBeenCalled();
  state.ctx = { ...state.ctx, syncStatus: 'synced', workspacePreferences: { _deviceImportChoice: 'separate' } };
  rerender(<DeviceImportPrompt/>);
  expect(dbService.loadWorkspace).not.toHaveBeenCalled();
});

it('ignores a device read that resolves after sign-out', async () => {
  const local = await dbService.loadWorkspace('local');
  let resolve!: (record: typeof local) => void;
  vi.mocked(dbService.loadWorkspace).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const { rerender } = render(<DeviceImportPrompt/>);
  state.user = null; rerender(<DeviceImportPrompt/>);
  await act(async () => { resolve(local); });
  expect(screen.queryByRole('dialog')).toBeNull(); expect(state.ctx.importTasks).not.toHaveBeenCalled();
});
