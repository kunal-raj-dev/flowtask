import { describe, it, expect } from 'vitest';
import {
  isTaskDeferred,
  isTaskBlocked,
  getAvailableTasks,
  getDeferredTasks,
  getBlockedTasks,
} from './workspaceSelectors';
import type { Task, Project } from '../types/task';

describe('GTD Temporal Pipeline & Sequential Project DAG Selectors', () => {
  const baseDate = new Date('2026-10-25T12:00:00Z');

  describe('Defer Date Engine', () => {
    it('identifies future defer dates as deferred', () => {
      const taskFutureDate: Task = {
        id: 't-future-date',
        title: 'Review proposal',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        deferUntil: '2026-10-28',
        subtasks: [],
        createdAt: 100,
      };
      expect(isTaskDeferred(taskFutureDate, baseDate)).toBe(true);

      const taskFutureUtc: Task = {
        ...taskFutureDate,
        deferUntil: '2026-10-26T14:00:00Z',
      };
      expect(isTaskDeferred(taskFutureUtc, baseDate)).toBe(true);
    });

    it('identifies past or today defer dates as actionable (not deferred)', () => {
      const taskPast: Task = {
        id: 't-past',
        title: 'Call dentist',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        deferUntil: '2026-10-20',
        subtasks: [],
        createdAt: 100,
      };
      expect(isTaskDeferred(taskPast, baseDate)).toBe(false);

      const taskToday: Task = {
        ...taskPast,
        deferUntil: '2026-10-25',
      };
      expect(isTaskDeferred(taskToday, baseDate)).toBe(false);

      const taskNoDefer: Task = {
        ...taskPast,
        deferUntil: undefined,
      };
      expect(isTaskDeferred(taskNoDefer, baseDate)).toBe(false);
    });
  });

  describe('Sequential DAG Project Pipeline', () => {
    const sequentialProject: Project = {
      id: 'proj-seq',
      name: 'Launch Website',
      color: '#3B82F6',
      isSequential: true,
    };

    const parallelProject: Project = {
      id: 'proj-par',
      name: 'Errands',
      color: '#10B981',
      isSequential: false,
    };

    const task1: Task = {
      id: 't-1',
      title: 'Step 1: Buy domain',
      status: 'todo',
      priority: 'p1',
      projectId: 'proj-seq',
      createdAt: 100,
      subtasks: [],
    };

    const task2: Task = {
      id: 't-2',
      title: 'Step 2: Deploy server',
      status: 'todo',
      priority: 'p1',
      projectId: 'proj-seq',
      predecessorTaskId: 't-1',
      createdAt: 200,
      subtasks: [],
    };

    const task3: Task = {
      id: 't-3',
      title: 'Step 3: Point DNS',
      status: 'todo',
      priority: 'p1',
      projectId: 'proj-seq',
      predecessorTaskId: 't-2',
      createdAt: 300,
      subtasks: [],
    };

    const allTasks = [task1, task2, task3];

    it('blocks subsequent actions until predecessor is completed', () => {
      // Step 1 is not blocked
      expect(isTaskBlocked(task1, allTasks, [sequentialProject])).toBe(false);
      // Step 2 and 3 are blocked
      expect(isTaskBlocked(task2, allTasks, [sequentialProject])).toBe(true);
      expect(isTaskBlocked(task3, allTasks, [sequentialProject])).toBe(true);
    });

    it('unblocks Step 2 once Step 1 is marked done', () => {
      const task1Done: Task = { ...task1, status: 'done' };
      const updatedTasks = [task1Done, task2, task3];

      expect(isTaskBlocked(task2, updatedTasks, [sequentialProject])).toBe(false);
      expect(isTaskBlocked(task3, updatedTasks, [sequentialProject])).toBe(true);
    });

    it('does not block parallel projects', () => {
      const parTask1: Task = {
        id: 'pt-1',
        title: 'Buy groceries',
        status: 'todo',
        priority: 'p3',
        projectId: 'proj-par',
        createdAt: 100,
        subtasks: [],
      };
      const parTask2: Task = {
        id: 'pt-2',
        title: 'Pick up dry cleaning',
        status: 'todo',
        priority: 'p3',
        projectId: 'proj-par',
        createdAt: 200,
        subtasks: [],
      };
      expect(isTaskBlocked(parTask1, [parTask1, parTask2], [parallelProject])).toBe(false);
      expect(isTaskBlocked(parTask2, [parTask1, parTask2], [parallelProject])).toBe(false);
    });
  });

  describe('getAvailableTasks filter', () => {
    it('isolates only truly actionable tasks, excluding future deferred and blocked items', () => {
      const proj: Project = { id: 'p1', name: 'Project', color: '#000', isSequential: true };
      const tasks: Task[] = [
        { id: '1', title: 'Actionable now', status: 'todo', priority: 'p2', projectId: 'inbox', subtasks: [], createdAt: 1 },
        { id: '2', title: 'Deferred until next week', status: 'todo', priority: 'p2', projectId: 'inbox', deferUntil: '2026-11-01', subtasks: [], createdAt: 2 },
        { id: '3', title: 'Seq step 1', status: 'todo', priority: 'p1', projectId: 'p1', subtasks: [], createdAt: 10 },
        { id: '4', title: 'Seq step 2', status: 'todo', priority: 'p1', projectId: 'p1', predecessorTaskId: '3', subtasks: [], createdAt: 20 },
      ];

      const available = getAvailableTasks(tasks, [proj], baseDate);
      expect(available.map((t) => t.id)).toEqual(['1', '3']);

      const deferred = getDeferredTasks(tasks, baseDate);
      expect(deferred.map((t) => t.id)).toEqual(['2']);

      const blocked = getBlockedTasks(tasks, [proj]);
      expect(blocked.map((t) => t.id)).toEqual(['4']);
    });
  });
});
