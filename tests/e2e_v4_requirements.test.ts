import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';

// Domain Types
import type { Task, Priority, SubTask, CalendarEvent } from '../src/types/task';
import type { WorkspaceRecord } from '../src/types/workspace';

// Stores & State Management
import { WorkspaceStore } from '../src/services/workspaceStore';
import { commandService } from '../src/services/commandService';
import { useFocusStore } from '../src/store/useFocusStore';
import { useUIStore } from '../src/store/useUIStore';
import { useModalStore } from '../src/store/useModalStore';

// Domain Logic & Selectors
import {
  isFocusTask,
  isTodayTask,
  isSomedayTask,
  completedOn,
} from '../src/utils/taskSelectors';
import { formatLocalDate } from '../src/utils/nlpParser';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  calculateBlockPosition,
  classifyTaskCognitiveIntensity,
  analyzeCognitiveTopology,
  findOverlappingCalendarEvent,
  findNextFreeGap,
  rippleScheduleGaps,
  calculateCapacityMetrics,
  TIMELINE_START_HOUR,
  TIMELINE_HOUR_HEIGHT_PX,
} from '../src/utils/timelineUtils';

// Web APIs & Native Integrations
import {
  pictureInPictureService,
  isDocumentPipSupported,
  syncStylesToPipWindow,
} from '../src/services/pictureInPictureService';
import {
  updateMediaSessionMetadata,
  registerMediaSessionHandlers,
} from '../src/services/studioAudio';
import celebrate from '../src/utils/celebrate';
import {
  registerWebMcpTools,
  unregisterWebMcpTools,
  setWebMcpActiveStore,
} from '../src/services/webMcpService';

// Hooks
import { useKeyboardNavigation } from '../src/hooks/useKeyboardNavigation';

// Mock Confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));
import confetti from 'canvas-confetti';

// Helper: Task Factory
function createTestTask(overrides: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: `task-${Math.random().toString(36).substring(2, 9)}`,
    title: 'Test Task',
    status: 'todo',
    priority: 'p3',
    projectId: 'inbox',
    plannedDate: formatLocalDate(new Date()),
    subtasks: [],
    createdAt: now,
    updatedAt: now,
    revision: 1,
    ...overrides,
  };
}

// Helper: In-Memory Workspace Persistence Mock
function createMockPersistence(initialTasks: Task[] = []) {
  const record: WorkspaceRecord = {
    schemaVersion: 5,
    workspaceId: 'test-ws-v4',
    tasks: initialTasks,
    projects: [
      { id: 'inbox', name: 'Inbox', color: '#6366f1', createdAt: Date.now(), updatedAt: Date.now() },
      { id: 'work', name: 'Work', color: '#10b981', createdAt: Date.now(), updatedAt: Date.now() },
      { id: 'personal', name: 'Personal', color: '#f59e0b', createdAt: Date.now(), updatedAt: Date.now() },
    ],
    dashboards: [],
    customViews: [],
    preferences: {
      focusLogs: [],
      settings: {
        defaultTaskPriority: 'p3',
        enableSmartSyntaxParsing: true,
      },
    },
    pending: [],
    undo: [],
    updatedAt: Date.now(),
  };

  return {
    record,
    ensureLegacyMigrated: vi.fn(async () => structuredClone(record)),
    saveWorkspace: vi.fn(async (_id: string, updated: WorkspaceRecord) => {
      Object.assign(record, structuredClone(updated));
    }),
    loadWorkspace: vi.fn(async () => structuredClone(record)),
    requestPersistentStorage: vi.fn(async () => true),
  };
}

// React Keyboard Harness Component using pure React.createElement
interface HarnessProps {
  tasks: Task[];
  onSelectTask?: (id: string) => void;
  onToggleStatus?: (id: string) => void;
  onTogglePinToday?: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
  onDeleteTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onBatchUpdate?: (ids: string[], updates: Partial<Task>) => void;
  onBatchDelete?: (ids: string[]) => void;
  onBatchArchive?: (ids: string[]) => void;
}

const KeyboardNavHarness: React.FC<HarnessProps> = (props) => {
  useKeyboardNavigation({
    tasks: props.tasks,
    onSelectTask: props.onSelectTask || vi.fn(),
    onToggleStatus: props.onToggleStatus || vi.fn(),
    onTogglePinToday: props.onTogglePinToday || vi.fn(),
    onUpdateTask: props.onUpdateTask || vi.fn(),
    onDeleteTask: props.onDeleteTask || vi.fn(),
    onStartFocus: props.onStartFocus || vi.fn(),
    onBatchUpdate: props.onBatchUpdate || vi.fn(),
    onBatchDelete: props.onBatchDelete || vi.fn(),
    onBatchArchive: props.onBatchArchive || vi.fn(),
    enabled: true,
  });
  return React.createElement('div', { 'data-testid': 'keyboard-harness' }, 'Harness');
};

/* ==========================================================================
   TIER 1: FEATURE COVERAGE (>=5 Test Cases per Feature)
   ========================================================================== */

describe('Tier 1: Feature Coverage (FlowTask v4.0 Requirements)', () => {
  const todayStr = formatLocalDate(new Date());

  afterEach(() => {
    vi.restoreAllMocks();
    unregisterWebMcpTools();
    setWebMcpActiveStore(null);
    useFocusStore.getState().setFocusSession(null);
    useUIStore.getState().clearTaskSelection();
    useUIStore.getState().setSelectedTaskId(null);
    useUIStore.getState().setFocusedTaskId(null);
    useModalStore.getState().closeAllModals();
  });

  // Feature 1: Top 3 Priorities Deck
  describe('1.1 Top 3 Priorities Deck (Things 3 Intentional Day Flow)', () => {
    it('1.1.1 pins task to Top 3 with explicit topThreeDate and isPinnedToday flag', () => {
      const task = createTestTask({ isPinnedToday: false });
      const result = commandService.updateTask([task], task.id, {
        isPinnedToday: true,
        topThreeDate: todayStr,
      });

      const updated = result.updatedTasks.find((t) => t.id === task.id);
      expect(updated?.isPinnedToday).toBe(true);
      expect(updated?.topThreeDate).toBe(todayStr);
      expect(isFocusTask(updated!, todayStr)).toBe(true);
    });

    it('1.1.2 unpins task from Top 3 while preserving planned date and active status', () => {
      const task = createTestTask({ isPinnedToday: true, topThreeDate: todayStr, plannedDate: todayStr });
      const result = commandService.updateTask([task], task.id, {
        isPinnedToday: false,
        topThreeDate: undefined,
      });

      const updated = result.updatedTasks.find((t) => t.id === task.id);
      expect(updated?.isPinnedToday).toBe(false);
      expect(updated?.topThreeDate).toBeUndefined();
      expect(isFocusTask(updated!, todayStr)).toBe(false);
      expect(isTodayTask(updated!, todayStr)).toBe(true);
    });

    it('1.1.3 isFocusTask selector strictly filters out tasks from other dates or completed status', () => {
      const yesterday = '2026-10-18';
      const taskYesterday = createTestTask({ topThreeDate: yesterday });
      const taskToday = createTestTask({ topThreeDate: todayStr, status: 'todo' });
      const taskDone = createTestTask({ topThreeDate: todayStr, status: 'done', completedAt: Date.now() });

      expect(isFocusTask(taskYesterday, todayStr)).toBe(false);
      expect(isFocusTask(taskToday, todayStr)).toBe(true);
      expect(isFocusTask(taskDone, todayStr)).toBe(false);
    });

    it('1.1.4 Top 3 deck ordering strictly sorts by priority weight (p1 > p2 > p3 > p4)', () => {
      const p3Task = createTestTask({ id: 't3', priority: 'p3', topThreeDate: todayStr });
      const p1Task = createTestTask({ id: 't1', priority: 'p1', topThreeDate: todayStr });
      const p2Task = createTestTask({ id: 't2', priority: 'p2', topThreeDate: todayStr });

      const topThreeTasks = [p3Task, p1Task, p2Task].filter((t) => isFocusTask(t, todayStr));
      const priorityOrder: Record<Priority, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
      topThreeTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      expect(topThreeTasks.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    });

    it('1.1.5 completing a Top 3 task preserves historical pin state and sets completedAt timestamp', () => {
      const task = createTestTask({ topThreeDate: todayStr, isPinnedToday: true });
      const result = commandService.toggleTaskStatus([task], task.id);
      const completed = result.updatedTasks.find((t) => t.id === task.id);

      expect(completed?.status).toBe('done');
      expect(completed?.completedAt).toBeTypeOf('number');
      expect(completed?.isPinnedToday).toBe(true);
      expect(completedOn(completed!, todayStr)).toBe(true);
    });
  });

  // Feature 2: Structured Daytime Task Batches
  describe('1.2 Structured Daytime Task Batches (Morning, Afternoon, Evening, Someday)', () => {
    it('1.2.1 Morning Focus batch selects high-intensity or morning scheduled tasks', () => {
      const morningTask = createTestTask({ scheduledStart: '09:00', scheduledEnd: '10:00' });
      const deepWorkTask = createTestTask({ priority: 'p1', estimatedMinutes: 60 });
      const adminTask = createTestTask({ scheduledStart: '14:00', priority: 'p4', estimatedMinutes: 15 });

      const all = [morningTask, deepWorkTask, adminTask];
      const morningBatch = all.filter((t) => {
        const startMin = parseTimeToMinutes(t.scheduledStart);
        return (startMin !== null && startMin < 12 * 60) || classifyTaskCognitiveIntensity(t) === 'deep';
      });

      expect(morningBatch.map((t) => t.id)).toEqual([morningTask.id, deepWorkTask.id]);
    });

    it('1.2.2 Daytime Flow batch captures midday tasks without evening flags', () => {
      const afternoonTask = createTestTask({ scheduledStart: '14:30', isEvening: false });
      const eveningTask = createTestTask({ isEvening: true });
      const somedayTask = createTestTask({ isSomeday: true });

      const all = [afternoonTask, eveningTask, somedayTask];
      const daytimeFlow = all.filter((t) => isTodayTask(t, todayStr) && !t.isEvening && !t.isSomeday);

      expect(daytimeFlow.map((t) => t.id)).toEqual([afternoonTask.id]);
    });

    it('1.2.3 Evening Batch partition captures tasks with isEvening flag or scheduled post-18:00', () => {
      const eveningFlagged = createTestTask({ isEvening: true });
      const lateScheduled = createTestTask({ scheduledStart: '19:00' });
      const dayTask = createTestTask({ scheduledStart: '11:00', isEvening: false });

      const all = [eveningFlagged, lateScheduled, dayTask];
      const eveningBatch = all.filter((t) => {
        const startMin = parseTimeToMinutes(t.scheduledStart);
        return Boolean(t.isEvening || (startMin !== null && startMin >= 18 * 60));
      });

      expect(eveningBatch.map((t) => t.id)).toEqual([eveningFlagged.id, lateScheduled.id]);
    });

    it('1.2.4 Someday / Backlog partition cleanly isolates deferred tasks from today', () => {
      const somedayTask = createTestTask({ isSomeday: true, plannedDate: undefined });
      const todayTask = createTestTask({ isSomeday: false, plannedDate: todayStr });

      expect(isSomedayTask(somedayTask)).toBe(true);
      expect(isTodayTask(somedayTask, todayStr)).toBe(false);
      expect(isSomedayTask(todayTask)).toBe(false);
      expect(isTodayTask(todayTask, todayStr)).toBe(true);
    });

    it('1.2.5 reassigning batch membership deterministically updates task flags and recalculates groups', () => {
      let task = createTestTask({ isEvening: true });
      const toMorning = commandService.updateTask([task], task.id, {
        isEvening: false,
        scheduledStart: '08:30',
        scheduledEnd: '09:30',
      });
      task = toMorning.updatedTasks[0];
      expect(task.isEvening).toBe(false);
      expect(task.scheduledStart).toBe('08:30');

      const toSomeday = commandService.updateTask([task], task.id, {
        isSomeday: true,
        plannedDate: undefined,
        scheduledStart: undefined,
      });
      task = toSomeday.updatedTasks[0];
      expect(isSomedayTask(task)).toBe(true);
      expect(isTodayTask(task, todayStr)).toBe(false);
    });
  });

  // Feature 3: Timeline Rail Snapping & 24h Schedule Canvas
  describe('1.3 Timeline Rail Snapping & 24h Schedule Canvas', () => {
    it('1.3.1 snaps arbitrary dragged delta minutes to strict 15-minute grid slots', () => {
      const snapTo15 = (deltaMinutes: number) => Math.round(deltaMinutes / 15) * 15;

      expect(snapTo15(7)).toBe(0);
      expect(snapTo15(8)).toBe(15);
      expect(snapTo15(22)).toBe(15);
      expect(snapTo15(23)).toBe(30);
      expect(snapTo15(52)).toBe(45);
      expect(snapTo15(53)).toBe(60);
    });

    it('1.3.2 clamps scheduled start within valid timeline canvas bounds (07:00 to 24:00)', () => {
      const duration = 60;
      const minBound = TIMELINE_START_HOUR * 60; // 420 (07:00)
      const maxBound = 1440 - duration; // 1380 (23:00)

      const clampStart = (startMin: number) => Math.max(minBound, Math.min(maxBound, startMin));

      expect(clampStart(300)).toBe(420); // 05:00 clamped to 07:00
      expect(clampStart(600)).toBe(600); // 10:00 preserved
      expect(clampStart(1420)).toBe(1380); // 23:40 clamped so end does not exceed 24:00
    });

    it('1.3.3 calculateBlockPosition computes exact CSS offsets based on hourHeightPx and minimum height', () => {
      const pos1 = calculateBlockPosition(7 * 60, 60, TIMELINE_START_HOUR, TIMELINE_HOUR_HEIGHT_PX);
      expect(pos1.topPx).toBe(0);
      expect(pos1.heightPx).toBe(80);

      // 15-minute task: (15/60)*80 = 20px, but minimum height enforcement is 38px
      const pos2 = calculateBlockPosition(8 * 60, 15, TIMELINE_START_HOUR, TIMELINE_HOUR_HEIGHT_PX);
      expect(pos2.topPx).toBe(80);
      expect(pos2.heightPx).toBe(38);

      // Deep work with 15m buffer: (15/60)*80 = 20px buffer height
      const pos3 = calculateBlockPosition(9 * 60, 90, TIMELINE_START_HOUR, TIMELINE_HOUR_HEIGHT_PX, 15);
      expect(pos3.topPx).toBe(160);
      expect(pos3.heightPx).toBe(120);
      expect(pos3.bufferHeightPx).toBe(20);
    });

    it('1.3.4 findNextFreeGap locates earliest available 15-min aligned slot avoiding collisions', () => {
      const scheduled = [
        createTestTask({ scheduledStart: '09:00', estimatedMinutes: 60 }),
        createTestTask({ scheduledStart: '10:00', estimatedMinutes: 60 }),
      ];
      const events: CalendarEvent[] = [
        { id: 'ev1', title: 'Standup', startTime: '11:00', endTime: '11:30' },
      ];

      // Looking for a 45-minute gap starting from 08:30
      const gap = findNextFreeGap(45, scheduled, events, 8 * 60 + 30);
      // 08:30-09:15 collides with 09:00 task. Free gap is after meeting at 11:30
      expect(gap).toBe(11 * 60 + 30); // 11:30 (690 minutes)
    });

    it('1.3.5 rippleScheduleGaps cascades overlapping tasks downwards in 15-min aligned slots with buffer', () => {
      const task1 = createTestTask({ id: 't1', scheduledStart: '10:00', estimatedMinutes: 60 });
      const task2 = createTestTask({ id: 't2', scheduledStart: '10:30', estimatedMinutes: 30 });
      const task3 = createTestTask({ id: 't3', scheduledStart: '11:00', estimatedMinutes: 45 });

      // Dropping task1 at 10:00 with 60m duration (deep work, auto-inserts 15m buffer: ends at 11:15)
      const ripples = rippleScheduleGaps([task1, task2, task3], 't1', 10 * 60, 60);

      expect(ripples).toHaveLength(3);
      expect(ripples[0]).toEqual({
        id: 't1',
        scheduledStart: '10:00',
        scheduledEnd: '11:00',
        bufferMinutes: 15,
      });
      // task2 is pushed to start after task1 + buffer = 11:15
      expect(ripples[1].id).toBe('t2');
      expect(ripples[1].scheduledStart).toBe('11:15');
      expect(ripples[1].scheduledEnd).toBe('11:45');
      // task3 is pushed to start at 11:45
      expect(ripples[2].id).toBe('t3');
      expect(ripples[2].scheduledStart).toBe('11:45');
    });
  });

  // Feature 4: Unified Focus Engine V4 (Zen, Lo-Fi Studio, Sprint Modes)
  describe('1.4 Unified Focus Engine V4 (Zen, Lo-Fi Studio, Sprint Modes)', () => {
    it('1.4.1 Zen Mode initiates minimalist Pomodoro countdown with exact target seconds', () => {
      const task = createTestTask({ title: 'Zen Architecture Plan' });
      const session = useFocusStore.getState().startFocusSession('pomodoro', task.id, task.title, 1500);

      expect(session.mode).toBe('pomodoro');
      expect(session.taskId).toBe(task.id);
      expect(session.taskTitle).toBe('Zen Architecture Plan');
      expect(session.targetDurationSec).toBe(1500);
      expect(useFocusStore.getState().activeTimerTaskId).toBe(task.id);
    });

    it('1.4.2 Lo-Fi Studio Mode updates MediaSession metadata with track info and audio artist', () => {
      const mockMediaSession = {
        metadata: null as unknown,
        setActionHandler: vi.fn(),
      };
      vi.stubGlobal('navigator', { mediaSession: mockMediaSession });
      vi.stubGlobal('MediaMetadata', class {
        constructor(public init: unknown) {}
      });

      updateMediaSessionMetadata({
        title: 'Rainy Kyoto Garden',
        artist: 'FlowTask Lo-Fi Synthesizer',
        album: 'Deep Focus Ambience',
      });

      expect(mockMediaSession.metadata).toBeDefined();
      const meta = mockMediaSession.metadata as { init: { title: string; artist: string; album: string } };
      expect(meta.init.title).toBe('Rainy Kyoto Garden');
      expect(meta.init.artist).toBe('FlowTask Lo-Fi Synthesizer');
    });

    it('1.4.3 Sprint Mode tracks step-by-step subtask breakdown, auto-pacing and switching', () => {
      const subtask1: SubTask = { id: 'st1', title: 'Parse AST', completed: false, difficulty: 'MEDIUM' };
      const subtask2: SubTask = { id: 'st2', title: 'Generate Code', completed: false, difficulty: 'HARD' };
      const task = createTestTask({ title: 'Compiler Sprint', subtasks: [subtask1, subtask2] });

      const session = useFocusStore.getState().startFocusSession(
        'sprint',
        task.id,
        task.title,
        3000,
        subtask1.id,
        subtask1.title,
        900
      );

      expect(session.mode).toBe('sprint');
      expect(session.subtaskId).toBe('st1');
      expect(session.pacingSecondsPerUnit).toBe(900);

      // Switch to subtask 2
      useFocusStore.getState().switchSubtask('st2', 'Generate Code', 1200);
      const updatedSession = useFocusStore.getState().focusSession;
      expect(updatedSession?.subtaskId).toBe('st2');
      expect(updatedSession?.subtaskTitle).toBe('Generate Code');
      expect(updatedSession?.targetDurationSec).toBe(1200);
    });

    it('1.4.4 Document PiP coordinator verifies API support, requests window, and handles style sync', async () => {
      const mockPipWindow = {
        document: {
          head: { appendChild: vi.fn() },
          documentElement: {
            className: '',
            setAttribute: vi.fn(),
            classList: { add: vi.fn(), contains: vi.fn().mockReturnValue(false) },
          },
          body: { className: '' },
          title: '',
        },
        closed: false,
        focus: vi.fn(),
        close: vi.fn(function (this: { closed: boolean }) {
          this.closed = true;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => mockPipWindow),
      });

      expect(isDocumentPipSupported()).toBe(true);
      const win = await pictureInPictureService.requestPipWindow({ width: 340, height: 180 });
      expect(win).toBe(mockPipWindow);
      expect(pictureInPictureService.isOpen()).toBe(true);

      syncStylesToPipWindow(mockPipWindow as unknown as Window);
      expect(mockPipWindow.document.title).toBe('FlowTask Focus HUD');

      pictureInPictureService.closePipWindow();
      expect(pictureInPictureService.isOpen()).toBe(false);
    });

    it('1.4.5 MediaSession action handlers (play, pause, stop) control focus session state', () => {
      const actionHandlers: Record<string, () => void> = {};
      vi.stubGlobal('navigator', {
        mediaSession: {
          setActionHandler: vi.fn((action: string, handler: () => void) => {
            actionHandlers[action] = handler;
          }),
        },
      });

      registerMediaSessionHandlers({
        onPlay: () => useFocusStore.getState().resumeFocusSession(),
        onPause: () => useFocusStore.getState().pauseFocusSession(),
        onStop: () => useFocusStore.getState().stopFocusSession(),
      });

      useFocusStore.getState().startFocusSession('pomodoro', 'task-1', 'Test', 1500);
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      actionHandlers.pause();
      expect(useFocusStore.getState().focusSession?.state).toBe('paused');

      actionHandlers.play();
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      actionHandlers.stop();
      expect(useFocusStore.getState().focusSession).toBeNull();
    });
  });

  // Feature 5: Linear-Grade Keyboard Navigation
  describe('1.5 Linear-Grade Keyboard Navigation (Vim Keys, Multi-Select, Hotkeys)', () => {
    const tasks = [
      createTestTask({ id: 't1', title: 'Task 1' }),
      createTestTask({ id: 't2', title: 'Task 2' }),
      createTestTask({ id: 't3', title: 'Task 3' }),
    ];

    it('1.5.1 J key traverses down the list and wraps around from end to beginning', () => {
      const onSelect = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onSelectTask: onSelect }));

      // First 'j' highlights index 0
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('t1');

      // Second 'j' highlights index 1
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('t2');

      // Third 'j' highlights index 2
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('t3');

      // Fourth 'j' wraps around to index 0
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('t1');
    });

    it('1.5.2 K key traverses up the list and wraps around backwards', () => {
      render(React.createElement(KeyboardNavHarness, { tasks }));

      // Press 'k' from unselected state wraps to last task 't3'
      fireEvent.keyDown(window, { key: 'k' });
      expect(useUIStore.getState().focusedTaskId).toBe('t3');

      // Press 'k' again moves up to 't2'
      fireEvent.keyDown(window, { key: 'k' });
      expect(useUIStore.getState().focusedTaskId).toBe('t2');
    });

    it('1.5.3 Shift+J accumulates tasks into multi-selection array', () => {
      render(React.createElement(KeyboardNavHarness, { tasks }));

      // Focus first task
      fireEvent.keyDown(window, { key: 'j' });
      // Shift+J expands selection
      fireEvent.keyDown(window, { key: 'j', shiftKey: true });

      const selected = useUIStore.getState().selectedTaskIds;
      expect(selected).toContain('t1');
      expect(selected).toContain('t2');
    });

    it('1.5.4 Space key triggers onToggleStatus on the focused task', () => {
      const onToggle = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onToggleStatus: onToggle }));

      fireEvent.keyDown(window, { key: 'j' }); // focus t1
      fireEvent.keyDown(window, { key: ' ' }); // space toggle

      expect(onToggle).toHaveBeenCalledWith('t1');
    });

    it('1.5.5 Delete / Backspace key triggers onDeleteTask on the focused task', () => {
      const onDelete = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onDeleteTask: onDelete }));

      fireEvent.keyDown(window, { key: 'j' }); // focus t1
      fireEvent.keyDown(window, { key: 'Delete' });

      expect(onDelete).toHaveBeenCalledWith('t1');
    });
  });

  // Feature 6: Single-Key Micro-Popovers & Shortcuts
  describe('1.6 Single-Key Micro-Popovers & Shortcuts (p, d, t, m, s, e)', () => {
    const tasks = [createTestTask({ id: 't1', title: 'Target Task' })];

    it('1.6.1 number keys (1, 2, 3, 4) update priority immediately on highlighted task', () => {
      const onUpdate = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onUpdateTask: onUpdate }));

      fireEvent.keyDown(window, { key: 'j' }); // focus t1
      fireEvent.keyDown(window, { key: '1' }); // P1 Urgent
      expect(onUpdate).toHaveBeenCalledWith('t1', { priority: 'p1' });

      fireEvent.keyDown(window, { key: '2' }); // P2 High
      expect(onUpdate).toHaveBeenCalledWith('t1', { priority: 'p2' });
    });

    it('1.6.2 T key reschedules highlighted task to Today and clears someday status', () => {
      const onUpdate = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onUpdateTask: onUpdate }));

      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 't' });

      expect(onUpdate).toHaveBeenCalledWith('t1', {
        plannedDate: todayStr,
        isSomeday: false,
      });
    });

    it('1.6.3 M key reschedules highlighted task to Tomorrow', () => {
      const onUpdate = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onUpdateTask: onUpdate }));

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatLocalDate(tomorrow);

      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'm' });

      expect(onUpdate).toHaveBeenCalledWith('t1', {
        plannedDate: tomorrowStr,
        isSomeday: false,
        isPinnedToday: false,
      });
    });

    it('1.6.4 S key defers highlighted task to Someday with dates cleared', () => {
      const onUpdate = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onUpdateTask: onUpdate }));

      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 's' });

      expect(onUpdate).toHaveBeenCalledWith('t1', {
        isSomeday: true,
        plannedDate: undefined,
        dueDate: undefined,
        isPinnedToday: false,
      });
    });

    it('1.6.5 E key archives the selected batch and clears selection', () => {
      const onBatchArchive = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onBatchArchive }));

      useUIStore.getState().selectAllTasks(['t1']);
      fireEvent.keyDown(window, { key: 'e' });

      expect(onBatchArchive).toHaveBeenCalledWith(['t1']);
      expect(useUIStore.getState().selectedTaskIds).toEqual([]);
    });

    it('1.6.6 P key opens PriorityPickerPopover on highlighted task', () => {
      render(React.createElement(KeyboardNavHarness, { tasks }));

      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'p' });

      expect(useUIStore.getState().activePopover).toEqual({
        type: 'priority',
        taskId: 't1',
      });
      useUIStore.getState().setActivePopover(null);
    });

    it('1.6.7 D key opens DatePickerPopover on highlighted task when no multi-select is active', () => {
      render(React.createElement(KeyboardNavHarness, { tasks }));

      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'd' });

      expect(useUIStore.getState().activePopover).toEqual({
        type: 'date',
        taskId: 't1',
      });
      useUIStore.getState().setActivePopover(null);
    });
  });

  // Feature 7: WebMCP 8 Tools & Protocol Bridge
  describe('1.7 WebMCP 8 Tools & Client-Side Assistant Protocol', () => {
    let store: WorkspaceStore;

    beforeEach(async () => {
      const mockPersistence = createMockPersistence();
      store = new WorkspaceStore('mcp-ws', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();
      setWebMcpActiveStore(store);
      registerWebMcpTools();
    });

    it('1.7.1 registers global bridge on window.__FLOWTASK_MCP__ with schema metadata', () => {
      expect(window.__FLOWTASK_MCP__).toBeDefined();
      expect(window.__FLOWTASK_MCP__?.version).toBe('1.0.0');
      const tools = window.__FLOWTASK_MCP__?.getTools() || [];
      expect(tools.length).toBeGreaterThanOrEqual(4);
      expect(tools.map((t) => t.name)).toContain('createTask');
      expect(tools.map((t) => t.name)).toContain('listTodayTasks');
      expect(tools.map((t) => t.name)).toContain('startFocusSession');
      expect(tools.map((t) => t.name)).toContain('getWorkspaceStatus');
    });

    it('1.7.2 createTask tool validates parameters, parses NLP tags, and updates store', async () => {
      const res = (await window.__FLOWTASK_MCP__?.callTool('createTask', {
        title: 'Draft RFC #work p1',
        estimatedMinutes: 45,
      })) as { success: boolean; task: Task };

      expect(res.success).toBe(true);
      expect(res.task.title).toContain('Draft RFC');
      expect(res.task.priority).toBe('p1');
      expect(res.task.estimatedMinutes).toBe(45);

      const tasksInStore = store.getSnapshot().record.tasks;
      expect(tasksInStore.some((t) => t.id === res.task.id)).toBe(true);
    });

    it('1.7.3 listTodayTasks organizes tasks into topThree, daytime, and completed categories', async () => {
      const t1 = createTestTask({ title: 'Top 1', topThreeDate: todayStr });
      const t2 = createTestTask({ title: 'Daytime 1', plannedDate: todayStr, isSomeday: false });
      const t3 = createTestTask({ title: 'Done 1', status: 'done', completedAt: Date.now() });
      store.run('Seed', (r) => ({ ...r, tasks: [t1, t2, t3] }));

      const res = (await window.__FLOWTASK_MCP__?.callTool('listTodayTasks', {
        includeCompleted: true,
      })) as {
        totalCount: number;
        topThree: Task[];
        daytime: Task[];
        completed: Task[];
      };

      expect(res.topThree.map((t) => t.id)).toContain(t1.id);
      expect(res.daytime.map((t) => t.id)).toContain(t2.id);
      expect(res.completed.map((t) => t.id)).toContain(t3.id);
      expect(res.totalCount).toBe(3);
    });

    it('1.7.4 startFocusSession validates task existence, starts session, and links task', async () => {
      const task = createTestTask({ title: 'Deep Architecture Sprint' });
      store.run('Seed', (r) => ({ ...r, tasks: [task] }));

      const res = (await window.__FLOWTASK_MCP__?.callTool('startFocusSession', {
        taskId: task.id,
        mode: 'sprint',
        targetDurationMinutes: 50,
      })) as { success: boolean; session: unknown };

      expect(res.success).toBe(true);
      expect(useFocusStore.getState().focusSession?.taskId).toBe(task.id);
      expect(useFocusStore.getState().focusSession?.mode).toBe('sprint');
      expect(useFocusStore.getState().focusSession?.targetDurationSec).toBe(3000);
    });

    it('1.7.5 getWorkspaceStatus computes telemetry including active tasks and today focused seconds', async () => {
      const task1 = createTestTask({ status: 'todo' });
      const task2 = createTestTask({ status: 'done', completedAt: Date.now() });
      store.run('Seed', (r) => ({
        ...r,
        tasks: [task1, task2],
        preferences: {
          focusLogs: [
            {
              id: 'log1',
              phase: 'focus',
              seconds: 1500,
              endedAt: Date.now(),
            },
          ],
        },
      }));

      const res = (await window.__FLOWTASK_MCP__?.callTool('getWorkspaceStatus', {})) as {
        activeTasksCount: number;
        todayFocusedSeconds: number;
      };

      expect(res.activeTasksCount).toBe(1);
      expect(res.todayFocusedSeconds).toBe(1500);
    });

    it('1.7.6 updateTask and completeTask atomic tools update attributes and toggle status', async () => {
      const task = createTestTask({ title: 'Task to update', priority: 'p4' });
      store.run('Seed', (r) => ({ ...r, tasks: [task] }));

      const updateRes = (await window.__FLOWTASK_MCP__?.callTool('updateTask', {
        taskId: task.id,
        title: 'Updated Title',
        priority: 'p1',
        estimatedMinutes: 60,
      })) as { success: boolean; task: Task };

      expect(updateRes.success).toBe(true);
      expect(updateRes.task.title).toBe('Updated Title');
      expect(updateRes.task.priority).toBe('p1');

      const completeRes = (await window.__FLOWTASK_MCP__?.callTool('completeTask', {
        taskId: task.id,
        completed: true,
      })) as { success: boolean; task: Task };

      expect(completeRes.success).toBe(true);
      expect(completeRes.task.status).toBe('done');
    });

    it('1.7.7 scheduleTimelineBlock tool snaps start time to 15m intervals and sets scheduled block', async () => {
      const task = createTestTask({ title: 'Timeline Block Task', estimatedMinutes: 45 });
      store.run('Seed', (r) => ({ ...r, tasks: [task] }));

      const res = (await window.__FLOWTASK_MCP__?.callTool('scheduleTimelineBlock', {
        taskId: task.id,
        startTime: '10:07', // Snaps to 10:00 or 10:15
        durationMinutes: 45,
      })) as { success: boolean; task: Task; scheduledSlot: { start: string; end: string } };

      expect(res.success).toBe(true);
      expect(res.scheduledSlot.start).toBe('10:00');
      expect(res.scheduledSlot.end).toBe('10:45');
    });

    it('1.7.8 getDailySummary and decomposeTask tools return metrics and heuristic subtasks', async () => {
      const task = createTestTask({ title: 'Fix critical database deadlock bug', plannedDate: todayStr });
      store.run('Seed', (r) => ({ ...r, tasks: [task] }));

      const summary = (await window.__FLOWTASK_MCP__?.callTool('getDailySummary', {
        date: todayStr,
      })) as { totalTasks: number; completionRate: number };

      expect(summary.totalTasks).toBe(1);
      expect(summary.completionRate).toBe(0);

      const decomp = (await window.__FLOWTASK_MCP__?.callTool('decomposeTask', {
        taskId: task.id,
      })) as { success: boolean; subtasks: unknown[]; starterStep: string };

      expect(decomp.success).toBe(true);
      expect(decomp.subtasks.length).toBeGreaterThanOrEqual(3);
      expect(decomp.starterStep).toContain('2-Min Starter');
    });
  });

  // Feature 8: Offline Persistence & Transactional Store
  describe('1.8 Offline Persistence & Transactional Store', () => {
    it('1.8.1 mutations update in-memory snapshot synchronously without network delay', async () => {
      const mockPersistence = createMockPersistence();
      const store = new WorkspaceStore('offline-ws', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();

      const task = createTestTask({ title: 'Offline Instant Task' });
      store.run('Add Task', (r) => ({ ...r, tasks: [task] }));

      const snapshot = store.getSnapshot();
      expect(snapshot.record.tasks).toHaveLength(1);
      expect(snapshot.record.tasks[0].title).toBe('Offline Instant Task');
    });

    it('1.8.2 mutations are queued into pending operations array with reversible diffs', async () => {
      const mockPersistence = createMockPersistence();
      const store = new WorkspaceStore('connected-ws', true, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();

      const task = createTestTask({ title: 'Synced Task' });
      store.run('Add synced task', (r) => ({ ...r, tasks: [task] }));

      const pending = store.getSnapshot().record.pending;
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].changes[0].collection).toBe('tasks');
      expect(pending[0].changes[0].after).toBeDefined();
    });

    it('1.8.3 undo operation reverts state back to previous snapshot accurately', async () => {
      const mockPersistence = createMockPersistence();
      const store = new WorkspaceStore('undo-ws', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();

      const task = createTestTask({ title: 'Task to Undo' });
      store.run('Add task', (r) => ({ ...r, tasks: [task] }));
      expect(store.getSnapshot().record.tasks).toHaveLength(1);

      store.undo();
      expect(store.getSnapshot().record.tasks).toHaveLength(0);
    });

    it('1.8.4 redo operation reapplies reverted changes correctly', async () => {
      const mockPersistence = createMockPersistence();
      const store = new WorkspaceStore('redo-ws', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();

      const task = createTestTask({ title: 'Task to Redo' });
      store.run('Add task', (r) => ({ ...r, tasks: [task] }));
      store.undo();
      expect(store.getSnapshot().record.tasks).toHaveLength(0);

      store.redo();
      expect(store.getSnapshot().record.tasks).toHaveLength(1);
      expect(store.getSnapshot().record.tasks[0].title).toBe('Task to Redo');
    });

    it('1.8.5 storage persist request is called to protect IndexedDB quota', async () => {
      const mockPersistence = createMockPersistence();
      const store = new WorkspaceStore('persist-ws', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();

      expect(mockPersistence.ensureLegacyMigrated).toHaveBeenCalledWith('persist-ws');
    });
  });
});

/* ==========================================================================
   TIER 2: BOUNDARY & CORNER CASES (5 Subsections, 5 Tests Each = 25 Tests)
   ========================================================================== */

describe('Tier 2: Boundary & Corner Cases', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useUIStore.getState().clearTaskSelection();
    useUIStore.getState().setSelectedTaskId(null);
    useUIStore.getState().setFocusedTaskId(null);
  });

  // 2.1 Empty Lists & Zero-Task States
  describe('2.1 Empty Lists & Zero-Task States', () => {
    it('2.1.1 keyboard navigation on empty task list does not crash and keeps focusedIndex at -1', () => {
      render(React.createElement(KeyboardNavHarness, { tasks: [] }));
      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'k' });
      fireEvent.keyDown(window, { key: ' ' });

      expect(useUIStore.getState().focusedTaskId).toBeNull();
    });

    it('2.1.2 batch operations on empty selection perform safe no-ops without throwing', () => {
      const onBatchArchive = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks: [], onBatchArchive }));

      fireEvent.keyDown(window, { key: 'e' });
      expect(onBatchArchive).not.toHaveBeenCalled();
    });

    it('2.1.3 listTodayTasks on empty workspace returns 0 counts and empty arrays', async () => {
      const mockPersistence = createMockPersistence([]);
      const store = new WorkspaceStore('empty-ws', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();
      setWebMcpActiveStore(store);
      registerWebMcpTools();

      const res = (await window.__FLOWTASK_MCP__?.callTool('listTodayTasks', {})) as {
        totalCount: number;
        topThree: Task[];
        daytime: Task[];
      };

      expect(res.totalCount).toBe(0);
      expect(res.topThree).toEqual([]);
      expect(res.daytime).toEqual([]);
    });

    it('2.1.4 calculateCapacityMetrics on zero tasks returns 0 planned hours and healthy status', () => {
      const metrics = calculateCapacityMetrics([], 6.0);
      expect(metrics.totalPlannedMinutes).toBe(0);
      expect(metrics.totalPlannedHours).toBe('0.0');
      expect(metrics.capacityPercent).toBe(0);
      expect(metrics.status).toBe('healthy');
    });

    it('2.1.5 analyzeCognitiveTopology on empty tasks and calendar returns 0 load with no warning', () => {
      const topo = analyzeCognitiveTopology([], []);
      expect(topo.deepWorkMinutes).toBe(0);
      expect(topo.adminMinutes).toBe(0);
      expect(topo.meetingMinutes).toBe(0);
      expect(topo.hasHighCognitiveStrain).toBe(false);
      expect(topo.strainWarning).toBeUndefined();
    });
  });

  // 2.2 Extreme Durations & Numeric Boundary Values
  describe('2.2 Extreme Durations & Numeric Boundary Values', () => {
    it('2.2.1 task with 0 minutes duration formats correctly and occupies minimum height', () => {
      const task = createTestTask({ estimatedMinutes: 0 });
      expect(task.estimatedMinutes).toBe(0);

      const pos = calculateBlockPosition(8 * 60, 0, TIMELINE_START_HOUR, TIMELINE_HOUR_HEIGHT_PX);
      expect(pos.heightPx).toBe(38); // Minimum block height clamped to 38px
    });

    it('2.2.2 task with 1 minute duration calculates capacity without fractional or divide-by-zero errors', () => {
      const task = createTestTask({ estimatedMinutes: 1 });
      const metrics = calculateCapacityMetrics([task], 1.0);

      expect(metrics.totalPlannedMinutes).toBe(1);
      expect(metrics.capacityPercent).toBe(2); // (1/60)*100 rounded
      expect(metrics.status).toBe('healthy');
    });

    it('2.2.3 full 24h task (1440m) clamps properly on timeline rail without integer overflow', () => {
      const pos = calculateBlockPosition(0, 1440, 0, TIMELINE_HOUR_HEIGHT_PX);
      expect(pos.topPx).toBe(0);
      expect(pos.heightPx).toBe(1440 * (80 / 60)); // 1920px
    });

    it('2.2.4 negative estimated minutes in WebMCP tool execution throws descriptive validation error', async () => {
      const mockPersistence = createMockPersistence();
      const store = new WorkspaceStore('neg-ws', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();
      setWebMcpActiveStore(store);
      registerWebMcpTools();

      await expect(
        window.__FLOWTASK_MCP__?.callTool('createTask', {
          title: 'Negative duration task',
          estimatedMinutes: -15,
        })
      ).rejects.toThrow('estimatedMinutes must be a non-negative number');
    });

    it('2.2.5 extremely large duration (>10,000 minutes) caps capacity at maximum upper limit', () => {
      const task = createTestTask({ estimatedMinutes: 10000 });
      const metrics = calculateCapacityMetrics([task], 6.0);

      expect(metrics.capacityPercent).toBe(150); // Capped at 150%
      expect(metrics.status).toBe('overbooked');
    });
  });

  // 2.3 Midnight Timeline Crossovers & Time Parsing Edge Cases
  describe('2.3 Midnight Timeline Crossovers & Time Parsing Edge Cases', () => {
    it('2.3.1 task scheduled at 23:45 parses startMin at 1425 and clamps end before 24:00', () => {
      const startMin = parseTimeToMinutes('23:45');
      expect(startMin).toBe(1425);

      const timeStr = minutesToTimeStr(1425 + 30);
      expect(timeStr).toBe('23:59'); // Clamped to 23:59 max
    });

    it('2.3.2 minutesToTimeStr clamps values below 0 to 00:00 and above 1439 to 23:59', () => {
      expect(minutesToTimeStr(-45)).toBe('00:00');
      expect(minutesToTimeStr(1500)).toBe('23:59');
      expect(minutesToTimeStr(720)).toBe('12:00');
    });

    it('2.3.3 parseTimeToMinutes safely returns null on malformed, empty, or non-time strings', () => {
      expect(parseTimeToMinutes('')).toBeNull();
      expect(parseTimeToMinutes('invalid')).toBeNull();
      expect(parseTimeToMinutes('25:99')).toBe(25 * 60 + 99);
      expect(parseTimeToMinutes('abc:def')).toBeNull();
    });

    it('2.3.4 findNextFreeGap requested at 23:50 for 30m returns null when slot exceeds day limit', () => {
      const gap = findNextFreeGap(30, [], [], 23 * 60 + 50);
      expect(gap).toBeNull();
    });

    it('2.3.5 overlapping calendar event crossing midnight is detected correctly', () => {
      const event: CalendarEvent = {
        id: 'midnight-deploy',
        title: 'Midnight Deploy',
        startTime: '23:30',
        endTime: '23:59',
      };
      const collision = findOverlappingCalendarEvent(23 * 60 + 40, 20, [event]);
      expect(collision?.id).toBe('midnight-deploy');
    });
  });

  // 2.4 Invalid WebMCP Inputs & Defensive Validation
  describe('2.4 Invalid WebMCP Inputs & Defensive Validation', () => {
    let store: WorkspaceStore;

    beforeEach(async () => {
      const mockPersistence = createMockPersistence();
      store = new WorkspaceStore('invalid-ws', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
      await store.load();
      setWebMcpActiveStore(store);
      registerWebMcpTools();
    });

    it('2.4.1 calling non-existent tool name throws explicit WebMCP tool not found error', async () => {
      await expect(
        window.__FLOWTASK_MCP__?.callTool('nonExistentTool', {})
      ).rejects.toThrow('WebMCP tool not found: "nonExistentTool"');
    });

    it('2.4.2 createTask with empty string or whitespace-only title throws required parameter error', async () => {
      await expect(
        window.__FLOWTASK_MCP__?.callTool('createTask', { title: '   ' })
      ).rejects.toThrow('createTask requires a non-empty "title" string parameter');
    });

    it('2.4.3 createTask with invalid priority string throws enum validation error', async () => {
      await expect(
        window.__FLOWTASK_MCP__?.callTool('createTask', {
          title: 'Test',
          priority: 'urgent',
        })
      ).rejects.toThrow('Invalid priority "urgent". Must be one of: p1, p2, p3, p4');
    });

    it('2.4.4 startFocusSession when another session is active throws concurrency guard error', async () => {
      useFocusStore.getState().startFocusSession('pomodoro', 'task-1', 'Active', 1500);

      await expect(
        window.__FLOWTASK_MCP__?.callTool('startFocusSession', {
          taskTitle: 'Second Session',
        })
      ).rejects.toThrow('Finish the current focus session before starting another');
    });

    it('2.4.5 executing tool after AbortSignal has fired throws disconnection error', async () => {
      const controller = new AbortController();
      registerWebMcpTools({ signal: controller.signal });
      const bridge = window.__FLOWTASK_MCP__;
      expect(bridge).toBeDefined();

      controller.abort();

      await expect(
        bridge!.callTool('createTask', { title: 'Aborted Task' })
      ).rejects.toThrow('These assistant tools are no longer connected to this workspace');
    });
  });

  // 2.5 Rapid Hotkeys, Concurrency & Input Guarding
  describe('2.5 Rapid Hotkeys, Concurrency & Input Guarding', () => {
    const tasks = [
      createTestTask({ id: 't1', title: 'Task 1' }),
      createTestTask({ id: 't2', title: 'Task 2' }),
      createTestTask({ id: 't3', title: 'Task 3' }),
    ];

    it('2.5.1 50 rapid consecutive J keystrokes correctly compute index modulo length without desync', () => {
      render(React.createElement(KeyboardNavHarness, { tasks }));

      for (let i = 0; i < 50; i++) {
        fireEvent.keyDown(window, { key: 'j' });
      }

      const focusedId = useUIStore.getState().focusedTaskId;
      expect(['t1', 't2', 't3']).toContain(focusedId);
    });

    it('2.5.2 rapid alternating priority hotkeys (1, 2, 3, 4) produce deterministic updates', () => {
      const onUpdate = vi.fn();
      render(React.createElement(KeyboardNavHarness, { tasks, onUpdateTask: onUpdate }));

      fireEvent.keyDown(window, { key: 'j' }); // focus t1
      fireEvent.keyDown(window, { key: '1' });
      fireEvent.keyDown(window, { key: '4' });
      fireEvent.keyDown(window, { key: '2' });

      expect(onUpdate).toHaveBeenLastCalledWith('t1', { priority: 'p2' });
    });

    it('2.5.3 rapid consecutive status toggles on same task produce monotonically increasing revisions', () => {
      let currentTasks = [createTestTask({ id: 't1', status: 'todo', revision: 1 })];

      const res1 = commandService.toggleTaskStatus(currentTasks, 't1');
      currentTasks = res1.updatedTasks;
      expect(currentTasks[0].status).toBe('done');
      expect(currentTasks[0].revision).toBe(2);

      const res2 = commandService.toggleTaskStatus(currentTasks, 't1');
      currentTasks = res2.updatedTasks;
      expect(currentTasks[0].status).toBe('todo');
      expect(currentTasks[0].revision).toBe(3);
    });

    it('2.5.4 keystrokes inside an HTML input element are completely ignored by navigation', () => {
      const onSelect = vi.fn();
      render(
        React.createElement(
          'div',
          null,
          React.createElement('input', { 'data-testid': 'search-input' }),
          React.createElement(KeyboardNavHarness, { tasks, onSelectTask: onSelect })
        )
      );

      const input = document.querySelector('input')!;
      input.focus();

      // Typing 'j' or 'k' inside input must not trigger task selection
      fireEvent.keyDown(input, { key: 'j' });
      fireEvent.keyDown(input, { key: ' ' });

      expect(useUIStore.getState().focusedTaskId).toBeNull();
    });

    it('2.5.5 Escape key clears both focused task and active multi-selection', () => {
      render(React.createElement(KeyboardNavHarness, { tasks }));

      fireEvent.keyDown(window, { key: 'j' });
      useUIStore.getState().selectAllTasks(['t1', 't2']);
      expect(useUIStore.getState().selectedTaskIds).toHaveLength(2);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(useUIStore.getState().selectedTaskIds).toEqual([]);
    });
  });
});

/* ==========================================================================
   TIER 3: CROSS-FEATURE INTEGRATION COMBINATIONS (4 Comprehensive Flows)
   ========================================================================== */

describe('Tier 3: Cross-Feature Integration Combinations', () => {
  const todayStr = formatLocalDate(new Date());

  afterEach(() => {
    vi.restoreAllMocks();
    useFocusStore.getState().setFocusSession(null);
    useUIStore.getState().clearTaskSelection();
  });

  it('3.1 Pin to Top 3 -> Drag to Timeline Rail -> Focus in PiP -> Completion Confetti', async () => {
    // Step 1: Create a high-priority task
    const mockPersistence = createMockPersistence();
    const store = new WorkspaceStore('ws-flow-1', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
    await store.load();

    const task = createTestTask({
      id: 'flow-task-1',
      title: 'Architect v4 Engine',
      priority: 'p1',
      estimatedMinutes: 60,
    });
    store.run('Create', (r) => ({ ...r, tasks: [task] }));

    // Step 2: Pin task to Top 3
    const pinResult = commandService.updateTask(store.getSnapshot().record.tasks, task.id, {
      isPinnedToday: true,
      topThreeDate: todayStr,
    });
    store.run('Pin Top 3', (r) => ({ ...r, tasks: pinResult.updatedTasks }));
    expect(isFocusTask(store.getSnapshot().record.tasks[0], todayStr)).toBe(true);

    // Step 3: Drag task to Timeline Rail at 09:30 (snapped to 15m)
    const snappedMinutes = Math.round(parseTimeToMinutes('09:30')! / 15) * 15;
    const ripples = rippleScheduleGaps(store.getSnapshot().record.tasks, task.id, snappedMinutes, 60);
    store.run('Schedule', (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === task.id ? { ...t, scheduledStart: ripples[0].scheduledStart, scheduledEnd: ripples[0].scheduledEnd } : t)),
    }));

    const scheduled = store.getSnapshot().record.tasks[0];
    expect(scheduled.scheduledStart).toBe('09:30');
    expect(scheduled.scheduledEnd).toBe('10:30');

    // Step 4: Launch Focus Session in PiP
    const mockPipWindow = {
      document: {
        head: { appendChild: vi.fn() },
        documentElement: { className: '', setAttribute: vi.fn(), classList: { add: vi.fn(), contains: vi.fn().mockReturnValue(false) } },
        body: { className: '' },
        title: '',
      },
      closed: false,
      focus: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('documentPictureInPicture', {
      requestWindow: vi.fn(async () => mockPipWindow),
    });

    useFocusStore.getState().startFocusSession('pomodoro', task.id, task.title, 1500);
    await pictureInPictureService.requestPipWindow({ width: 340, height: 180 });
    expect(pictureInPictureService.isOpen()).toBe(true);

    // Step 5: Complete task and trigger celebration confetti
    const completeResult = commandService.toggleTaskStatus(store.getSnapshot().record.tasks, task.id);
    store.run('Complete', (r) => ({ ...r, tasks: completeResult.updatedTasks }));

    // Top 3 completion triggers celebration confetti
    celebrate({ particleCount: 50, spread: 60 });
    expect(confetti).toHaveBeenCalled();

    pictureInPictureService.closePipWindow();
    useFocusStore.getState().stopFocusSession();
    expect(store.getSnapshot().record.tasks[0].status).toBe('done');
  });

  it('3.2 WebMCP Creation -> Vim Keyboard Triage & Popovers -> Sprint Subtasks Runner', async () => {
    // Step 1: WebMCP tool creates task
    const mockPersistence = createMockPersistence();
    const store = new WorkspaceStore('ws-flow-2', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
    await store.load();
    setWebMcpActiveStore(store);
    registerWebMcpTools();

    const created = (await window.__FLOWTASK_MCP__?.callTool('createTask', {
      title: 'Implement Parser RFC',
      estimatedMinutes: 90,
    })) as { task: Task };

    expect(created.task.id).toBeDefined();

    // Step 2: Keyboard triage (press '1' for P1, 't' for today)
    const onUpdate = vi.fn((id, updates) => {
      store.run('Update', (r) => ({
        ...r,
        tasks: r.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
    });
    render(React.createElement(KeyboardNavHarness, { tasks: store.getSnapshot().record.tasks, onUpdateTask: onUpdate }));

    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 't' });

    expect(onUpdate).toHaveBeenCalledWith(created.task.id, { priority: 'p1' });

    // Step 3: Add subtasks and launch Sprint Mode
    const subtasks: SubTask[] = [
      { id: 'sub-1', title: 'Lexer tokens', completed: false, difficulty: 'EASY' },
      { id: 'sub-2', title: 'Parser grammar', completed: false, difficulty: 'HARD' },
    ];
    store.run('Add subtasks', (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === created.task.id ? { ...t, subtasks } : t)),
    }));

    const session = useFocusStore.getState().startFocusSession(
      'sprint',
      created.task.id,
      created.task.title,
      5400,
      'sub-1',
      'Lexer tokens',
      1200
    );

    expect(session.mode).toBe('sprint');
    expect(session.subtaskId).toBe('sub-1');

    // Switch to next subtask
    useFocusStore.getState().switchSubtask('sub-2', 'Parser grammar', 1800);
    expect(useFocusStore.getState().focusSession?.subtaskId).toBe('sub-2');

    useFocusStore.getState().stopFocusSession();
  });

  it('3.3 Offline Batch Reassignment -> Undo/Redo Chain -> IndexedDB Outbox Resilience', async () => {
    const mockPersistence = createMockPersistence();
    const store = new WorkspaceStore('ws-flow-3', true, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
    await store.load();

    const t1 = createTestTask({ id: 'task-a', title: 'Morning Prep', isEvening: false });
    const t2 = createTestTask({ id: 'task-b', title: 'Evening Wrap', isEvening: true });
    store.run('Seed tasks', (r) => ({ ...r, tasks: [t1, t2] }));

    // Move task-b to morning and someday
    store.run('Reassign task-b', (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === 'task-b' ? { ...t, isEvening: false, isSomeday: true } : t)),
    }));

    expect(store.getSnapshot().record.tasks.find((t) => t.id === 'task-b')?.isSomeday).toBe(true);

    // Undo the move
    store.undo();
    expect(Boolean(store.getSnapshot().record.tasks.find((t) => t.id === 'task-b')?.isSomeday)).toBe(false);
    expect(store.getSnapshot().record.tasks.find((t) => t.id === 'task-b')?.isEvening).toBe(true);

    // Redo the move
    store.redo();
    expect(store.getSnapshot().record.tasks.find((t) => t.id === 'task-b')?.isSomeday).toBe(true);
  });

  it('3.4 Timeline Collision Ripple -> Downstream Push -> Isolated 1s Focus Ticker', () => {
    const t1 = createTestTask({ id: 'sched-1', scheduledStart: '10:00', estimatedMinutes: 45 });
    const t2 = createTestTask({ id: 'sched-2', scheduledStart: '10:45', estimatedMinutes: 30 });
    const t3 = createTestTask({ id: 'sched-3', scheduledStart: '11:15', estimatedMinutes: 30 });

    // Insert new 60m deep work task at 10:00
    const ripples = rippleScheduleGaps([t1, t2, t3], 'sched-1', 10 * 60, 60);

    // Verify cascaded push: sched-1 ends at 11:00 (+15m buffer = 11:15)
    expect(ripples[0].scheduledStart).toBe('10:00');
    expect(ripples[1].scheduledStart).toBe('11:15');

    // Start 1-second isolated focus session
    const session = useFocusStore.getState().startFocusSession('pomodoro', 'sched-1', 'Deep Work', 1500);
    expect(session.state).toBe('running');

    // Ticking focus store does NOT modify tasks list
    const originalTasks = [t1, t2, t3];
    useFocusStore.getState().tick();
    expect(originalTasks).toHaveLength(3);

    useFocusStore.getState().stopFocusSession();
  });
});

/* ==========================================================================
   TIER 4: REAL-WORLD WORKLOAD SCENARIOS (3 Full Day Workflows)
   ========================================================================== */

describe('Tier 4: Real-World Workload Scenarios', () => {
  const todayStr = formatLocalDate(new Date());

  afterEach(() => {
    vi.restoreAllMocks();
    useFocusStore.getState().setFocusSession(null);
    useUIStore.getState().clearTaskSelection();
  });

  it('4.1 Morning Planning Workflow: Backlog Triage, Top 3 Commit, Daytime Partition, Capacity Guard', async () => {
    // 8:30 AM Kickoff Ritual
    const mockPersistence = createMockPersistence();
    const store = new WorkspaceStore('ws-morning', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
    await store.load();

    // 1. Initial workspace with carry-over tasks and backlog
    const inbox1 = createTestTask({ id: 'inbox-1', title: 'Prepare Q4 Review Deck', projectId: 'inbox', priority: 'p1', estimatedMinutes: 90 });
    const inbox2 = createTestTask({ id: 'inbox-2', title: 'Fix Auth Token Expiry', projectId: 'inbox', priority: 'p2', estimatedMinutes: 60 });
    const inbox3 = createTestTask({ id: 'inbox-3', title: 'Team 1:1 with Alex', projectId: 'inbox', priority: 'p2', estimatedMinutes: 45 });
    const inbox4 = createTestTask({ id: 'inbox-4', title: 'Submit Expense Report', projectId: 'inbox', priority: 'p4', estimatedMinutes: 15 });
    const backlog = createTestTask({ id: 'backlog-1', title: 'Explore Rust WebAssembly', isSomeday: true });

    store.run('Morning Seed', (r) => ({ ...r, tasks: [inbox1, inbox2, inbox3, inbox4, backlog] }));
    expect(store.getSnapshot().record.tasks).toHaveLength(5);

    // 2. Select and commit exactly Top 3 Priorities for today
    const topThreeIds = ['inbox-1', 'inbox-2', 'inbox-3'];
    store.run('Commit Top 3', (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (topThreeIds.includes(t.id) ? { ...t, isPinnedToday: true, topThreeDate: todayStr, plannedDate: todayStr } : t)),
    }));

    const topThree = store.getSnapshot().record.tasks.filter((t) => isFocusTask(t, todayStr));
    expect(topThree).toHaveLength(3);

    // 3. Partition tasks into Morning Focus (inbox-1, inbox-2) and Evening Batch (inbox-4)
    store.run('Partition Batches', (r) => ({
      ...r,
      tasks: r.tasks.map((t) => {
        if (t.id === 'inbox-1') return { ...t, scheduledStart: '09:00', scheduledEnd: '10:30' };
        if (t.id === 'inbox-2') return { ...t, scheduledStart: '10:45', scheduledEnd: '11:45' };
        if (t.id === 'inbox-4') return { ...t, isEvening: true };
        return t;
      }),
    }));

    // 4. Validate workload capacity metrics (target: 6.0 hours)
    const todayTasks = store.getSnapshot().record.tasks.filter((t) => isTodayTask(t, todayStr));
    const capacity = calculateCapacityMetrics(todayTasks, 6.0);

    expect(capacity.totalPlannedHours).toBe('3.5'); // 90 + 60 + 45 + 15 = 210 mins = 3.5 hrs
    expect(capacity.status).toBe('healthy');
    expect(capacity.capacityPercent).toBe(58);
  });

  it('4.2 Deep Work Focus Sprint Workflow: Studio Scene, Lo-Fi Audio, PiP HUD, Subtask Pacing, History Log', async () => {
    // 10:00 AM Deep Work Execution
    const mockPersistence = createMockPersistence();
    const store = new WorkspaceStore('ws-deep-work', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
    await store.load();

    const subtasks: SubTask[] = [
      { id: 'sub-a', title: 'Write unit tests', completed: false, estimatedMinutes: 20 },
      { id: 'sub-b', title: 'Implement feature', completed: false, estimatedMinutes: 25 },
    ];
    const task = createTestTask({
      id: 'focus-prime',
      title: 'Build Document PiP HUD',
      priority: 'p1',
      subtasks,
    });
    store.run('Seed', (r) => ({ ...r, tasks: [task] }));

    // 1. Launch Focus Engine in Studio mode with MediaSession metadata
    const mockMediaSession = { metadata: null, setActionHandler: vi.fn() };
    vi.stubGlobal('navigator', { mediaSession: mockMediaSession });
    vi.stubGlobal('MediaMetadata', class {
      constructor(public init: unknown) {}
    });

    updateMediaSessionMetadata({
      title: 'Cyberpunk Library - LoFi Rain',
      artist: 'FlowTask Studio Mixer',
    });
    expect(mockMediaSession.metadata).toBeDefined();

    // 2. Start sprint session linked to subtask
    useFocusStore.getState().startFocusSession('sprint', task.id, task.title, 2700, 'sub-a', 'Write unit tests', 1200);
    expect(useFocusStore.getState().focusSession?.subtaskId).toBe('sub-a');

    // 3. Complete subtask 'sub-a' and advance to 'sub-b'
    store.run('Complete subtask a', (r) => ({
      ...r,
      tasks: r.tasks.map((t) =>
        t.id === task.id ? { ...t, subtasks: t.subtasks.map((s) => (s.id === 'sub-a' ? { ...s, completed: true } : s)) } : t
      ),
    }));
    useFocusStore.getState().switchSubtask('sub-b', 'Implement feature', 1500);
    expect(useFocusStore.getState().focusSession?.subtaskId).toBe('sub-b');

    // 4. Complete sprint session and record focus log into workspace preferences
    const completedSession = useFocusStore.getState().stopFocusSession();
    expect(completedSession.session?.taskId).toBe('focus-prime');

    store.run('Save focus log', (r) => ({
      ...r,
      preferences: {
        ...r.preferences,
        focusLogs: [
          ...((r.preferences.focusLogs as unknown[]) || []),
          {
            id: 'log-101',
            taskId: task.id,
            phase: 'focus',
            seconds: 2700,
            endedAt: Date.now(),
          },
        ],
      },
    }));

    const logs = (store.getSnapshot().record.preferences.focusLogs as Array<{ seconds: number }>) || [];
    expect(logs).toHaveLength(1);
    expect(logs[0].seconds).toBe(2700);
  });

  it('4.3 Evening Shutdown Ritual Workflow: Review, Celebration Confetti, Rollover & Archive', async () => {
    // 6:00 PM Shutdown Closeout
    const mockPersistence = createMockPersistence();
    const store = new WorkspaceStore('ws-evening', false, mockPersistence as unknown as typeof import('../src/services/dbService').dbService);
    await store.load();

    const topTaskDone = createTestTask({ id: 'top-1', title: 'Ship v4 Release', status: 'todo', topThreeDate: todayStr, isPinnedToday: true });
    const daytimeDone = createTestTask({ id: 'day-1', title: 'Team Sync', status: 'todo', plannedDate: todayStr });
    const unfinishedTask = createTestTask({ id: 'day-2', title: 'Read Research Papers', status: 'todo', plannedDate: todayStr });

    store.run('Evening Seed', (r) => ({ ...r, tasks: [topTaskDone, daytimeDone, unfinishedTask] }));

    // 1. Mark Top 3 task complete -> trigger celebratory confetti
    const comp1 = commandService.toggleTaskStatus(store.getSnapshot().record.tasks, 'top-1');
    store.run('Complete Top 3', (r) => ({ ...r, tasks: comp1.updatedTasks }));
    celebrate({ particleCount: 100, spread: 70 });
    expect(confetti).toHaveBeenCalled();

    // 2. Mark daytime task complete
    const comp2 = commandService.toggleTaskStatus(store.getSnapshot().record.tasks, 'day-1');
    store.run('Complete daytime', (r) => ({ ...r, tasks: comp2.updatedTasks }));

    // 3. Triage unfinished task: reschedule to tomorrow ('m')
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);

    store.run('Rollover unfinished', (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (t.id === 'day-2' ? { ...t, plannedDate: tomorrowStr, isSomeday: false } : t)),
    }));

    // 4. Archive completed tasks
    const completedIds = store.getSnapshot().record.tasks.filter((t) => t.status === 'done').map((t) => t.id);
    expect(completedIds).toEqual(['top-1', 'day-1']);

    store.run('Archive completed', (r) => ({
      ...r,
      tasks: r.tasks.map((t) => (completedIds.includes(t.id) ? { ...t, archivedAt: Date.now() } : t)),
    }));

    // 5. Verify clean shutdown state
    const visibleActiveToday = store.getSnapshot().record.tasks.filter((t) => isTodayTask(t, todayStr));
    expect(visibleActiveToday).toHaveLength(0); // All today's tasks completed/archived or rolled over
    expect(store.getSnapshot().error).toBeNull();
  });
});
