import { describe, it, expect } from 'vitest';
import { calculateNextDueDate, exportToMarkdown, exportToJSON, exportToCSV, DEFAULT_PROJECTS } from './storage';
import type { Task } from '../types/task';

describe('storage & recurrence engine', () => {
  it('calculates daily recurrence correctly', () => {
    const next = calculateNextDueDate('2026-10-01', 'daily');
    expect(next).toBe('2026-10-02');
  });

  it('calculates weekly recurrence correctly', () => {
    const next = calculateNextDueDate('2026-10-01', 'weekly');
    expect(next).toBe('2026-10-08');
  });

  it('skips weekends for weekdays recurrence', () => {
    // 2026-10-02 is a Friday
    const next = calculateNextDueDate('2026-10-02', 'weekdays');
    expect(next).toBe('2026-10-05'); // Monday
  });

  it('calculates biweekly recurrence correctly (+14 days)', () => {
    const next = calculateNextDueDate('2026-10-01', 'biweekly');
    expect(next).toBe('2026-10-15');
  });

  it('calculates yearly recurrence correctly (+1 year)', () => {
    const next = calculateNextDueDate('2026-10-01', 'yearly');
    expect(next).toBe('2027-10-01');
  });

  it('exports tasks to formatted Markdown', () => {
    const sampleTasks: Task[] = [
      {
        id: 't1',
        title: 'Draft quarterly report',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        dueDate: '2026-10-05',
        subtasks: [{ id: 's1', title: 'Gather numbers', completed: true }],
        createdAt: 1000,
      },
    ];

    const md = exportToMarkdown(sampleTasks, DEFAULT_PROJECTS);
    expect(md).toContain('# FlowTask Export');
    expect(md).toContain('## Work');
    expect(md).toContain('- [ ] **Draft quarterly report**');
    expect(md).toContain('Priority: P1');
    expect(md).toContain('- [x] Gather numbers');
  });

  it('calculates custom interval recurrence (every 3 days, every 2 months)', () => {
    const nextDays = calculateNextDueDate('2026-10-01', 'custom', { interval: 3, unit: 'days' });
    expect(nextDays).toBe('2026-10-04');

    const nextMonths = calculateNextDueDate('2026-10-01', 'custom', { interval: 2, unit: 'months' });
    expect(nextMonths).toBe('2026-12-01');
  });

  it('calculates custom completion-based recurrence', () => {
    // Completed on 2026-10-10, rule: 5 days after completion
    const completedAt = new Date('2026-10-10T12:00:00Z').getTime();
    const next = calculateNextDueDate('2026-10-01', 'custom', { interval: 5, unit: 'days', mode: 'completion' }, completedAt);
    expect(next).toBe('2026-10-15');
  });

  it('exports tasks to RFC-4180 compliant CSV', () => {
    const sampleTasks: Task[] = [
      {
        id: 't1',
        title: 'Refactor Auth, "v2"',
        status: 'done',
        priority: 'p1',
        projectId: 'work',
        dueDate: '2026-10-05',
        estimatedMinutes: 60,
        timeSpentMinutes: 75,
        tags: ['backend', 'security'],
        contextTags: ['computer'],
        subtasks: [
          { id: 's1', title: 'Write unit tests', completed: true },
          { id: 's2', title: 'Update docs', completed: false },
        ],
        createdAt: 1000,
        completedAt: 2000,
      },
    ];

    const csv = exportToCSV(sampleTasks, DEFAULT_PROJECTS);
    expect(csv).toContain('ID,Title,Status,Priority,Project');
    expect(csv).toContain('"Refactor Auth, ""v2"""');
    expect(csv).toContain('backend;security');
    expect(csv).toContain('computer');
  });

  it('exports to valid JSON', () => {
    const sampleTasks: Task[] = [];
    const jsonStr = exportToJSON(sampleTasks, DEFAULT_PROJECTS);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(Array.isArray(parsed.projects)).toBe(true);
  });
});

