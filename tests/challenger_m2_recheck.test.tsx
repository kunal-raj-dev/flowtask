// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceTaskRow } from '../src/components/tasks/WorkspaceTaskRow';
import { TodayTimelineRail } from '../src/components/views/today/TodayTimelineRail';
import { HorizonTodayView } from '../src/components/views/today/HorizonTodayView';
import { AppShell } from '../src/components/layout/AppShell';
import type { Task, Priority } from '../src/types/task';

// Mocks
const mockUpdateTask = vi.fn();
const mockAddTask = vi.fn();
const mockToggleTaskStatus = vi.fn();
const mockToggleTaskPinToday = vi.fn();
const mockDeleteTask = vi.fn();
const mockBatchUpdateTasks = vi.fn();
const mockBatchDeleteTasks = vi.fn();
const mockShowToast = vi.fn();

let mockTasks: Task[] = [];
const mockSettings = { targetWorkCapacityHours: 6, enableSmartSyntaxParsing: true };

vi.mock('../src/context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: mockTasks,
    calendarEvents: [],
    projects: [{ id: 'inbox', name: 'Inbox', color: '#64748B' }],
    smartViews: [],
    selectedTaskIds: [],
    toggleTaskSelection: vi.fn(),
    clearTaskSelection: vi.fn(),
    workspacePreferences: {},
    workspaceId: 'local',
    settings: mockSettings,
    updateDashboards: vi.fn(),
    setWorkspacePreference: vi.fn(),
    updateTask: mockUpdateTask,
    addTask: mockAddTask,
    toggleTaskStatus: mockToggleTaskStatus,
    toggleTaskPinToday: mockToggleTaskPinToday,
    deleteTask: mockDeleteTask,
    batchUpdateTasks: mockBatchUpdateTasks,
    batchDeleteTasks: mockBatchDeleteTasks,
    showToast: mockShowToast,
    focusLogs: [],
    focusSession: null,
    totalFocusedTodaySeconds: 0,
  }),
}));

vi.mock('../src/hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-19',
  useTomorrowStr: () => '2026-10-20',
  getTodayStr: () => '2026-10-19',
  getTomorrowStr: () => '2026-10-20',
}));

vi.mock('../src/hooks/useTotalFocusedTodaySeconds', () => ({
  useTotalFocusedTodaySeconds: () => 0,
}));

vi.mock('react-grid-layout', () => ({
  useContainerWidth: () => ({ width: 1200, mounted: true, containerRef: { current: null } }),
  ResponsiveGridLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-grid-layout">{children}</div>
  ),
}));

vi.mock('../src/components/focus/FocusMiniPlayer', () => ({
  FocusMiniPlayer: ({ variant }: { variant: string }) => (
    <div data-testid={`focus-mini-player-${variant}`}>MiniPlayer ({variant})</div>
  ),
}));

describe('Challenger 2 Empirical Verification: WorkspaceTaskRow & Milestone M2 Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasks = [];
  });

  describe('1. WorkspaceTaskRow Priority Robustness & Undefined Safety', () => {
    it('renders without throwing when task.priority is undefined (prevents toUpperCase TypeError)', () => {
      const taskWithUndefinedPriority: Task = {
        id: 'task-undef-prio',
        title: 'Task with undefined priority',
        status: 'todo',
        priority: undefined as unknown as Priority,
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [],
      };

      expect(() => {
        render(
          <WorkspaceTaskRow
            task={taskWithUndefinedPriority}
            onSelectTask={vi.fn()}
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Task with undefined priority')).toBeDefined();
      // Should not render any priority badge
      expect(screen.queryByText(/P[1-4]/i)).toBeNull();
    });

    it('does not render priority badge when priority is p4 (default/lowest)', () => {
      const taskP4: Task = {
        id: 'task-p4',
        title: 'Task with p4 priority',
        status: 'todo',
        priority: 'p4',
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [],
      };

      render(<WorkspaceTaskRow task={taskP4} onSelectTask={vi.fn()} />);
      expect(screen.getByText('Task with p4 priority')).toBeDefined();
      expect(screen.queryByText('P4')).toBeNull();
    });

    it('renders priority badges correctly for p1, p2, p3', () => {
      const priorities: Priority[] = ['p1', 'p2', 'p3'];

      for (const prio of priorities) {
        const task: Task = {
          id: `task-${prio}`,
          title: `Task with ${prio}`,
          status: 'todo',
          priority: prio,
          projectId: 'inbox',
          createdAt: Date.now(),
          subtasks: [],
        };

        const { unmount } = render(<WorkspaceTaskRow task={task} onSelectTask={vi.fn()} />);
        expect(screen.getByText(prio.toUpperCase())).toBeDefined();
        unmount();
      }
    });

    it('renders safely with ultra-sparse task payload having missing optional fields', () => {
      const ultraSparseTask = {
        id: 'sparse-task-1',
        title: 'Bare minimum task',
        status: 'todo',
        projectId: 'inbox',
        createdAt: 1000,
      } as unknown as Task;

      expect(() => {
        render(<WorkspaceTaskRow task={ultraSparseTask} onSelectTask={vi.fn()} />);
      }).not.toThrow();

      expect(screen.getByText('Bare minimum task')).toBeDefined();
    });

    it('allows toggling pin status and completion on task with undefined priority', () => {
      const task: Task = {
        id: 'task-toggle-undef',
        title: 'Toggle Pin Task',
        status: 'todo',
        priority: undefined as unknown as Priority,
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [],
      };

      render(<WorkspaceTaskRow task={task} onSelectTask={vi.fn()} />);

      const pinButton = screen.getByRole('button', { name: /Pin to Top 3/i });
      fireEvent.click(pinButton);
      expect(mockToggleTaskPinToday).toHaveBeenCalledWith('task-toggle-undef');
    });
  });

  describe('2. AppShell Mobile Bottom Navigation Wireup', () => {
    it('passes onOpenMobileSidebar to MobileBottomNav onOpenMenu trigger', () => {
      const onOpenMobileSidebar = vi.fn();
      const onCloseMobileSidebar = vi.fn();

      render(
        <AppShell
          activeView="today"
          onSelectView={vi.fn()}
          onOpenTaskModal={vi.fn()}
          onOpenSearch={vi.fn()}
          onOpenShortcuts={vi.fn()}
          onOpenSettings={vi.fn()}
          isMobileSidebarOpen={false}
          onOpenMobileSidebar={onOpenMobileSidebar}
          onCloseMobileSidebar={onCloseMobileSidebar}
        >
          <div>App Shell Content</div>
        </AppShell>
      );

      // Find the mobile bottom nav "More" button using its aria-label
      const moreButton = screen.getByRole('button', { name: 'More views and projects' });
      fireEvent.click(moreButton);

      // Verify onOpenMobileSidebar was called and onCloseMobileSidebar was NOT called
      expect(onOpenMobileSidebar).toHaveBeenCalledTimes(1);
      expect(onCloseMobileSidebar).not.toHaveBeenCalled();
    });
  });

  describe('3. TodayTimelineRail Scheduled Tasks Isolation', () => {
    it('strictly isolates future-dated scheduled tasks from Today rail even when status is todo', () => {
      const railTasks: Task[] = [
        {
          id: 'future-task-1',
          title: 'Future Scheduled Task',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          createdAt: Date.now(),
          scheduledStart: '10:00',
          scheduledEnd: '11:00',
          plannedDate: '2026-10-20', // Tomorrow!
          subtasks: [],
        },
        {
          id: 'future-task-due-tomorrow',
          title: 'Future Task Due Tomorrow',
          status: 'todo',
          priority: 'p3',
          projectId: 'inbox',
          createdAt: Date.now(),
          scheduledStart: '14:00',
          scheduledEnd: '15:00',
          dueDate: '2026-10-20', // Tomorrow!
          subtasks: [],
        },
        {
          id: 'today-task-1',
          title: 'Legitimate Today Task',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          createdAt: Date.now(),
          scheduledStart: '09:00',
          scheduledEnd: '10:00',
          plannedDate: '2026-10-19', // Today!
          subtasks: [],
        },
        {
          id: 'today-task-due-today',
          title: 'Task Due Today',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          createdAt: Date.now(),
          scheduledStart: '11:30',
          scheduledEnd: '12:30',
          dueDate: '2026-10-19', // Today!
          subtasks: [],
        },
      ];

      render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={railTasks}
        />
      );

      // Today's tasks should be rendered on the rail
      expect(screen.getByText('Legitimate Today Task')).toBeDefined();
      expect(screen.getByText('Task Due Today')).toBeDefined();

      // Future tasks must NOT be rendered on Today's rail
      expect(screen.queryByText('Future Scheduled Task')).toBeNull();
      expect(screen.queryByText('Future Task Due Tomorrow')).toBeNull();
    });
  });

  describe('4. HorizonTodayView Focus Task Overflow (No Clipping)', () => {
    it('does not discard tasks when more than 3 tasks have isPinnedToday/focus', () => {
      // 5 tasks pinned for today
      mockTasks = [
        { id: 'f-1', title: 'Focus Task 1', status: 'todo', priority: 'p1', isPinnedToday: true, topThreeDate: '2026-10-19', projectId: 'inbox', createdAt: 1, subtasks: [] },
        { id: 'f-2', title: 'Focus Task 2', status: 'todo', priority: 'p1', isPinnedToday: true, topThreeDate: '2026-10-19', projectId: 'inbox', createdAt: 2, subtasks: [] },
        { id: 'f-3', title: 'Focus Task 3', status: 'todo', priority: 'p2', isPinnedToday: true, topThreeDate: '2026-10-19', projectId: 'inbox', createdAt: 3, subtasks: [] },
        { id: 'f-4', title: 'Focus Task 4 (Overflow 1)', status: 'todo', priority: 'p2', isPinnedToday: true, topThreeDate: '2026-10-19', projectId: 'inbox', createdAt: 4, subtasks: [] },
        { id: 'f-5', title: 'Focus Task 5 (Overflow 2)', status: 'todo', priority: 'p3', isPinnedToday: true, topThreeDate: '2026-10-19', projectId: 'inbox', createdAt: 5, subtasks: [] },
      ];

      render(<HorizonTodayView onSelectTask={vi.fn()} />);

      // Top 3 deck must display top 3
      expect(screen.getByText('Focus Task 1')).toBeDefined();
      expect(screen.getByText('Focus Task 2')).toBeDefined();
      expect(screen.getByText('Focus Task 3')).toBeDefined();

      // Overflow tasks (4 and 5) MUST NOT be clipped or vanished from the view!
      // They should appear in daytime task batches.
      expect(screen.getByText('Focus Task 4 (Overflow 1)')).toBeDefined();
      expect(screen.getByText('Focus Task 5 (Overflow 2)')).toBeDefined();
    });
  });
});
