import { describe, it, expect, vi } from 'vitest';
import { sanitizeForFirestore, prepareTaskForFirestore } from './cloudWorkspace';
import type { Task } from '../types/task';

// Mock firebase/firestore deleteField with importOriginal
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    deleteField: () => '__DELETE_FIELD_SENTINEL__',
  };
});

describe('cloudWorkspace firestore utilities', () => {
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

  describe('prepareTaskForFirestore', () => {
    it('assigns deleteField() to undefined, null, or empty optional fields', () => {
      const task: Task = {
        id: 'task-sync-1',
        title: 'Test sync task',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        createdAt: 1000,
        subtasks: [],
        plannedDate: undefined,
        dueDate: '',
        tags: undefined,
        contextTags: undefined,
        blockedBy: undefined,
      };

      const prepared = prepareTaskForFirestore(task);

      expect(prepared.id).toBe('task-sync-1');
      expect(prepared.title).toBe('Test sync task');
      expect(prepared.plannedDate).toBe('__DELETE_FIELD_SENTINEL__');
      expect(prepared.dueDate).toBe('__DELETE_FIELD_SENTINEL__');
      expect(prepared.tags).toBe('__DELETE_FIELD_SENTINEL__');
      expect(prepared.contextTags).toBe('__DELETE_FIELD_SENTINEL__');
      expect(prepared.blockedBy).toBe('__DELETE_FIELD_SENTINEL__');
      expect(prepared.completedAt).toBe('__DELETE_FIELD_SENTINEL__');
      expect(prepared.deletedAt).toBe('__DELETE_FIELD_SENTINEL__');
      expect(prepared.archivedAt).toBe('__DELETE_FIELD_SENTINEL__');
    });

    it('retains set optional fields without assigning deleteField()', () => {
      const task: Task = {
        id: 'task-sync-2',
        title: 'Active planned task',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        plannedDate: '2026-10-05',
        dueDate: '2026-10-10',
        tags: ['urgent'],
        contextTags: ['computer'],
        blockedBy: ['blocker-1'],
        estimatedMinutes: 45,
        subtasks: [],
        createdAt: 1000,
      };

      const prepared = prepareTaskForFirestore(task);

      expect(prepared.plannedDate).toBe('2026-10-05');
      expect(prepared.dueDate).toBe('2026-10-10');
      expect(prepared.tags).toEqual(['urgent']);
      expect(prepared.contextTags).toEqual(['computer']);
      expect(prepared.blockedBy).toEqual(['blocker-1']);
      expect(prepared.estimatedMinutes).toBe(45);
    });
  });
});
