import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore, useFocusStore } from './index';

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
  });
});
