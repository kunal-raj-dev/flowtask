import { describe, it, expect } from 'vitest';
import { computeAutoSlotSchedule } from './autoSlotAlgorithm';
import type { Task, CalendarEvent } from '../types/task';

describe('autoSlotAlgorithm', () => {
  const createTask = (id: string, title: string, duration: number, priority: 'p1' | 'p2' | 'p3' | 'p4' = 'p2', isPinned = false): Task => ({
    id,
    title,
    status: 'todo',
    priority,
    estimatedMinutes: duration,
    isPinnedToday: isPinned,
    projectId: 'inbox',
    subtasks: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  it('slots unscheduled tasks into open morning gaps', () => {
    const unscheduled: Task[] = [
      createTask('t1', 'Important Meeting Prep', 60, 'p1', true),
      createTask('t2', 'Email Clean up', 30, 'p4'),
    ];

    const result = computeAutoSlotSchedule(unscheduled, [], [], {
      startHour: 9,
      endHour: 17,
      bufferMinutes: 0,
    });

    expect(result.slotted.length).toBe(2);
    expect(result.unslotted.length).toBe(0);
    // First task should be slotted right at startHour (09:00)
    expect(result.slotted[0].taskId).toBe('t1');
    expect(result.slotted[0].scheduledStart).toBe('09:00');
    expect(result.slotted[0].dueTime).toBe('10:00');

    // Second task should start at 10:00
    expect(result.slotted[1].taskId).toBe('t2');
    expect(result.slotted[1].scheduledStart).toBe('10:00');
    expect(result.slotted[1].dueTime).toBe('10:30');
  });

  it('respects external calendar meetings and jumps around them', () => {
    const unscheduled: Task[] = [
      createTask('t1', 'Deep Focus Task', 60, 'p1'),
    ];

    const calendarEvents: CalendarEvent[] = [
      {
        id: 'cal-1',
        title: 'Team Standup',
        startTime: '09:00',
        endTime: '10:00',
        isAllDay: false,
      },
    ];

    const result = computeAutoSlotSchedule(unscheduled, [], calendarEvents, {
      startHour: 9,
      endHour: 17,
    });

    expect(result.slotted.length).toBe(1);
    // Task cannot go at 09:00 because of Standup, should jump to 10:00
    expect(result.slotted[0].scheduledStart).toBe('10:00');
    expect(result.slotted[0].dueTime).toBe('11:00');
  });

  it('respects existing scheduled tasks on the timeline', () => {
    const unscheduled: Task[] = [
      createTask('t-unscheduled', 'New Task', 45, 'p2'),
    ];

    const existingScheduled = [
      {
        task: createTask('t-existing', 'Scheduled Client Call', 60, 'p1'),
        startMin: 9 * 60, // 09:00
        duration: 60,
      },
    ];

    const result = computeAutoSlotSchedule(unscheduled, existingScheduled, [], {
      startHour: 9,
      endHour: 17,
      bufferMinutes: 15,
    });

    expect(result.slotted.length).toBe(1);
    // 09:00 - 10:00 is occupied. Buffer of 15m means next slot at 10:15
    expect(result.slotted[0].scheduledStart).toBe('10:15');
    expect(result.slotted[0].dueTime).toBe('11:00');
  });

  it('marks tasks as unslotted if they exceed calendar day bounds', () => {
    const unscheduled: Task[] = [
      createTask('t-huge', 'Massive 8-hour block', 480, 'p1'),
      createTask('t-extra', 'Overflow task', 120, 'p2'),
    ];

    // Day from 9:00 to 17:00 is 8 hours (480 min)
    const result = computeAutoSlotSchedule(unscheduled, [], [], {
      startHour: 9,
      endHour: 17,
      bufferMinutes: 0,
    });

    expect(result.slotted.length).toBe(1);
    expect(result.slotted[0].taskId).toBe('t-huge');
    expect(result.unslotted.length).toBe(1);
    expect(result.unslotted[0].id).toBe('t-extra');
  });
});
