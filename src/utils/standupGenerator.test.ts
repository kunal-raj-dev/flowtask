import { describe, it, expect } from 'vitest';
import { generateDailyStandup } from './standupGenerator';
import type { Task, Project } from '../types/task';

describe('standupGenerator', () => {
  const mockProjects: Project[] = [
    { id: 'proj-1', name: 'Engineering', color: '#6366f1' },
    { id: 'proj-2', name: 'Product', color: '#10b981' },
  ];

  const targetDate = '2026-10-02';

  const mockTasks: Task[] = [
    {
      id: 't-1',
      title: 'Architect storage engine',
      status: 'done',
      priority: 'p1',
      projectId: 'proj-1',
      dueDate: targetDate,
      estimatedMinutes: 60,
      timeSpentMinutes: 75,
      subtasks: [],
      createdAt: Date.now(),
    },
    {
      id: 't-2',
      title: 'Deploy API migration',
      status: 'todo',
      priority: 'p1',
      projectId: 'proj-1',
      dueDate: targetDate,
      estimatedMinutes: 45,
      subtasks: [],
      createdAt: Date.now(),
    },
    {
      id: 't-3',
      title: 'Draft release notes',
      status: 'todo',
      priority: 'p3',
      projectId: 'proj-2',
      dueDate: targetDate,
      estimatedMinutes: 15,
      subtasks: [],
      createdAt: Date.now(),
    },
  ];

  it('generates markdown format with completed tasks and in-flight items', () => {
    const output = generateDailyStandup(mockTasks, mockProjects, {
      format: 'markdown',
      dateStr: targetDate,
    });

    expect(output).toContain('### 📅 Daily Standup — 2026-10-02');
    expect(output).toContain('#### ☀️ Completed Today');
    expect(output).toContain('Architect storage engine');
    expect(output).toContain('`#Engineering`');
    expect(output).toContain('*(⏱️ 75m)*');
    expect(output).toContain('#### 🎯 Next Up & Priorities');
    expect(output).toContain('Deploy API migration');
    expect(output).toContain('**[P1 Urgent]**');
    expect(output).toContain('Total Focus Logged:');
  });

  it('generates slack format with bold and strikethrough styling', () => {
    const output = generateDailyStandup(mockTasks, mockProjects, {
      format: 'slack',
      dateStr: targetDate,
    });

    expect(output).toContain('*📅 Daily Standup — 2026-10-02*');
    expect(output).toContain('*☀️ Completed Today:*');
    expect(output).toContain('~Architect storage engine~');
    expect(output).toContain('[Engineering]');
    expect(output).toContain('*Deploy API migration*');
  });

  it('generates plain text format', () => {
    const output = generateDailyStandup(mockTasks, mockProjects, {
      format: 'plain',
      dateStr: targetDate,
    });

    expect(output).toContain('DAILY STANDUP (2026-10-02)');
    expect(output).toContain('COMPLETED TODAY:');
    expect(output).toContain('- Architect storage engine');
    expect(output).toContain('NEXT UP / IN FLIGHT:');
    expect(output).toContain('[P1] Deploy API migration');
  });

  it('handles empty task lists gracefully', () => {
    const output = generateDailyStandup([], mockProjects, {
      format: 'markdown',
      dateStr: targetDate,
    });

    expect(output).toContain('_None yet_');
    expect(output).toContain('_No pending tasks scheduled for today_');
    expect(output).toContain('0.0 hrs');
  });
});
