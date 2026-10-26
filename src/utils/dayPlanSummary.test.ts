import { describe, it, expect } from 'vitest';
import {
  calculateDayPlanSummary,
  calculateUniqueIntervalMinutes,
  calculateWeekPlanSummary,
  calculateFeasibleFinishTime, calculateFinishForecast,
} from './dayPlanSummary';
import type { Task, CalendarEvent } from '../types/task';

it('counts a planned task once across the week and keeps its later deadline separate', () => {
  const tasks: Task[]=[{id:'one',title:'Prepare',status:'todo',priority:'p2',projectId:'inbox',subtasks:[],createdAt:1,plannedDate:'2026-10-17',dueDate:'2026-10-20',estimatedMinutes:60}];
  const week=calculateWeekPlanSummary({startDate:'2026-10-17',todayStr:'2026-10-17',tasks,calendarEvents:[{id:'m1',title:'First',date:'2026-10-17',startTime:'09:00',endTime:'10:00'},{id:'m2',title:'Second',date:'2026-10-17',startTime:'09:30',endTime:'10:30'}]});
  expect(week.reduce((sum,day)=>sum+day.summary.totalDemandMinutes,0)).toBe(60);
  expect(week[0].summary.availableTaskBudgetMinutes).toBe(270);
  expect(week[3].deadlinesCount).toBe(1); expect(week[3].summary.totalDemandMinutes).toBe(0);
});

describe('calculateUniqueIntervalMinutes', () => {
  it('handles empty intervals', () => {
    expect(calculateUniqueIntervalMinutes([])).toBe(0);
  });

  it('calculates single interval', () => {
    expect(calculateUniqueIntervalMinutes([[540, 600]])).toBe(60);
  });

  it('merges overlapping intervals correctly', () => {
    // 09:00 - 10:30 (540-630) and 10:00 - 11:00 (600-660) -> 09:00 - 11:00 (120 min)
    expect(calculateUniqueIntervalMinutes([[540, 630], [600, 660]])).toBe(120);
  });

  it('merges completely enveloped intervals', () => {
    // 09:00 - 12:00 (540-720) and 10:00 - 11:00 (600-660) -> 180 min
    expect(calculateUniqueIntervalMinutes([[540, 720], [600, 660]])).toBe(180);
  });

  it('sums non-overlapping disjoint intervals', () => {
    // 09:00-10:00 (60m) and 11:00-12:00 (60m) -> 120m
    expect(calculateUniqueIntervalMinutes([[540, 600], [660, 720]])).toBe(120);
  });
});

describe('calculateDayPlanSummary', () => {
  const baseDate = '2026-10-17';

  it('calculates available task budget subtracting timed calendar commitments within working hours', () => {
    const calendarEvents: CalendarEvent[] = [
      { id: 'm1', title: 'Standup', startTime: '09:00', endTime: '09:30', isAllDay: false },
      { id: 'm2', title: 'Overlap Standup', startTime: '09:15', endTime: '10:00', isAllDay: false },
      { id: 'all1', title: 'Company Holiday', startTime: '', endTime: '', isAllDay: true },
    ];

    const summary = calculateDayPlanSummary({
      date: baseDate,
      tasks: [],
      calendarEvents,
      settings: { targetWorkCapacityHours: 6.0, timelineStartHour: 7, timelineEndHour: 22 },
      todayStr: baseDate,
    });

    // Configured capacity = 6 hours * 60 = 360 min
    expect(summary.configuredCapacityMinutes).toBe(360);
    // Timed calendar meetings: 09:00 - 10:00 merged = 60 min
    expect(summary.timedCalendarMinutes).toBe(60);
    // Available budget = 360 - 60 = 300 min
    expect(summary.availableTaskBudgetMinutes).toBe(300);
    // All day events kept separate
    expect(summary.allDayCalendarEvents).toHaveLength(1);
    expect(summary.allDayCalendarEvents[0].title).toBe('Company Holiday');
  });

  it('handles missing estimates using defaultTaskDuration and identifies them', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Task without estimate',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        plannedDate: baseDate,
        createdAt: 1000,
        subtasks: [],
      },
      {
        id: 't2',
        title: 'Task with estimate',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        plannedDate: baseDate,
        estimatedMinutes: 45,
        createdAt: 1000,
        subtasks: [],
      },
    ];

    const summary = calculateDayPlanSummary({
      date: baseDate,
      tasks,
      settings: { defaultTaskDuration: 25 },
      todayStr: baseDate,
    });

    expect(summary.missingEstimatesCount).toBe(1);
    // Total demand = 25 (default) + 45 = 70 min
    expect(summary.totalDemandMinutes).toBe(70);
    expect(summary.remainingTaskWorkMinutes).toBe(70);
  });

  it('separates remaining task work and recorded focus time', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Done Task',
        status: 'done',
        priority: 'p1',
        projectId: 'inbox',
        plannedDate: baseDate,
        estimatedMinutes: 60,
        createdAt: 1000,
        subtasks: [],
      },
      {
        id: 't2',
        title: 'Pending Task',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        plannedDate: baseDate,
        estimatedMinutes: 90,
        createdAt: 1000,
        subtasks: [],
      },
    ];

    const summary = calculateDayPlanSummary({
      date: baseDate,
      tasks,
      focusLogsSecondsToday: 3600, // 60 min recorded focus time
      todayStr: baseDate,
    });

    expect(summary.completedTaskCount).toBe(1);
    expect(summary.totalTaskCount).toBe(2);
    expect(summary.totalDemandMinutes).toBe(150);
    expect(summary.remainingTaskWorkMinutes).toBe(90); // Only pending task
    expect(summary.recordedFocusMinutes).toBe(60); // 3600s = 60m
  });

  it('detects overbooked workload accurately', () => {
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Huge task',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        plannedDate: baseDate,
        estimatedMinutes: 400,
        createdAt: 1000,
        subtasks: [],
      },
    ];

    const summary = calculateDayPlanSummary({
      date: baseDate,
      tasks,
      settings: { targetWorkCapacityHours: 5.0 }, // 300 min
      todayStr: baseDate,
    });

    expect(summary.availableTaskBudgetMinutes).toBe(300);
    expect(summary.totalDemandMinutes).toBe(400);
    expect(summary.overbooked).toBe(true);
    expect(summary.overbookedMinutes).toBe(100);
  });

  it('accurately incorporates multiple independent work blocks across days', () => {
    const multiBlockTask: Task = {
      id: 'mb1',
      title: 'Split project work',
      status: 'todo',
      priority: 'p1',
      projectId: 'inbox',
      subtasks: [],
      createdAt: 1000,
      dueDate: '2026-10-31',
      plannedDate: '2026-10-20',
      estimatedMinutes: 180,
      workBlocks: [
        {
          id: 'wb1',
          taskId: 'mb1',
          startInstant: Date.parse(`${baseDate}T09:00:00Z`),
          endInstant: Date.parse(`${baseDate}T10:30:00Z`),
          timezone: 'UTC',
          status: 'scheduled',
          date: baseDate,
          durationMinutes: 90,
          createdAt: '2026-10-17T00:00:00Z',
          updatedAt: '2026-10-17T00:00:00Z',
        },
      ],
    };

    const summary = calculateDayPlanSummary({
      date: baseDate,
      tasks: [multiBlockTask],
      todayStr: '2026-10-16',
    });

    expect(summary.totalTaskCount).toBe(1);
    expect(summary.scheduledTaskMinutes).toBe(90);
  });
});

describe('calculateFeasibleFinishTime', () => {
  it('returns current time when remaining work is 0 or negative', () => {
    const now = new Date('2026-10-25T14:30:00');
    expect(calculateFeasibleFinishTime(now, 0)).toBe('14:30');
    expect(calculateFeasibleFinishTime(now, -15)).toBe('14:30');
  });

  it('projects simple finish time without calendar events', () => {
    const now = new Date('2026-10-25T09:00:00');
    // 09:00 + 45 minutes = 09:45
    expect(calculateFeasibleFinishTime(now, 45, [])).toBe('09:45');
    // 09:00 + 120 minutes = 11:00
    expect(calculateFeasibleFinishTime(now, 120, [])).toBe('11:00');
  });

  it('hops over active/ongoing calendar events', () => {
    // Current time is 10:15
    const now = new Date('2026-10-25T10:15:00');
    // Meeting from 10:00 to 11:00 (active until 11:00)
    const events = [
      { id: 'ev-1', title: 'Sprint Sync', startTime: '10:00', endTime: '11:00', durationMinutes: 60 },
    ];
    // 30 minutes of remaining work starts at 11:00 -> finishes at 11:30
    expect(calculateFeasibleFinishTime(now, 30, events)).toBe('11:30');
  });

  it('accounts for upcoming calendar events and interstitial gaps', () => {
    // Current time is 09:00
    const now = new Date('2026-10-25T09:00:00');
    // Upcoming event from 09:30 to 10:30 (15 min gap between 09:00-09:30 is 30m, work is 45m)
    const events = [
      { id: 'ev-1', title: 'Review', startTime: '09:30', endTime: '10:30', durationMinutes: 60 },
    ];
    // Work 45m: 30m done from 09:00 to 09:30, then meeting 09:30-10:30, remaining 15m done 10:30-10:45
    expect(calculateFeasibleFinishTime(now, 45, events)).toBe('10:45');
  });

  it('ignores past calendar events', () => {
    const now = new Date('2026-10-25T14:00:00');
    const pastEvents = [
      { id: 'ev-past', title: 'Morning Standup', startTime: '09:00', endTime: '09:30', durationMinutes: 30 },
    ];
    // 60 minutes starting at 14:00 finishes at 15:00
    expect(calculateFeasibleFinishTime(now, 60, pastEvents)).toBe('15:00');
  });
});



it('exposes next-day and planning-hours limits instead of wrapping the finish clock silently', () => {
  expect(calculateFinishForecast(new Date('2026-10-25T23:30:00'), 120, [], 22)).toEqual({ time: '01:30', dayOffset: 1, outsideWorkHours: true });
  expect(calculateFinishForecast(new Date('2026-10-25T17:00:00'), 60, [], 18)).toEqual({ time: '18:00', dayOffset: 0, outsideWorkHours: false });
});
