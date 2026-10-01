import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  calculateCapacityMetrics,
  calculateBlockPosition,
  TIMELINE_START_HOUR,
  TIMELINE_HOUR_HEIGHT_PX,
} from './timelineUtils';
import type { Task } from '../types/task';

describe('timelineUtils', () => {
  describe('parseTimeToMinutes', () => {
    it('parses valid HH:mm string', () => {
      expect(parseTimeToMinutes('09:30')).toBe(570);
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('23:59')).toBe(1439);
      expect(parseTimeToMinutes('14:15')).toBe(855);
    });

    it('returns null for invalid or undefined time string', () => {
      expect(parseTimeToMinutes(undefined)).toBeNull();
      expect(parseTimeToMinutes('')).toBeNull();
      expect(parseTimeToMinutes('invalid')).toBeNull();
    });
  });

  describe('minutesToTimeStr', () => {
    it('formats minutes from midnight into 24h HH:mm', () => {
      expect(minutesToTimeStr(570)).toBe('09:30');
      expect(minutesToTimeStr(0)).toBe('00:00');
      expect(minutesToTimeStr(855)).toBe('14:15');
      expect(minutesToTimeStr(1439)).toBe('23:59');
    });
  });

  describe('calculateCapacityMetrics', () => {
    const mockTask = (estimatedMinutes?: number): Task => ({
      id: 'task-test',
      title: 'Test',
      status: 'todo',
      priority: 'p2',
      projectId: 'work',
      estimatedMinutes,
      subtasks: [],
      createdAt: Date.now(),
    });

    it('calculates healthy workload below 75% capacity', () => {
      const tasks = [mockTask(60), mockTask(60), mockTask(60)]; // 180 min = 3.0h
      const metrics = calculateCapacityMetrics(tasks, 6.0); // target 6h (360 min)

      expect(metrics.totalPlannedMinutes).toBe(180);
      expect(metrics.totalPlannedHours).toBe('3.0');
      expect(metrics.capacityPercent).toBe(50);
      expect(metrics.status).toBe('healthy');
    });

    it('calculates full workload between 75% and 100% capacity', () => {
      const tasks = [mockTask(120), mockTask(120), mockTask(60)]; // 300 min = 5.0h
      const metrics = calculateCapacityMetrics(tasks, 6.0);

      expect(metrics.capacityPercent).toBe(83);
      expect(metrics.status).toBe('full');
    });

    it('calculates overbooked workload when exceeding target capacity', () => {
      const tasks = [mockTask(180), mockTask(180), mockTask(60)]; // 420 min = 7.0h
      const metrics = calculateCapacityMetrics(tasks, 6.0);

      expect(metrics.totalPlannedHours).toBe('7.0');
      expect(metrics.capacityPercent).toBe(117);
      expect(metrics.status).toBe('overbooked');
    });

    it('defaults task with undefined estimatedMinutes to 30m', () => {
      const tasks = [mockTask(undefined), mockTask(undefined)];
      const metrics = calculateCapacityMetrics(tasks, 6.0);

      expect(metrics.totalPlannedMinutes).toBe(60);
    });
  });

  describe('calculateBlockPosition', () => {
    it('computes accurate topPx and heightPx based on start time and duration', () => {
      // 09:00 is 2 hours after START_HOUR (07:00) -> 2 * 80px = 160px
      const { topPx, heightPx } = calculateBlockPosition(
        9 * 60,
        60,
        TIMELINE_START_HOUR,
        TIMELINE_HOUR_HEIGHT_PX
      );
      expect(topPx).toBe(160);
      expect(heightPx).toBe(80);
    });

    it('enforces minimum height of 38px for short tasks', () => {
      const { heightPx } = calculateBlockPosition(
        10 * 60,
        15, // 15m would be 20px, but min is 38px
        TIMELINE_START_HOUR,
        TIMELINE_HOUR_HEIGHT_PX
      );
      expect(heightPx).toBe(38);
    });
  });
});
