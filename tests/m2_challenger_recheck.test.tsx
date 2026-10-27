// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../src/components/layout/AppShell';
import { TodayTimelineRail } from '../src/components/views/today/TodayTimelineRail';
import { HorizonTodayView } from '../src/components/views/today/HorizonTodayView';
import { WorkspaceTaskRow } from '../src/components/tasks/WorkspaceTaskRow';
import type { Task } from '../src/types/task';

// Mocks
const mockUpdateTask = vi.fn();
const mockAddTask = vi.fn();
const mockToggleTaskStatus = vi.fn();
const mockToggleTaskPinToday = vi.fn();
const mockDeleteTask = vi.fn();
let mockTasks: Task[] = [];
let mockFocusedSeconds = 0;
let mockSettings = { targetWorkCapacityHours: 6, enableSmartSyntaxParsing: true };
let mockWorkspacePreferences: Record<string, unknown> = {};

vi.mock('../src/context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: mockTasks,
    calendarEvents: [],
    projects: [{ id: 'inbox', name: 'Inbox', color: '#64748B' }],
    smartViews: [],
    selectedTaskIds: [],
    toggleTaskSelection: vi.fn(),
    clearTaskSelection: vi.fn(),
    workspacePreferences: mockWorkspacePreferences,
    workspaceId: 'local',
    settings: mockSettings,
    updateDashboards: vi.fn(),
    setWorkspacePreference: vi.fn(),
    updateTask: mockUpdateTask,
    addTask: mockAddTask,
    toggleTaskStatus: mockToggleTaskStatus,
    toggleTaskPinToday: mockToggleTaskPinToday,
    deleteTask: mockDeleteTask,
    batchUpdateTasks: vi.fn(),
    batchDeleteTasks: vi.fn(),
    showToast: vi.fn(),
    focusLogs: [],
    focusSession: null,
    totalFocusedTodaySeconds: mockFocusedSeconds,
  }),
}));

vi.mock('../src/hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-19',
  useTomorrowStr: () => '2026-10-20',
  getTodayStr: () => '2026-10-19',
  getTomorrowStr: () => '2026-10-20',
}));

vi.mock('../src/hooks/useTotalFocusedTodaySeconds', () => ({
  useTotalFocusedTodaySeconds: () => mockFocusedSeconds,
}));

vi.mock('../src/components/focus/FocusMiniPlayer', () => ({
  FocusMiniPlayer: ({ variant }: { variant: string }) => (
    <div data-testid={`focus-mini-player-${variant}`}>MiniPlayer ({variant})</div>
  ),
}));

describe('Empirical Verification: Milestone M2 Remediation Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasks = [];
    mockFocusedSeconds = 0;
    mockSettings = { targetWorkCapacityHours: 6, enableSmartSyntaxParsing: true };
    mockWorkspacePreferences = {};
  });

  describe('Item 1: AppShell MobileBottomNav "More" click calls onOpenMobileSidebar', () => {
    it('clicking "More" button on MobileBottomNav triggers onOpenMobileSidebar and NOT onCloseMobileSidebar', () => {
      const openMobileSidebarSpy = vi.fn();
      const closeMobileSidebarSpy = vi.fn();
      const selectViewSpy = vi.fn();
      const quickAddSpy = vi.fn();

      render(
        <AppShell
          isSidebarCollapsed={false}
          onToggleSidebar={vi.fn()}
          isSidebarOpenMobile={false}
          onCloseMobileSidebar={closeMobileSidebarSpy}
          onOpenMobileSidebar={openMobileSidebarSpy}
          onOpenPomodoro={vi.fn()}
          onOpenShortcuts={vi.fn()}
          onOpenExportImport={vi.fn()}
          onOpenBrainDump={vi.fn()}
          onOpenAesthetics={vi.fn()}
          onOpenScratchpad={vi.fn()}
          onOpenStudySession={vi.fn()}
          onOpenSettings={vi.fn()}
          desktopHeader={<div data-testid="desktop-header">Desktop Header</div>}
          mobileHeader={<div data-testid="mobile-header">Mobile Header</div>}
          activeView="today"
          onSelectView={selectViewSpy}
          onQuickAdd={quickAddSpy}
          todayCount={5}
          inboxCount={2}
          upcomingCount={1}
          selectedTaskId={null}
          onCloseDrawer={vi.fn()}
          onStartFocus={vi.fn()}
          isPomodoroOpen={false}
          onSelectTaskFromModalRoot={vi.fn()}
        >
          <div data-testid="shell-child">Main Content</div>
        </AppShell>
      );

      // Find the "More" button on MobileBottomNav
      const moreButton = screen.getByRole('button', { name: 'More views and projects' });
      expect(moreButton).toBeDefined();

      // Click "More"
      fireEvent.click(moreButton);

      // Verify onOpenMobileSidebar was called exactly once
      expect(openMobileSidebarSpy).toHaveBeenCalledTimes(1);
      // Verify onCloseMobileSidebar was NOT called
      expect(closeMobileSidebarSpy).not.toHaveBeenCalled();
    });

    it('clicking other MobileBottomNav buttons routes appropriately within AppShell', () => {
      const openMobileSidebarSpy = vi.fn();
      const selectViewSpy = vi.fn();
      const quickAddSpy = vi.fn();

      render(
        <AppShell
          isSidebarCollapsed={false}
          onToggleSidebar={vi.fn()}
          isSidebarOpenMobile={false}
          onCloseMobileSidebar={vi.fn()}
          onOpenMobileSidebar={openMobileSidebarSpy}
          onOpenPomodoro={vi.fn()}
          onOpenShortcuts={vi.fn()}
          onOpenExportImport={vi.fn()}
          onOpenBrainDump={vi.fn()}
          onOpenAesthetics={vi.fn()}
          onOpenScratchpad={vi.fn()}
          onOpenStudySession={vi.fn()}
          onOpenSettings={vi.fn()}
          desktopHeader={<div>Desktop</div>}
          mobileHeader={<div>Mobile</div>}
          activeView="today"
          onSelectView={selectViewSpy}
          onQuickAdd={quickAddSpy}
          todayCount={5}
          inboxCount={2}
          upcomingCount={1}
          selectedTaskId={null}
          onCloseDrawer={vi.fn()}
          onStartFocus={vi.fn()}
          isPomodoroOpen={false}
          onSelectTaskFromModalRoot={vi.fn()}
        >
          <div>Child</div>
        </AppShell>
      );

      // Click Inbox
      const inboxBtn = screen.getByRole('button', { name: 'Inbox View' });
      fireEvent.click(inboxBtn);
      expect(selectViewSpy).toHaveBeenCalledWith('inbox');

      // Click Quick Add
      const addBtn = screen.getByRole('button', { name: 'Quick Add Task' });
      fireEvent.click(addBtn);
      expect(quickAddSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Item 2: TodayTimelineRail future task boundary isolation', () => {
    it('does NOT render future tasks with scheduledStart on Today timeline rail', () => {
      const futureTaskWithPlannedDate: Task = {
        id: 'future-task-1',
        title: 'Future Task Planned Next Week',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: 1,
        plannedDate: '2026-10-25', // Future date
        scheduledStart: '10:00',
        scheduledEnd: '11:00',
        subtasks: [],
      };

      const futureTaskWithDueDate: Task = {
        id: 'future-task-2',
        title: 'Future Task Due Tomorrow',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        createdAt: 2,
        dueDate: '2026-10-20', // Tomorrow
        scheduledStart: '11:00',
        scheduledEnd: '12:00',
        subtasks: [],
      };

      const todayTaskWithPlannedDate: Task = {
        id: 'today-task-1',
        title: 'Legitimate Today Task',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: 3,
        plannedDate: '2026-10-19', // Today
        scheduledStart: '09:00',
        scheduledEnd: '10:00',
        subtasks: [],
      };

      const todayTaskWithDueDate: Task = {
        id: 'today-task-2',
        title: 'Legitimate Due Today Task',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        createdAt: 4,
        dueDate: '2026-10-19', // Today via dueDate
        scheduledStart: '14:00',
        scheduledEnd: '15:00',
        subtasks: [],
      };

      render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[
            futureTaskWithPlannedDate,
            futureTaskWithDueDate,
            todayTaskWithPlannedDate,
            todayTaskWithDueDate,
          ]}
        />
      );

      // Verify today tasks are rendered
      expect(screen.getByText('Legitimate Today Task')).toBeDefined();
      expect(screen.getByText('Legitimate Due Today Task')).toBeDefined();

      // Verify future tasks are NOT rendered on Today's timeline
      expect(screen.queryByText('Future Task Planned Next Week')).toBeNull();
      expect(screen.queryByText('Future Task Due Tomorrow')).toBeNull();
    });

    it('does NOT render deleted or archived tasks on Today timeline rail', () => {
      const deletedTask: Task = {
        id: 'deleted-1',
        title: 'Deleted Task For Today',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: 1,
        plannedDate: '2026-10-19',
        scheduledStart: '10:00',
        deletedAt: Date.now(),
        subtasks: [],
      };

      const archivedTask: Task = {
        id: 'archived-1',
        title: 'Archived Task For Today',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: 2,
        plannedDate: '2026-10-19',
        scheduledStart: '11:00',
        archivedAt: Date.now(),
        subtasks: [],
      };

      render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[deletedTask, archivedTask]}
        />
      );

      expect(screen.queryByText('Deleted Task For Today')).toBeNull();
      expect(screen.queryByText('Archived Task For Today')).toBeNull();
    });
  });

  describe('Item 3: HorizonTodayView 4+ isFocusTask handling', () => {
    it('renders exactly 3 tasks in Top 3 deck and preserves all overflow focus tasks across daytime batches', () => {
      // 5 tasks all matching isFocusTask for today
      mockTasks = [
        {
          id: 'focus-1',
          title: 'Focus Task 1 (p1)',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          createdAt: 1,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        },
        {
          id: 'focus-2',
          title: 'Focus Task 2 (p1)',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          createdAt: 2,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        },
        {
          id: 'focus-3',
          title: 'Focus Task 3 (p2)',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          createdAt: 3,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        },
        {
          id: 'focus-4',
          title: 'Focus Task 4 (p3 deep intensity)',
          status: 'todo',
          priority: 'p3',
          projectId: 'inbox',
          createdAt: 4,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        },
        {
          id: 'focus-5',
          title: 'Focus Task 5 (p4 deep intensity)',
          status: 'todo',
          priority: 'p4',
          projectId: 'inbox',
          createdAt: 5,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        },
      ];

      mockWorkspacePreferences = {
        workspace: {
          todayLayout: {
            version: 1,
            sections: [
              { id: 'capture', visible: true },
              { id: 'capacity', visible: true },
              { id: 'priorities', visible: true },
              { id: 'tasks', visible: true },
            ],
          },
        },
      };
      render(<HorizonTodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />);

      // Top 3 deck check:
      const topThreeSection = document.querySelector('.daily-priorities');
      expect(topThreeSection).not.toBeNull();
      const topThreeRows = topThreeSection?.querySelectorAll('.desk-task-row');
      expect(topThreeRows?.length).toBe(3);

      // Top 3 contains the 3 highest priority items: Focus 1 (p1), Focus 2 (p1), Focus 3 (p2)
      expect(topThreeRows?.[0].textContent).toContain('Focus Task 1 (p1)');
      expect(topThreeRows?.[1].textContent).toContain('Focus Task 2 (p1)');
      expect(topThreeRows?.[2].textContent).toContain('Focus Task 3 (p2)');

      // Rank badges strictly 01, 02, 03
      const ranks = topThreeSection?.querySelectorAll('.desk-task-rank');
      expect(ranks?.length).toBe(3);
      expect(ranks?.[0].textContent).toBe('01');
      expect(ranks?.[1].textContent).toBe('02');
      expect(ranks?.[2].textContent).toBe('03');

      // Overflow focus tasks (Focus 4 and Focus 5) are NOT dropped; they are preserved in daytime batches (Daytime Flow)
      const morningFocusSection = screen.getByRole('region', { name: 'Daytime Flow' });
      expect(morningFocusSection).toBeDefined();
      expect(morningFocusSection.textContent).toContain('Focus Task 4 (p3 deep intensity)');
      expect(morningFocusSection.textContent).toContain('Focus Task 5 (p4 deep intensity)');

      // All 5 focus tasks are rendered and accessible in the DOM
      expect(screen.getByText('Focus Task 1 (p1)')).toBeDefined();
      expect(screen.getByText('Focus Task 2 (p1)')).toBeDefined();
      expect(screen.getByText('Focus Task 3 (p2)')).toBeDefined();
      expect(screen.getByText('Focus Task 4 (p3 deep intensity)')).toBeDefined();
      expect(screen.getByText('Focus Task 5 (p4 deep intensity)')).toBeDefined();
    });

    it('overflow focus tasks with medium cognitive intensity cleanly render in Daytime Flow batch', () => {
      // 4 tasks matching isFocusTask via topThreeDate, with 4th task having medium intensity (p3, no pin, 30m)
      mockTasks = [
        { id: 't1', title: 'Task 1 (P1)', status: 'todo', priority: 'p1', projectId: 'inbox', createdAt: 1, plannedDate: '2026-10-19', topThreeDate: '2026-10-19', isPinnedToday: true, subtasks: [] },
        { id: 't2', title: 'Task 2 (P1)', status: 'todo', priority: 'p1', projectId: 'inbox', createdAt: 2, plannedDate: '2026-10-19', topThreeDate: '2026-10-19', isPinnedToday: true, subtasks: [] },
        { id: 't3', title: 'Task 3 (P2)', status: 'todo', priority: 'p2', projectId: 'inbox', createdAt: 3, plannedDate: '2026-10-19', topThreeDate: '2026-10-19', isPinnedToday: true, subtasks: [] },
        // 4th task: topThreeDate set (matches isFocusTask), priority p3, estimatedMinutes 30 (classifyTaskCognitiveIntensity === 'medium')
        { id: 't4', title: 'Task 4 Overflow In Daytime Flow', status: 'todo', priority: 'p3', projectId: 'inbox', createdAt: 4, plannedDate: '2026-10-19', topThreeDate: '2026-10-19', estimatedMinutes: 30, subtasks: [] },
      ];

      mockWorkspacePreferences = {
        workspace: {
          todayLayout: {
            version: 1,
            sections: [
              { id: 'capture', visible: true },
              { id: 'capacity', visible: true },
              { id: 'priorities', visible: true },
              { id: 'tasks', visible: true },
            ],
          },
        },
      };
      render(<HorizonTodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />);

      // Exactly 3 in Top 3 deck
      const topThreeSection = document.querySelector('.daily-priorities');
      const topThreeRows = topThreeSection?.querySelectorAll('.desk-task-row');
      expect(topThreeRows?.length).toBe(3);

      // 4th task lands in Daytime Flow batch
      const flowSection = screen.getByRole('region', { name: 'Daytime Flow' });
      expect(flowSection).toBeDefined();
      expect(flowSection.textContent).toContain('Task 4 Overflow In Daytime Flow');

      // Verify task is fully visible
      expect(screen.getByText('Task 4 Overflow In Daytime Flow')).toBeDefined();
    });
  });

  describe('Item 4: WorkspaceTaskRow defensive undefined priority guard', () => {
    it('renders cleanly without TypeError when task.priority is undefined', () => {
      const taskWithoutPriority = {
        id: 'no-priority-task',
        title: 'Legacy Corrupted Task Without Priority',
        status: 'todo',
        projectId: 'inbox',
        createdAt: 1,
        subtasks: [],
      } as unknown as Task;

      expect(() => {
        render(<WorkspaceTaskRow task={taskWithoutPriority} onSelectTask={vi.fn()} />);
      }).not.toThrow();

      expect(screen.getByText('Legacy Corrupted Task Without Priority')).toBeDefined();
    });
  });
});
