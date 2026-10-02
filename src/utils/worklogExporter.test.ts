import { describe, it, expect } from 'vitest';
import { generateWorklogMarkdown } from './worklogExporter';
import type { Task, Project } from '../types/task';

describe('worklogExporter', () => {
  const mockProjects: Project[] = [
    { id: 'work', name: 'Deep Work', color: '#10b981' },
    { id: 'admin', name: 'Operations', color: '#3b82f6' },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Draft Q3 Architecture RFC',
      status: 'done',
      priority: 'p1',
      projectId: 'work',
      completedAt: new Date('2026-10-02T10:00:00Z').getTime(),
      timeSpentMinutes: 90,
      description: 'Defined distributed sync protocol and state persistence model',
      subtasks: [],
      createdAt: Date.now(),
    },
    {
      id: 'task-2',
      title: 'Review team pull requests',
      status: 'done',
      priority: 'p2',
      projectId: 'work',
      completedAt: new Date('2026-10-02T11:30:00Z').getTime(),
      timeSpentMinutes: 45,
      subtasks: [],
      createdAt: Date.now(),
    },
    {
      id: 'task-3',
      title: 'Clean up mail backlog',
      status: 'done',
      priority: 'p3',
      projectId: 'admin',
      completedAt: new Date('2026-10-02T12:00:00Z').getTime(),
      estimatedMinutes: 20,
      subtasks: [],
      createdAt: Date.now(),
    },
  ];

  it('renders structured markdown with project groupings and focus hours', () => {
    const fixedDate = new Date('2026-10-02T12:30:00Z');
    const md = generateWorklogMarkdown(mockTasks, mockProjects, {
      timeHorizon: 'today',
      exportDate: fixedDate,
    });

    expect(md).toContain('# 📋 FlowTask Accomplishment Worklog');
    expect(md).toContain('> **Period**: TODAY');
    expect(md).toContain('3 tasks completed');
    // Total minutes = 90 + 45 + 20 = 155 min = 2.6 hours
    expect(md).toContain('2.6 focus hours logged');
    expect(md).toContain('### #Deep Work (2 tasks)');
    expect(md).toContain('### #Operations (1 tasks)');
    expect(md).toContain('- [x] **Draft Q3 Architecture RFC**');
    expect(md).toContain('*(⏱️ 90m)*');
    expect(md).toContain('> Defined distributed sync protocol');
  });

  it('handles empty task list gracefully', () => {
    const md = generateWorklogMarkdown([], mockProjects, { timeHorizon: 'week' });
    expect(md).toContain('_No completed tasks in the selected range._');
    expect(md).toContain('0 tasks completed');
    expect(md).toContain('0.0 focus hours logged');
  });

  it('falls back to General for tasks with unknown project id', () => {
    const orphanTask: Task = {
      id: 'orphan-1',
      title: 'Misc task',
      status: 'done',
      priority: 'p2',
      projectId: 'unknown_proj',
      subtasks: [],
      createdAt: Date.now(),
    };

    const md = generateWorklogMarkdown([orphanTask], mockProjects);
    expect(md).toContain('### #General (1 tasks)');
    expect(md).toContain('- [x] **Misc task**');
  });
});
