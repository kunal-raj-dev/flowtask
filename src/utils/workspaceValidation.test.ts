import { describe, it, expect } from 'vitest';
import { validateWorkspaceData } from './workspaceValidation';

describe('validateWorkspaceData (BUG-01 & BUG-02)', () => {
  const defaultProjects = [
    { id: 'inbox', name: 'Inbox', color: '#64748B' },
    { id: 'work', name: 'Work', color: '#3B82F6' },
  ];

  it('allows legacy ideas project ID and cleanly remaps to inbox with isSomeday flag when ideas project is absent', () => {
    const rawTasks = [
      {
        id: 'task-legacy-1',
        title: 'Legacy idea note',
        status: 'todo',
        priority: 'p2',
        projectId: 'ideas',
        createdAt: 1700000000000,
      },
    ];

    const result = validateWorkspaceData(rawTasks, defaultProjects);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].projectId).toBe('inbox');
    expect(result.tasks[0].isSomeday).toBe(true);
  });

  it('keeps legacy ideas project ID intact if ideas project is registered in projects array', () => {
    const projectsWithIdeas = [
      ...defaultProjects,
      { id: 'ideas', name: 'Ideas & Someday', color: '#8B5CF6' },
    ];
    const rawTasks = [
      {
        id: 'task-legacy-2',
        title: 'Another idea',
        status: 'todo',
        priority: 'p3',
        projectId: 'ideas',
        createdAt: 1700000000000,
      },
    ];

    const result = validateWorkspaceData(rawTasks, projectsWithIdeas);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].projectId).toBe('ideas');
    expect(result.tasks[0].isSomeday).toBe(true);
  });

  it('cleanlys remap any missing project ID to inbox without throwing a fatal crash', () => {
    const rawTasks = [
      {
        id: 'task-unknown-proj',
        title: 'Task with orphan project',
        status: 'todo',
        priority: 'p1',
        projectId: 'non-existent-proj-xyz',
        createdAt: 1700000000000,
      },
    ];

    const result = validateWorkspaceData(rawTasks, defaultProjects);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].projectId).toBe('inbox');
  });

  it('coerces string ISO timestamps to numeric milliseconds (BUG-02)', () => {
    const isoString = '2026-10-16T12:00:00.000Z';
    const expectedTime = Date.parse(isoString);

    const rawTasks = [
      {
        id: 'task-iso-ts',
        title: 'Task with ISO string timestamp',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: isoString,
        updatedAt: isoString,
        completedAt: isoString,
      },
    ];

    const result = validateWorkspaceData(rawTasks, defaultProjects);
    expect(result.tasks).toHaveLength(1);
    expect(typeof result.tasks[0].createdAt).toBe('number');
    expect(result.tasks[0].createdAt).toBe(expectedTime);
    expect(result.tasks[0].updatedAt).toBe(expectedTime);
    expect(result.tasks[0].completedAt).toBe(expectedTime);
  });

  it('throws on invalid non-parseable timestamps', () => {
    const rawTasks = [
      {
        id: 'task-bad-ts',
        title: 'Invalid timestamp task',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: 'not-a-valid-date',
      },
    ];

    expect(() => validateWorkspaceData(rawTasks, defaultProjects)).toThrow(/invalid creation timestamp/);
  });
});
