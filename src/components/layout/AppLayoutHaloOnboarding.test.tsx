// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppLayout } from './AppLayout';
import type { Task } from '../../types/task';
import { useUIStore } from '../../store/useUIStore';

const mockOpenModal = vi.fn();
const mockCloseModal = vi.fn();
const mockUpdateTask = vi.fn();
const mockToggleTaskStatus = vi.fn();
const mockSetSelectedTaskId = vi.fn();

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};
(globalThis as any).localStorage = localStorageMock;

let mockSelectedTaskId: string | null = null;
let mockTasks: Task[] = [];
let mockSettings: any = {
  onboardingCompleted: true,
  keyboardHaloEnabled: true,
};
let mockSyncStatus = 'synced';

vi.mock('../../context/ModalContext', () => ({
  useModal: () => ({
    openModal: mockOpenModal,
    closeModal: mockCloseModal,
    isModalOpen: vi.fn().mockReturnValue(false),
    hasAnyModalOpen: false,
    activeModals: [],
  }),
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAnonymous: true,
  }),
}));

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    activeView: 'inbox',
    setActiveView: vi.fn(),
    selectedTaskId: mockSelectedTaskId,
    setSelectedTaskId: mockSetSelectedTaskId,
    selectedTaskIds: [],
    tasks: mockTasks,
    projects: [{ id: 'inbox', name: 'Inbox', color: '#64748B' }],
    smartViews: [],
    isAuthModalOpen: false,
    isSmartFilterModalOpen: false,
    isEveningShutdownOpen: false,
    isWeeklyReviewOpen: false,
    addTask: vi.fn(),
    undoLastAction: vi.fn(),
    redoLastAction: vi.fn(),
    isQuickAddOpen: false,
    setIsQuickAddOpen: vi.fn(),
    syncStatus: mockSyncStatus,
    setIsAuthModalOpen: vi.fn(),
    toggleTaskStatus: mockToggleTaskStatus,
    updateTask: mockUpdateTask,
    settings: mockSettings,
  }),
}));

vi.mock('../../hooks/useTactileAudioClicks', () => ({
  useTactileAudioClicks: vi.fn(),
}));

vi.mock('../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-16',
  useTomorrowStr: () => '2026-10-17',
  getTodayStr: () => '2026-10-16',
  getTomorrowStr: () => '2026-10-17',
}));

describe('AppLayout Universal Halo & Onboarding (BUG-13 & BUG-08)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    useUIStore.getState().setFocusedTaskId(null);
    mockSelectedTaskId = null;
    mockTasks = [
      {
        id: 'task-layout-1',
        title: 'Review PR Diff',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: 1000,
        subtasks: [],
      },
    ];
    mockSettings = {
      onboardingCompleted: true,
      keyboardHaloEnabled: true,
    };
    mockSyncStatus = 'synced';
  });

  it('does not render bottom keyboard halo dock when a task is selected', () => {
    mockSelectedTaskId = 'task-layout-1';
    render(<AppLayout />);

    expect(screen.queryByRole('button', { name: /keyboard shortcuts cheatsheet/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /dismiss keyboard halo dock/i })).toBeNull();
  });

  it('does not render bottom keyboard halo dock during focused task navigation', () => {
    mockSelectedTaskId = null;
    useUIStore.getState().setFocusedTaskId('task-layout-1');
    render(<AppLayout />);

    expect(screen.queryByRole('button', { name: /keyboard shortcuts cheatsheet/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /dismiss keyboard halo dock/i })).toBeNull();
  });

  it('keeps first-time navigation usable without automatically opening a setup dialog', () => {
    mockTasks = [];
    mockSettings = {
      onboardingCompleted: false,
      keyboardHaloEnabled: true,
    };
    render(<AppLayout />);

    expect(mockOpenModal).not.toHaveBeenCalledWith('onboarding');
  });
});
