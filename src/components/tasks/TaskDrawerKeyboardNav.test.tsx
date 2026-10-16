// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useUIStore } from '../../store/useUIStore';
import type { Task } from '../../types/task';

// Test harness component
const KeyboardTestHarness: React.FC<{
  tasks: Task[];
  onSelectTask: (id: string) => void;
  onToggleStatus: (id: string) => void;
}> = ({ tasks, onSelectTask, onToggleStatus }) => {
  const { focusedTaskId } = useKeyboardNavigation({
    tasks,
    onSelectTask,
    onToggleStatus,
    enabled: true,
  });

  return (
    <div>
      <span data-testid="focused-id">{focusedTaskId || 'none'}</span>
      {tasks.map((t) => (
        <div key={t.id} data-testid={`task-${t.id}`}>
          {t.title}
        </div>
      ))}
    </div>
  );
};

describe('Fluid Keyboard Navigation with Slide-Over Drawer', () => {
  const tasks: Task[] = [
    { id: 'task-1', title: 'Task One', status: 'todo', priority: 'p1', projectId: 'inbox', subtasks: [], createdAt: 1 },
    { id: 'task-2', title: 'Task Two', status: 'todo', priority: 'p2', projectId: 'inbox', subtasks: [], createdAt: 2 },
    { id: 'task-3', title: 'Task Three', status: 'todo', priority: 'p3', projectId: 'inbox', subtasks: [], createdAt: 3 },
  ];

  beforeEach(() => {
    useUIStore.getState().setSelectedTaskId(null);
  });

  it('navigates with j and k when no modal is open', () => {
    const onSelectTask = vi.fn();
    const onToggleStatus = vi.fn();

    render(
      <KeyboardTestHarness
        tasks={tasks}
        onSelectTask={onSelectTask}
        onToggleStatus={onToggleStatus}
      />
    );

    // Initial state: no focused task
    expect(screen.getByTestId('focused-id').textContent).toBe('none');

    // Press 'j' -> moves to first task
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('focused-id').textContent).toBe('task-1');

    // Press 'j' -> moves to second task
    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByTestId('focused-id').textContent).toBe('task-2');

    // Press 'k' -> moves back to first task
    fireEvent.keyDown(window, { key: 'k' });
    expect(screen.getByTestId('focused-id').textContent).toBe('task-1');
  });

  it('updates selectedTaskId in place when j is pressed and drawer is open', () => {
    const onSelectTask = vi.fn();
    const onToggleStatus = vi.fn();

    // Simulate drawer open for task-1
    useUIStore.getState().setSelectedTaskId('task-1');

    // Mount drawer mock element with data-task-drawer="true"
    const drawerEl = document.createElement('div');
    drawerEl.setAttribute('role', 'dialog');
    drawerEl.setAttribute('aria-modal', 'true');
    drawerEl.setAttribute('data-task-drawer', 'true');
    document.body.appendChild(drawerEl);

    try {
      render(
        <KeyboardTestHarness
          tasks={tasks}
          onSelectTask={onSelectTask}
          onToggleStatus={onToggleStatus}
        />
      );

      // Should automatically sync focusedTaskId with selectedTaskId
      expect(screen.getByTestId('focused-id').textContent).toBe('task-1');

      // Press 'j' -> should advance to task-2 and trigger onSelectTask for task-2
      fireEvent.keyDown(window, { key: 'j' });
      expect(onSelectTask).toHaveBeenCalledWith('task-2');
    } finally {
      document.body.removeChild(drawerEl);
    }
  });

  it('blocks keyboard navigation when a blocking modal is present without data-task-drawer', () => {
    const onSelectTask = vi.fn();
    const onToggleStatus = vi.fn();

    const blockingModal = document.createElement('div');
    blockingModal.setAttribute('role', 'dialog');
    blockingModal.setAttribute('aria-modal', 'true');
    document.body.appendChild(blockingModal);

    try {
      render(
        <KeyboardTestHarness
          tasks={tasks}
          onSelectTask={onSelectTask}
          onToggleStatus={onToggleStatus}
        />
      );

      fireEvent.keyDown(window, { key: 'j' });
      // Should remain 'none' because blockingModal intercepted
      expect(screen.getByTestId('focused-id').textContent).toBe('none');
      expect(onSelectTask).not.toHaveBeenCalled();
    } finally {
      document.body.removeChild(blockingModal);
    }
  });

  it('does not hijack Space or Enter when an interactive button is focused', () => {
    const onSelectTask = vi.fn();
    const onToggleStatus = vi.fn();

    render(
      <div>
        <button data-testid="internal-btn">Action</button>
        <KeyboardTestHarness
          tasks={tasks}
          onSelectTask={onSelectTask}
          onToggleStatus={onToggleStatus}
        />
      </div>
    );

    const btn = screen.getByTestId('internal-btn');
    btn.focus();
    expect(document.activeElement).toBe(btn);

    // Press Space while focused on button
    fireEvent.keyDown(window, { key: ' ' });
    expect(onToggleStatus).not.toHaveBeenCalled();

    // Press Enter while focused on button
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelectTask).not.toHaveBeenCalled();
  });
});
