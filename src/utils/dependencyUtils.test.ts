import { describe, it, expect } from 'vitest';
import {
  isTaskBlocked,
  getPotentialBlockingCandidates,
  mergeTaskData,
} from './dependencyUtils';
import type { Task } from '../types/task';

describe('dependencyUtils', () => {
  const blockingTask: Task = {
    id: 'blocker-1',
    title: 'Run database migration',
    status: 'todo',
    priority: 'p1',
    projectId: 'work',
    subtasks: [],
    createdAt: 1,
  };

  const blockedTask: Task = {
    id: 'blocked-1',
    title: 'Deploy backend API',
    status: 'todo',
    priority: 'p2',
    projectId: 'work',
    blockedBy: ['blocker-1'],
    subtasks: [],
    createdAt: 2,
  };

  it('correctly reports blocked status when dependency is incomplete', () => {
    const status = isTaskBlocked(blockedTask, [blockingTask, blockedTask]);
    expect(status.isBlocked).toBe(true);
    expect(status.blockingTasks.length).toBe(1);
    expect(status.blockingTasks[0].title).toBe('Run database migration');
  });

  it('reports unblocked status when dependency is marked done', () => {
    const completedBlocker = { ...blockingTask, status: 'done' as const };
    const status = isTaskBlocked(blockedTask, [completedBlocker, blockedTask]);
    expect(status.isBlocked).toBe(false);
    expect(status.blockingTasks.length).toBe(0);
  });

  it('filters out self and circular candidates', () => {
    const candidates = getPotentialBlockingCandidates(blockingTask.id, [
      blockingTask,
      blockedTask,
    ]);
    // blockedTask is blocked by blockingTask, so it shouldn't be a candidate for blockingTask
    expect(candidates.find((c) => c.id === blockedTask.id)).toBeUndefined();
    expect(candidates.find((c) => c.id === blockingTask.id)).toBeUndefined();
  });

  it('merges task descriptions, subtasks, and metadata cleanly', () => {
    const target: Task = {
      id: 't-target',
      title: 'Prepare presentation',
      description: 'Main outline',
      status: 'todo',
      priority: 'p2',
      projectId: 'work',
      subtasks: [{ id: 's1', title: 'Intro slide', completed: false }],
      contextTags: ['computer'],
      estimatedMinutes: 30,
      createdAt: 1,
    };

    const source: Task = {
      id: 't-source',
      title: 'Prepare slides and visuals',
      description: 'Visual diagrams',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      subtasks: [{ id: 's2', title: 'Charts slide', completed: false }],
      contextTags: ['desk'],
      estimatedMinutes: 45,
      createdAt: 2,
    };

    const merged = mergeTaskData(target, source);
    expect(merged.description).toContain('Main outline');
    expect(merged.description).toContain('Visual diagrams');
    expect(merged.subtasks?.length).toBe(2);
    expect(merged.priority).toBe('p1'); // p1 wins
    expect(merged.contextTags).toEqual(['computer', 'desk']);
    expect(merged.estimatedMinutes).toBe(75);
  });
});
