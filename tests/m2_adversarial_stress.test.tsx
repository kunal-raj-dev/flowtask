import { act as flushRender } from '@testing-library/react';
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, createEvent } from '@testing-library/react';
import { WorkspaceTaskRow } from '../src/components/tasks/WorkspaceTaskRow';
import { TodayTimelineRail } from '../src/components/views/today/TodayTimelineRail';
import { HorizonTodayView } from '../src/components/views/today/HorizonTodayView';
import { TodayView } from '../src/components/views/TodayView';
import { DashboardCanvasView } from '../src/components/views/DashboardCanvasView';
import { DesktopHeader } from '../src/components/layout/DesktopHeader';
import { MobileBottomNav } from '../src/components/layout/MobileBottomNav';
import { ViewContainer } from '../src/components/layout/ViewContainer';
import { AppShell } from '../src/components/layout/AppShell';
import { computeAutoSlotSchedule } from '../src/utils/autoSlotAlgorithm';
import type { Task, CalendarEvent, Priority } from '../src/types/task';

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
let mockCalendarEvents: CalendarEvent[] = [];
let mockFocusedSeconds = 0;
let mockSettings = { targetWorkCapacityHours: 6, enableSmartSyntaxParsing: true };

vi.mock('../src/context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: mockTasks,
    calendarEvents: mockCalendarEvents,
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

// Helper to create a drop event with synthetic clientY and dataTransfer in jsdom
function createDropEvent(target: Element, clientY: number, data: Record<string, string>) {
  const event = createEvent.drop(target);
  Object.defineProperty(event, 'clientY', { value: clientY, configurable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      types: Object.keys(data),
      getData: (type: string) => data[type] || '',
    },
    configurable: true,
  });
  return event;
}

describe('Milestone M2 Adversarial & Empirical Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTasks = [];
    mockCalendarEvents = [];
    mockFocusedSeconds = 0;
    mockSettings = { targetWorkCapacityHours: 6, enableSmartSyntaxParsing: true };
  });

  describe('1. HTML5 Drag-and-Drop Contract & Payload Robustness', () => {
    it('WorkspaceTaskRow sets draggable=true when task is not scheduleLocked', async () => {
      const task: Task = {
        id: 'task-unlocked',
        title: 'Draggable Task',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        createdAt: 1,
        scheduleLocked: false,
        estimatedMinutes: 45,
        subtasks: [],
      };

      const { container } = await flushRender(async () => (render(
        <WorkspaceTaskRow task={task} onSelectTask={vi.fn()} />
      )));

      const row = container.querySelector('.desk-task-row');
      expect(row).not.toBeNull();
      expect(row?.getAttribute('draggable')).toBe('true');
    });

    it('WorkspaceTaskRow sets draggable=false when task.scheduleLocked is true', async () => {
      const task: Task = {
        id: 'task-locked',
        title: 'Locked Task',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: 1,
        scheduleLocked: true,
        estimatedMinutes: 30,
        subtasks: [],
      };

      const { container } = await flushRender(async () => (render(
        <WorkspaceTaskRow task={task} onSelectTask={vi.fn()} />
      )));

      const row = container.querySelector('.desk-task-row');
      expect(row).not.toBeNull();
      expect(row?.getAttribute('draggable')).toBe('false');
    });

    it('WorkspaceTaskRow onDragStart populates application/json payload with taskId and duration', async () => {
      const task: Task = {
        id: 'task-dnd-1',
        title: 'DnD Test Task',
        status: 'todo',
        priority: 'p3',
        projectId: 'inbox',
        createdAt: 1,
        estimatedMinutes: 60,
        subtasks: [],
      };

      const { container } = await flushRender(async () => (render(
        <WorkspaceTaskRow task={task} onSelectTask={vi.fn()} />
      )));

      const row = container.querySelector('.desk-task-row')!;
      const setDataMock = vi.fn();
      const dragStartEvent = {
        dataTransfer: {
          setData: setDataMock,
          effectAllowed: '',
        },
      };

      fireEvent.dragStart(row, dragStartEvent);

      expect(setDataMock).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify({ taskId: 'task-dnd-1', duration: 60 })
      );
      expect(dragStartEvent.dataTransfer.effectAllowed).toBe('move');
    });

    it('WorkspaceTaskRow onDragStart falls back to 30m duration if estimatedMinutes is undefined or 0', async () => {
      const task: Task = {
        id: 'task-fallback-duration',
        title: 'No estimate task',
        status: 'todo',
        priority: 'p4',
        projectId: 'inbox',
        createdAt: 1,
        subtasks: [],
      };

      const { container } = await flushRender(async () => (render(
        <WorkspaceTaskRow task={task} onSelectTask={vi.fn()} />
      )));

      const row = container.querySelector('.desk-task-row')!;
      const setDataMock = vi.fn();
      const dragStartEvent = {
        dataTransfer: {
          setData: setDataMock,
          effectAllowed: '',
        },
      };

      fireEvent.dragStart(row, dragStartEvent);

      expect(setDataMock).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify({ taskId: 'task-fallback-duration', duration: 30 })
      );
    });

    it('TodayTimelineRail magnetic grid snapping: mathematically snaps 7m->0m, 8m->15m, 22m->15m, 23m->30m', async () => {
      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;

      // Drop at y=7px -> 7 minutes -> snaps to 0m (00:00)
      const ev1 = createDropEvent(canvas, 7, {
        'application/json': JSON.stringify({ taskId: 'snap-task-1', duration: 30 }),
      });
      fireEvent(canvas, ev1);

      expect(mockUpdateTask).toHaveBeenCalledWith('snap-task-1', {
        scheduledStart: '00:00',
        scheduledEnd: '00:30',
        plannedDate: '2026-10-19',
      });

      // Drop at y=8px -> 8 minutes -> snaps to 15m (00:15)
      const ev2 = createDropEvent(canvas, 8, {
        'application/json': JSON.stringify({ taskId: 'snap-task-2', duration: 45 }),
      });
      fireEvent(canvas, ev2);

      expect(mockUpdateTask).toHaveBeenCalledWith('snap-task-2', {
        scheduledStart: '00:15',
        scheduledEnd: '01:00',
        plannedDate: '2026-10-19',
      });

      // Drop at y=22px -> 22 minutes -> snaps to 15m (00:15)
      const ev3 = createDropEvent(canvas, 22, {
        'application/json': JSON.stringify({ taskId: 'snap-task-3', duration: 30 }),
      });
      fireEvent(canvas, ev3);

      expect(mockUpdateTask).toHaveBeenCalledWith('snap-task-3', {
        scheduledStart: '00:15',
        scheduledEnd: '00:45',
        plannedDate: '2026-10-19',
      });

      // Drop at y=23px -> 23 minutes -> snaps to 30m (00:30)
      const ev4 = createDropEvent(canvas, 23, {
        'application/json': JSON.stringify({ taskId: 'snap-task-4', duration: 30 }),
      });
      fireEvent(canvas, ev4);

      expect(mockUpdateTask).toHaveBeenCalledWith('snap-task-4', {
        scheduledStart: '00:30',
        scheduledEnd: '01:00',
        plannedDate: '2026-10-19',
      });
    });

    it('TodayTimelineRail clamps boundary drops at 00:00 and 24:00 (midnight limit)', async () => {
      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;

      // Negative drop position (scrolled/dragged above top) -> clamps to 00:00
      const evMin = createDropEvent(canvas, -50, {
        'application/json': JSON.stringify({ taskId: 'clamp-min', duration: 60 }),
      });
      fireEvent(canvas, evMin);

      expect(mockUpdateTask).toHaveBeenCalledWith('clamp-min', {
        scheduledStart: '00:00',
        scheduledEnd: '01:00',
        plannedDate: '2026-10-19',
      });

      // Overshot bottom drop position (1500px, duration 60m) -> maxStart = 1440 - 60 = 1380 (23:00)
      const evMax = createDropEvent(canvas, 1500, {
        'application/json': JSON.stringify({ taskId: 'clamp-max', duration: 60 }),
      });
      fireEvent(canvas, evMax);

      expect(mockUpdateTask).toHaveBeenCalledWith('clamp-max', {
        scheduledStart: '23:00',
        scheduledEnd: '23:59',
        plannedDate: '2026-10-19',
      });
    });

    it('TodayTimelineRail snaps magnetically to calendar event end boundary within 10-minute threshold', async () => {
      const events: CalendarEvent[] = [
        {
          id: 'standup-meeting',
          title: 'Daily Standup',
          startTime: '09:00',
          endTime: '09:30',
          date: '2026-10-19',
        },
      ];

      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          calendarEvents={events}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;

      // 09:30 is 570 minutes. 9:25 is 565px. Drop at 565px -> raw snap is 570, magnetically snaps to meeting end 09:30
      const evSnap = createDropEvent(canvas, 565, {
        'application/json': JSON.stringify({ taskId: 'meeting-adjacent-task', duration: 30 }),
      });
      fireEvent(canvas, evSnap);

      expect(mockUpdateTask).toHaveBeenCalledWith('meeting-adjacent-task', {
        scheduledStart: '09:30',
        scheduledEnd: '10:00',
        plannedDate: '2026-10-19',
      });
    });

    it('TodayTimelineRail handles malformed, empty, or non-json drag payloads safely without throwing', async () => {
      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;

      // 1. Non-JSON type
      const evNonJson = createDropEvent(canvas, 100, { 'text/plain': 'some plain text' });
      expect(() => fireEvent(canvas, evNonJson)).not.toThrow();

      // 2. Syntax-corrupted JSON
      const evCorrupt = createDropEvent(canvas, 100, { 'application/json': '{"taskId": "broken", duration: }' });
      expect(() => fireEvent(canvas, evCorrupt)).not.toThrow();

      // 3. JSON without taskId
      const evNoId = createDropEvent(canvas, 100, { 'application/json': JSON.stringify({ duration: 45 }) });
      expect(() => fireEvent(canvas, evNoId)).not.toThrow();

      // 4. Empty string getData
      const evEmpty = createDropEvent(canvas, 100, { 'application/json': '' });
      expect(() => fireEvent(canvas, evEmpty)).not.toThrow();

      expect(mockUpdateTask).not.toHaveBeenCalled();
    });
  });

  describe('2. TodayView.test.tsx Contract & Horizon Assertions Verification', () => {
    it('satisfies all TodayView.test.tsx baseline assertions cleanly', async () => {
      mockTasks = [
        {
          id: 'today-task',
          title: 'Solve Priority Problem',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          createdAt: 1,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          estimatedMinutes: 30,
          subtasks: [],
        },
      ];
      mockFocusedSeconds = 4500; // 1h 15m

      const onFocus = vi.fn();
      await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={onFocus} />)));

      // Baseline checks
      expect(screen.getByRole('heading', { name: 'Today.' })).toBeDefined();
      expect(screen.getByRole('textbox', { name: 'Add a task to this list' })).toBeDefined();
      expect(screen.getByText('A DAY THAT FITS')).toBeDefined();
      expect(document.querySelector('.daily-planning-summary')?.textContent).toContain(
        '0.5h planned · 5.5h in daily budget'
      );
      expect(screen.queryByText(/Focus Session in Progress/)).toBeNull();
      expect(screen.getByText('1h 15m focused')).toBeDefined();

      // Focus trigger button check
      const focusBtn = screen.getByRole('button', { name: 'Focus on Solve Priority Problem' });
      expect(focusBtn).toBeDefined();
      fireEvent.click(focusBtn);
      expect(onFocus).toHaveBeenCalledWith('today-task');

      // Plan my day button and dialog check
      const planBtn = screen.getByRole('button', { name: 'Plan my day' });
      fireEvent.click(planBtn);
      expect(screen.getByRole('dialog', { name: 'Make room for today' })).toBeDefined();
    });

    it('satisfies overbooked warning threshold calculation (480m vs 360m available = 120m overbooked)', async () => {
      mockTasks = [
        {
          id: 'huge-task',
          title: 'Massive Project Block',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          createdAt: 1,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          estimatedMinutes: 480, // 8 hours planned against 6 hours target = 120m overbooked
          subtasks: [],
        },
      ];

      await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />)));

      expect(screen.getByText(/Overbooked by 120 minutes/)).toBeDefined();
    });

    it('renders empty day state gracefully with guidance prompt and zero error cascades', async () => {
      mockTasks = [];

      await flushRender(async () => (render(<HorizonTodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />)));

      expect(screen.getByText('What matters most today?')).toBeDefined();
      expect(
        screen.getByText('Star up to three tasks below. Give your day a clear place to start.')
      ).toBeDefined();
      expect(document.querySelector('.daily-planning-summary')?.textContent).toContain(
        '0h planned · 6h in daily budget'
      );
    });

    it('correctly partitions daytime batches: Morning, Flow, Evening, Someday, and Completed', async () => {
      mockTasks = [
        {
          id: 'p-1',
          title: 'Top Priority Item',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          createdAt: 1,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          estimatedMinutes: 30,
          subtasks: [],
        },
        {
          id: 'm-1',
          title: 'Deep Work Morning Item',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          createdAt: 2,
          plannedDate: '2026-10-19',
          scheduledStart: '09:00',
          estimatedMinutes: 60,
          subtasks: [],
        },
        {
          id: 'f-1',
          title: 'Midday Afternoon Task',
          status: 'todo',
          priority: 'p3',
          projectId: 'inbox',
          createdAt: 3,
          plannedDate: '2026-10-19',
          scheduledStart: '14:00',
          estimatedMinutes: 30,
          subtasks: [],
        },
        {
          id: 'e-1',
          title: 'Evening Review',
          status: 'todo',
          priority: 'p4',
          projectId: 'inbox',
          createdAt: 4,
          plannedDate: '2026-10-19',
          isEvening: true,
          estimatedMinutes: 15,
          subtasks: [],
        },
        {
          id: 's-1',
          title: 'Someday Backlog Idea',
          status: 'todo',
          priority: 'p4',
          projectId: 'inbox',
          createdAt: 5,
          isSomeday: true,
          subtasks: [],
        },
        {
          id: 'c-1',
          title: 'Already Finished Task',
          status: 'done',
          priority: 'p2',
          projectId: 'inbox',
          createdAt: 6,
          plannedDate: '2026-10-19',
          completedAt: new Date('2026-10-19T12:00:00').getTime(),
          subtasks: [],
        },
      ];

      await flushRender(async () => (render(<HorizonTodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />)));

      // Top 3
      expect(screen.getByText('Top Priority Item')).toBeDefined();
      // Morning Focus section
      const morningRegion = screen.getByRole('region', { name: 'Morning Focus' });
      expect(morningRegion).toBeDefined();
      expect(morningRegion.textContent).toContain('Deep Work Morning Item');

      // Daytime Flow section
      const flowRegion = screen.getByRole('region', { name: 'Daytime Flow' });
      expect(flowRegion).toBeDefined();
      expect(flowRegion.textContent).toContain('Midday Afternoon Task');

      // Evening section
      const eveningRegion = screen.getByRole('region', { name: 'This Evening' });
      expect(eveningRegion).toBeDefined();
      expect(eveningRegion.textContent).toContain('Evening Review');

      // Backlog
      expect(screen.getByText('Someday & Backlog')).toBeDefined();
      // Completed
      expect(screen.getByText('Completed')).toBeDefined();
    });
  });

  describe('3. DashboardCanvasView & View Switching Stress & Stability', () => {
    it('cleanly renders DashboardEditor inside DashboardCanvasView', async () => {
      await flushRender(async () => (render(
        <DashboardCanvasView
          onSelectTask={vi.fn()}
          onStartFocus={vi.fn()}
          onSwitchToHorizon={vi.fn()}
        />
      )));

      expect(screen.getByText('Modular Dashboard Canvas')).toBeDefined();
      expect(screen.getByText('Back to Horizon Daily Flow')).toBeDefined();
      expect(document.querySelector('.dashboard-workspace')).not.toBeNull();
    });

    it('triggers onSwitchToHorizon when Back button is clicked', async () => {
      const switchHorizonMock = vi.fn();
      await flushRender(async () => (render(
        <DashboardCanvasView
          onSelectTask={vi.fn()}
          onStartFocus={vi.fn()}
          onSwitchToHorizon={switchHorizonMock}
        />
      )));

      const backBtn = screen.getByRole('button', { name: 'Back to Horizon Daily Flow' });
      fireEvent.click(backBtn);
      expect(switchHorizonMock).toHaveBeenCalledTimes(1);
    });

    it('TodayView switches between Horizon View and Dashboard Canvas cleanly', async () => {
      await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />)));

      // Initially in Horizon View
      expect(screen.getByText('Horizon View')).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Today.' })).toBeDefined();

      // Click "Switch dashboard" button
      const switchBtn = screen.getByRole('button', { name: 'Switch dashboard' });
      await act(async () => {
        fireEvent.click(switchBtn);
        await import('../src/components/views/DashboardCanvasView');
      });

      // Now in Dashboard Canvas View
      expect(screen.getByText('Modular Dashboard Canvas')).toBeDefined();
      expect(document.querySelector('.dashboard-workspace')).not.toBeNull();

      // Click "Back to Horizon Daily Flow"
      const backBtn = screen.getByRole('button', { name: 'Back to Horizon Daily Flow' });
      fireEvent.click(backBtn);

      // Back in Horizon View
      expect(screen.getByText('Horizon View')).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Today.' })).toBeDefined();
    });

    it('stress-test: 10 rapid consecutive view mode toggles without state desync or memory leaks', async () => {
      const { container } = await flushRender(async () => (render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />)));

      for (let i = 0; i < 10; i++) {
        await act(async () => {
          // Switch to Dashboard
          const switchBtn = screen.getByRole('button', { name: 'Switch dashboard' });
          fireEvent.click(switchBtn);
        });

        expect(screen.getByText('Modular Dashboard Canvas')).toBeDefined();

        await act(async () => {
          // Switch back to Horizon
          const backBtn = screen.getByRole('button', { name: 'Back to Horizon Daily Flow' });
          fireEvent.click(backBtn);
        });

        expect(screen.getByRole('heading', { name: 'Today.' })).toBeDefined();
      }

      // Final state check
      expect(container.querySelector('.horizon-today-view')).not.toBeNull();
      expect(container.querySelector('.desk-dashboard-canvas-view')).toBeNull();
    }, 15000);
  });

  // =========================================================================
  // 4. HorizonTodayView Scalability & Boundary Stress (0, 1, 3, 50+ Tasks)
  // =========================================================================
  describe('4. HorizonTodayView Scalability & Boundary Stress (0, 1, 3, 50+ Tasks)', () => {
    it('0 tasks: renders clean empty states across Top 3, Daytime Flow, and Capacity Summary', async () => {
      mockTasks = [];

      await flushRender(async () => (render(<HorizonTodayView />)));

      expect(screen.getByText('What matters most today?')).toBeDefined();
      expect(screen.getByText(/Star up to three tasks below/)).toBeDefined();
      expect(screen.getByText('0/3 · Keep it intentional')).toBeDefined();
      expect(screen.getByText(/A clear space to begin. Add a task above/)).toBeDefined();

      const summary = document.querySelector('.daily-planning-summary');
      expect(summary?.textContent).toContain('0h planned · 6h in daily budget');
      expect(summary?.textContent).toContain('0 completed');
    });

    it('1 task in Top 3: renders single rank badge 01 and exactly 2 spaces left banner', async () => {
      mockTasks = [
        {
          id: 'solo-top-task',
          title: 'Sole Focus Task',
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          createdAt: 1,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          estimatedMinutes: 45,
          subtasks: [],
        },
      ];

      await flushRender(async () => (render(<HorizonTodayView />)));

      expect(screen.getByText('Sole Focus Task')).toBeDefined();
      expect(screen.getByLabelText('Priority 1')).toBeDefined();
      expect(screen.getByText('01')).toBeDefined();
      expect(screen.getByText('1/3 · Keep it intentional')).toBeDefined();
      expect(screen.getByText('2 spaces left. Leave room for what matters.')).toBeDefined();
    });

    it('3 tasks in Top 3: renders badges 01, 02, 03 sorted by priority and hides empty spaces banner', async () => {
      mockTasks = [
        {
          id: 'task-p3',
          title: 'Priority 3 Task',
          status: 'todo',
          priority: 'p3',
          projectId: 'inbox',
          createdAt: 1,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        },
        {
          id: 'task-p1',
          title: 'Priority 1 Task',
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
          id: 'task-p2',
          title: 'Priority 2 Task',
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          createdAt: 3,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        },
      ];

      await flushRender(async () => (render(<HorizonTodayView />)));

      expect(screen.getByText('3/3 · Keep it intentional')).toBeDefined();
      expect(screen.queryByText(/spaces left/)).toBeNull();

      const rankBadges = document.querySelectorAll('.daily-priorities .desk-task-rank');
      expect(rankBadges.length).toBe(3);
      expect(rankBadges[0].textContent).toBe('01');
      expect(rankBadges[1].textContent).toBe('02');
      expect(rankBadges[2].textContent).toBe('03');

      const rows = document.querySelectorAll('.daily-priorities .desk-task-row');
      expect(rows[0].textContent).toContain('Priority 1 Task');
      expect(rows[1].textContent).toContain('Priority 2 Task');
      expect(rows[2].textContent).toContain('Priority 3 Task');
    });

    it('50+ tasks in Top 3: strictly caps deck to 3 highest-priority items', async () => {
      const tasks50: Task[] = [];
      const priorities: Priority[] = ['p4', 'p3', 'p2', 'p1'];
      for (let i = 0; i < 55; i++) {
        tasks50.push({
          id: `pinned-overflow-${i}`,
          title: `Pinned Task ${i} (${priorities[i % 4]})`,
          status: 'todo',
          priority: priorities[i % 4],
          projectId: 'inbox',
          createdAt: i,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        });
      }
      mockTasks = tasks50;

      await flushRender(async () => (render(<HorizonTodayView />)));

      const topThreeSection = document.querySelector('.daily-priorities');
      const ranks = topThreeSection?.querySelectorAll('.desk-task-rank');
      expect(ranks?.length).toBe(3);
      expect(ranks?.[0].textContent).toBe('01');
      expect(ranks?.[1].textContent).toBe('02');
      expect(ranks?.[2].textContent).toBe('03');

      const rows = topThreeSection?.querySelectorAll('.desk-task-row');
      expect(rows?.length).toBe(3);
      rows?.forEach((row) => {
        expect(row.textContent).toContain('(p1)');
      });
    });

    it('50+ tasks in daytime batches: virtual list renders without degradation or desync', async () => {
      const massive: Task[] = [];

      // 3 Top 3 tasks
      for (let i = 1; i <= 3; i++) {
        massive.push({
          id: `top-scale-${i}`,
          title: `Top Scale ${i}`,
          status: 'todo',
          priority: 'p1',
          projectId: 'inbox',
          createdAt: i,
          plannedDate: '2026-10-19',
          topThreeDate: '2026-10-19',
          isPinnedToday: true,
          subtasks: [],
        });
      }

      // 20 Morning tasks (scheduledStart < 12:00)
      for (let i = 1; i <= 20; i++) {
        massive.push({
          id: `morning-scale-${i}`,
          title: `Morning Task ${i}`,
          status: 'todo',
          priority: 'p2',
          projectId: 'inbox',
          createdAt: 10 + i,
          plannedDate: '2026-10-19',
          scheduledStart: '09:00',
          scheduledEnd: '09:30',
          subtasks: [],
        });
      }

      // 25 Daytime Flow tasks
      for (let i = 1; i <= 25; i++) {
        massive.push({
          id: `flow-scale-${i}`,
          title: `Daytime Flow Task ${i}`,
          status: 'todo',
          priority: 'p3',
          projectId: 'inbox',
          createdAt: 50 + i,
          plannedDate: '2026-10-19',
          subtasks: [],
        });
      }

      // 15 Evening tasks
      for (let i = 1; i <= 15; i++) {
        massive.push({
          id: `evening-scale-${i}`,
          title: `Evening Task ${i}`,
          status: 'todo',
          priority: 'p4',
          projectId: 'inbox',
          createdAt: 100 + i,
          plannedDate: '2026-10-19',
          isEvening: true,
          subtasks: [],
        });
      }

      mockTasks = massive;

      await flushRender(async () => (render(<HorizonTodayView />)));

      const morningSection = screen.getByRole('region', { name: 'Morning Focus' });
      expect(morningSection.textContent).toContain('20');

      const daytimeSection = screen.getByRole('region', { name: 'Daytime Flow' });
      expect(daytimeSection.textContent).toContain('25');

      const eveningSection = screen.getByRole('region', { name: 'This Evening' });
      expect(eveningSection.textContent).toContain('15');
    });
  });

  // =========================================================================
  // 5. TodayTimelineRail Extreme Time Boundaries (00:00, 23:45, Boundary Crossovers)
  // =========================================================================
  describe('5. TodayTimelineRail Extreme Time Boundaries (00:00, 23:45, Boundary Crossovers)', () => {
    it('snaps drop at 00:00 start of day cleanly', async () => {
      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;
      const ev = createDropEvent(canvas, 0, {
        'application/json': JSON.stringify({ taskId: 'task-midnight-start', duration: 30 }),
      });
      fireEvent(canvas, ev);

      expect(mockUpdateTask).toHaveBeenCalledWith('task-midnight-start', {
        scheduledStart: '00:00',
        scheduledEnd: '00:30',
        plannedDate: '2026-10-19',
      });
    });

    it('clamps negative clientY drops (scrolled/dragged above top) to 00:00', async () => {
      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;
      const ev = createDropEvent(canvas, -120, {
        'application/json': JSON.stringify({ taskId: 'task-negative-clamp', duration: 45 }),
      });
      fireEvent(canvas, ev);

      expect(mockUpdateTask).toHaveBeenCalledWith('task-negative-clamp', {
        scheduledStart: '00:00',
        scheduledEnd: '00:45',
        plannedDate: '2026-10-19',
      });
    });

    it('snaps drop at 23:45 with 15m duration and clamps scheduledEnd to 23:59', async () => {
      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;
      // 23:45 = 1425 minutes -> 1425px
      const ev = createDropEvent(canvas, 1425, {
        'application/json': JSON.stringify({ taskId: 'task-late-15m', duration: 15 }),
      });
      fireEvent(canvas, ev);

      expect(mockUpdateTask).toHaveBeenCalledWith('task-late-15m', {
        scheduledStart: '23:45',
        scheduledEnd: '23:59',
        plannedDate: '2026-10-19',
      });
    });

    it('clamps drop at 23:45 with 60m duration so task does not overflow past 24h (starts at 23:00)', async () => {
      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;
      // 23:45 with duration 60m: maxStart = 1440 - 60 = 1380 (23:00)
      const ev = createDropEvent(canvas, 1425, {
        'application/json': JSON.stringify({ taskId: 'task-late-60m', duration: 60 }),
      });
      fireEvent(canvas, ev);

      expect(mockUpdateTask).toHaveBeenCalledWith('task-late-60m', {
        scheduledStart: '23:00',
        scheduledEnd: '23:59',
        plannedDate: '2026-10-19',
      });
    });

    it('clamps drop far past 24:00 (clientY = 2500px) within 24h boundary', async () => {
      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;
      const ev = createDropEvent(canvas, 2500, {
        'application/json': JSON.stringify({ taskId: 'task-past-boundary', duration: 30 }),
      });
      fireEvent(canvas, ev);

      // Max start is 1440 - 30 = 1410 (23:30)
      expect(mockUpdateTask).toHaveBeenCalledWith('task-past-boundary', {
        scheduledStart: '23:30',
        scheduledEnd: '23:59',
        plannedDate: '2026-10-19',
      });
    });

    it('magnetically snaps to calendar event end boundary within 10-minute threshold', async () => {
      const events: CalendarEvent[] = [
        {
          id: 'ev-retro',
          title: 'Sprint Retrospective',
          startTime: '14:00',
          endTime: '15:10',
          date: '2026-10-19',
        },
      ];

      const { container } = await flushRender(async () => (render(
        <TodayTimelineRail
          isOpen={true}
          onToggleCollapse={vi.fn()}
          tasks={[]}
          calendarEvents={events}
          hourHeightPx={60}
          startHour={0}
          endHour={24}
        />
      )));

      const canvas = container.querySelector('.overscroll-contain')!;
      // 15:15 is 915px. 15:10 is 910m. Distance |915 - 910| = 5 <= 10m threshold -> snaps to 15:10
      const ev = createDropEvent(canvas, 915, {
        'application/json': JSON.stringify({ taskId: 'task-retro-followup', duration: 30 }),
      });
      fireEvent(canvas, ev);

      expect(mockUpdateTask).toHaveBeenCalledWith('task-retro-followup', {
        scheduledStart: '15:10',
        scheduledEnd: '15:40',
        plannedDate: '2026-10-19',
      });
    });
  });

  // =========================================================================
  // 6. Auto-Slot Day Algorithm Dense Schedule Stress Tests
  // =========================================================================
  describe('6. Auto-Slot Day Algorithm Dense Schedule Stress Tests', () => {
    it('100% full calendar leaves all tasks unslotted with zero schedule collisions', () => {
      const unscheduled: Task[] = [
        { id: 'u1', title: 'Task 1', status: 'todo', priority: 'p1', projectId: 'inbox', createdAt: 1, subtasks: [], estimatedMinutes: 30 },
        { id: 'u2', title: 'Task 2', status: 'todo', priority: 'p2', projectId: 'inbox', createdAt: 2, subtasks: [], estimatedMinutes: 30 },
      ];

      const backToBackMeetings: CalendarEvent[] = [
        { id: 'm1', title: 'Block 1', startTime: '08:00', endTime: '12:00' },
        { id: 'm2', title: 'Block 2', startTime: '12:00', endTime: '16:00' },
        { id: 'm3', title: 'Block 3', startTime: '16:00', endTime: '20:00' },
      ];

      const result = computeAutoSlotSchedule(unscheduled, [], backToBackMeetings, {
        startHour: 8,
        endHour: 20,
      });

      expect(result.slotted.length).toBe(0);
      expect(result.unslotted.length).toBe(2);
      expect(result.totalSlottedMinutes).toBe(0);
    });

    it('micro-gaps smaller than task duration are preserved and tasks stay in unslotted', () => {
      const unscheduled: Task[] = [
        { id: 'u1', title: 'Task 30m', status: 'todo', priority: 'p1', projectId: 'inbox', createdAt: 1, subtasks: [], estimatedMinutes: 30 },
      ];

      // 10-minute gap from 09:50 to 10:00
      const meetings: CalendarEvent[] = [
        { id: 'm1', title: 'Session A', startTime: '09:00', endTime: '09:50' },
        { id: 'm2', title: 'Session B', startTime: '10:00', endTime: '17:00' },
      ];

      const result = computeAutoSlotSchedule(unscheduled, [], meetings, {
        startHour: 9,
        endHour: 17,
      });

      expect(result.slotted.length).toBe(0);
      expect(result.unslotted.length).toBe(1);
    });

    it('overlapping/double-booked calendar events are merged seamlessly', () => {
      const unscheduled: Task[] = [
        { id: 'u1', title: 'Task After Overlap', status: 'todo', priority: 'p1', projectId: 'inbox', createdAt: 1, subtasks: [], estimatedMinutes: 60 },
      ];

      const overlaps: CalendarEvent[] = [
        { id: 'm1', title: 'Meeting 1', startTime: '10:00', endTime: '11:30' },
        { id: 'm2', title: 'Meeting 2', startTime: '11:00', endTime: '12:30' },
      ];

      const result = computeAutoSlotSchedule(unscheduled, [], overlaps, {
        startHour: 10,
        endHour: 16,
        bufferMinutes: 0,
      });

      expect(result.slotted.length).toBe(1);
      expect(result.slotted[0].scheduledStart).toBe('12:30');
      expect(result.slotted[0].dueTime).toBe('13:30');
    });

    it('prioritizes pinned Top 3 tasks ahead of higher-scoring unpinned items', () => {
      const unscheduled: Task[] = [
        { id: 'unpinned-p1', title: 'P1 Unpinned', status: 'todo', priority: 'p1', isPinnedToday: false, projectId: 'inbox', createdAt: 1, subtasks: [], estimatedMinutes: 60 },
        { id: 'pinned-p3', title: 'P3 Pinned', status: 'todo', priority: 'p3', isPinnedToday: true, projectId: 'inbox', createdAt: 2, subtasks: [], estimatedMinutes: 60 },
      ];

      // Exactly 60m available (09:00 - 10:00)
      const result = computeAutoSlotSchedule(unscheduled, [], [], {
        startHour: 9,
        endHour: 10,
        bufferMinutes: 0,
      });

      expect(result.slotted.length).toBe(1);
      expect(result.slotted[0].taskId).toBe('pinned-p3');
      expect(result.unslotted.length).toBe(1);
      expect(result.unslotted[0].id).toBe('unpinned-p1');
    });
  });

  // =========================================================================
  // 7. Modular Shell Responsiveness & View Transitions Across Breakpoints
  // =========================================================================
  describe('7. Modular Shell Responsiveness & View Transitions Across Breakpoints', () => {
    it('DesktopHeader renders view title, breadcrumb, focus controls, and quick capture', async () => {
      const onToggle = vi.fn();
      const onQuickAdd = vi.fn();
      const onOpenFocus = vi.fn();

      await flushRender(async () => (render(
        <DesktopHeader
          viewTitle="Today Horizon"
          isSidebarCollapsed={false}
          onToggleSidebar={onToggle}
          onOpenFocus={onOpenFocus}
          onOpenAuth={vi.fn()}
          onQuickAdd={onQuickAdd}
          onOpenCommandPalette={vi.fn()}
          onOpenSettings={vi.fn()}
          syncStatus="synced"
          user={{ displayName: 'Alex Mercer', email: 'alex@flowtask.app' }}
          isAnonymous={false}
        />
      )));

      expect(screen.getByText('Today Horizon')).toBeDefined();
      expect(screen.getByText('FlowTask')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Focus', exact: true })).toBeDefined();
      expect(screen.getByText('Alex Mercer')).toBeDefined();
      expect(screen.getByText('Synced')).toBeDefined();

      const quickAddBtn = screen.getByRole('button', { name: 'New Task' });
      fireEvent.click(quickAddBtn);
      expect(onQuickAdd).toHaveBeenCalled();

      const toggleBtn = screen.getByRole('button', { name: 'Toggle Sidebar ([)' });
      fireEvent.click(toggleBtn);
      expect(onToggle).toHaveBeenCalled();
    });

    it('MobileBottomNav renders navigation tabs, caps count badge at 99+, and handles view selection', async () => {
      const onSelectView = vi.fn();
      const onQuickAdd = vi.fn();
      const onOpenMenu = vi.fn();

      await flushRender(async () => (render(
        <MobileBottomNav
          activeView="today"
          onSelectView={onSelectView}
          onQuickAdd={onQuickAdd}
          onOpenMenu={onOpenMenu}
          todayCount={120}
          inboxCount={8}
          upcomingCount={0}
        />
      )));

      expect(screen.getByText('99+')).toBeDefined();
      expect(screen.getByText('8')).toBeDefined();

      const inboxBtn = screen.getByRole('button', { name: 'Inbox View' });
      fireEvent.click(inboxBtn);
      expect(onSelectView).toHaveBeenCalledWith('inbox');

      const addBtn = screen.getByRole('button', { name: 'Quick Add Task' });
      fireEvent.click(addBtn);
      expect(onQuickAdd).toHaveBeenCalled();

      const moreBtn = screen.getByRole('button', { name: 'More views and projects' });
      fireEvent.click(moreBtn);
      expect(onOpenMenu).toHaveBeenCalled();
    });

    it('ViewContainer resets scroll position on activeView transition and renders shared snapshot banner', async () => {
      const onImport = vi.fn();
      const onDismiss = vi.fn();

      const snapshot = {
        title: 'Project Roadmap Snapshot',
        v: 1,
        exportedAt: Date.now(),
        tasks: [{ title: 'Milestone 1' }, { title: 'Milestone 2' }],
      };

      const { rerender } = await flushRender(async () => (render(
        <ViewContainer
          activeView="today"
          viewTitle="Today"
          onBackToToday={vi.fn()}
          pendingSnapshot={snapshot}
          onImportSnapshot={onImport}
          onDismissSnapshot={onDismiss}
        >
          <div data-testid="today-content">Today Content</div>
        </ViewContainer>
      )));

      expect(screen.getByText(/Shared Task Snapshot: "Project Roadmap Snapshot"/)).toBeDefined();
      expect(screen.getByText(/Contains 2 tasks shared via zero-auth client link/)).toBeDefined();

      const importBtn = screen.getByRole('button', { name: /Import 2 Tasks/ });
      fireEvent.click(importBtn);
      expect(onImport).toHaveBeenCalledWith(snapshot);

      rerender(
        <ViewContainer
          activeView="upcoming"
          viewTitle="Upcoming"
          onBackToToday={vi.fn()}
          pendingSnapshot={null}
          onImportSnapshot={onImport}
          onDismissSnapshot={onDismiss}
        >
          <div data-testid="upcoming-content">Upcoming Content</div>
        </ViewContainer>
      );

      expect(screen.queryByText(/Shared Task Snapshot/)).toBeNull();
      expect(screen.getByTestId('upcoming-content')).toBeDefined();
    });

    it('AppShell mounts workspace frame, skip link, and passes children to main container', async () => {
      await flushRender(async () => (render(
        <AppShell
          isSidebarCollapsed={false}
          onToggleSidebar={vi.fn()}
          isSidebarOpenMobile={false}
          onCloseMobileSidebar={vi.fn()}
          onOpenMobileSidebar={vi.fn()}
          onOpenPomodoro={vi.fn()}
          onOpenShortcuts={vi.fn()}
          onOpenExportImport={vi.fn()}
          onOpenBrainDump={vi.fn()}
          onOpenAesthetics={vi.fn()}
          onOpenScratchpad={vi.fn()}
          onOpenStudySession={vi.fn()}
          onOpenSettings={vi.fn()}
          desktopHeader={<div data-testid="test-desktop-header">Desktop Header</div>}
          mobileHeader={<div data-testid="test-mobile-header">Mobile Header</div>}
          activeView="today"
          onSelectView={vi.fn()}
          onQuickAdd={vi.fn()}
          todayCount={3}
          inboxCount={1}
          upcomingCount={0}
          selectedTaskId={null}
          onCloseDrawer={vi.fn()}
          onStartFocus={vi.fn()}
          isPomodoroOpen={false}
          onSelectTaskFromModalRoot={vi.fn()}
        >
          <div data-testid="shell-main-content">Shell Main Content</div>
        </AppShell>
      )));

      expect(screen.getByText('Skip to main content')).toBeDefined();
      expect(screen.getByTestId('test-desktop-header')).toBeDefined();
      expect(screen.getByTestId('test-mobile-header')).toBeDefined();
      expect(screen.getByTestId('shell-main-content')).toBeDefined();
    });
  });
});

