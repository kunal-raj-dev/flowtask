import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceRecoveryNotice } from './WorkspaceRecoveryNotice';
import { AuthModal } from '../modals/AuthModal';

const state = vi.hoisted(() => ({ error: 'A cloud update has incomplete task relationships. Your last valid workspace is preserved.' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock('../../context/TaskContext', () => ({ useTaskContext: () => ({ syncStatus: 'synced', tasks: [], projects: [], downloadWorkspaceBackup: vi.fn() }) }));
vi.mock('../../services/workspaceStore', () => ({ useWorkspaceSelector: (select: (value: { recoveryError: string }) => unknown) => select({ recoveryError: state.error }) }));
afterEach(cleanup);

it('dismisses the notice and stays dismissed when the same issue rerenders', () => {
  const download = vi.fn();
  const { rerender } = render(<WorkspaceRecoveryNotice error={state.error} download={download} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download backup' }));
  expect(download).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss recovery notice' }));
  rerender(<WorkspaceRecoveryNotice error={state.error} download={download} />);
  expect(screen.queryByRole('status')).toBeNull();
});

it('shows a new warning or workspace instead of carrying dismissal across account boundaries', () => {
  const renderNotice = (id: string, error: string) => <WorkspaceRecoveryNotice key={`${id}:${error}`} error={error} download={vi.fn()} />;
  const { rerender } = render(renderNotice('account-a', state.error));
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss recovery notice' }));
  rerender(renderNotice('account-a', 'Device storage is full. Download a backup.'));
  expect(screen.getByRole('status').textContent).toContain('Device storage is full');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss recovery notice' }));
  rerender(renderNotice('account-b', state.error));
  expect(screen.getByRole('status').textContent).toContain(state.error);
});

it('keeps the issue available in account details after dismissing the popup', () => {
  const content = (open: boolean) => <><WorkspaceRecoveryNotice error={state.error} download={vi.fn()} /><AuthModal isOpen={open} onClose={vi.fn()} /></>;
  const { rerender } = render(content(false));
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss recovery notice' }));
  rerender(content(true));
  expect(screen.getByRole('dialog', { name: 'Account and sync' })).toBeTruthy();
  expect(screen.getByText(state.error)).toBeTruthy();
  expect(screen.getByText('Needs attention')).toBeTruthy();
  expect(screen.queryByText('Cloud Synced')).toBeNull();
});
