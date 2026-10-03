import { describe, it, expect } from 'vitest';
import { calculateFuzzyScore, searchTasksFuzzy } from './fuzzySearch';
import type { Task, Project } from '../types/task';

describe('fuzzySearch', () => {
  describe('calculateFuzzyScore', () => {
    it('returns highest score for exact string matches', () => {
      const result = calculateFuzzyScore('meeting', 'Meeting');
      expect(result.isMatch).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(1000);
    });

    it('matches prefixes with high scores', () => {
      const result = calculateFuzzyScore('meet', 'Meeting preparation');
      expect(result.isMatch).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(800);
    });

    it('matches substring boundaries', () => {
      const result = calculateFuzzyScore('auth', 'Implement user-auth system');
      expect(result.isMatch).toBe(true);
      expect(result.score).toBeGreaterThan(300);
    });

    it('matches non-contiguous subsequences (fzf style)', () => {
      const result = calculateFuzzyScore('dsa', 'Data Structures and Algorithms');
      expect(result.isMatch).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('handles slight typos within tolerance', () => {
      const result = calculateFuzzyScore('apointment', 'Doctor Appointment checkup');
      expect(result.isMatch).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('returns no match for completely unrelated queries', () => {
      const result = calculateFuzzyScore('xylophone', 'Fix production database deadlock');
      expect(result.isMatch).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('searchTasksFuzzy', () => {
    const sampleProjects: Project[] = [
      { id: 'p-core', name: 'Core Infrastructure', color: '#6366F1', createdAt: 0, updatedAt: 0 },
      { id: 'p-web', name: 'Web Application', color: '#10B981', createdAt: 0, updatedAt: 0 },
    ];

    const sampleTasks: Task[] = [
      {
        id: 't-1',
        title: 'Refactor Auth Provider',
        description: 'Migrate tokens to secure http-only cookies',
        projectId: 'p-core',
        tags: ['security', 'auth'],
        contextTags: ['deepwork'],
        subtasks: [{ id: 's-1', title: 'Rotate JWT signing keys', completed: false }],
        status: 'todo',
        priority: 'p1',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 't-2',
        title: 'Weekly Standup Notes',
        description: 'Review roadmap deliverables with engineering team',
        projectId: 'p-web',
        tags: ['meetings'],
        contextTags: ['calls'],
        subtasks: [],
        status: 'todo',
        priority: 'p3',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 't-3',
        title: 'Design Matrix UI Mockup',
        description: 'Finalize Tailwind color palettes and contrast levels',
        projectId: 'p-web',
        tags: ['design'],
        contextTags: ['creative'],
        subtasks: [],
        status: 'todo',
        priority: 'p2',
        createdAt: 0,
        updatedAt: 0,
      },
    ];

    it('finds tasks by title with highest rank', () => {
      const results = searchTasksFuzzy(sampleTasks, 'Refactor', sampleProjects);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].task.id).toBe('t-1');
      expect(results[0].matchedField).toBe('title');
    });

    it('finds tasks by context tag (@calls)', () => {
      const results = searchTasksFuzzy(sampleTasks, 'calls', sampleProjects);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].task.id).toBe('t-2');
      expect(results[0].matchedField).toBe('context');
    });

    it('finds tasks by project name match', () => {
      const results = searchTasksFuzzy(sampleTasks, 'Core Infrastructure', sampleProjects);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].task.id).toBe('t-1');
      expect(results[0].projectName).toBe('Core Infrastructure');
    });

    it('finds tasks by subtask title', () => {
      const results = searchTasksFuzzy(sampleTasks, 'signing keys', sampleProjects);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].task.id).toBe('t-1');
      expect(results[0].matchedField).toBe('subtask');
    });
  });
});
