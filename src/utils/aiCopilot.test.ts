import { describe, it, expect } from 'vitest';
import { suggestSubtasks, suggestDuration } from './aiCopilot';

describe('aiCopilot', () => {
  describe('suggestSubtasks', () => {
    it('returns empty array for empty title', () => {
      expect(suggestSubtasks('')).toEqual([]);
      expect(suggestSubtasks('   ')).toEqual([]);
    });

    it('decomposes software bug fixes correctly', () => {
      const subtasks = suggestSubtasks('Fix crash on login screen when offline');
      expect(subtasks.length).toBeGreaterThanOrEqual(3);
      expect(subtasks[0].title).toContain('Reproduce defect');
      expect(subtasks.some((s) => s.title.toLowerCase().includes('fix'))).toBe(true);
    });

    it('decomposes feature implementation correctly', () => {
      const subtasks = suggestSubtasks('Build interactive calendar timeblocking view');
      expect(subtasks.length).toBe(4);
      expect(subtasks[0].title).toContain('Draft technical specification');
    });

    it('decomposes tax & financial tasks correctly', () => {
      const subtasks = suggestSubtasks('File annual tax return with accountant');
      expect(subtasks.length).toBe(4);
      expect(subtasks[0].title).toContain('Gather all relevant receipts');
    });

    it('decomposes presentation deck tasks correctly', () => {
      const subtasks = suggestSubtasks('Create pitch deck for series A investors');
      expect(subtasks.length).toBe(4);
      expect(subtasks[0].title).toContain('Outline core narrative');
    });

    it('decomposes travel planning correctly', () => {
      const subtasks = suggestSubtasks('Plan summer vacation trip to Tokyo');
      expect(subtasks.length).toBe(4);
      expect(subtasks[0].title).toContain('Confirm dates');
    });

    it('uses universal cognitive fallback for unfamiliar topics', () => {
      const subtasks = suggestSubtasks('Assemble Scandinavian oak bookshelf');
      expect(subtasks.length).toBe(4);
      expect(subtasks[0].title).toContain('Define requirements and outline steps');
    });
  });

  describe('suggestDuration', () => {
    it('suggests 15m for quick items', () => {
      expect(suggestDuration('Quick ping to designer')).toBe(15);
      expect(suggestDuration('Brief call with client')).toBe(15);
    });

    it('suggests 45m-60m for deep tasks', () => {
      expect(suggestDuration('Draft quarterly strategic plan')).toBe(60);
      expect(suggestDuration('Implement database migration')).toBe(45);
    });

    it('defaults to 30m for general items', () => {
      expect(suggestDuration('Follow up with supplier')).toBe(30);
    });
  });
});
