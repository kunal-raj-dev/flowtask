import { describe, it, expect } from 'vitest';
import {
  isTaskBlocked,
  getPotentialBlockingCandidates,
  mergeTaskData,
  wouldCreateCycle,
  getMergePreview,
  redirectDependencies,
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

  describe('wouldCreateCycle', () => {
    it('detects self-dependency cycle', () => {
      expect(wouldCreateCycle('task-a', 'task-a', [blockingTask])).toBe(true);
    });

    it('detects 2-hop circular dependency', () => {
      // taskA is blocked by taskB; attempting to set taskA as blocker for taskB creates a cycle
      const taskA: Task = {
        id: 'task-a',
        title: 'Task A',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        blockedBy: ['task-b'],
        subtasks: [],
        createdAt: 10,
      };
      const taskB: Task = {
        id: 'task-b',
        title: 'Task B',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        subtasks: [],
        createdAt: 20,
      };

      // Adding taskA as blocker for taskB (taskB blockedBy taskA) creates a cycle: B -> A -> B
      expect(wouldCreateCycle('task-b', 'task-a', [taskA, taskB])).toBe(true);
      // Adding taskB as blocker for taskA does not create a cycle since taskB has no dependencies
      expect(wouldCreateCycle('task-a', 'task-b', [taskA, taskB])).toBe(false);
    });

    it('detects 3-hop transitive circular dependency', () => {
      // Chain: A is blocked by B, B is blocked by C.
      // If we attempt to set A as blocker for C (C blockedBy A), cycle C -> A -> B -> C is formed.
      const taskA: Task = {
        id: 'task-a',
        title: 'Task A',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        blockedBy: ['task-b'],
        subtasks: [],
        createdAt: 10,
      };
      const taskB: Task = {
        id: 'task-b',
        title: 'Task B',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        blockedBy: ['task-c'],
        subtasks: [],
        createdAt: 20,
      };
      const taskC: Task = {
        id: 'task-c',
        title: 'Task C',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        subtasks: [],
        createdAt: 30,
      };

      const tasks = [taskA, taskB, taskC];
      expect(wouldCreateCycle('task-c', 'task-a', tasks)).toBe(true);
      expect(wouldCreateCycle('task-c', 'task-b', tasks)).toBe(true);
    });

    it('returns false for independent valid dependencies', () => {
      const taskA: Task = {
        id: 'task-a',
        title: 'Task A',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        subtasks: [],
        createdAt: 10,
      };
      const taskB: Task = {
        id: 'task-b',
        title: 'Task B',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        subtasks: [],
        createdAt: 20,
      };

      expect(wouldCreateCycle('task-a', 'task-b', [taskA, taskB])).toBe(false);
    });
  });

  describe('getMergePreview', () => {
    it('detects project, priority, and date conflicts and previews redirects', () => {
      const target: Task = {
        id: 'target-1',
        title: 'Main Feature',
        status: 'todo',
        priority: 'p3',
        projectId: 'work',
        dueDate: '2026-10-10',
        subtasks: [{ id: 's1', title: 'Target Sub', completed: false }],
        createdAt: 100,
      };

      const source: Task = {
        id: 'source-1',
        title: 'Duplicate Feature',
        status: 'todo',
        priority: 'p1',
        projectId: 'personal',
        dueDate: '2026-10-15',
        subtasks: [{ id: 's2', title: 'Source Sub', completed: true }],
        createdAt: 200,
      };

      const dependentTask: Task = {
        id: 'dep-1',
        title: 'Dependent Task',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        blockedBy: ['source-1'],
        subtasks: [],
        createdAt: 300,
      };

      const allTasks = [target, source, dependentTask];
      const preview = getMergePreview(target, source, allTasks);

      // Conflicts
      expect(preview.conflicts.length).toBe(3);
      const projConflict = preview.conflicts.find((c) => c.field === 'Project');
      expect(projConflict?.resolvedValue).toBe('work');

      const prioConflict = preview.conflicts.find((c) => c.field === 'Priority');
      expect(prioConflict?.resolvedValue).toBe('P1');

      const dueConflict = preview.conflicts.find((c) => c.field === 'Due Date');
      expect(dueConflict?.resolvedValue).toBe('2026-10-10');

      // Redirected tasks
      expect(preview.redirectedTasks.length).toBe(1);
      expect(preview.redirectedTasks[0].taskId).toBe('dep-1');

      // Combined updates
      expect(preview.combinedTaskUpdates.subtasks?.length).toBe(2);
      expect(preview.combinedTaskUpdates.priority).toBe('p1');
    });
  });

  describe('redirectDependencies', () => {
    it('redirects oldId to newId in blockedBy arrays and prevents self-block', () => {
      const tasks: Task[] = [
        {
          id: 'task-1',
          title: 'Task 1',
          status: 'todo',
          priority: 'p2',
          projectId: 'work',
          blockedBy: ['old-id', 'other-id'],
          subtasks: [],
          createdAt: 10,
        },
        {
          id: 'new-id',
          title: 'Target Task',
          status: 'todo',
          priority: 'p1',
          projectId: 'work',
          blockedBy: ['old-id'], // would become new-id, so should be filtered out to avoid self-block
          subtasks: [],
          createdAt: 20,
        },
      ];

      const redirected = redirectDependencies(tasks, 'old-id', 'new-id');
      const t1 = redirected.find((t) => t.id === 'task-1');
      expect(t1?.blockedBy).toContain('new-id');
      expect(t1?.blockedBy).not.toContain('old-id');

      const target = redirected.find((t) => t.id === 'new-id');
      expect(target?.blockedBy).not.toContain('new-id'); // Self block filtered out
    });
  });
});
