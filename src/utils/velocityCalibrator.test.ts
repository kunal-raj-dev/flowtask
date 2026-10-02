import { describe, it, expect } from 'vitest';
import {
  computeHistoricalVelocity,
  getVelocityCalibration,
  calculateEstimationAccuracy,
} from './velocityCalibrator';
import type { Task } from '../types/task';

describe('velocityCalibrator', () => {
  const baseTask: Task = {
    id: 't-1',
    title: 'Test task',
    status: 'done',
    priority: 'p2',
    projectId: 'code',
    subtasks: [],
    createdAt: Date.now(),
  };

  it('returns null if fewer than 2 completed sample tasks exist', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', estimatedMinutes: 30, timeSpentMinutes: 45 },
    ];
    expect(computeHistoricalVelocity(tasks)).toBeNull();
  });

  it('computes underestimation ratio accurately', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', estimatedMinutes: 30, timeSpentMinutes: 45 }, // 1.5x
      { ...baseTask, id: '2', estimatedMinutes: 20, timeSpentMinutes: 30 }, // 1.5x
      { ...baseTask, id: '3', estimatedMinutes: 10, timeSpentMinutes: 15 }, // 1.5x
    ];

    const result = computeHistoricalVelocity(tasks);
    expect(result).not.toBeNull();
    expect(result?.ratio).toBe(1.5);
    expect(result?.direction).toBe('underestimated');
    expect(result?.sampleCount).toBe(3);
  });

  it('recommends calibrated duration rounding to nearest 5 minutes', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', estimatedMinutes: 30, timeSpentMinutes: 45 },
      { ...baseTask, id: '2', estimatedMinutes: 20, timeSpentMinutes: 30 },
    ];

    // Proposed 20 minutes * 1.5 ratio = 30 minutes
    const calibration = getVelocityCalibration(tasks, 20);
    expect(calibration).not.toBeNull();
    expect(calibration?.recommendedMinutes).toBe(30);
    expect(calibration?.ratio).toBe(1.5);
  });

  it('calculates aggregate estimation accuracy score', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', estimatedMinutes: 30, timeSpentMinutes: 30, priority: 'p1' },
      { ...baseTask, id: '2', estimatedMinutes: 20, timeSpentMinutes: 20, priority: 'p4' },
    ];

    const metrics = calculateEstimationAccuracy(tasks);
    expect(metrics.avgRatio).toBe(1.0);
    expect(metrics.accuracyPercent).toBe(100);
    expect(metrics.completedSampleCount).toBe(2);
    expect(metrics.deepWorkPercent).toBeGreaterThan(0);
  });

  it('calibrates based on context tag if tag sample exists', () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', contextTags: ['code'], estimatedMinutes: 30, timeSpentMinutes: 60 }, // 2.0x
      { ...baseTask, id: '2', contextTags: ['code'], estimatedMinutes: 20, timeSpentMinutes: 40 }, // 2.0x
      { ...baseTask, id: '3', contextTags: ['admin'], estimatedMinutes: 20, timeSpentMinutes: 20 },
    ];

    const calib = getVelocityCalibration(tasks, 30, 'code', 'code');
    expect(calib).not.toBeNull();
    expect(calib?.ratio).toBe(2.0);
    expect(calib?.recommendedMinutes).toBe(60);
    expect(calib?.scope).toBe('tag');
  });
});
