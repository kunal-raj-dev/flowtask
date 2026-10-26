// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { parseTaskInput, formatLocalDate } from '../src/utils/nlpParser';
import { commandService } from '../src/services/commandService';
import { useTaskStore } from '../src/store/useTaskStore';
import { calculateDayPlanSummary, calculateUniqueIntervalMinutes } from '../src/utils/dayPlanSummary';
import { computeAutoSlotSchedule } from '../src/utils/autoSlotAlgorithm';
import { suggestSubtasks } from '../src/utils/aiCopilot';
import { isStudyTask } from '../src/utils/taskSelectors';
import type { Task, CalendarEvent, Project } from '../src/types/task';
import type { WorkflowSettings } from '../src/types/settings';

describe('Phase 1 Trust Repairs (F01 - F06)', () => {
  describe('F01: Capture Date Semantics', () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);

    it('parses bare dates as plannedDate, leaving dueDate undefined', () => {
      const parsed = parseTaskInput('Read chapter tomorrow #personal ~45m p1');
      expect(parsed.plannedDate).toBe(tomorrowStr);
      expect(parsed.dueDate).toBeUndefined();
      expect(parsed.priority).toBe('p1');
      expect(parsed.projectTag).toBe('personal');
      expect(parsed.estimatedMinutes).toBe(45);
      expect(parsed.cleanTitle).toBe('Read chapter');
    });

    it('parses explicit due: keyword as dueDate, leaving plannedDate undefined', () => {
      const parsed = parseTaskInput('Submit quarterly report due tomorrow');
      expect(parsed.dueDate).toBe(tomorrowStr);
      expect(parsed.plannedDate).toBeUndefined();
      expect(parsed.cleanTitle).toBe('Submit quarterly report');
    });

    it('parses explicit due: prefix syntax as dueDate', () => {
      const parsed = parseTaskInput(`Submit quarterly report due:${tomorrowStr}`);
      expect(parsed.dueDate).toBe(tomorrowStr);
      expect(parsed.plannedDate).toBeUndefined();
      expect(parsed.cleanTitle).toBe('Submit quarterly report');
    });

    it('handles compound inputs with both plannedDate and dueDate correctly without trailing due in title', () => {
      const parsed = parseTaskInput('Plan product launch tomorrow due next week');
      expect(parsed.plannedDate).toBe(tomorrowStr);
      expect(parsed.dueDate).toBeDefined();
      expect(parsed.cleanTitle).toBe('Plan product launch');
      expect(parsed.cleanTitle.toLowerCase()).not.toContain('due');
    });

    it('handles explicit plan: and due: token prefixes cleanly', () => {
      const parsed = parseTaskInput('Design dashboard plan:tomorrow due:next week');
      expect(parsed.plannedDate).toBe(tomorrowStr);
      expect(parsed.dueDate).toBeDefined();
      expect(parsed.cleanTitle).toBe('Design dashboard');
    });

    it('parses due by and due on prepositions as dueDate without trailing keywords in cleanTitle', () => {
      const parsedBy = parseTaskInput('Submit project report due by tomorrow');
      expect(parsedBy.dueDate).toBe(tomorrowStr);
      expect(parsedBy.plannedDate).toBeUndefined();
      expect(parsedBy.cleanTitle).toBe('Submit project report');

      const parsedOn = parseTaskInput('Submit project report due on tomorrow');
      expect(parsedOn.dueDate).toBe(tomorrowStr);
      expect(parsedOn.plannedDate).toBeUndefined();
      expect(parsedOn.cleanTitle).toBe('Submit project report');
    });

    it('ensures second bare date phrase never gets assigned to dueDate (Contract 5.1)', () => {
      const parsed = parseTaskInput('Plan workshop tomorrow next Friday');
      expect(parsed.plannedDate).toBe(tomorrowStr);
      expect(parsed.dueDate).toBeUndefined();
      expect(parsed.cleanTitle).toBe('Plan workshop');
    });

    it('resolves ambiguous compound date and time expressions consistently', () => {
      const parsed = parseTaskInput('Meet about taxes tomorrow due 5pm');
      expect(parsed.cleanTitle).toBe('Meet about taxes');
      expect(parsed.plannedDate).toBe(tomorrowStr);
      expect(parsed.dueDate).toBe(tomorrowStr);
      expect(parsed.dueTime).toBe('17:00');
    });

    it('preserves destination default semantics: explicit undefined plannedDate is not overridden by context default', () => {
      const todayStr = formatLocalDate(today);
      const res = commandService.createTask([], 'Capture from Global HUD', { plannedDate: undefined }, {
        defaultPlannedDate: todayStr,
      });
      expect(res.createdTask.plannedDate).toBeUndefined();
      expect(res.createdTask.projectId).toBe('inbox');
    });

    it('preserves destination default semantics: capturing in Today view with future deadline does not force plannedDate to today', () => {
      const todayStr = formatLocalDate(today);
      const res = commandService.createTask([], 'Submit invoice due tomorrow', undefined, {
        defaultPlannedDate: todayStr,
      });
      expect(res.createdTask.dueDate).toBe(tomorrowStr);
      expect(res.createdTask.plannedDate).toBeUndefined();
    });

    it('handles empty and whitespace input gracefully without throwing', () => {
      expect(parseTaskInput('').cleanTitle).toBe('');
      expect(parseTaskInput('   ').cleanTitle).toBe('');
    });
  });

  describe('F02: Drawer Overlap Protection & Interval Conflict Detection', () => {
    it('calculates unique non-overlapping minutes correctly for adjacent intervals', () => {
      // 09:00 - 10:00 (540 to 600) and 10:00 - 11:00 (600 to 660)
      const minutes = calculateUniqueIntervalMinutes([
        [540, 600],
        [600, 660],
      ]);
      expect(minutes).toBe(120);
    });

    it('calculates deduplicated minutes correctly for overlapping intervals', () => {
      // 09:00 - 10:30 (540 to 630) and 10:00 - 11:30 (600 to 690)
      // Total span: 540 to 690 = 150 unique minutes, 30 min overlap
      const minutes = calculateUniqueIntervalMinutes([
        [540, 630],
        [600, 690],
      ]);
      expect(minutes).toBe(150);
    });

    it('handles contained intervals without double counting', () => {
      // 09:00 - 12:00 (540 to 720) and 10:00 - 11:00 (600 to 660)
      const minutes = calculateUniqueIntervalMinutes([
        [540, 720],
        [600, 660],
      ]);
      expect(minutes).toBe(180);
    });

    it('handles empty and out-of-order intervals gracefully', () => {
      expect(calculateUniqueIntervalMinutes([])).toBe(0);
      expect(calculateUniqueIntervalMinutes([[600, 540]])).toBe(0); // invalid
      expect(
        calculateUniqueIntervalMinutes([
          [700, 800],
          [500, 600],
        ])
      ).toBe(200);
    });
  });

  describe('F03: Lock Bypass Enforcement in commandService & Store', () => {
    const lockedTask: Task = {
      id: 'locked-1',
      title: 'Locked Client Presentation',
      status: 'todo',
      priority: 'p1',
      projectId: 'work',
      plannedDate: '2026-04-10',
      scheduledStart: '09:00',
      scheduledEnd: '10:30',
      scheduleLocked: true,
      createdAt: 1000,
    };

    it('throws error when modifying scheduledStart on a locked task without allowLocked', () => {
      expect(() => {
        commandService.updateTask([lockedTask], 'locked-1', { scheduledStart: '11:00' });
      }).toThrow(/Cannot modify schedule of locked task/);
    });

    it('throws error when modifying scheduledEnd on a locked task without allowLocked', () => {
      expect(() => {
        commandService.updateTask([lockedTask], 'locked-1', { scheduledEnd: '12:00' });
      }).toThrow(/Cannot modify schedule of locked task/);
    });

    it('throws error when modifying plannedDate on a locked task without allowLocked', () => {
      expect(() => {
        commandService.updateTask([lockedTask], 'locked-1', { plannedDate: '2026-04-11' });
      }).toThrow(/Cannot modify schedule of locked task/);
    });

    it('allows non-schedule updates (e.g. title, priority, notes) on locked task', () => {
      const result = commandService.updateTask([lockedTask], 'locked-1', {
        title: 'Updated Presentation Title',
        priority: 'p2',
      });
      expect(result.updatedTasks[0].title).toBe('Updated Presentation Title');
      expect(result.updatedTasks[0].priority).toBe('p2');
      expect(result.updatedTasks[0].scheduledStart).toBe('09:00');
    });

    it('allows schedule changes when allowLocked option is explicitly true', () => {
      const result = commandService.updateTask(
        [lockedTask],
        'locked-1',
        { scheduledStart: '14:00', scheduledEnd: '15:30' },
        { allowLocked: true }
      );
      expect(result.updatedTasks[0].scheduledStart).toBe('14:00');
      expect(result.updatedTasks[0].scheduledEnd).toBe('15:30');
    });

    it('allows schedule changes when unlocking the task in the same operation', () => {
      const result = commandService.updateTask([lockedTask], 'locked-1', {
        scheduleLocked: false,
        scheduledStart: '14:00',
      });
      expect(result.updatedTasks[0].scheduleLocked).toBe(false);
      expect(result.updatedTasks[0].scheduledStart).toBe('14:00');
    });

    it('enforces schedule lock guard through useTaskStore', () => {
      useTaskStore.setState({
        tasks: [lockedTask],
        projects: [{ id: 'work', name: 'Work', color: '#6366f1', createdAt: 1 }],
        store: null,
      });

      // Modifying schedule without allowLocked throws
      expect(() => {
        useTaskStore.getState().updateTask('locked-1', { scheduledStart: '15:00' });
      }).toThrow(/Cannot modify schedule of locked task/);

      // Modifying schedule with allowLocked succeeds
      useTaskStore.getState().updateTask('locked-1', { scheduledStart: '15:00' }, { allowLocked: true });
      expect(useTaskStore.getState().tasks.find((t) => t.id === 'locked-1')?.scheduledStart).toBe('15:00');
    });

    it('blocks clearing scheduledStart or scheduledEnd on a locked task', () => {
      expect(() => {
        commandService.updateTask([lockedTask], 'locked-1', {
          scheduledStart: undefined,
          scheduledEnd: undefined,
        });
      }).toThrow(/Cannot modify schedule of locked task/);
    });

    it('blocks clearing plannedDate on a locked task', () => {
      expect(() => {
        commandService.updateTask([lockedTask], 'locked-1', {
          plannedDate: undefined,
        });
      }).toThrow(/Cannot modify schedule of locked task/);
    });

    it('prevents autoSlotAlgorithm from scheduling locked tasks', () => {
      const unscheduledLocked: Task = {
        id: 'unsched-locked',
        title: 'Locked Unscheduled Task',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        scheduleLocked: true,
        estimatedMinutes: 60,
        createdAt: 1,
      };

      const result = computeAutoSlotSchedule([unscheduledLocked], [], []);
      expect(result.slotted.length).toBe(0);
      expect(result.unslotted.length).toBe(1);
      expect(result.unslotted[0].id).toBe('unsched-locked');
      expect(result.reasons['unsched-locked']).toBe('Schedule is locked.');
    });
  });

  describe('F04: Time Presentation Arithmetic & Day Plan Summary', () => {
    const testDate = '2026-04-10';
    const mockProjects: Project[] = [{ id: 'work', name: 'Work', color: '#6366f1', createdAt: 1 }];
    const defaultSettings: WorkflowSettings = {
      targetWorkCapacityHours: 8,
      defaultTaskDuration: 30,
      enableSmartSyntaxParsing: true,
      timelineStartHour: 8,
      timelineEndHour: 18,
    };

    it('separates task effort from scheduled duration for two 3-hour reservations with 75m estimate', () => {
      const task1: Task = {
        id: 'task-slot-1',
        title: 'Morning Deep Work',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        plannedDate: testDate,
        scheduledStart: '08:00',
        scheduledEnd: '11:00', // 180 min reservation
        estimatedMinutes: 45,
        createdAt: 1,
      };

      const task2: Task = {
        id: 'task-slot-2',
        title: 'Afternoon Deep Work',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        plannedDate: testDate,
        scheduledStart: '14:30',
        scheduledEnd: '17:30', // 180 min reservation
        estimatedMinutes: 30,
        createdAt: 2,
      };

      const summary = calculateDayPlanSummary({
        date: testDate,
        todayStr: testDate,
        tasks: [task1, task2],
        projects: mockProjects,
        settings: defaultSettings,
      });

      // Task effort is the sum of estimatedMinutes: 45 + 30 = 75 minutes
      expect(summary.totalDemandMinutes).toBe(75);
      // Scheduled reservation is 180 + 180 = 360 minutes
      expect(summary.scheduledTaskMinutes).toBe(360);
      // Non-overlapping reservations occupy 360 unique minutes
      expect(summary.uniqueOccupiedMinutes).toBe(360);
      // No overlaps between 08:00-11:00 and 14:30-17:30
      expect(summary.conflictMinutes).toBe(0);
    });

    it('computes conflict minutes accurately when two scheduled tasks overlap', () => {
      const task1: Task = {
        id: 't-ov-1',
        title: 'Slot 1',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        plannedDate: testDate,
        scheduledStart: '09:00',
        scheduledEnd: '11:00', // 120 min
        estimatedMinutes: 60,
        createdAt: 1,
      };

      const task2: Task = {
        id: 't-ov-2',
        title: 'Slot 2',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        plannedDate: testDate,
        scheduledStart: '10:00',
        scheduledEnd: '12:00', // 120 min (overlaps 10:00 - 11:00 = 60 min)
        estimatedMinutes: 60,
        createdAt: 2,
      };

      const summary = calculateDayPlanSummary({
        date: testDate,
        todayStr: testDate,
        tasks: [task1, task2],
        projects: mockProjects,
        settings: defaultSettings,
      });

      expect(summary.scheduledTaskMinutes).toBe(240);
      expect(summary.uniqueOccupiedMinutes).toBe(180); // 09:00 to 12:00
      expect(summary.conflictMinutes).toBe(60); // 10:00 to 11:00
    });

    it('computes conflicts accurately between calendar events and scheduled tasks', () => {
      const task: Task = {
        id: 'task-meet-conf',
        title: 'Focus Sprint',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        plannedDate: testDate,
        scheduledStart: '13:30',
        scheduledEnd: '14:30', // 60 min
        estimatedMinutes: 60,
        createdAt: 1,
      };

      const calendarEvent: CalendarEvent = {
        id: 'cal-meet-1',
        title: 'Team Sync',
        startDate: testDate,
        startTime: '13:00',
        endTime: '14:00', // 60 min (overlaps 13:30 - 14:00 = 30 min)
      };

      const summary = calculateDayPlanSummary({
        date: testDate,
        todayStr: testDate,
        tasks: [task],
        projects: mockProjects,
        calendarEvents: [calendarEvent],
        settings: defaultSettings,
      });

      expect(summary.timedCalendarMinutes).toBe(60);
      expect(summary.scheduledTaskMinutes).toBe(60);
      // Span 13:00 to 14:30 = 90 unique minutes
      expect(summary.uniqueOccupiedMinutes).toBe(90);
      // Overlap 13:30 to 14:00 = 30 minutes
      expect(summary.conflictMinutes).toBe(30);
    });

    it('detects overcapacity accurately when meetings and task effort exceed daily capacity', () => {
      const sixHourSettings: WorkflowSettings = {
        ...defaultSettings,
        targetWorkCapacityHours: 6,
      };

      const task: Task = {
        id: 'task-demand-1',
        title: 'Draft proposal',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        plannedDate: testDate,
        estimatedMinutes: 180,
        createdAt: 1,
      };

      const meeting: CalendarEvent = {
        id: 'cal-meet-long',
        title: 'Client workshops',
        startDate: testDate,
        startTime: '09:00',
        endTime: '13:00',
      };

      const summary = calculateDayPlanSummary({
        date: testDate,
        todayStr: testDate,
        tasks: [task],
        projects: mockProjects,
        calendarEvents: [meeting],
        settings: sixHourSettings,
      });

      expect(summary.availableTaskBudgetMinutes).toBe(120);
      expect(summary.totalDemandMinutes).toBe(180);
      expect(summary.overbooked).toBe(true);
      expect(summary.overbookedMinutes).toBe(60);
    });
  });

  describe('F05: Breakdown Credibility & AI Copilot Disambiguation', () => {
    it('decomposes technical accessibility audit without tax or 1099 subtasks', () => {
      const subtasks = suggestSubtasks('Audit onboarding accessibility');
      expect(subtasks.length).toBeGreaterThanOrEqual(3);
      // Must match technical audit steps
      expect(subtasks[0].title.toLowerCase()).toContain('checklist');
      expect(subtasks.some((s) => s.title.toLowerCase().includes('remediation'))).toBe(true);

      // Must NOT contain tax, 1099, or financial terms
      for (const step of subtasks) {
        const text = step.title.toLowerCase();
        expect(text).not.toContain('1099');
        expect(text).not.toContain('receipt');
        expect(text).not.toContain('accountant');
        expect(text).not.toContain('deductible');
      }
    });

    it('decomposes security and code audit without financial terms', () => {
      const subtasks = suggestSubtasks('Security audit of authentication endpoints');
      expect(subtasks.length).toBeGreaterThanOrEqual(3);
      expect(subtasks.some((s) => s.title.toLowerCase().includes('findings report'))).toBe(true);

      for (const step of subtasks) {
        const text = step.title.toLowerCase();
        expect(text).not.toContain('1099');
        expect(text).not.toContain('receipt');
      }
    });

    it('decomposes financial tax audit with proper tax and financial steps', () => {
      const subtasks = suggestSubtasks('Prepare annual tax audit documentation');
      expect(subtasks.length).toBeGreaterThanOrEqual(3);
      expect(subtasks.some((s) => s.title.toLowerCase().includes('receipts'))).toBe(true);
      expect(subtasks.some((s) => s.title.toLowerCase().includes('accountant') || s.title.toLowerCase().includes('spreadsheet'))).toBe(true);
    });

    it('decomposes IRS and expense filings with tax steps', () => {
      const subtasks = suggestSubtasks('IRS quarterly tax filing');
      expect(subtasks.length).toBeGreaterThanOrEqual(3);
      expect(subtasks[0].title.toLowerCase()).toContain('receipts');
    });
  });

  describe('F06: Study Classification Separation', () => {
    it('does not classify generic scheduled tasks as study tasks', () => {
      const genericTask: Task = {
        id: 'gen-1',
        title: 'Refactor Auth Middleware',
        status: 'todo',
        priority: 'p2',
        projectId: 'work',
        scheduledStart: '09:00',
        scheduledEnd: '10:30',
        estimatedMinutes: 90,
        createdAt: 1,
      };

      expect(isStudyTask(genericTask)).toBe(false);
    });

    it('does not classify generic scheduled task with isSession: false as a study task', () => {
      const genericSessionTask: Task = {
        id: 'gen-2',
        title: 'Review Engineering PRs',
        status: 'todo',
        priority: 'p2',
        projectId: 'engineering',
        scheduledStart: '14:00',
        scheduledEnd: '15:00',
        sessionMetadata: {
          isSession: false,
        },
        createdAt: 1,
      };

      expect(isStudyTask(genericSessionTask)).toBe(false);
    });

    it('classifies task as study task when isStudy: true is explicitly set', () => {
      const studyTask: Task = {
        id: 'study-1',
        title: 'Review Biology Flashcards',
        status: 'todo',
        priority: 'p2',
        projectId: 'personal',
        isStudy: true,
        createdAt: 1,
      };

      expect(isStudyTask(studyTask)).toBe(true);
    });

    it('classifies task as study task when projectId is study', () => {
      const studyTask: Task = {
        id: 'study-2',
        title: 'Study Chapter 4 Algorithms',
        status: 'todo',
        priority: 'p2',
        projectId: 'study',
        createdAt: 1,
      };

      expect(isStudyTask(studyTask)).toBe(true);
    });

    it('classifies task as study task when targetPacingMinutes is configured in sessionMetadata', () => {
      const pacingTask: Task = {
        id: 'study-3',
        title: 'Practice 20 LSAT Logic Games',
        status: 'todo',
        priority: 'p1',
        projectId: 'prep',
        sessionMetadata: {
          isSession: true,
          targetPacingMinutes: 15,
        },
        createdAt: 1,
      };

      expect(isStudyTask(pacingTask)).toBe(true);
    });
  });
});
