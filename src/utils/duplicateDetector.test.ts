import { describe, it, expect } from 'vitest';
import {
  calculateTitleSimilarity,
  findPotentialDuplicates,
} from './duplicateDetector';
import type { Task } from '../types/task';

describe('duplicateDetector', () => {
  it('detects high similarity between identical or near-identical titles', () => {
    expect(calculateTitleSimilarity('Review PR 102', 'Review PR 102')).toBe(1);
    expect(calculateTitleSimilarity('Review PR 102', 'review pr 102')).toBe(1);

    const sim = calculateTitleSimilarity('Call the dentist', 'Call dentist');
    expect(sim).toBeGreaterThan(0.65);

    const sim2 = calculateTitleSimilarity('Prepare Q4 financial report', 'Prepare Q4 financial summary report');
    expect(sim2).toBeGreaterThan(0.7);
  });

  it('reports low similarity for distinctly different tasks', () => {
    const sim = calculateTitleSimilarity('Buy groceries', 'Fix production bug in auth');
    expect(sim).toBeLessThan(0.3);
  });

  it('finds duplicate candidates from task backlog', () => {
    const targetTask: Task = {
      id: 't-target',
      title: 'Deploy migration to staging',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      subtasks: [],
      createdAt: 1,
    };

    const backlog: Task[] = [
      {
        id: 't-1',
        title: 'Deploy database migration to staging server',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        subtasks: [],
        createdAt: 2,
      },
      {
        id: 't-2',
        title: 'Morning 5km run in park',
        status: 'todo',
        priority: 'p4',
        projectId: 'personal',
        subtasks: [],
        createdAt: 3,
      },
    ];

    const duplicates = findPotentialDuplicates(targetTask, backlog, 0.5);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].task.id).toBe('t-1');
  });
});
