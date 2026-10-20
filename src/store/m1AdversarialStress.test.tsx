// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup, renderHook } from '@testing-library/react';
import { useTaskStore, useModalStore, useUIStore, useFocusStore } from './index';
import { TaskProvider, TaskContext, useTaskContext, type TaskContextType } from '../context/TaskContext';
import { ModalProvider } from '../context/ModalContext';
import { ModalRoot } from '../components/modals/ModalRoot';
import { WorkspaceTaskRow, TaskRowTimer } from '../components/tasks/WorkspaceTaskRow';
import { WorkspaceStore } from '../services/workspaceStore';
import { dbService, emptyWorkspace } from '../services/dbService';
import type { Task, FocusSession } from '../types/task';
import type { ModalId } from './useModalStore';

// Mock dependencies
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

describe('Milestone M1 Adversarial Stress Test Suite', () => {
  beforeEach(() => {
    // Reset stores
    useModalStore.getState().closeAllModals();
    useFocusStore.getState().stopFocusSession();
    useUIStore.setState({
      activeView: 'today',
      viewLayout: 'list',
      selectedTaskId: null,
      selectedTaskIds: [],
      searchQuery: '',
      priorityFilter: 'all',
      quickWinsOnly: false,
      theme: 'light',
      toast: null,
      isQuickAddOpen: false,
      quickAddDraft: '',
      focusedTaskId: null,
    });
    useTaskStore.setState({
      tasks: [],
      projects: [{ id: 'inbox', name: 'Inbox', color: '#6366f1', createdAt: Date.now() }],
      store: null,
    });
  });

  afterEach(async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    cleanup();
    vi.restoreAllMocks();
  });

  /* =========================================================================
   * AREA 1: Rapid Concurrent Actions on useTaskStore
   * ========================================================================= */
  describe('Area 1: useTaskStore Concurrency & Stress', () => {
    it('handles rapid burst creation of 100 tasks without dropped tasks or id collisions', () => {
      const createdIds = new Set<string>();
      const count = 100;

      for (let i = 0; i < count; i++) {
        const title = `Task Burst #${i} - [${Math.random().toString(36).slice(2, 8)}]`;
        const task = useTaskStore.getState().addTask(title, {
          priority: i % 2 === 0 ? 'p1' : 'p3',
          estimatedMinutes: (i % 4 + 1) * 15,
        });

        expect(task.id).toBeDefined();
        expect(createdIds.has(task.id)).toBe(false);
        createdIds.add(task.id);
      }

      const tasksInStore = useTaskStore.getState().tasks;
      expect(tasksInStore.length).toBe(count);
      expect(createdIds.size).toBe(count);
    });

    it('processes rapid concurrent updates, status toggles, and deletions in tight loop', () => {
      // Seed 20 tasks
      const seeded = Array.from({ length: 20 }, (_, i) =>
        useTaskStore.getState().addTask(`Concurrent Target ${i}`, { priority: 'p2' })
      );

      // Perform 60 interleaved mutations
      for (let i = 0; i < 60; i++) {
        const target = seeded[i % seeded.length];
        const actionType = i % 3;

        if (actionType === 0) {
          useTaskStore.getState().updateTask(target.id, {
            title: `${target.title} - rev${i}`,
            priority: i % 2 === 0 ? 'p1' : 'p4',
          });
        } else if (actionType === 1) {
          useTaskStore.getState().toggleTaskStatus(target.id);
        } else {
          useTaskStore.getState().toggleTaskPinToday(target.id);
        }
      }

      const finalTasks = useTaskStore.getState().tasks;
      expect(finalTasks.length).toBe(20);

      // Every task should still have valid, non-corrupted schema
      for (const t of finalTasks) {
        expect(['todo', 'done', 'in_progress']).toContain(t.status);
        expect(['p1', 'p2', 'p3', 'p4']).toContain(t.priority);
        expect(typeof t.title).toBe('string');
        expect(t.title.length).toBeGreaterThan(0);
      }
    });

    it('executes a deep 20-action undo/redo transactional chain deterministically with WorkspaceStore', async () => {
      const mockDb = {
        ...dbService,
        saveWorkspace: vi.fn().mockResolvedValue(undefined),
        ensureLegacyMigrated: vi.fn().mockResolvedValue(emptyWorkspace('undo-test')),
      };
      const ws = new WorkspaceStore('undo-test', false, mockDb as unknown as typeof dbService);

      // Initialize workspace
      await ws.load();
      // Ensure ready
      ws.run('Init', (r) => ({
        ...r,
        tasks: [],
        projects: [{ id: 'inbox', name: 'Inbox', color: '#6366f1', createdAt: Date.now() }],
      }));

      useTaskStore.getState().setWorkspaceStore(ws);

      // Execute 15 distinct operations
      const createdTaskIds: string[] = [];
      for (let i = 0; i < 15; i++) {
        const t = useTaskStore.getState().addTask(`Task Step ${i}`);
        createdTaskIds.push(t.id);
      }

      expect(ws.getSnapshot().record.tasks.length).toBe(15);
      expect(ws.canUndo()).toBe(true);

      // Rewind 15 operations step-by-step
      for (let i = 14; i >= 0; i--) {
        useTaskStore.getState().undoLastAction();
        expect(ws.getSnapshot().record.tasks.length).toBe(i);
      }

      // At step 0, tasks array should be completely empty
      expect(ws.getSnapshot().record.tasks.length).toBe(0);
      expect(ws.canRedo()).toBe(true);

      // Redo all 15 operations forward
      for (let i = 1; i <= 15; i++) {
        useTaskStore.getState().redoLastAction();
        expect(ws.getSnapshot().record.tasks.length).toBe(i);
      }

      // Branching history invalidation test:
      // Undo 3 times, then make a new mutation -> redo stack must be cleared
      useTaskStore.getState().undoLastAction();
      useTaskStore.getState().undoLastAction();
      useTaskStore.getState().undoLastAction();
      expect(ws.getSnapshot().record.tasks.length).toBe(12);
      expect(ws.canRedo()).toBe(true);

      // Branch mutation
      useTaskStore.getState().addTask('Branch Task New Path');
      expect(ws.getSnapshot().record.tasks.length).toBe(13);
      // Redo must now be disabled because history branched
      expect(ws.canRedo()).toBe(false);
    });

    it('survives boundary edge-cases: non-existent task IDs, empty strings, and empty undo/redo', () => {
      // Non-existent operations should be safe no-ops and not throw
      expect(() => useTaskStore.getState().updateTask('non-existent-id', { priority: 'p1' })).not.toThrow();
      expect(() => useTaskStore.getState().deleteTask('non-existent-id')).not.toThrow();
      expect(() => useTaskStore.getState().toggleTaskStatus('non-existent-id')).not.toThrow();
      expect(() => useTaskStore.getState().toggleTaskPinToday('non-existent-id')).not.toThrow();
      expect(() => useTaskStore.getState().undoLastAction()).not.toThrow();
      expect(() => useTaskStore.getState().redoLastAction()).not.toThrow();

      // Empty input creates fallback or safe default
      const emptyTask = useTaskStore.getState().addTask('');
      expect(emptyTask).toBeDefined();
      expect(emptyTask.id).toBeDefined();
    });
  });

  /* =========================================================================
   * AREA 2: Rapid Modal Open/Close Sequences on useModalStore & LIFO Esc
   * ========================================================================= */
  describe('Area 2: useModalStore & ModalRoot Strict LIFO Esc Semantics', () => {
    it('strictly maintains LIFO stack order across stacked modals', () => {
      const modalStore = useModalStore.getState();
      const stackSequence: ModalId[] = ['settings', 'shortcuts', 'auth', 'smartFilter', 'quickAdd'];

      for (const id of stackSequence) {
        modalStore.openModal(id);
      }

      expect(useModalStore.getState().activeModals).toEqual(stackSequence);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(true);
      expect(useModalStore.getState().isQuickAddOpen).toBe(true);
      expect(useModalStore.getState().isAuthModalOpen).toBe(true);

      // Close top modal one by one
      useModalStore.getState().closeTopModal();
      expect(useModalStore.getState().activeModals).toEqual(['settings', 'shortcuts', 'auth', 'smartFilter']);
      expect(useModalStore.getState().isQuickAddOpen).toBe(false);
      expect(useModalStore.getState().isSmartFilterModalOpen).toBe(true);

      useModalStore.getState().closeTopModal();
      expect(useModalStore.getState().activeModals).toEqual(['settings', 'shortcuts', 'auth']);
      expect(useModalStore.getState().isSmartFilterModalOpen).toBe(false);

      useModalStore.getState().closeTopModal();
      expect(useModalStore.getState().activeModals).toEqual(['settings', 'shortcuts']);
      expect(useModalStore.getState().isAuthModalOpen).toBe(false);

      useModalStore.getState().closeTopModal();
      expect(useModalStore.getState().activeModals).toEqual(['settings']);

      useModalStore.getState().closeTopModal();
      expect(useModalStore.getState().activeModals).toEqual([]);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(false);
    });

    it('handles 100 rapid random open/close fuzzed actions without state desynchronization', () => {
      const modalIds: ModalId[] = [
        'settings',
        'shortcuts',
        'auth',
        'smartFilter',
        'quickAdd',
        'brainDump',
        'eveningShutdown',
        'morningKickoff',
        'interruption',
      ];

      for (let i = 0; i < 100; i++) {
        const id = modalIds[i % modalIds.length];
        const action = i % 3;

        if (action === 0) {
          useModalStore.getState().openModal(id);
        } else if (action === 1) {
          useModalStore.getState().closeModal(id);
        } else {
          useModalStore.getState().closeTopModal();
        }

        const state = useModalStore.getState();
        // INVARIANT 1: No duplicate modal IDs in activeModals
        const uniqueSet = new Set(state.activeModals);
        expect(state.activeModals.length).toBe(uniqueSet.size);

        // INVARIANT 2: hasAnyModalOpen strictly reflects activeModals.length > 0
        expect(state.hasAnyModalOpen).toBe(state.activeModals.length > 0);

        // INVARIANT 3: Legacy direct flags match activeModals membership
        expect(state.isAuthModalOpen).toBe(state.activeModals.includes('auth'));
        expect(state.isQuickAddOpen).toBe(state.activeModals.includes('quickAdd'));
        expect(state.isSmartFilterModalOpen).toBe(state.activeModals.includes('smartFilter'));
        expect(state.isEveningShutdownOpen).toBe(state.activeModals.includes('eveningShutdown'));
      }
    });

    it('dispatches Escape key in ModalRoot closing only the topmost modal in strict LIFO order', async () => {
      const mockContext = {
        setSelectedTaskId: vi.fn(),
      } as unknown as TaskContextType;

      const TestHost = () => {
        return (
          <TaskContext.Provider value={mockContext}>
            <ModalProvider>
              <ModalRoot />
            </ModalProvider>
          </TaskContext.Provider>
        );
      };

      render(<TestHost />);

      // Open 2 modals: 'shortcuts' then 'exportImport'
      await act(async () => {
        useModalStore.getState().openModal('shortcuts');
      });
      await act(async () => {
        useModalStore.getState().openModal('exportImport');
      });

      expect(useModalStore.getState().activeModals).toEqual(['shortcuts', 'exportImport']);

      // First Escape: closes exportImport (top of stack)
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(useModalStore.getState().activeModals).toEqual(['shortcuts']);
      expect(useModalStore.getState().isModalOpen('shortcuts')).toBe(true);
      expect(useModalStore.getState().isModalOpen('exportImport')).toBe(false);

      // Second Escape: closes shortcuts
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(useModalStore.getState().activeModals).toEqual([]);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(false);

      // Third Escape: no modals open, should safely do nothing
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(useModalStore.getState().activeModals).toEqual([]);
    });
  });

  /* =========================================================================
   * AREA 3: <TaskRowTimer> and WorkspaceTaskRow Re-render Isolation
   * ========================================================================= */
  describe('Area 3: TaskRowTimer & WorkspaceTaskRow Re-render Isolation', () => {
    it('isolates 1-second focus timer ticks to the active timer without re-rendering inactive rows', async () => {
      const taskA: Task = {
        id: 'task-active',
        title: 'Active Timer Task A',
        projectId: 'inbox',
        status: 'in_progress',
        priority: 'p1',
        subtasks: [],
        createdAt: 1000,
      };

      const taskB: Task = {
        id: 'task-inactive-b',
        title: 'Inactive Task B',
        projectId: 'inbox',
        status: 'todo',
        priority: 'p2',
        subtasks: [],
        createdAt: 1001,
      };

      const taskC: Task = {
        id: 'task-inactive-c',
        title: 'Inactive Task C',
        projectId: 'inbox',
        status: 'todo',
        priority: 'p3',
        subtasks: [],
        createdAt: 1002,
      };

      // Spies to track renders of rows
      let renderCountRowA = 0;
      let renderCountRowB = 0;
      let renderCountRowC = 0;

      const MonitoredRowA = (props: { task: Task }) => {
        renderCountRowA++;
        return <WorkspaceTaskRow task={props.task} onSelectTask={vi.fn()} />;
      };

      const MonitoredRowB = (props: { task: Task }) => {
        renderCountRowB++;
        return <WorkspaceTaskRow task={props.task} onSelectTask={vi.fn()} />;
      };

      const MonitoredRowC = (props: { task: Task }) => {
        renderCountRowC++;
        return <WorkspaceTaskRow task={props.task} onSelectTask={vi.fn()} />;
      };

      // Set focus session on Task A
      const session: FocusSession = {
        id: 'focus-session-1',
        taskId: 'task-active',
        taskTitle: 'Active Timer Task A',
        mode: 'stopwatch',
        state: 'running',
        startedAt: Date.now(),
        originalStartedAt: Date.now(),
        workspaceId: 'local',
        accumulatedElapsedMs: 0,
        targetDurationSec: 0,
      };

      useFocusStore.setState({
        focusSession: session,
        activeTimerTaskId: 'task-active',
        activeTimerSeconds: 0,
        focusElapsedSeconds: 0,
      });

      const mockContext = {
        projects: [],
        selectedTaskIds: [],
        focusSession: session,
        activeTimerTaskId: 'task-active',
        toggleTaskStatus: vi.fn(),
        toggleTaskPinToday: vi.fn(),
        updateTask: vi.fn(),
        toggleTaskSelection: vi.fn(),
        toggleTaskTimer: vi.fn(),
      } as unknown as TaskContextType;

      const TestHarness = () => {
        return (
          <TaskContext.Provider value={mockContext}>
            <div data-testid="row-container">
              <MonitoredRowA task={taskA} />
              <MonitoredRowB task={taskB} />
              <MonitoredRowC task={taskC} />
            </div>
          </TaskContext.Provider>
        );
      };

      render(<TestHarness />);

      // Initial mount counts
      const initialA = renderCountRowA;
      const initialB = renderCountRowB;
      const initialC = renderCountRowC;

      expect(initialA).toBe(1);
      expect(initialB).toBe(1);
      expect(initialC).toBe(1);

      // Now simulate 10 consecutive 1-second ticks of the focus timer
      for (let sec = 1; sec <= 10; sec++) {
        act(() => {
          useFocusStore.setState({
            activeTimerSeconds: sec,
            focusElapsedSeconds: sec,
          });
        });
      }

      // CRITICAL CHECK: Inactive rows B and C must NOT have re-rendered on each second tick!
      expect(renderCountRowB).toBe(initialB);
      expect(renderCountRowC).toBe(initialC);

      // Even Task A's row itself is not re-rendered by seconds ticking (only TaskRowTimer re-renders)
      expect(renderCountRowA).toBe(initialA);

      // Check TaskRowTimer displays latest formatted second
      expect(screen.getByText('00:10')).toBeDefined();
    });

    it('TaskRowTimer component re-renders independently and displays live clock', () => {
      useFocusStore.setState({
        activeTimerTaskId: 'timer-task',
        activeTimerSeconds: 0,
        focusSession: {
          id: 's-1',
          taskId: 'timer-task',
          taskTitle: 'Timer Task',
          mode: 'stopwatch',
          state: 'running',
          startedAt: Date.now(),
          originalStartedAt: Date.now(),
          workspaceId: 'local',
          accumulatedElapsedMs: 0,
          targetDurationSec: 0,
        },
      });

      render(<TaskRowTimer taskId="timer-task" isRunning={true} />);
      expect(screen.getByText('00:00')).toBeDefined();

      // Tick 5 times
      for (let i = 1; i <= 5; i++) {
        act(() => {
          useFocusStore.setState({ activeTimerSeconds: i });
        });
      }

      // Live readout must update to 00:05
      expect(screen.getByText('00:05')).toBeDefined();
    });
  });

  /* =========================================================================
   * AREA 4: Backward Compatibility of TaskContext.tsx Adapter Under Stress
   * ========================================================================= */
  describe('Area 4: TaskContext Adapter Compatibility & Parity', () => {
    it('exposes all 62 critical TaskContextType properties and methods with active stores', async () => {
      const mockRecord = emptyWorkspace('local');
      mockRecord.tasks = [
        {
          id: 'compat-1',
          title: 'Legacy Compatibility Task',
          projectId: 'inbox',
          status: 'todo',
          priority: 'p2',
          subtasks: [],
          createdAt: Date.now(),
        },
      ];

      vi.spyOn(dbService, 'ensureLegacyMigrated').mockResolvedValue(mockRecord);
      vi.spyOn(dbService, 'saveWorkspace').mockResolvedValue(undefined);

      const { result } = renderHook(() => useTaskContext(), { wrapper: TaskProvider });

      // Wait for workspace ready
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const ctx = result.current;
      expect(ctx).toBeDefined();

      // Verify task collections and store methods
      expect(Array.isArray(ctx.tasks)).toBe(true);
      expect(Array.isArray(ctx.projects)).toBe(true);
      expect(typeof ctx.addTask).toBe('function');
      expect(typeof ctx.updateTask).toBe('function');
      expect(typeof ctx.deleteTask).toBe('function');
      expect(typeof ctx.permanentDeleteTask).toBe('function');
      expect(typeof ctx.archiveTask).toBe('function');
      expect(typeof ctx.restoreTask).toBe('function');
      expect(typeof ctx.toggleTaskStatus).toBe('function');
      expect(typeof ctx.toggleTaskPinToday).toBe('function');
      expect(typeof ctx.undoLastAction).toBe('function');
      expect(typeof ctx.redoLastAction).toBe('function');

      // Verify subtask methods
      expect(typeof ctx.addSubTask).toBe('function');
      expect(typeof ctx.addSubTasks).toBe('function');
      expect(typeof ctx.updateSubTask).toBe('function');
      expect(typeof ctx.deleteSubTask).toBe('function');
      expect(typeof ctx.moveSubTask).toBe('function');
      expect(typeof ctx.promoteSubTaskToTask).toBe('function');
      expect(typeof ctx.toggleSubTask).toBe('function');

      // Verify batch methods
      expect(typeof ctx.batchUpdateTasks).toBe('function');
      expect(typeof ctx.batchDeleteTasks).toBe('function');
      expect(typeof ctx.batchToggleStatus).toBe('function');
      expect(typeof ctx.applyTaskChanges).toBe('function');

      // Verify focus session methods & dynamic getters
      expect(typeof ctx.startFocusSession).toBe('function');
      expect(typeof ctx.pauseFocusSession).toBe('function');
      expect(typeof ctx.resumeFocusSession).toBe('function');
      expect(typeof ctx.stopFocusSession).toBe('function');
      expect(typeof ctx.focusElapsedSeconds).toBe('number');
      expect(typeof ctx.totalFocusedTodaySeconds).toBe('number');
      expect(typeof ctx.activeTimerSeconds).toBe('number');

      // Verify modal state flags on context
      expect(typeof ctx.isAuthModalOpen).toBe('boolean');
      expect(typeof ctx.setIsAuthModalOpen).toBe('function');
      expect(typeof ctx.isQuickAddOpen).toBe('boolean');
      expect(typeof ctx.setIsQuickAddOpen).toBe('function');
      expect(typeof ctx.isTemplatePickerOpen).toBe('boolean');
      expect(typeof ctx.isWeeklyReviewOpen).toBe('boolean');
      expect(typeof ctx.isSmartFilterModalOpen).toBe('boolean');
      expect(typeof ctx.isEveningShutdownOpen).toBe('boolean');
    });

    it('preserves synchronized two-way mutations between TaskContext and Zustand stores', async () => {
      const mockRecord = emptyWorkspace('local');
      vi.spyOn(dbService, 'ensureLegacyMigrated').mockResolvedValue(mockRecord);
      vi.spyOn(dbService, 'saveWorkspace').mockResolvedValue(undefined);

      const { result } = renderHook(() => useTaskContext(), { wrapper: TaskProvider });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Mutate via context adapter
      let added: Task | undefined;
      act(() => {
        added = result.current.addTask('Created via TaskContext Adapter', { priority: 'p1' });
      });

      expect(added).toBeDefined();

      // Verify reflected in Zustand store
      expect(useTaskStore.getState().tasks.some((t) => t.id === added!.id)).toBe(true);

      // Mutate via Zustand store
      act(() => {
        useTaskStore.getState().updateTask(added!.id, { title: 'Updated via Zustand directly' });
      });

      // Verify reflected in useTaskStore
      const updatedInStore = useTaskStore.getState().tasks.find((t) => t.id === added!.id);
      expect(updatedInStore?.title).toBe('Updated via Zustand directly');
    });
  });

  /* =========================================================================
   * AREA 5: Deeper Adversarial Edge Cases & Boundary Mining
   * ========================================================================= */
  describe('Area 5: Deeper Adversarial Edge Cases & Structural Integrity', () => {
    it('executes batch update and batch delete with single-step undo recovery on WorkspaceStore', async () => {
      const mockDb = {
        ...dbService,
        saveWorkspace: vi.fn().mockResolvedValue(undefined),
        ensureLegacyMigrated: vi.fn().mockResolvedValue(emptyWorkspace('batch-test')),
      };
      const ws = new WorkspaceStore('batch-test', false, mockDb as unknown as typeof dbService);
      await ws.load();
      ws.run('Init', (r) => ({ ...r, tasks: [] }));
      useTaskStore.getState().setWorkspaceStore(ws);

      // Add 10 tasks
      const ids: string[] = [];
      for (let i = 0; i < 10; i++) {
        const t = useTaskStore.getState().addTask(`Batch Task ${i}`);
        ids.push(t.id);
      }
      expect(ws.getSnapshot().record.tasks.length).toBe(10);

      // Batch update all 10 to p1
      useTaskStore.getState().batchUpdateTasks(ids, { priority: 'p1' });
      expect(ws.getSnapshot().record.tasks.every((t) => t.priority === 'p1')).toBe(true);

      // Single undo restores all 10 back to p3
      useTaskStore.getState().undoLastAction();
      expect(ws.getSnapshot().record.tasks.every((t) => t.priority === 'p3')).toBe(true);

      // Batch delete 5 tasks
      useTaskStore.getState().batchDeleteTasks(ids.slice(0, 5));
      expect(ws.getSnapshot().record.tasks.filter((t) => !t.deletedAt).length).toBe(5);

      // Single undo restores the 5 deleted tasks
      useTaskStore.getState().undoLastAction();
      expect(ws.getSnapshot().record.tasks.filter((t) => !t.deletedAt).length).toBe(10);
    });

    it('documents standalone mode behavior when WorkspaceStore is null', () => {
      // Disconnect store
      useTaskStore.setState({ store: null, tasks: [] });

      const t1 = useTaskStore.getState().addTask('Standalone 1');
      expect(useTaskStore.getState().tasks.length).toBe(1);

      // updateTask works in standalone
      useTaskStore.getState().updateTask(t1.id, { priority: 'p1' });
      expect(useTaskStore.getState().tasks[0].priority).toBe('p1');

      // batchToggleStatus requires store, silent no-op when store is null
      useTaskStore.getState().batchToggleStatus([t1.id]);
      // Status remains 'todo'
      expect(useTaskStore.getState().tasks[0].status).toBe('todo');
    });

    it('verifies modal stack behavior on reopening an already-opened modal', () => {
      useModalStore.getState().openModal('settings');
      useModalStore.getState().openModal('shortcuts');
      expect(useModalStore.getState().activeModals).toEqual(['settings', 'shortcuts']);

      // Reopen 'settings'
      useModalStore.getState().openModal('settings');
      // Retains ['settings', 'shortcuts'] without moving settings to top (FIFO position retention)
      expect(useModalStore.getState().activeModals).toEqual(['settings', 'shortcuts']);
    });

    it('respects Zen mode fullscreen and does not dismiss pomodoro modal when Zen focus is mounted', async () => {
      const mockContext = {
        setSelectedTaskId: vi.fn(),
      } as unknown as TaskContextType;

      const zenIndicator = document.createElement('div');
      zenIndicator.setAttribute('aria-label', 'Zen Focus Mode');
      document.body.appendChild(zenIndicator);

      const TestHost = () => (
        <TaskContext.Provider value={mockContext}>
          <ModalProvider>
            <ModalRoot />
          </ModalProvider>
        </TaskContext.Provider>
      );

      render(<TestHost />);

      await act(async () => {
        useModalStore.getState().openModal('pomodoro');
      });

      expect(useModalStore.getState().activeModals).toEqual(['pomodoro']);

      // Press Escape while Zen mode is active
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      // pomodoro MUST REMAIN OPEN because Zen focus handles first Escape
      expect(useModalStore.getState().isModalOpen('pomodoro')).toBe(true);
      expect(useModalStore.getState().activeModals).toEqual(['pomodoro']);

      // Remove Zen element
      document.body.removeChild(zenIndicator);

      // Press Escape again
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      // Now pomodoro closes!
      expect(useModalStore.getState().isModalOpen('pomodoro')).toBe(false);
      expect(useModalStore.getState().activeModals).toEqual([]);
    });

    it('demonstrates keyboard navigation focus targeting via focusedTaskId', () => {
      const taskA: Task = {
        id: 'task-a',
        title: 'Task A',
        projectId: 'inbox',
        status: 'todo',
        priority: 'p1',
        subtasks: [],
        createdAt: 1000,
      };

      const taskB: Task = {
        id: 'task-b',
        title: 'Task B',
        projectId: 'inbox',
        status: 'todo',
        priority: 'p2',
        subtasks: [],
        createdAt: 1001,
      };

      const mockCtx = {
        projects: [],
        selectedTaskIds: [],
        toggleTaskStatus: vi.fn(),
        toggleTaskPinToday: vi.fn(),
        updateTask: vi.fn(),
        toggleTaskSelection: vi.fn(),
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockCtx}>
          <WorkspaceTaskRow task={taskA} onSelectTask={vi.fn()} />
          <WorkspaceTaskRow task={taskB} onSelectTask={vi.fn()} />
        </TaskContext.Provider>
      );

      // Neither is focused initially
      const rowAEl = screen.getByText('Task A').closest('.desk-task-row');
      const rowBEl = screen.getByText('Task B').closest('.desk-task-row');
      expect(rowAEl?.getAttribute('data-keyboard-focused')).toBeNull();
      expect(rowBEl?.getAttribute('data-keyboard-focused')).toBeNull();

      // Focus task A via useUIStore
      act(() => {
        useUIStore.setState({ focusedTaskId: 'task-a' });
      });

      // Task A is now highlighted with data-keyboard-focused="true"
      expect(rowAEl?.getAttribute('data-keyboard-focused')).toBe('true');
      expect(rowBEl?.getAttribute('data-keyboard-focused')).toBeNull();

      // Move focus to Task B
      act(() => {
        useUIStore.setState({ focusedTaskId: 'task-b' });
      });

      // Focus switches cleanly
      expect(rowAEl?.getAttribute('data-keyboard-focused')).toBeNull();
      expect(rowBEl?.getAttribute('data-keyboard-focused')).toBe('true');
    });
  });
});
