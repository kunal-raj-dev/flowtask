// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import { useUIStore } from '../store/useUIStore';
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

describe('useKeyboardNavigation Multi-Select Choreography', () => {
  const tasks: Task[] = [
    { id: 't1', title: 'Task 1', status: 'todo', priority: 'p3', projectId: 'inbox', subtasks: [], createdAt: 1 },
    { id: 't2', title: 'Task 2', status: 'todo', priority: 'p4', projectId: 'inbox', subtasks: [], createdAt: 2 },
  ];

  beforeEach(() => {
    useUIStore.getState().clearTaskSelection();
    useUIStore.getState().setSelectedTaskId(null);
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

  it('triggers batch delete on pressing D when tasks are selected', () => {
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
