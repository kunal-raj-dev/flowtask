import { describe, expect, it } from 'vitest';
import { createSchedulePreview, scheduleChanges } from './schedulePlanner';
import type { Task } from '../types/task';

const now = new Date('2026-10-20T10:07:00');
const date = '2026-10-20';
const task = (id: string, patch: Partial<Task> = {}): Task => ({ id, title: id, status: 'todo', priority: 'p3', projectId: 'inbox', plannedDate: date, estimatedMinutes: 30, createdAt: 1, subtasks: [], ...patch });
const preview = (tasks: Task[], patch: Partial<Parameters<typeof createSchedulePreview>[0]> = {}) => createSchedulePreview({ date, now, tasks, settings: { timelineStartHour: 9, timelineEndHour: 17, targetWorkCapacityHours: 6, autoSlotBufferMinutes: 10 }, ...patch });

describe('shared schedule planner', () => {
  it('excludes deferred and sequentially blocked work, including explicit selections', () => {
    const tasks = [task('first', { projectId: 'seq', createdAt: 1 }), task('next', { projectId: 'seq', createdAt: 2 }), task('deferred', { deferUntil: '2026-10-21' })];
    const result = preview(tasks, { selectedIds: ['next', 'deferred'], projects: [{ id: 'seq', name: 'Sequence', color: '#000000', isSequential: true }] });
    expect(result.slotted).toEqual([]);
    expect(result.reasons.next).toMatch(/dependency/);
    expect(result.reasons.deferred).toMatch(/defer/);
  });
  it('respects a future-day exact availability time instead of placing work earlier that morning', () => {
    const result = preview([task('later', { plannedDate: '2026-10-21', deferUntil: '2026-10-21T14:10:00' })], { date: '2026-10-21' });
    expect(result.slotted[0].scheduledStart).toBe('14:15');
  });
  it('only selects active unscheduled day tasks by default and never mutates input', () => {
    const tasks = [task('today'), task('backlog', { plannedDate: undefined }), task('tomorrow', { plannedDate: '2026-10-21' }), task('someday', { isSomeday: true }), task('done', { status: 'done' }), task('deleted', { deletedAt: 1 }), task('archived', { archivedAt: 1 })];
    const before = JSON.stringify(tasks);
    const result = preview(tasks);
    expect(result.slotted.map(s => s.taskId)).toEqual(['today']);
    expect(result.slotted[0].scheduledStart).toBe('10:15');
    expect(JSON.stringify(tasks)).toBe(before);
  });
  it('permits explicitly selected backlog, retaining deadlines and clearing someday only on apply', () => {
    const result = preview([task('backlog', { plannedDate: undefined, isSomeday: true, dueDate: '2026-10-22' })], { selectedIds: ['backlog'] });
    expect(scheduleChanges(result)[0].updates).toMatchObject({ plannedDate: date, isSomeday: false, scheduledStart: '10:15' });
    expect(scheduleChanges(result)[0].updates).not.toHaveProperty('dueDate');
  });
  it('excludes locked, removed and blocked tasks even when explicitly selected', () => {
    const result = preview([task('locked', { scheduleLocked: true }), task('blocker', { plannedDate: '2026-10-21' }), task('blocked', { blockedBy: ['blocker'] })], { selectedIds: ['locked', 'blocked', 'missing'] });
    expect(result.slotted).toEqual([]);
    expect(result.reasons.locked).toMatch(/locked/);
    expect(result.reasons.blocked).toMatch(/dependency/);
    expect(result.reasons.missing).toMatch(/available/);
  });
  it('uses explicit scheduled ends and calendar buffers without moving existing blocks', () => {
    const result = preview([task('existing', { scheduledStart: '10:00', scheduledEnd: '11:30', estimatedMinutes: 15 }), task('new')], { calendarEvents: [{ id: 'meeting', title: 'Meeting', date, startTime: '11:30', endTime: '12:00' }] });
    expect(result.slotted[0].scheduledStart).toBe('12:15');
    expect(result.budget).toBe(240);
    expect(result.slotted.map(s => s.taskId)).toEqual(['new']);
  });
  it('subtracts unique meetings and scheduled work from shared capacity', () => {
    const result = preview([task('existing', { scheduledStart: '09:00', scheduledEnd: '10:00' }), task('large', { estimatedMinutes: 150 })], { settings: { targetWorkCapacityHours: 3 }, calendarEvents: [{ id: '1', title: 'A', date, startTime: '13:00', endTime: '14:00' }, { id: '2', title: 'B', date, startTime: '13:30', endTime: '14:30' }] });
    expect(result.budget).toBe(30);
    expect(result.slotted).toEqual([]);
    expect(result.reasons.large).toMatch(/budget/);
  });
  it('leaves the configured buffer before an existing block, not just after it', () => {
    const result = preview([task('existing', { scheduledStart: '09:30', scheduledEnd: '10:30' }), task('new')], { now: new Date('2026-10-20T08:00:00') });
    expect(result.slotted[0].scheduledStart).toBe('10:45');
  });
  it('never schedules in the past or over a same-day timed deadline', () => {
    const result = preview([task('late', { dueDate: date, dueTime: '10:30', estimatedMinutes: 45 })]);
    expect(result.slotted).toEqual([]);
    expect(result.reasons.late).toMatch(/deadline/);
    expect(preview([task('past')], { date: '2026-10-19', selectedIds: ['past'] }).slotted).toEqual([]);
  });
  it('schedules future days from working hours and warns about overdue deadlines', () => {
    const result = preview([task('future', { plannedDate: '2026-10-21', dueDate: '2026-10-19' })], { date: '2026-10-21' });
    expect(result.slotted[0].scheduledStart).toBe('09:00');
    expect(result.warnings[0]).toMatch(/deadline/);
  });
  it('ignores other-day and all-day events as timed blockers', () => {
    const result = preview([task('today')], { calendarEvents: [{ id: 'all', title: 'Birthday', date, isAllDay: true, startTime: '00:00', endTime: '23:59' }, { id: 'tomorrow', title: 'Tomorrow', date: '2026-10-21', startTime: '09:00', endTime: '17:00' }] });
    expect(result.slotted[0].scheduledStart).toBe('10:15');
  });
  it('uses edited estimates and detects stale data, midnight and new availability', () => {
    const tasks = [task('a')];
    const original = preview(tasks);
    expect(preview(tasks, { estimates: { a: 45 } }).slotted[0].durationMinutes).toBe(45);
    expect(preview([task('a', { title: 'Changed elsewhere' })]).fingerprint).not.toBe(original.fingerprint);
    expect(preview(tasks, { now: new Date('2026-10-20T10:16:00') }).fingerprint).not.toBe(original.fingerprint);
    const midnight = preview(tasks, { now: new Date('2026-10-21T00:01:00'), selectedIds: ['a'] });
    expect(midnight.slotted).toEqual([]);
  });
  it('orders Top 3 and priorities deterministically and reports no whole-block fit', () => {
    const result = preview([task('z'), task('priority', { priority: 'p1' }), task('top', { isPinnedToday: true, topThreeDate: date }), task('huge', { estimatedMinutes: 1000 })]);
    expect(result.slotted[0].taskId).toBe('top');
    expect(result.slotted[1].taskId).toBe('priority');
    const narrow = preview([task('long', { estimatedMinutes: 45 })], { settings: { timelineStartHour: 10, timelineEndHour: 11 }, now: new Date('2026-10-20T10:30:00') });
    expect(narrow.reasons.long).toMatch(/whole block/);
  });
});
