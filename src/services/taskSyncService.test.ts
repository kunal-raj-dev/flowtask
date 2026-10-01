import { describe, it, expect } from 'vitest';
import { sanitizeForFirestore } from './taskSyncService';

describe('sanitizeForFirestore', () => {
  it('removes undefined fields from flat objects', () => {
    const raw = {
      id: 'task-1',
      title: 'Test task',
      dueDate: undefined,
      priority: 'p1',
    };

    const cleaned = sanitizeForFirestore(raw);

    expect(cleaned).toEqual({
      id: 'task-1',
      title: 'Test task',
      priority: 'p1',
    });
    expect('dueDate' in cleaned).toBe(false);
  });

  it('handles nested objects and removes undefined properties', () => {
    const raw = {
      id: 'task-2',
      metadata: {
        created: 12345,
        updated: undefined,
      },
    };

    const cleaned = sanitizeForFirestore(raw);

    expect(cleaned).toEqual({
      id: 'task-2',
      metadata: {
        created: 12345,
      },
    });
  });

  it('handles arrays of subtasks with optional fields', () => {
    const raw = {
      id: 'task-3',
      subtasks: [
        { id: 'sub-1', title: 'Sub 1', completed: false, extra: undefined },
        { id: 'sub-2', title: 'Sub 2', completed: true },
      ],
    };

    const cleaned = sanitizeForFirestore(raw);

    expect(cleaned).toEqual({
      id: 'task-3',
      subtasks: [
        { id: 'sub-1', title: 'Sub 1', completed: false },
        { id: 'sub-2', title: 'Sub 2', completed: true },
      ],
    });
  });
});
