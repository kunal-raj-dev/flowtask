// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecoveryView } from './RecoveryView';

const mockRestoreTask = vi.fn();
const mockPermanentDeleteTask = vi.fn();
const mockUpdateProject = vi.fn();
const mockDownloadWorkspaceBackup = vi.fn();
const mockShowToast = vi.fn();

const sampleTasks = [
  {
    id: 'trash-1',
    title: 'Deleted Task One',
    status: 'todo' as const,
    priority: 'high' as const,
    projectId: 'inbox',
    deletedAt: Date.now() - 10000,
    createdAt: Date.now() - 50000,
    subtasks: [],
  },
  {
    id: 'trash-2',
    title: 'Deleted Task Two',
    status: 'todo' as const,
    priority: 'low' as const,
    projectId: 'proj-1',
    deletedAt: Date.now() - 5000,
    createdAt: Date.now() - 40000,
    subtasks: [],
  },
  {
    id: 'arch-1',
    title: 'Archived Task Alpha',
    status: 'done' as const,
    priority: 'medium' as const,
    projectId: 'inbox',
    archivedAt: Date.now() - 8000,
    createdAt: Date.now() - 60000,
    subtasks: [],
  },
  {
    id: 'active-1',
    title: 'Active Task Beta',
    status: 'todo' as const,
    priority: 'high' as const,
    projectId: 'inbox',
    createdAt: Date.now() - 10000,
    subtasks: [],
  },
];

const sampleProjects = [
  {
    id: 'proj-1',
    name: 'Work Project',
    color: '#3b82f6',
    isArchived: false,
  },
  {
    id: 'proj-arch',
    name: 'Legacy Project',
    color: '#ec4899',
    isArchived: true,
    archivedAt: Date.now() - 20000,
  },
];

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: sampleTasks,
    projects: sampleProjects,
    restoreTask: mockRestoreTask,
    permanentDeleteTask: mockPermanentDeleteTask,
    updateProject: mockUpdateProject,
    downloadWorkspaceBackup: mockDownloadWorkspaceBackup,
    showToast: mockShowToast,
  }),
}));

describe('RecoveryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Trash mode', () => {
    it('renders trash header, deleted tasks, and actions', () => {
      render(<RecoveryView mode="trash" />);

      expect(screen.getByText('Trash & Recovery')).toBeDefined();
      expect(screen.getByText('Deleted Task One')).toBeDefined();
      expect(screen.getByText('Deleted Task Two')).toBeDefined();
      expect(screen.queryByText('Archived Task Alpha')).toBeNull();
      expect(screen.queryByText('Active Task Beta')).toBeNull();
    });

    it('triggers restoreTask when Restore button is clicked', () => {
      render(<RecoveryView mode="trash" />);

      const restoreButtons = screen.getAllByRole('button', { name: /restore/i });
      // Click restore on the first task
      fireEvent.click(restoreButtons[1]); // button 0 is 'Restore All'

      expect(mockRestoreTask).toHaveBeenCalledWith('trash-1');
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Deleted Task One'));
    });

    it('prompts confirmation dialog and executes permanent deletion', () => {
      render(<RecoveryView mode="trash" />);

      const deleteButtons = screen.getAllByRole('button', { name: /permanently delete/i });
      fireEvent.click(deleteButtons[0]);

      // Confirmation dialog should be open
      expect(screen.getByText(/permanently delete task\?/i)).toBeDefined();

      // Click "Delete forever" inside dialog
      const confirmButton = screen.getAllByRole('button', { name: /delete forever/i }).slice(-1)[0];
      fireEvent.click(confirmButton);

      expect(mockPermanentDeleteTask).toHaveBeenCalledWith('trash-1');
      expect(mockShowToast).toHaveBeenCalledWith('Task permanently deleted');
    });

    it('supports workspace backup and restore all', () => {
      render(<RecoveryView mode="trash" />);

      const backupBtn = screen.getByRole('button', { name: /backup workspace/i });
      fireEvent.click(backupBtn);
      expect(mockDownloadWorkspaceBackup).toHaveBeenCalled();

      const restoreAllBtn = screen.getByRole('button', { name: /restore all/i });
      fireEvent.click(restoreAllBtn);
      expect(mockRestoreTask).toHaveBeenCalledWith('trash-1');
      expect(mockRestoreTask).toHaveBeenCalledWith('trash-2');
    });

    it('filters tasks based on search input', () => {
      render(<RecoveryView mode="trash" />);

      const searchInput = screen.getByPlaceholderText(/search deleted tasks/i);
      fireEvent.change(searchInput, { target: { value: 'Task Two' } });

      expect(screen.queryByText('Deleted Task One')).toBeNull();
      expect(screen.getByText('Deleted Task Two')).toBeDefined();
    });
  });

  describe('Archive mode', () => {
    it('renders archive header, archived tasks, and archived projects', () => {
      render(<RecoveryView mode="archive" />);

      expect(screen.getByText('Workspace Archive')).toBeDefined();
      expect(screen.getByText('Archived Task Alpha')).toBeDefined();
      expect(screen.getAllByText('Legacy Project').length).toBeGreaterThan(0);
      expect(screen.queryByText('Deleted Task One')).toBeNull();
    });

    it('restores archived project when button clicked', () => {
      render(<RecoveryView mode="archive" />);

      const restoreProjBtn = screen.getByRole('button', { name: /restore project legacy project/i });
      fireEvent.click(restoreProjBtn);

      expect(mockUpdateProject).toHaveBeenCalledWith('proj-arch', {
        isArchived: false,
        archivedAt: undefined,
      });
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Legacy Project'));
    });
  });
});
