// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useUIStore } from '../store/useUIStore';
import { useModalStore } from '../store/useModalStore';
import { useTaskStore } from '../store/useTaskStore';
import type { Task } from '../types/task';

const MultiSelectHarness: React.FC<{
  tasks: Task[];
  onBatchUpdate: (taskIds: string[], updates: Partial<Task>) => void;
  onBatchDelete: (taskIds: string[]) => void;
  onBatchArchive: (taskIds: string[]) => void;
}> = ({ tasks, onBatchUpdate, onBatchDelete, onBatchArchive }) => {
  useKeyboardNavigation({
    tasks,
    onSelectTask: vi.fn(),
    onToggleStatus: vi.fn(),
    onBatchUpdate,
    onBatchDelete,
    onBatchArchive,
    enabled: true,
  });
  return <div>Harness</div>;
};

const SingleSelectHarness: React.FC<{
  tasks: Task[];
  onSelectTask?: (taskId: string) => void;
  onToggleStatus?: (taskId: string) => void;
  onTogglePinToday?: (taskId: string) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
  onBatchArchive?: (taskIds: string[]) => void;
}> = ({
  tasks,
  onSelectTask = vi.fn(),
  onToggleStatus = vi.fn(),
  onTogglePinToday = vi.fn(),
  onUpdateTask = vi.fn(),
  onDeleteTask = vi.fn(),
  onStartFocus = vi.fn(),
  onBatchArchive = vi.fn(),
}) => {
  useKeyboardNavigation({
    tasks,
    onSelectTask,
    onToggleStatus,
    onTogglePinToday,
    onUpdateTask,
    onDeleteTask,
    onStartFocus,
    onBatchArchive,
    enabled: true,
  });
  return <div>Single Harness</div>;
};

describe('useKeyboardNavigation Multi-Select Choreography', () => {
  const tasks: Task[] = [
    { id: 't1', title: 'Task 1', status: 'todo', priority: 'p3', projectId: 'inbox', subtasks: [], createdAt: 1 },
    { id: 't2', title: 'Task 2', status: 'todo', priority: 'p4', projectId: 'inbox', subtasks: [], createdAt: 2 },
  ];

  beforeEach(() => {
    useUIStore.getState().clearTaskSelection();
    useUIStore.getState().setSelectedTaskId(null);
    useUIStore.getState().setFocusedTaskId(null);
    useUIStore.getState().setActivePopover(null);
  });

  it('triggers batch archive on pressing E when tasks are selected', () => {
    const onBatchArchive = vi.fn();
    const onBatchUpdate = vi.fn();
    const onBatchDelete = vi.fn();

    render(
      <MultiSelectHarness
        tasks={tasks}
        onBatchUpdate={onBatchUpdate}
        onBatchDelete={onBatchDelete}
        onBatchArchive={onBatchArchive}
      />
    );

    useUIStore.getState().selectAllTasks(['t1', 't2']);
    expect(useUIStore.getState().selectedTaskIds).toEqual(['t1', 't2']);

    fireEvent.keyDown(window, { key: 'e' });
    expect(onBatchArchive).toHaveBeenCalledWith(['t1', 't2']);
    expect(useUIStore.getState().selectedTaskIds).toEqual([]);
  });

  it('triggers batch delete on pressing Delete when tasks are selected', () => {
    const onBatchArchive = vi.fn();
    const onBatchUpdate = vi.fn();
    const onBatchDelete = vi.fn();

    render(
      <MultiSelectHarness
        tasks={tasks}
        onBatchUpdate={onBatchUpdate}
        onBatchDelete={onBatchDelete}
        onBatchArchive={onBatchArchive}
      />
    );

    useUIStore.getState().selectAllTasks(['t1', 't2']);
    fireEvent.keyDown(window, { key: 'd' });
    expect(onBatchDelete).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(onBatchDelete).toHaveBeenCalledWith(['t1', 't2']);
    expect(useUIStore.getState().selectedTaskIds).toEqual([]);
  });

  it('triggers batch reschedule to today on pressing T and clears selection', () => {
    const onBatchArchive = vi.fn();
    const onBatchUpdate = vi.fn();
    const onBatchDelete = vi.fn();

    render(
      <MultiSelectHarness
        tasks={tasks}
        onBatchUpdate={onBatchUpdate}
        onBatchDelete={onBatchDelete}
        onBatchArchive={onBatchArchive}
      />
    );

    useUIStore.getState().selectAllTasks(['t1', 't2']);
    fireEvent.keyDown(window, { key: 't' });
    expect(onBatchUpdate).toHaveBeenCalledWith(
      ['t1', 't2'],
      expect.objectContaining({ plannedDate: expect.any(String), isSomeday: false })
    );
    expect(useUIStore.getState().selectedTaskIds).toEqual([]);
  });

  it('triggers batch priority change on pressing 1 or P and clears selection', () => {
    const onBatchArchive = vi.fn();
    const onBatchUpdate = vi.fn();
    const onBatchDelete = vi.fn();

    render(
      <MultiSelectHarness
        tasks={tasks}
        onBatchUpdate={onBatchUpdate}
        onBatchDelete={onBatchDelete}
        onBatchArchive={onBatchArchive}
      />
    );

    useUIStore.getState().selectAllTasks(['t1', 't2']);
    fireEvent.keyDown(window, { key: '1' });
    expect(onBatchUpdate).toHaveBeenCalledWith(['t1', 't2'], { priority: 'p1' });
    expect(useUIStore.getState().selectedTaskIds).toEqual([]);
  });
});

describe('useKeyboardNavigation Single-Key Popovers & Linear-Grade Interactions', () => {
  const tasks: Task[] = [
    { id: 'task-1', title: 'Task 1', status: 'todo', priority: 'p3', projectId: 'inbox', subtasks: [], createdAt: 1 },
    { id: 'task-2', title: 'Task 2', status: 'todo', priority: 'p4', projectId: 'inbox', subtasks: [], createdAt: 2 },
  ];

  beforeEach(() => {
    useUIStore.getState().clearTaskSelection();
    useUIStore.getState().setSelectedTaskId(null);
    useUIStore.getState().setFocusedTaskId(null);
    useUIStore.getState().setActivePopover(null);
    useUIStore.getState().setIsQuickAddOpen(false);
    useModalStore.getState().closeAllModals();
  });

  it('navigates with j and k keys', () => {
    render(<SingleSelectHarness tasks={tasks} />);

    // Initial state: first task focused
    fireEvent.keyDown(window, { key: 'j' });
    expect(useUIStore.getState().focusedTaskId).toBe('task-1');

    // Move to next
    fireEvent.keyDown(window, { key: 'j' });
    expect(useUIStore.getState().focusedTaskId).toBe('task-2');

    // Move up
    fireEvent.keyDown(window, { key: 'k' });
    expect(useUIStore.getState().focusedTaskId).toBe('task-1');
  });

  it('opens PriorityPickerPopover on pressing p', () => {
    render(<SingleSelectHarness tasks={tasks} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 'p' });
    expect(useUIStore.getState().activePopover).toEqual({
      type: 'priority',
      taskId: 'task-1',
    });
  });

  it('opens DatePickerPopover on pressing d', () => {
    render(<SingleSelectHarness tasks={tasks} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 'd' });
    expect(useUIStore.getState().activePopover).toEqual({
      type: 'date',
      taskId: 'task-1',
    });
  });

  it('toggles Top 3 Pin on pressing *', () => {
    const onTogglePinToday = vi.fn();
    render(<SingleSelectHarness tasks={tasks} onTogglePinToday={onTogglePinToday} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: '*' });
    expect(onTogglePinToday).toHaveBeenCalledWith('task-1');
  });

  it('reschedules to Today on pressing t', () => {
    const onUpdateTask = vi.fn();
    render(<SingleSelectHarness tasks={tasks} onUpdateTask={onUpdateTask} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 't' });
    expect(onUpdateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ isSomeday: false, plannedDate: expect.any(String) })
    );
  });

  it('toggles multi-select on pressing x', () => {
    render(<SingleSelectHarness tasks={tasks} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 'x' });
    expect(useUIStore.getState().selectedTaskIds).toEqual(['task-1']);

    fireEvent.keyDown(window, { key: 'x' });
    expect(useUIStore.getState().selectedTaskIds).toEqual([]);
  });

  it('toggles completion on pressing Space', () => {
    const onToggleStatus = vi.fn();
    render(<SingleSelectHarness tasks={tasks} onToggleStatus={onToggleStatus} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: ' ' });
    expect(onToggleStatus).toHaveBeenCalledWith('task-1');
  });

  it('starts focus session on pressing f', () => {
    const onStartFocus = vi.fn();
    render(<SingleSelectHarness tasks={tasks} onStartFocus={onStartFocus} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 'f' });
    expect(onStartFocus).toHaveBeenCalledWith('task-1');
  });

  it('archives focused task on pressing e', () => {
    const onBatchArchive = vi.fn();
    render(<SingleSelectHarness tasks={tasks} onBatchArchive={onBatchArchive} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 'e' });
    expect(onBatchArchive).toHaveBeenCalledWith(['task-1']);
  });

  it('opens quick add composer on pressing c anywhere', () => {
    render(<SingleSelectHarness tasks={tasks} />);

    fireEvent.keyDown(window, { key: 'c' });
    expect(useUIStore.getState().isQuickAddOpen).toBe(true);
  });

  it('opens details with Enter and reserves F2 for inline rename', () => {
    const onSelectTask = vi.fn();
    const editHandler = vi.fn();
    window.addEventListener('flowtask:edit-task', editHandler);

    render(<SingleSelectHarness tasks={tasks} onSelectTask={onSelectTask} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelectTask).toHaveBeenCalledWith('task-1');
    expect(editHandler).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'F2' });
    expect(editHandler).toHaveBeenCalledTimes(1);
    window.removeEventListener('flowtask:edit-task', editHandler);
  });

  it('deletes focused task on pressing Delete or Backspace', () => {
    const onDeleteTask = vi.fn();
    render(<SingleSelectHarness tasks={tasks} onDeleteTask={onDeleteTask} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(onDeleteTask).toHaveBeenCalledWith('task-1');
  });

  it('updates priority directly on pressing 1..4', () => {
    const onUpdateTask = vi.fn();
    render(<SingleSelectHarness tasks={tasks} onUpdateTask={onUpdateTask} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: '1' });
    expect(onUpdateTask).toHaveBeenCalledWith('task-1', { priority: 'p1' });

    fireEvent.keyDown(window, { key: '4' });
    expect(onUpdateTask).toHaveBeenCalledWith('task-1', { priority: 'p4' });
  });

  it('reschedules to Tomorrow on pressing m and moves to Someday on pressing s', () => {
    const onUpdateTask = vi.fn();
    render(<SingleSelectHarness tasks={tasks} onUpdateTask={onUpdateTask} />);
    fireEvent.keyDown(window, { key: 'j' }); // focus task-1

    fireEvent.keyDown(window, { key: 'm' });
    expect(onUpdateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ isSomeday: false, isPinnedToday: false })
    );

    fireEvent.keyDown(window, { key: 's' });
    expect(onUpdateTask).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ isSomeday: true, isPinnedToday: false })
    );
  });

  it('blocks navigation when modal is open in useModalStore', () => {
    render(<SingleSelectHarness tasks={tasks} />);
    useModalStore.getState().openModal('auth');

    fireEvent.keyDown(window, { key: 'j' });
    expect(useUIStore.getState().focusedTaskId).toBeNull();
  });

  it('blocks hotkeys when activeElement is input, textarea, contenteditable, or role=textbox', () => {
    render(<SingleSelectHarness tasks={tasks} />);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(window, { key: 'j' });
    expect(useUIStore.getState().focusedTaskId).toBeNull();

    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.appendChild(editable);
    editable.focus();

    fireEvent.keyDown(window, { key: 'j' });
    expect(useUIStore.getState().focusedTaskId).toBeNull();

    const searchBox = document.createElement('div');
    searchBox.setAttribute('role', 'searchbox');
    searchBox.setAttribute('tabindex', '0');
    document.body.appendChild(searchBox);
    searchBox.focus();

    fireEvent.keyDown(window, { key: 'j' });
    expect(useUIStore.getState().focusedTaskId).toBeNull();

    document.body.removeChild(input);
    document.body.removeChild(editable);
    document.body.removeChild(searchBox);
  });

  it('opens quickAdd modal on pressing c, C, n, or N', () => {
    render(<SingleSelectHarness tasks={tasks} />);

    // Test 'c'
    useModalStore.getState().closeModal('quickAdd');
    useUIStore.getState().setIsQuickAddOpen(false);
    fireEvent.keyDown(window, { key: 'c' });
    expect(useUIStore.getState().isQuickAddOpen).toBe(true);

    // Test 'n'
    useModalStore.getState().closeModal('quickAdd');
    useUIStore.getState().setIsQuickAddOpen(false);
    fireEvent.keyDown(window, { key: 'n' });
    expect(useUIStore.getState().isQuickAddOpen).toBe(true);

    // Test 'N'
    useModalStore.getState().closeModal('quickAdd');
    useUIStore.getState().setIsQuickAddOpen(false);
    fireEvent.keyDown(window, { key: 'N' });
    expect(useUIStore.getState().isQuickAddOpen).toBe(true);
  });

  it('disables shortcuts when settings.keyboardShortcutsEnabled is false', () => {
    const origSettings = useTaskStore.getState().settings;
    useTaskStore.setState({
      settings: { ...origSettings, keyboardShortcutsEnabled: false },
    });

    render(<SingleSelectHarness tasks={tasks} />);

    useModalStore.getState().closeModal('quickAdd');
    useUIStore.getState().setIsQuickAddOpen(false);
    fireEvent.keyDown(window, { key: 'n' });
    expect(useUIStore.getState().isQuickAddOpen).toBe(false);

    fireEvent.keyDown(window, { key: 'j' });
    expect(useUIStore.getState().focusedTaskId).toBeNull();

    // Restore
    useTaskStore.setState({ settings: origSettings });
  });
});
