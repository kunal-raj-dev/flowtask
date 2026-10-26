import { describe, expect, it } from 'vitest';
import type { Task, Project } from '../types/task';
import { getTaskEligibility, isDeferred } from './taskEligibility';
import { isTodayTask, isFocusTask } from './taskSelectors';
import { isActionableTask } from '../services/workspaceSelectors';
import { isTaskBlocked } from './dependencyUtils';

const day = '2026-10-25';
const now = new Date(`${day}T09:00:00Z`);
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, status: 'todo', priority: 'p3', projectId: 'inbox', subtasks: [], createdAt: 1, plannedDate: day, topThreeDate: day, ...extra });

describe('shared task eligibility', () => {
  it('keeps Today, priorities, focus availability and dependency helpers consistent', () => {
    const blocker = task('blocker');
    const dependent = task('dependent', { blockedBy: ['blocker'] });
    for (const status of ['todo', 'done'] as const) {
      const tasks = [{ ...blocker, status }, dependent];
      const expected = status === 'done';
      expect(isTodayTask(dependent, day, { tasks, now })).toBe(expected);
      expect(isFocusTask(dependent, day, { tasks, now })).toBe(expected);
      expect(isActionableTask(dependent, tasks, [], now)).toBe(expected);
      expect(isTaskBlocked(dependent, tasks).isBlocked).toBe(!expected);
    }
  });
  it('honors direct predecessors, ignores removed blockers, and never mutates project/task order', () => {
    const first = task('first', { projectId: 'sequential' });
    const next = task('next', { projectId: 'sequential', predecessorTaskId: first.id, createdAt: 2 });
    const projects: Project[] = [{ id: 'sequential', name: 'Launch', color: '#000000', isSequential: true }];
    const tasks = [next, first];
    const before = JSON.stringify(tasks);
    expect(getTaskEligibility(next, { tasks, projects, now })).toMatchObject({ reason: 'dependency', blockerIds: ['first'] });
    expect(getTaskEligibility(next, { tasks: [next, { ...first, archivedAt: 1 }], projects, now }).actionable).toBe(true);
    expect(JSON.stringify(tasks)).toBe(before);
  });
  it.each([
    [{ deletedAt: 1 }, 'deleted'], [{ archivedAt: 1 }, 'archived'],
    [{ status: 'done' }, 'completed'], [{ isSomeday: true }, 'someday'],
    [{ deferUntil: '2026-10-26' }, 'deferred'],
  ] as const)('returns an explainable reason for %o', (extra, reason) => {
    expect(getTaskEligibility(task('a', extra), { now }).reason).toBe(reason);
  });
  it('uses the injected instant and zone for deferral, and the planning day for future-date selectors', () => {
    expect(isDeferred(task('a', { deferUntil: `${day}T09:30:00Z` }), { now })).toBe(true);
    expect(isDeferred(task('a', { deferUntil: `${day}T09:30:00Z` }), { now: now.getTime() + 3_600_000 })).toBe(false);
    expect(isDeferred(task('a', { deferUntil: '2026-10-26' }), { now: new Date('2026-10-25T19:00:00Z'), timezone: 'Asia/Kolkata' })).toBe(false);
    expect(isTodayTask(task('future', { plannedDate: '2026-10-27', deferUntil: '2026-10-26T18:00:00Z', topThreeDate: undefined }), '2026-10-27')).toBe(true);
  });
  it('keeps archived project tasks unavailable while retaining their source record', () => {
    const a = task('a', { projectId: 'p' });
    const projects: Project[] = [{ id: 'p', name: 'Old project', color: '#000000', isArchived: true }];
    expect(getTaskEligibility(a, { projects }).reason).toBe('project_archived');
    expect(a.projectId).toBe('p');
  });
});
