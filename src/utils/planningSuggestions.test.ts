import { describe, expect, it } from 'vitest';
import { findEstimateSuggestion } from './planningSuggestions';
import type { Task } from '../types/task';

const task = (overrides: Partial<Task>): Task => ({
  id: 't1', title: 'Write report', status: 'in_progress', priority: 'p2', projectId: 'inbox',
  estimatedMinutes: 40, timeSpentMinutes: 55, subtasks: [], createdAt: 1, ...overrides,
});

describe('findEstimateSuggestion', () => {
  it('explains a proposed estimate from tracked focus time without mutating the task', () => {
    const item = task({});
    expect(findEstimateSuggestion([item])).toEqual({ taskId: 't1', currentMinutes: 40, observedMinutes: 55, suggestedMinutes: 65 });
    expect(item.estimatedMinutes).toBe(40);
  });

  it('does not suggest changes below the 25% threshold or for closed tasks', () => {
    expect(findEstimateSuggestion([task({ timeSpentMinutes: 49 })])).toBeNull();
    expect(findEstimateSuggestion([task({ status: 'done' })])).toBeNull();
    expect(findEstimateSuggestion([task({ deletedAt: 10 })])).toBeNull();
  });
});
