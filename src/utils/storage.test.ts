import { describe, it, expect } from 'vitest';
import { calculateNextDueDate, exportToMarkdown, exportToJSON, DEFAULT_PROJECTS } from './storage';
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

  it('exports to valid JSON', () => {
    const sampleTasks: Task[] = [];
    const jsonStr = exportToJSON(sampleTasks, DEFAULT_PROJECTS);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(Array.isArray(parsed.projects)).toBe(true);
  });
});
