import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { WorkspaceStore } from './workspaceStore';
import { emptyWorkspace } from './dbService';
import {
  WorkspaceStoreContext,
  useWorkspaceTasks,
  useWorkspaceProjects,
  useActiveTask,
} from '../context/TaskContext';

function createStoreWrapper(store: WorkspaceStore) {
  return ({ children }: { children: React.ReactNode }) => (
    <WorkspaceStoreContext.Provider value={store}>
      {children}
    </WorkspaceStoreContext.Provider>
  );
}

describe('WorkspaceStore selector slices', () => {
  it('subscribes to tasks, projects, and activeTask memoized slices', async () => {
    const mockPersistence = {
      ensureLegacyMigrated: vi.fn(async (id: string) => ({
        ...emptyWorkspace(id),
        tasks: [
          {
            id: 't-1',
            title: 'Initial Task',
            status: 'todo' as const,
            priority: 'p1' as const,
            projectId: 'inbox',
            createdAt: Date.now(),
            subtasks: [],
          },
        ],
      })),
      saveWorkspace: vi.fn(async () => {}),
      loadWorkspace: vi.fn(async () => null),
      deleteWorkspace: vi.fn(async () => {}),
      requestPersistentStorage: vi.fn(async () => true),
    };

    const store = new WorkspaceStore('sel-test', false, mockPersistence as any);
    await store.load();

    const wrapper = createStoreWrapper(store);

    const { result: tasksResult } = renderHook(() => useWorkspaceTasks(), { wrapper });
    const { result: projectsResult } = renderHook(() => useWorkspaceProjects(), { wrapper });
    const { result: activeTaskResult } = renderHook(() => useActiveTask('t-1'), { wrapper });

    expect(tasksResult.current).toHaveLength(1);
    expect(tasksResult.current[0].title).toBe('Initial Task');
    expect(projectsResult.current.length).toBeGreaterThan(0);
    expect(activeTaskResult.current?.title).toBe('Initial Task');

    // Mutate unrelated state (preferences) - tasks reference should remain stable
    const tasksBefore = tasksResult.current;
    act(() => {
      store.run('Update pref', r => ({
        ...r,
        preferences: { ...r.preferences, customFlag: true },
      }));
    });

    expect(tasksResult.current).toBe(tasksBefore);

    // Mutate task title
    act(() => {
      store.run('Update task', r => ({
        ...r,
        tasks: r.tasks.map(t => t.id === 't-1' ? { ...t, title: 'Updated Task' } : t),
      }));
    });

    expect(tasksResult.current[0].title).toBe('Updated Task');
    expect(activeTaskResult.current?.title).toBe('Updated Task');
  });
});
