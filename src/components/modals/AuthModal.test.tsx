import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthModal } from './AuthModal';
import { TaskContext, type TaskContextType } from '../../context/TaskContext';
import * as AuthContextModule from '../../context/AuthContext';

vi.mock('../../lib/firebase', () => ({
  isFirebaseConfigured: true,
}));

describe('AuthModal Component', () => {
  const mockSignInWithGoogle = vi.fn();
  const mockForceSyncToCloud = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (authUser: any = null, syncStatus = 'local') => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: authUser,
      loading: false,
      isAnonymous: false,
      isConfigured: true,
      signInWithGoogle: mockSignInWithGoogle,
      signInWithGoogleRedirect: vi.fn(),
      signInAsGuest: vi.fn(),
      signOutUser: vi.fn(),
      authError: null,
      authErrorCode: null,
      clearAuthError: vi.fn(),
    });

    const mockContext = {
      syncStatus,
      lastSyncedAt: null,
      forceSyncToCloud: mockForceSyncToCloud,
      tasks: [{ id: 't1', title: 'Task 1', status: 'todo', priority: 'p1', projectId: 'inbox', subtasks: [] }],
      projects: [{ id: 'inbox', name: 'Inbox', color: '#10b981', order: 0, createdAt: 0, updatedAt: 0 }],
      importLocalWorkspace: vi.fn(),
      showToast: vi.fn(),
      downloadWorkspaceBackup: vi.fn(),
    } as unknown as TaskContextType;

    return render(
      <TaskContext.Provider value={mockContext}>
        <AuthModal isOpen={true} onClose={mockOnClose} />
      </TaskContext.Provider>
    );
  };

  it('renders Local Mode status and provides actionable "Sign in to sync" button when not logged in', () => {
    renderModal(null, 'local');

    expect(screen.getByText('Account & Backups')).toBeTruthy();
    expect(screen.getByText('Saved on Device (Local)')).toBeTruthy();
    expect(screen.getByText('1 tasks')).toBeTruthy();
    expect(screen.getByText('1 projects')).toBeTruthy();

    const syncButton = screen.getByRole('button', { name: /Sign in to sync/i });
    expect(syncButton).toBeTruthy();

    fireEvent.click(syncButton);
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('renders user details and "Sync Now" button when logged in with Google account', () => {
    const mockUser = {
      uid: 'user-12345',
      displayName: 'Kunal Raj',
      email: 'kunal@example.com',
      photoURL: null,
      isAnonymous: false,
    };

    renderModal(mockUser, 'synced');

    expect(screen.getByText('Kunal Raj')).toBeTruthy();
    expect(screen.getByText('kunal@example.com')).toBeTruthy();

    const syncButton = screen.getByRole('button', { name: /Sync Now/i });
    expect(syncButton).toBeTruthy();

    fireEvent.click(syncButton);
    expect(mockForceSyncToCloud).toHaveBeenCalledTimes(1);
  });
});
