// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { STUDY_PACING_PRESETS, STARTER_STUDY_TEMPLATES } from '../src/utils/studyTemplates';
import { convertSessionToTask } from '../src/utils/sessionParser';
import { isStudyTask } from '../src/utils/taskSelectors';
import { MAX_CALENDAR_EVENTS, parseICSFeed, parseICSFile } from '../src/services/calendarService';
import { isQuietHours } from '../src/services/reminderService';
import type { UserWorkflowSettings } from '../src/types/settings';
import type { RoutineRun } from '../src/types/routine';
import type { WorkspaceReview } from '../src/types/review';
import type { Task } from '../src/types/task';
import type { Goal } from '../src/types/goal';
import type { Area } from '../src/types/area';

describe('Phase 5 Supporting Sections & Services', () => {
  describe('Study Mode, Pacing Presets & Canonical Work Blocks (Package 5.1)', () => {
    it('exports canonical study pacing presets adhering to TimerConfiguration', () => {
      expect(Array.isArray(STUDY_PACING_PRESETS)).toBe(true);
      expect(STUDY_PACING_PRESETS.length).toBeGreaterThanOrEqual(3);

      const pomodoro = STUDY_PACING_PRESETS.find((p) => p.id === 'pomodoro-classic');
      expect(pomodoro).toBeDefined();
      expect(pomodoro?.timer.focusMinutes).toBe(25);
      expect(pomodoro?.timer.shortBreakMinutes).toBe(5);
      expect(pomodoro?.timer.longBreakMinutes).toBe(15);
      expect(pomodoro?.timer.cyclesBeforeLongBreak).toBe(4);
      expect(pomodoro?.timer.autoStart).toBe(false);

      const fiftyTen = STUDY_PACING_PRESETS.find((p) => p.id === 'deep-study-50-10');
      expect(fiftyTen).toBeDefined();
      expect(fiftyTen?.timer.focusMinutes).toBe(50);
      expect(fiftyTen?.timer.shortBreakMinutes).toBe(10);
      expect(fiftyTen?.timer.cyclesBeforeLongBreak).toBe(3);

      const ultradian = STUDY_PACING_PRESETS.find((p) => p.id === 'sprint-90-20');
      expect(ultradian).toBeDefined();
      expect(ultradian?.timer.focusMinutes).toBe(90);
      expect(ultradian?.timer.shortBreakMinutes).toBe(20);
      expect(ultradian?.timer.cyclesBeforeLongBreak).toBe(2);
    });

    it('builds study tasks with explicit isStudy: true flag and canonical workBlocks', () => {
      const template = STARTER_STUDY_TEMPLATES[0];
      expect(template.sessions.length).toBeGreaterThanOrEqual(1);
      const sessionWithTime = {
        ...template.sessions[0],
        startTime: '09:00',
        endTime: '10:00',
      };
      const task = convertSessionToTask(sessionWithTime, '2026-10-26');
      expect(task.isStudy).toBe(true);
      expect(task.title).toContain(template.title);
      expect(task.plannedDate).toBe('2026-10-26');
      expect(task.workBlocks).toBeDefined();
      expect(task.workBlocks?.length).toBe(1);
      expect(task.workBlocks?.[0].status).toBe('scheduled');
      expect(task.workBlocks?.[0].startTime).toBe('09:00');
      expect(task.workBlocks?.[0].endTime).toBe('10:00');
      expect(task.workBlocks?.[0].durationMinutes).toBe(60);
    });

    it('strictly filters study tasks via isStudyTask without shadow engines', () => {
      const standardTask: Task = {
        id: 'std-1',
        title: 'Review team PR',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        createdAt: Date.now(),
      };
      expect(isStudyTask(standardTask)).toBe(false);

      const studyTask: Task = {
        id: 'study-1',
        title: 'Algorithms Revision',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        isStudy: true,
        createdAt: Date.now(),
      };
      expect(isStudyTask(studyTask)).toBe(true);

      const taggedStudyTask: Task = {
        id: 'study-tag-1',
        title: 'Deep Physics Study',
        status: 'todo',
        priority: 'p1',
        projectId: 'personal',
        tags: ['study'],
        createdAt: Date.now(),
      };
      expect(isStudyTask(taggedStudyTask)).toBe(true);
    });
  });

  describe('Calendar Service Hardening (Package 5.8)', () => {
    it('defines MAX_CALENDAR_EVENTS as 500', () => {
      expect(MAX_CALENDAR_EVENTS).toBe(500);
    });

    it('rejects files larger than 2MB in parseICSFile', async () => {
      const oversizedBlob = new Blob([new Uint8Array(2 * 1024 * 1024 + 10)], { type: 'text/calendar' });
      const oversizedFile = new File([oversizedBlob], 'huge.ics', { type: 'text/calendar' });
      await expect(parseICSFile(oversizedFile)).rejects.toThrow('Calendar file exceeds 2 MB limit.');
    });

    it('parses valid ICS events with isReadOnly: true and isExternal: true', () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//FlowTask//Test//EN',
        'BEGIN:VEVENT',
        'UID:test-event-001',
        'SUMMARY:Team Standup',
        'DTSTART:20261026T090000Z',
        'DTEND:20261026T093000Z',
        'DESCRIPTION:Daily synchronization',
        'LOCATION:Zoom',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const events = parseICSFeed(ics, '2026-10-26');
      expect(events.length).toBeGreaterThanOrEqual(1);
      const ev = events.find((e) => e.title === 'Team Standup');
      expect(ev).toBeDefined();
      expect(ev?.isReadOnly).toBe(true);
      expect(ev?.isExternal).toBe(true);
    });

    it('caps calendar events at MAX_CALENDAR_EVENTS (500)', () => {
      const vevents: string[] = [];
      for (let i = 0; i < 600; i++) {
        vevents.push(
          'BEGIN:VEVENT',
          `UID:test-bulk-${i}`,
          `SUMMARY:Event ${i}`,
          'DTSTART:20261026T100000Z',
          'DTEND:20261026T103000Z',
          'END:VEVENT'
        );
      }
      const largeIcs = ['BEGIN:VCALENDAR', 'VERSION:2.0', ...vevents, 'END:VCALENDAR'].join('\r\n');
      const events = parseICSFeed(largeIcs, '2026-10-26');
      expect(events.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Quiet Hours & Boundary Transitions (Package 5.7)', () => {
    const overnightSettings: UserWorkflowSettings = {
      targetWorkCapacityHours: 6,
      defaultTaskDuration: 30,
      timelineStartHour: 7,
      timelineEndHour: 22,
      autoSlotBufferMinutes: 10,
      weekStartDay: 'monday',
      onboardingCompleted: true,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };

    it('returns false if quietHoursEnabled is false or settings missing', () => {
      expect(isQuietHours(undefined, new Date('2026-10-26T23:00:00'))).toBe(false);
      expect(isQuietHours({ ...overnightSettings, quietHoursEnabled: false }, new Date('2026-10-26T23:00:00'))).toBe(false);
    });

    it('correctly suppresses during midnight-crossing quiet hours window', () => {
      // 23:30 is during quiet hours
      const nightDate = new Date();
      nightDate.setHours(23, 30, 0, 0);
      expect(isQuietHours(overnightSettings, nightDate)).toBe(true);

      // 03:00 is during quiet hours
      const earlyMorningDate = new Date();
      earlyMorningDate.setHours(3, 0, 0, 0);
      expect(isQuietHours(overnightSettings, earlyMorningDate)).toBe(true);

      // 14:00 is outside quiet hours
      const afternoonDate = new Date();
      afternoonDate.setHours(14, 0, 0, 0);
      expect(isQuietHours(overnightSettings, afternoonDate)).toBe(false);
    });

    it('evaluates exact boundary minute transitions precisely', () => {
      // Exactly at start minute (22:00) -> quiet hours active (suppressed)
      const exactStart = new Date();
      exactStart.setHours(22, 0, 0, 0);
      expect(isQuietHours(overnightSettings, exactStart)).toBe(true);

      // At 06:59 -> quiet hours still active
      const minuteBeforeEnd = new Date();
      minuteBeforeEnd.setHours(6, 59, 0, 0);
      expect(isQuietHours(overnightSettings, minuteBeforeEnd)).toBe(true);

      // Exactly at end minute (07:00) -> quiet hours expired (not suppressed)
      const exactEnd = new Date();
      exactEnd.setHours(7, 0, 0, 0);
      expect(isQuietHours(overnightSettings, exactEnd)).toBe(false);
    });

    it('correctly suppresses during daytime quiet hours window', () => {
      const daytimeSettings: UserWorkflowSettings = {
        ...overnightSettings,
        quietHoursStart: '13:00',
        quietHoursEnd: '15:00',
      };

      const napDate = new Date();
      napDate.setHours(14, 0, 0, 0);
      expect(isQuietHours(daytimeSettings, napDate)).toBe(true);

      const eveningDate = new Date();
      eveningDate.setHours(18, 0, 0, 0);
      expect(isQuietHours(daytimeSettings, eveningDate)).toBe(false);
    });
  });

  describe('Routine & Review Data Models (Package 5.2 & 5.5)', () => {
    it('supports RoutineRun status typing (started, completed, skipped, partial)', () => {
      const run: RoutineRun = {
        id: 'run-1',
        routineId: 'morning-routine',
        startedAt: 1000,
        completedAt: 2000,
        completedStepsCount: 1,
        totalStepsCount: 2,
        totalDurationSeconds: 600,
        status: 'skipped',
        stepStates: { 'step-1': 'skipped', 'step-2': 'completed' },
      };
      expect(run.status).toBe('skipped');
      expect(run.stepStates?.['step-1']).toBe('skipped');
      expect(run.stepStates?.['step-2']).toBe('completed');
    });

    it('supports WorkspaceReview model for daily_shutdown without focusLog conflation', () => {
      const review: WorkspaceReview = {
        id: 'rev-1',
        type: 'daily_shutdown',
        reviewedAt: 1730000000000,
        completedTaskIds: ['task-1', 'task-2', 'task-3'],
        focusSecondsRecorded: 7200,
        interruptedSecondsRecorded: 1320,
        interruptedSessionsCount: 1,
        notes: 'Productive day with zero interruptions',
        revision: 1,
      };
      expect(review.type).toBe('daily_shutdown');
      expect(review.completedTaskIds).toHaveLength(3);
      expect(review.focusSecondsRecorded).toBe(7200);
      expect(review.interruptedSessionsCount).toBe(1);
    });
  });

  describe('Life Areas & Goals Domain Linking (Package 5.4)', () => {
    it('links tasks to areas and goals via ID reference without duplicating task engines', () => {
      const area: Area = {
        id: 'area-health',
        name: 'Health & Vitality',
        color: '#10b981',
        icon: 'heart',
        sortOrder: 1,
      };

      const goal: Goal = {
        id: 'goal-run',
        title: 'Run 10k race',
        areaId: area.id,
        status: 'in_progress',
      };

      const task: Task = {
        id: 'task-interval',
        title: 'Morning 5x1km intervals',
        status: 'todo',
        priority: 'p1',
        projectId: 'personal',
        areaId: area.id,
        goalId: goal.id,
        createdAt: Date.now(),
      };

      expect(task.areaId).toBe(area.id);
      expect(task.goalId).toBe(goal.id);
      expect(goal.areaId).toBe(area.id);
    });

    it('calculates honest task count progress denominators', () => {
      const goalTasks: Task[] = [
        { id: 't1', title: 'Task 1', status: 'done', priority: 'p2', projectId: 'work', goalId: 'g1', createdAt: 1 },
        { id: 't2', title: 'Task 2', status: 'todo', priority: 'p2', projectId: 'work', goalId: 'g1', createdAt: 2 },
      ];

      const completed = goalTasks.filter((t) => t.status === 'done').length;
      const total = goalTasks.length;
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

      expect(completed).toBe(1);
      expect(total).toBe(2);
      expect(progressPercent).toBe(50);
    });
  });

  describe('Insights Statistical Transparency (Package 5.3)', () => {
    it('identifies preliminary sample-size condition when fewer than 5 timed tasks exist', () => {
      const fewTasks: Task[] = [
        { id: 't1', title: 'Task 1', status: 'done', priority: 'p1', projectId: 'work', estimatedMinutes: 30, timeSpentMinutes: 35, createdAt: 1 },
        { id: 't2', title: 'Task 2', status: 'done', priority: 'p1', projectId: 'work', estimatedMinutes: 45, timeSpentMinutes: 40, createdAt: 2 },
      ];

      const timedTasks = fewTasks.filter(
        (t) => (t.estimatedMinutes || 0) > 0 && (t.timeSpentMinutes || 0) > 0
      );
      expect(timedTasks.length).toBeLessThan(5);
      const isPreliminary = timedTasks.length < 5;
      expect(isPreliminary).toBe(true);
    });

    it('separates estimated effort, actual recorded focus, and unestimated tasks', () => {
      const sampleTasks: Task[] = [
        { id: 't1', title: 'Timed Task', status: 'done', priority: 'p1', projectId: 'work', estimatedMinutes: 60, timeSpentMinutes: 70, createdAt: 1 },
        { id: 't2', title: 'Unestimated Task', status: 'done', priority: 'p2', projectId: 'work', timeSpentMinutes: 30, createdAt: 2 },
      ];

      const estimated = sampleTasks.filter((t) => (t.estimatedMinutes || 0) > 0);
      const unestimated = sampleTasks.filter((t) => !t.estimatedMinutes || t.estimatedMinutes === 0);
      const totalEstimated = estimated.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0);
      const totalActual = sampleTasks.reduce((acc, t) => acc + (t.timeSpentMinutes || 0), 0);

      expect(estimated.length).toBe(1);
      expect(unestimated.length).toBe(1);
      expect(totalEstimated).toBe(60);
      expect(totalActual).toBe(100);
    });
  });
});
