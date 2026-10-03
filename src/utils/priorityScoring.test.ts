import { describe, it, expect } from 'vitest';
import { calculateTaskPriorityScore } from './priorityScoring';
import type { Task } from '../types/task';

describe('calculateTaskPriorityScore', () => {
  const baseDate = new Date('2026-10-03T10:00:00Z');

  it('assigns high urgency and importance to overdue P1 tasks -> Q1 Do First', () => {
    const task: Task = {
      id: 'task-overdue',
      title: 'Fix critical database issue',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      dueDate: '2026-10-01', // overdue
      createdAt: Date.now(),
      subtasks: [],
    };

    const score = calculateTaskPriorityScore(task, [task], baseDate);
    expect(score.urgencyScore).toBe(50);
    expect(score.importanceScore).toBe(40);
    expect(score.compositeScore).toBe(90);
    expect(score.suggestedQuadrant).toBe('p1');
  });

  it('assigns low urgency and high importance to unscheduled P2 strategic tasks -> Q2 Schedule', () => {
    const task: Task = {
      id: 'task-strategic',
      title: 'Design Q4 architecture roadmap',
      status: 'todo',
      priority: 'p2',
      projectId: 'work',
      createdAt: Date.now(),
      subtasks: [],
    };

    const score = calculateTaskPriorityScore(task, [task], baseDate);
    expect(score.urgencyScore).toBe(0);
    expect(score.importanceScore).toBe(30);
    expect(score.compositeScore).toBe(30);
    expect(score.suggestedQuadrant).toBe('p2');
  });

  it('assigns high urgency and low importance to immediate low-priority quick tasks -> Q3 Delegate', () => {
    const task: Task = {
      id: 'task-errand',
      title: 'Submit monthly utility meter reading',
      status: 'todo',
      priority: 'p4',
      projectId: 'personal',
      dueDate: '2026-10-03', // due today
      estimatedMinutes: 10,
      createdAt: Date.now(),
      subtasks: [],
    };

    const score = calculateTaskPriorityScore(task, [task], baseDate);
    expect(score.urgencyScore).toBeGreaterThanOrEqual(40);
    expect(score.importanceScore).toBeLessThan(25);
    expect(score.suggestedQuadrant).toBe('p3');
  });

  it('penalizes urgency for blocked tasks', () => {
    const blocker: Task = {
      id: 'blocker-1',
      title: 'Sign vendor contract',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      createdAt: Date.now(),
      subtasks: [],
    };

    const blockedTask: Task = {
      id: 'task-blocked',
      title: 'Configure production API keys',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      dueDate: '2026-10-03', // due today
      blockedBy: ['blocker-1'],
      createdAt: Date.now(),
      subtasks: [],
    };

    const score = calculateTaskPriorityScore(blockedTask, [blocker, blockedTask], baseDate);
    // Unblocked due today would be 40; blocked is penalized by 20 -> 20
    expect(score.urgencyScore).toBe(20);
    expect(score.urgencyReason).toContain('Blocked by dependency');
  });
});
