import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore, useFocusStore, useTaskStore, useModalStore } from './index';

describe('Zustand State Architecture Modernization', () => {
  describe('useUIStore', () => {
    beforeEach(() => {
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
      });
    });

    it('manages active view and updates correctly', () => {
      expect(useUIStore.getState().activeView).toBe('today');
      useUIStore.getState().setActiveView('upcoming');
      expect(useUIStore.getState().activeView).toBe('upcoming');
    });

    it('manages view layout switching', () => {
      expect(useUIStore.getState().viewLayout).toBe('list');
      useUIStore.getState().setViewLayout('kanban');
      expect(useUIStore.getState().viewLayout).toBe('kanban');
    });

    it('manages multi-select task selection', () => {
      const { selectTask, toggleTaskSelection, deselectTask, selectAllTasks, clearTaskSelection } =
        useUIStore.getState();

      selectTask('task-1');
      expect(useUIStore.getState().selectedTaskIds).toEqual(['task-1']);

      toggleTaskSelection('task-2');
      expect(useUIStore.getState().selectedTaskIds).toContain('task-1');
      expect(useUIStore.getState().selectedTaskIds).toContain('task-2');

      toggleTaskSelection('task-1');
      expect(useUIStore.getState().selectedTaskIds).toEqual(['task-2']);

      deselectTask('task-2');
      expect(useUIStore.getState().selectedTaskIds).toEqual([]);

      selectAllTasks(['t-1', 't-2', 't-3']);
      expect(useUIStore.getState().selectedTaskIds.length).toBe(3);

      clearTaskSelection();
      expect(useUIStore.getState().selectedTaskIds).toEqual([]);
    });

    it('manages search query and priority filters', () => {
      useUIStore.getState().setSearchQuery('refactor');
      expect(useUIStore.getState().searchQuery).toBe('refactor');

      useUIStore.getState().setPriorityFilter('p1');
      expect(useUIStore.getState().priorityFilter).toBe('p1');

      useUIStore.getState().setQuickWinsOnly(true);
      expect(useUIStore.getState().quickWinsOnly).toBe(true);
    });

    it('manages theme toggling and setting', () => {
      useUIStore.getState().setTheme('tokyo');
      expect(useUIStore.getState().theme).toBe('tokyo');

      useUIStore.getState().setTheme('light');
      useUIStore.getState().toggleTheme();
      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('manages toasts and quick add drafts', () => {
      useUIStore.getState().showToast('Task completed', 'Undo');
      expect(useUIStore.getState().toast?.message).toBe('Task completed');
      expect(useUIStore.getState().toast?.actionLabel).toBe('Undo');

      useUIStore.getState().clearToast();
      expect(useUIStore.getState().toast).toBeNull();

      useUIStore.getState().setIsQuickAddOpen(true);
      useUIStore.getState().setQuickAddDraft('Write docs');
      expect(useUIStore.getState().isQuickAddOpen).toBe(true);
      expect(useUIStore.getState().quickAddDraft).toBe('Write docs');
    });
  });

  describe('useFocusStore', () => {
    beforeEach(() => {
      useFocusStore.getState().stopFocusSession();
    });

    it('starts, pauses, resumes, and stops a focus session', () => {
      const session = useFocusStore.getState().startFocusSession('stopwatch', 'task-99', 'Deep Work');
      expect(session).toBeDefined();
      expect(useFocusStore.getState().focusSession?.state).toBe('running');
      expect(useFocusStore.getState().activeTimerTaskId).toBe('task-99');

      useFocusStore.getState().pauseFocusSession();
      expect(useFocusStore.getState().focusSession?.state).toBe('paused');

      useFocusStore.getState().resumeFocusSession();
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      const result = useFocusStore.getState().stopFocusSession();
      expect(result.session).toBeDefined();
      expect(useFocusStore.getState().focusSession).toBeNull();
      expect(useFocusStore.getState().activeTimerTaskId).toBeNull();
      expect(useFocusStore.getState().focusElapsedSeconds).toBe(0);
    });

    it('starts pomodoro session with default duration', () => {
      const session = useFocusStore.getState().startFocusSession('pomodoro', 'task-100');
      expect(session.targetDurationSec).toBe(1500);
      expect(useFocusStore.getState().activeTimerTaskId).toBe('task-100');

      useFocusStore.getState().stopFocusSession();
      expect(useFocusStore.getState().focusSession).toBeNull();
    });

    it('supports study sprint mode with subtask tracking and switching', () => {
      const session = useFocusStore.getState().startFocusSession(
        'sprint',
        'task-sprint-1',
        'Algorithms Practice',
        3600,
        'sub-1',
        'Two Sum',
        900
      );

      expect(session.mode).toBe('sprint');
      expect(session.subtaskId).toBe('sub-1');
      expect(session.subtaskTitle).toBe('Two Sum');
      expect(session.pacingSecondsPerUnit).toBe(900);
      expect(useFocusStore.getState().focusSession?.subtaskTitle).toBe('Two Sum');

      // Switch subtask to problem 2
      useFocusStore.getState().switchSubtask('sub-2', 'Add Two Numbers', 1200);
      const updated = useFocusStore.getState().focusSession;
      expect(updated?.subtaskId).toBe('sub-2');
      expect(updated?.subtaskTitle).toBe('Add Two Numbers');
      expect(updated?.pacingSecondsPerUnit).toBe(1200);

      // Update banked seconds
      useFocusStore.getState().updateFocusSession({ bankedSeconds: 300 });
      expect(useFocusStore.getState().focusSession?.bankedSeconds).toBe(300);

      useFocusStore.getState().stopFocusSession();
      expect(useFocusStore.getState().focusSession).toBeNull();
    });
  });

  describe('useModalStore', () => {
    beforeEach(() => {
      useModalStore.getState().closeAllModals();
    });

    it('opens and closes modals with activeModals tracking', () => {
      expect(useModalStore.getState().activeModals).toEqual([]);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(false);

      useModalStore.getState().openModal('shortcuts');
      expect(useModalStore.getState().isModalOpen('shortcuts')).toBe(true);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(true);
      expect(useModalStore.getState().activeModals).toContain('shortcuts');

      useModalStore.getState().closeModal('shortcuts');
      expect(useModalStore.getState().isModalOpen('shortcuts')).toBe(false);
      expect(useModalStore.getState().hasAnyModalOpen).toBe(false);
    });

    it('synchronizes modal flags with activeModals stack', () => {
      useModalStore.getState().setIsAuthModalOpen(true);
      expect(useModalStore.getState().isAuthModalOpen).toBe(true);
      expect(useModalStore.getState().activeModals).toContain('auth');

      useModalStore.getState().setIsAuthModalOpen(false);
      expect(useModalStore.getState().isAuthModalOpen).toBe(false);
      expect(useModalStore.getState().activeModals).not.toContain('auth');

      useModalStore.getState().openModal('eveningShutdown');
      expect(useModalStore.getState().isEveningShutdownOpen).toBe(true);
      useModalStore.getState().closeModal('eveningShutdown');
      expect(useModalStore.getState().isEveningShutdownOpen).toBe(false);
    });

    it('stores and retrieves modal props', () => {
      useModalStore.getState().openModal('pomodoro', { taskId: 'task-abc', initialPhase: 'focus' });
      expect(useModalStore.getState().getModalProps('pomodoro')).toEqual({
        taskId: 'task-abc',
        initialPhase: 'focus',
      });
    });

    it('closes top modal in stack order', () => {
      useModalStore.getState().openModal('shortcuts');
      useModalStore.getState().openModal('commandPalette');
      expect(useModalStore.getState().activeModals).toEqual(['shortcuts', 'commandPalette']);

      useModalStore.getState().closeTopModal();
      expect(useModalStore.getState().activeModals).toEqual(['shortcuts']);
      expect(useModalStore.getState().isModalOpen('commandPalette')).toBe(false);
      expect(useModalStore.getState().isModalOpen('shortcuts')).toBe(true);
    });

    it('dismisses shutdown and triage correctly', () => {
      useModalStore.getState().dismissShutdown();
      expect(useModalStore.getState().isShutdownDismissed).toBe(true);

      useModalStore.getState().setIsTriageDismissed(true);
      expect(useModalStore.getState().isTriageDismissed).toBe(true);
    });
  });

  describe('useTaskStore', () => {
    beforeEach(() => {
      useTaskStore.setState({
        tasks: [],
        projects: [{ id: 'inbox', name: 'Inbox', color: '#6366f1', createdAt: Date.now() }],
        store: null,
      });
    });

    it('adds task with defaults and updates state', () => {
      const task = useTaskStore.getState().addTask('Review pull request');
      expect(task).toBeDefined();
      expect(task.title).toBe('Review pull request');
      expect(useTaskStore.getState().tasks.some((t) => t.id === task.id)).toBe(true);
    });

    it('updates, toggles, and deletes tasks', () => {
      const task = useTaskStore.getState().addTask('Prepare release');
      useTaskStore.getState().updateTask(task.id, { priority: 'p1' });
      expect(useTaskStore.getState().tasks.find((t) => t.id === task.id)?.priority).toBe('p1');

      useTaskStore.getState().toggleTaskStatus(task.id);
      expect(useTaskStore.getState().tasks.find((t) => t.id === task.id)?.status).toBe('done');

      useTaskStore.getState().deleteTask(task.id);
      expect(useTaskStore.getState().tasks.find((t) => t.id === task.id)?.deletedAt).toBeDefined();
    });

    it('manages subtasks on tasks', () => {
      const task = useTaskStore.getState().addTask('Big Project');
      useTaskStore.getState().addSubTask(task.id, 'Subtask 1', 15);

      const updated = useTaskStore.getState().tasks.find((t) => t.id === task.id);
      expect(updated?.subtasks).toHaveLength(1);
      expect(updated?.subtasks[0].title).toBe('Subtask 1');

      const subId = updated!.subtasks[0].id;
      useTaskStore.getState().toggleSubTask(task.id, subId);
      expect(useTaskStore.getState().tasks.find((t) => t.id === task.id)?.subtasks[0].completed).toBe(true);

      useTaskStore.getState().deleteSubTask(task.id, subId);
      expect(useTaskStore.getState().tasks.find((t) => t.id === task.id)?.subtasks).toHaveLength(0);
    });

    it('manages projects and smart views', () => {
      useTaskStore.getState().addProject('Engineering', '#3b82f6', 'code');
      expect(useTaskStore.getState().projects.some((p) => p.name === 'Engineering')).toBe(true);

      const view = useTaskStore.getState().addSmartView('High Priority', 'star', '#f59e0b', {
        priorities: ['p1'],
      });
      expect(view).toBeDefined();
      expect(useTaskStore.getState().customViews.some((v) => v.id === view.id)).toBe(true);

      useTaskStore.getState().deleteSmartView(view.id);
      expect(useTaskStore.getState().customViews.some((v) => v.id === view.id)).toBe(false);
    });
  });
});
