import { describe, it, expect } from 'vitest';
import { validateWorkspaceData } from './workspaceValidation';

describe('validateWorkspaceData (BUG-01 & BUG-02)', () => {
  const defaultProjects = [
    { id: 'inbox', name: 'Inbox', color: '#64748B' },
    { id: 'work', name: 'Work', color: '#3B82F6' },
  ];

  it('preserves local project cover references and clamps saved focal points', () => {
    const result = validateWorkspaceData([], [{ ...defaultProjects[1], coverAssetId: 'local:workspace-cover', coverFocalPoint: { x: 125, y: -10 } }]);
    const project = result.projects.find(item => item.id === 'work')!;
    expect(project.coverAssetId).toBe('local:workspace-cover');
    expect(project.coverFocalPoint).toEqual({ x: 100, y: 0 });
  });

  it('rejects malformed project cover references and non-finite crop coordinates', () => {
    expect(() => validateWorkspaceData([], [{ ...defaultProjects[1], coverAssetId: 'bad / id' }])).toThrow(/cover image/);
    expect(() => validateWorkspaceData([], [{ ...defaultProjects[1], coverFocalPoint: { x: Infinity, y: 50 } }])).toThrow(/focal point/);
  });

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

  it('preserves valid project milestones and task links', () => {
    const project = { ...defaultProjects[1], milestones: [{ id: 'm1', title: 'Exam revision', order: 0, dueDate: '2026-11-01' }] };
    const task = { id: 'task-milestone', title: 'Revise chapter one', status: 'todo', priority: 'p2', projectId: 'work', milestoneId: 'm1', createdAt: 1700000000000 };
    const result = validateWorkspaceData([task], [defaultProjects[0], project]);
    expect(result.projects[1].milestones?.[0]).toMatchObject({ id: 'm1', title: 'Exam revision', order: 0, dueDate: '2026-11-01' });
    expect(result.tasks[0].milestoneId).toBe('m1');
  });

  it('rejects duplicate milestone IDs and orphaned task milestone references', () => {
    const task = { id: 'task-milestone', title: 'Revise chapter one', status: 'todo', priority: 'p2', projectId: 'work', milestoneId: 'missing', createdAt: 1700000000000 };
    expect(() => validateWorkspaceData([], [{ ...defaultProjects[0], milestones: [{ id: 'm1', title: 'First', order: 0 }, { id: 'm1', title: 'Duplicate', order: 1 }] }])).toThrow(/invalid milestone/);
    expect(() => validateWorkspaceData([task], defaultProjects)).toThrow(/missing project milestone/);
  });
});
