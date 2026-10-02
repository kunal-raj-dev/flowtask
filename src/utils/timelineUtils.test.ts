import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  calculateCapacityMetrics,
  calculateBlockPosition,
  classifyTaskCognitiveIntensity,
  analyzeCognitiveTopology,
  findOverlappingCalendarEvent,
  findNextFreeGap,
  TIMELINE_START_HOUR,
  TIMELINE_HOUR_HEIGHT_PX,
} from './timelineUtils';
import type { Task, CalendarEvent } from '../types/task';

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

  describe('classifyTaskCognitiveIntensity', () => {
    it('classifies P1 or >=45m tasks as deep work', () => {
      expect(classifyTaskCognitiveIntensity({ priority: 'p1' } as Task)).toBe('deep');
      expect(classifyTaskCognitiveIntensity({ priority: 'p2', estimatedMinutes: 60 } as Task)).toBe('deep');
      expect(classifyTaskCognitiveIntensity({ isPinnedToday: true } as Task)).toBe('deep');
    });

    it('classifies P4 or <=15m tasks as admin', () => {
      expect(classifyTaskCognitiveIntensity({ priority: 'p4' } as Task)).toBe('admin');
      expect(classifyTaskCognitiveIntensity({ priority: 'p3', estimatedMinutes: 10 } as Task)).toBe('admin');
    });

    it('classifies normal tasks as medium', () => {
      expect(classifyTaskCognitiveIntensity({ priority: 'p2', estimatedMinutes: 30 } as Task)).toBe('medium');
    });
  });

  describe('analyzeCognitiveTopology', () => {
    it('detects high cognitive strain when 3+ hours are scheduled back to back without rest', () => {
      const tasks: Task[] = [
        {
          id: 't1',
          title: 'System Architecture',
          priority: 'p1',
          scheduledStart: '09:00',
          estimatedMinutes: 90,
          status: 'todo',
          projectId: 'work',
          subtasks: [],
          createdAt: 1,
        },
        {
          id: 't2',
          title: 'Database Refactor',
          priority: 'p1',
          scheduledStart: '10:30', // starts immediately after t1 (90m)
          estimatedMinutes: 90,
          status: 'todo',
          projectId: 'work',
          subtasks: [],
          createdAt: 1,
        },
      ];

      const topology = analyzeCognitiveTopology(tasks);
      expect(topology.deepWorkMinutes).toBe(180);
      expect(topology.hasHighCognitiveStrain).toBe(true);
      expect(topology.strainWarning).toContain('High continuous cognitive strain detected');
    });

    it('clears strain warning when sufficient buffer is inserted between deep tasks', () => {
      const tasks: Task[] = [
        {
          id: 't1',
          title: 'System Architecture',
          priority: 'p1',
          scheduledStart: '09:00',
          estimatedMinutes: 90,
          status: 'todo',
          projectId: 'work',
          subtasks: [],
          createdAt: 1,
        },
        {
          id: 't2',
          title: 'Database Refactor',
          priority: 'p1',
          scheduledStart: '11:00', // 30m break from 10:30 to 11:00
          estimatedMinutes: 90,
          status: 'todo',
          projectId: 'work',
          subtasks: [],
          createdAt: 1,
        },
      ];

      const topology = analyzeCognitiveTopology(tasks);
      expect(topology.hasHighCognitiveStrain).toBe(false);
      expect(topology.strainWarning).toBeUndefined();
    });
  });

  describe('findOverlappingCalendarEvent', () => {
    const mockEvents: CalendarEvent[] = [
      {
        id: 'ev-1',
        title: 'Team Standup',
        startTime: '10:00',
        endTime: '10:45',
      },
    ];

    it('detects overlap when task starts during calendar event', () => {
      // 10:15 (615m) for 30m overlaps with 10:00-10:45
      const overlap = findOverlappingCalendarEvent(615, 30, mockEvents);
      expect(overlap).not.toBeNull();
      expect(overlap?.title).toBe('Team Standup');
    });

    it('detects overlap when task spans over calendar event', () => {
      // 09:45 (585m) for 60m ends at 10:45
      const overlap = findOverlappingCalendarEvent(585, 60, mockEvents);
      expect(overlap).not.toBeNull();
      expect(overlap?.title).toBe('Team Standup');
    });

    it('returns null when task does not overlap', () => {
      // 09:00 (540m) for 45m ends at 09:45
      const overlap = findOverlappingCalendarEvent(540, 45, mockEvents);
      expect(overlap).toBeNull();

      // 11:00 (660m) for 30m starts after event ends
      const overlap2 = findOverlappingCalendarEvent(660, 30, mockEvents);
      expect(overlap2).toBeNull();
    });
  });

  describe('findNextFreeGap', () => {
    it('finds the first available 15m aligned opening on timeline', () => {
      const scheduledTasks: Task[] = [
        {
          id: 't1',
          title: 'Morning Focus',
          scheduledStart: '09:00',
          estimatedMinutes: 60, // 09:00 - 10:00
          status: 'todo',
          priority: 'p1',
          projectId: 'work',
          subtasks: [],
          createdAt: 1,
        },
      ];

      const calendarEvents: CalendarEvent[] = [
        {
          id: 'ev-1',
          title: 'All Hands',
          startTime: '10:00',
          endTime: '11:00', // 10:00 - 11:00
        },
      ];

      // Starting from 09:00 (540m), 09:00-11:00 is occupied.
      // Next free 30m gap should be at 11:00 (660m)
      const nextGap = findNextFreeGap(30, scheduledTasks, calendarEvents, 540);
      expect(nextGap).toBe(660);
      expect(minutesToTimeStr(nextGap!)).toBe('11:00');
    });
  });
});
