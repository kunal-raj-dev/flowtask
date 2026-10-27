import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BackupReminder } from './BackupReminder';
import { TaskContext, type TaskContextType } from '../../context/TaskContext';

describe('BackupReminder', () => {
  afterEach(cleanup);

  it('does NOT render for a brand new workspace with fresh activity under 3 days old', () => {
    const mockContext = {
      workspacePreferences: { _lastBackupAt: 0, _backupReminderDismissedAt: 0 },
      tasks: [{ id: 'task-1', title: 'Done task', status: 'done', createdAt: Date.now() }],
      focusLogs: [],
      downloadWorkspaceBackup: vi.fn(),
      setWorkspacePreference: vi.fn(),
    } as unknown as TaskContextType;

    render(
      <TaskContext.Provider value={mockContext}>
        <BackupReminder />
      </TaskContext.Provider>
    );

    expect(screen.queryByLabelText('Keep a backup')).toBeNull();
  });

  it('renders for a workspace with older activity when backup is overdue', () => {
    const fourDaysAgo = Date.now() - 4 * 86400000;
    const downloadMock = vi.fn();
    const mockContext = {
      workspacePreferences: { _lastBackupAt: 0, _backupReminderDismissedAt: 0 },
      tasks: [{ id: 'task-1', title: 'Done task', status: 'done', createdAt: fourDaysAgo }],
      focusLogs: [],
      downloadWorkspaceBackup: downloadMock,
      setWorkspacePreference: vi.fn(),
    } as unknown as TaskContextType;

    render(
      <TaskContext.Provider value={mockContext}>
        <BackupReminder />
      </TaskContext.Provider>
    );

    expect(screen.getByLabelText('Keep a backup')).toBeTruthy();
    const downloadBtn = screen.getByRole('button', { name: 'Download backup' });
    fireEvent.click(downloadBtn);
    expect(downloadMock).toHaveBeenCalledOnce();
  });

  it('sets dismissal preference when Later is clicked', () => {
    const eightDaysAgo = Date.now() - 8 * 86400000;
    const setPrefMock = vi.fn();
    const mockContext = {
      workspacePreferences: { _lastBackupAt: eightDaysAgo, _backupReminderDismissedAt: 0 },
      tasks: [{ id: 'task-1', title: 'Done task', status: 'done', createdAt: eightDaysAgo }],
      focusLogs: [],
      downloadWorkspaceBackup: vi.fn(),
      setWorkspacePreference: setPrefMock,
    } as unknown as TaskContextType;

    render(
      <TaskContext.Provider value={mockContext}>
        <BackupReminder />
      </TaskContext.Provider>
    );

    const laterBtn = screen.getByRole('button', { name: 'Remind me about backups later' });
    fireEvent.click(laterBtn);
    expect(setPrefMock).toHaveBeenCalledWith('_backupReminderDismissedAt', expect.any(Number));
  });
});
