import { describe, expect, it } from 'vitest';
import { defaultTodayLayout, moveTodaySection, normalizeTodayLayout, partitionTodayTasks } from './todayLayout';
import type { Task } from '../types/task';

const tasks = [
  { id: 'priority', scheduledStart: '09:00', priority: 'p1' },
  { id: 'morning', scheduledStart: '10:00', priority: 'p2' },
  { id: 'evening', scheduledStart: '19:00', priority: 'p3' },
  { id: 'anytime', priority: 'p4' },
].map(task => ({ ...task, title: task.id, status: 'todo', projectId: 'inbox', createdAt: 1, subtasks: [] })) as Task[];
describe('Today presentation preferences', () => {
  it('starts with the lean layout while retaining every optional section', () => {
    const layout = defaultTodayLayout();
    expect(layout.sections.filter(section => section.visible).map(section => section.id)).toEqual(['capture', 'capacity', 'tasks']);
    expect(layout.sections).toHaveLength(9);
    expect(layout.contextPanel).toBe('none');
  });
  it('repairs malformed preferences without hiding capture or tasks or duplicating sections', () => {
    const layout = normalizeTodayLayout({ version: 1, sections: [{ id: 'tasks', visible: false }, { id: 'tasks', visible: true }, { id: 'unknown', visible: true }], contextPanel: 'bad' });
    expect(layout.sections[0]).toEqual({ id: 'tasks', visible: true });
    expect(new Set(layout.sections.map(section => section.id)).size).toBe(9);
    expect(layout.sections.find(section => section.id === 'capture')?.visible).toBe(true);
    expect(normalizeTodayLayout({ version: 2 })).toEqual(defaultTodayLayout());
  });
  it('moves sections without mutating the saved layout', () => {
    const saved = defaultTodayLayout();
    const moved = moveTodaySection(saved, 'tasks', 0);
    expect(moved.sections[0].id).toBe('tasks');
    expect(saved.sections[0].id).toBe('capture');
  });
  it('keeps all tasks in the main reading surface with optional groups hidden', () => {
    const groups = partitionTodayTasks(tasks, defaultTodayLayout(), ['priority']);
    expect(groups.tasks.map(task => task.id)).toEqual(tasks.map(task => task.id));
    expect(groups.priorities).toEqual([]);
    expect(groups.morning).toEqual([]);
    expect(groups.evening).toEqual([]);
  });
  it('renders each task once when a priority is also scheduled', () => {
    const layout = defaultTodayLayout();
    layout.sections = layout.sections.map(section => ({ ...section, visible: true }));
    const groups = partitionTodayTasks([...tasks, tasks[0]], layout, ['priority']);
    expect(groups.priorities.map(task => task.id)).toEqual(['priority']);
    expect(groups.morning.map(task => task.id)).toEqual(['morning']);
    expect(groups.evening.map(task => task.id)).toEqual(['evening']);
    const all = Object.values(groups).flat().map(task => task.id);
    expect(all).toHaveLength(tasks.length);
    expect(new Set(all).size).toBe(tasks.length);
    layout.sections = layout.sections.map(section => section.id === 'morning' || section.id === 'priorities' ? { ...section, visible: false } : section);
    const hidden = partitionTodayTasks(tasks, layout, ['priority']);
    expect(hidden.tasks.map(task => task.id)).toEqual(['priority', 'morning', 'anytime']);
  });
});
