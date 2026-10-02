import { describe, it, expect } from 'vitest';
import { parseTaskInput, formatLocalDate } from './nlpParser';

describe('nlpParser', () => {
  it('parses plain title without metadata', () => {
    const res = parseTaskInput('Buy groceries at the store');
    expect(res.cleanTitle).toBe('Buy groceries at the store');
    expect(res.priority).toBeUndefined();
    expect(res.projectTag).toBeUndefined();
    expect(res.estimatedMinutes).toBeUndefined();
  });

  it('parses priority tokens (p1, p2, p3, p4)', () => {
    const res1 = parseTaskInput('Fix critical bug p1');
    expect(res1.cleanTitle).toBe('Fix critical bug');
    expect(res1.priority).toBe('p1');

    const res2 = parseTaskInput('Write quarterly review p2');
    expect(res2.cleanTitle).toBe('Write quarterly review');
    expect(res2.priority).toBe('p2');

    const res3 = parseTaskInput('Clean desk !low');
    expect(res3.cleanTitle).toBe('Clean desk');
    expect(res3.priority).toBe('p4');
  });

  it('parses project hashtag (#work, #personal)', () => {
    const res = parseTaskInput('Prepare slide deck #work');
    expect(res.cleanTitle).toBe('Prepare slide deck');
    expect(res.projectTag).toBe('work');
  });

  it('parses duration estimates (~30m, ~1.5h)', () => {
    const resMin = parseTaskInput('Quick team sync ~15m');
    expect(resMin.cleanTitle).toBe('Quick team sync');
    expect(resMin.estimatedMinutes).toBe(15);

    const resHour = parseTaskInput('Deep focus architecture draft ~2h');
    expect(resHour.cleanTitle).toBe('Deep focus architecture draft');
    expect(resHour.estimatedMinutes).toBe(120);
  });

  it('parses composite input with date, priority, project, and duration', () => {
    const res = parseTaskInput('Submit taxes tomorrow at 5pm #finances p1 ~45m');
    expect(res.priority).toBe('p1');
    expect(res.projectTag).toBe('finances');
    expect(res.estimatedMinutes).toBe(45);
    expect(res.dueDate).toBeDefined();
    expect(res.dueTime).toBe('17:00');
    expect(res.cleanTitle).toBe('Submit taxes');
  });

  it('formats local dates consistently without UTC offset drift', () => {
    const testDate = new Date(2026, 9, 15); // Oct 15, 2026
    expect(formatLocalDate(testDate)).toBe('2026-10-15');
  });

  it('parses natural language recurrence rules', () => {
    const resDaily = parseTaskInput('Meditate every day');
    expect(resDaily.cleanTitle).toBe('Meditate');
    expect(resDaily.recurrence).toBe('daily');

    const resWeekdays = parseTaskInput('Standup on weekdays at 9am #work');
    expect(resWeekdays.cleanTitle).toBe('Standup');
    expect(resWeekdays.recurrence).toBe('weekdays');
    expect(resWeekdays.dueTime).toBe('09:00');

    const resWeekly = parseTaskInput('Review sprint metrics every monday');
    expect(resWeekly.cleanTitle).toBe('Review sprint metrics');
    expect(resWeekly.recurrence).toBe('weekly');
    expect(resWeekly.dueDate).toBeDefined();

    const resBiweekly = parseTaskInput('Pay team biweekly #finances');
    expect(resBiweekly.cleanTitle).toBe('Pay team');
    expect(resBiweekly.recurrence).toBe('biweekly');

    const resMonthly = parseTaskInput('Pay rent every month');
    expect(resMonthly.cleanTitle).toBe('Pay rent');
    expect(resMonthly.recurrence).toBe('monthly');
  });

  it('parses relative time-of-day keywords (morning, afternoon, evening)', () => {
    const resMorn = parseTaskInput('Call doctor tomorrow morning');
    expect(resMorn.cleanTitle).toBe('Call doctor');
    expect(resMorn.dueDate).toBeDefined();
    expect(resMorn.dueTime).toBe('09:00');

    const resAft = parseTaskInput('Client demo afternoon');
    expect(resAft.cleanTitle).toBe('Client demo');
    expect(resAft.dueTime).toBe('14:00');

    const resEve = parseTaskInput('Family dinner tonight');
    expect(resEve.cleanTitle).toBe('Family dinner');
    expect(resEve.dueTime).toBe('18:00');
  });

  it('parses GTD context tags (@calls, @computer, @errands)', () => {
    const resSingle = parseTaskInput('Call client about contract @calls #work p1');
    expect(resSingle.cleanTitle).toBe('Call client about contract');
    expect(resSingle.contextTags).toEqual(['calls']);
    expect(resSingle.projectTag).toBe('work');
    expect(resSingle.priority).toBe('p1');

    const resMultiple = parseTaskInput('Fix layout bug @computer @desk #code');
    expect(resMultiple.cleanTitle).toBe('Fix layout bug');
    expect(resMultiple.contextTags).toEqual(['computer', 'desk']);
    expect(resMultiple.projectTag).toBe('code');
  });

  it('parses multiple hashtags as tags array', () => {
    const res = parseTaskInput('Implement OAuth2 flow #work #backend #auth p1');
    expect(res.cleanTitle).toBe('Implement OAuth2 flow');
    expect(res.projectTag).toBe('work');
    expect(res.tags).toEqual(['work', 'backend', 'auth']);
    expect(res.priority).toBe('p1');
  });
});
