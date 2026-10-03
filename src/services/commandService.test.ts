import { describe, it, expect } from 'vitest';
import { commandService } from './commandService';
import type { Task } from '../types/task';

describe('commandService', () => {
  const initialTask: Task = {
    id: 'task-1',
    title: 'Complete project documentation',
    description: 'Initial draft',
    status: 'todo',
    priority: 'p2',
    projectId: 'work',
    subtasks: [{ id: 'sub-1', title: 'Outline', completed: true }],
    createdAt: 1000,
  };

  it('archiveTask sets archivedAt timestamp and creates reversible inverse', () => {
    const tasks = [initialTask];
    const result = commandService.archiveTask(tasks, 'task-1');

    expect(result.updatedTasks[0].archivedAt).toBeDefined();
    expect(result.description).toContain('Archived');

    // Test undo / inverse
    const restored = result.inverse(result.updatedTasks);
    expect(restored[0].archivedAt).toBeUndefined();
  });

  it('restoreTask removes deletedAt and archivedAt timestamps', () => {
    const archivedTask: Task = {
      ...initialTask,
      archivedAt: 2000,
      deletedAt: 2500,
    };
    const result = commandService.restoreTask([archivedTask], 'task-1');

    expect(result.updatedTasks[0].archivedAt).toBeUndefined();
    expect(result.updatedTasks[0].deletedAt).toBeUndefined();

    // Reversible inverse
    const inverted = result.inverse(result.updatedTasks);
    expect(inverted[0].archivedAt).toBe(2000);
    expect(inverted[0].deletedAt).toBe(2500);
  });

  it('mergeTasks combines data, redirects dependencies, and deletes source', () => {
    const targetTask: Task = {
      id: 'target',
      title: 'Target Task',
      description: 'Target description',
      status: 'todo',
      priority: 'p3',
      projectId: 'work',
      subtasks: [{ id: 's1', title: 'Sub 1', completed: false }],
      createdAt: 100,
    };

    const sourceTask: Task = {
      id: 'source',
      title: 'Source Task',
      description: 'Source description',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      subtasks: [{ id: 's2', title: 'Sub 2', completed: true }],
      createdAt: 200,
    };

    const dependentTask: Task = {
      id: 'dependent',
      title: 'Dependent Task',
      status: 'todo',
      priority: 'p2',
      projectId: 'work',
      blockedBy: ['source'],
      subtasks: [],
      createdAt: 300,
    };

    const tasks = [targetTask, sourceTask, dependentTask];
    const result = commandService.mergeTasks(tasks, 'target', 'source');

    const updatedTarget = result.updatedTasks.find((t) => t.id === 'target')!;
    const updatedSource = result.updatedTasks.find((t) => t.id === 'source')!;
    const updatedDep = result.updatedTasks.find((t) => t.id === 'dependent')!;

    // Target has merged subtasks, higher priority (p1), and merged description
    expect(updatedTarget.subtasks.length).toBe(2);
    expect(updatedTarget.priority).toBe('p1');
    expect(updatedTarget.description).toContain('Target description');
    expect(updatedTarget.description).toContain('Source description');

    // Source is marked deleted
    expect(updatedSource.deletedAt).toBeDefined();

    // Dependent task now blocked by target instead of source
    expect(updatedDep.blockedBy).toContain('target');
    expect(updatedDep.blockedBy).not.toContain('source');

    // Inverse restores pristine state
    const original = result.inverse(result.updatedTasks);
    expect(original).toEqual(tasks);

    // Inverse preserves unrelated edits/tasks created in the interim
    const unrelatedTask: Task = {
      id: 'unrelated-new',
      title: 'Unrelated task created after merge',
      status: 'todo',
      priority: 'p3',
      projectId: 'inbox',
      subtasks: [],
      createdAt: 500,
    };
    const interimTasks = [...result.updatedTasks, unrelatedTask];
    const undoneWithInterim = result.inverse(interimTasks);
    expect(undoneWithInterim.find((t) => t.id === 'unrelated-new')).toBeDefined();
    expect(undoneWithInterim.find((t) => t.id === 'target')?.description).toBe('Target description');
    expect(undoneWithInterim.find((t) => t.id === 'source')?.deletedAt).toBeUndefined();
  });

  it('createTask respects plannedDate and dueDate precedence correctly', () => {
    // 1. Parsed date without explicit override sets both plannedDate and dueDate
    const result1 = commandService.createTask([], 'Call client tomorrow');
    expect(result1.createdTask.dueDate).toBeDefined();
    expect(result1.createdTask.plannedDate).toBeUndefined();

    // 2. Explicit plannedDate overrides parsed date
    const result2 = commandService.createTask([], 'Call client tomorrow', {
      plannedDate: '2026-10-15',
    });
    expect(result2.createdTask.plannedDate).toBe('2026-10-15');

    // 3. Fallback to context defaultPlannedDate when no date is parsed
    const result3 = commandService.createTask([], 'Simple task', undefined, {
      defaultPlannedDate: '2026-10-05',
    });
    expect(result3.createdTask.plannedDate).toBe('2026-10-05');
    expect(result3.createdTask.dueDate).toBeUndefined();
  });

  it('toggleTaskStatus generates recurring task, preserves Top 3 history, and cleanly undos', () => {
    const recurringTask: Task = {
      ...initialTask,
      id: 'rec-1',
      recurrence: 'daily',
      isPinnedToday: true,
      dueDate: '2026-10-03',
      plannedDate: '2026-10-03',
    };

    const result = commandService.toggleTaskStatus([recurringTask], 'rec-1');

    // Completed task should be done and unpinned from Top 3
    const completed = result.updatedTasks.find((t) => t.id === 'rec-1')!;
    expect(completed.status).toBe('done');
    expect(completed.isPinnedToday).toBe(true);
    expect(completed.completedAt).toBeDefined();

    // Next recurring task should be created
    const nextTask = result.updatedTasks.find((t) => t.id !== 'rec-1')!;
    expect(nextTask).toBeDefined();
    expect(nextTask.status).toBe('todo');
    expect(nextTask.plannedDate).toBe('2026-10-04');
    expect(nextTask.isPinnedToday).toBe(false);

    // Undo should restore original task to todo with original isPinnedToday, and remove recurring task
    const undone = result.inverse(result.updatedTasks);
    expect(undone.length).toBe(1);
    expect(undone[0].id).toBe('rec-1');
    expect(undone[0].status).toBe('todo');
    expect(undone[0].isPinnedToday).toBe(true);
    expect(undone[0].completedAt).toBeUndefined();
  });
});
