import { describe, it, expect } from 'vitest';
import {
  normalizeTimeTo24h,
  calculateDurationMinutes,
  parseTargetLine,
  parseStudySessions,
  convertSessionToTask,
} from './sessionParser';

describe('sessionParser', () => {
  it('normalizes time strings to 24-hour format', () => {
    expect(normalizeTimeTo24h('8:30 am')).toBe('08:30');
    expect(normalizeTimeTo24h('11:30 am')).toBe('11:30');
    expect(normalizeTimeTo24h('12:00 pm')).toBe('12:00');
    expect(normalizeTimeTo24h('2:30 pm')).toBe('14:30');
    expect(normalizeTimeTo24h('8 am')).toBe('08:00');
    expect(normalizeTimeTo24h('14:45')).toBe('14:45');
  });

  it('calculates duration in minutes correctly', () => {
    expect(calculateDurationMinutes('08:30', '11:30')).toBe(180);
    expect(calculateDurationMinutes('12:00', '14:30')).toBe(150);
    expect(calculateDurationMinutes('23:00', '01:00')).toBe(120); // across midnight
  });

  it('parses compact LeetCode target with difficulty, URL, and tags', () => {
    const rawLine = '7 HARDMedian of Two Sorted Arrays69.40.004736972853624943https://leetcode.com/problems/median-of-two-sorted-arrays Conquer';
    const target = parseTargetLine(rawLine, 0);

    expect(target).not.toBeNull();
    expect(target?.problemNumber).toBe('7');
    expect(target?.difficulty).toBe('HARD');
    expect(target?.title).toContain('Median of Two Sorted Arrays');
    expect(target?.url).toBe('https://leetcode.com/problems/median-of-two-sorted-arrays');
    expect(target?.tags).toContain('Conquer');
  });

  it('parses LeetCode line with multiple comma tags', () => {
    const rawLine = '5MEDIUM3Sum70.40.003969310706550047https://leetcode.com/problems/3sumArray, Two Pointers, Sorting';
    const target = parseTargetLine(rawLine, 1);

    expect(target).not.toBeNull();
    expect(target?.problemNumber).toBe('5');
    expect(target?.difficulty).toBe('MEDIUM');
    expect(target?.title).toContain('3Sum');
    expect(target?.url).toBe('https://leetcode.com/problems/3sumArray');
    expect(target?.tags).toContain('Two Pointers');
    expect(target?.tags).toContain('Sorting');
  });

  it('parses the exact user screenshot study log with multi-sessions and pacing', () => {
    const rawInput = `Start Study - 8:30 AM
--------------------------------------------------
Session 01 - Time => 8:30 am to 11:30 am
task -> DSA question practise
target questions -> 7 HARDMedian of Two Sorted Arrays69.40.004736972853624943https://leetcode.com/problems/median-of-two-sorted-arrays Divide and Conquer
5MEDIUM3Sum70.40.003969310706550047https://leetcode.com/problems/3sumArray, Two Pointers, Sorting
11EASYLongest Common Prefix67.60.004818721754065003https://leetcode.com/problems/longest-common-prefixArray, String
8MEDIUMLongest Substring Without Repeating Characters69.40.003977943136223824https://leetcode.com/problems/longest-substring-without-repeating-characters String, Sliding Window

September 29, 2026
kunal02 9/29/26, 12:00 AM
15MEDIUMContainer With Most Water63.40.00606482478622991https://leetcode.com/problems/container-with-most-water
16EASYMajority Element62.60.0066486982475450675https://leetcode.com/problems/majority-elementArray, Hash Table, Boyer-Moore Voting Algorithm
180 minutes / 6 questions => 30 mins/Q
--------------------------------------------------
Session 02 - Time => 12:00 pm to 2:30 pm
task -> Web development
kunal02 9/29/26, 12:08 AM
target -> Day 25 -> Javascript complete module
finishing it then move to game activity
revision if possible starting from js after both done`;

    const sessions = parseStudySessions(rawInput);

    expect(sessions.length).toBe(2);

    // Session 01 Assertions
    const s1 = sessions[0];
    expect(s1.sessionNumber).toBe(1);
    expect(s1.sessionTopic).toBe('DSA question practise');
    expect(s1.startTime).toBe('08:30');
    expect(s1.endTime).toBe('11:30');
    expect(s1.durationMinutes).toBe(180);
    expect(s1.targets.length).toBe(6);
    expect(s1.targetPacingMinutes).toBe(30);
    expect(s1.targetUnit).toBe('Q');

    expect(s1.targets[0].difficulty).toBe('HARD');
    expect(s1.targets[0].title).toContain('Median of Two Sorted Arrays');
    expect(s1.targets[1].difficulty).toBe('MEDIUM');
    expect(s1.targets[2].difficulty).toBe('EASY');
    expect(s1.targets[5].difficulty).toBe('EASY');

    // Session 02 Assertions
    const s2 = sessions[1];
    expect(s2.sessionNumber).toBe(2);
    expect(s2.sessionTopic).toBe('Web development');
    expect(s2.startTime).toBe('12:00');
    expect(s2.endTime).toBe('14:30');
    expect(s2.durationMinutes).toBe(150);
    expect(s2.secondaryMilestone).toBe('game activity');
    expect(s2.contingencyGoal).toContain('revision if possible');
    expect(s2.targets.length).toBeGreaterThanOrEqual(1);
  });

  it('converts parsed session to FlowTask Task entity', () => {
    const raw = `Session 01 - Time => 8:30 am to 11:30 am
task -> DSA question practise
15MEDIUMContainer With Most Water https://leetcode.com/problems/container-with-most-water Two Pointers
180 minutes / 1 questions => 180 mins/Q`;

    const sessions = parseStudySessions(raw);
    const task = convertSessionToTask(sessions[0], '2026-10-03', 'work');

    expect(task.title).toBe('Session 01: DSA question practise');
    expect(task.priority).toBe('p1');
    expect(task.scheduledStart).toBe('08:30');
    expect(task.scheduledEnd).toBe('11:30');
    expect(task.estimatedMinutes).toBe(180);
    expect(task.isPinnedToday).toBe(true);
    expect(task.sessionMetadata?.isSession).toBe(true);
    expect(task.sessionMetadata?.targetPacingMinutes).toBe(180);
    expect(task.subtasks.length).toBe(1);
    expect(task.subtasks[0].difficulty).toBe('MEDIUM');
    expect(task.subtasks[0].url).toContain('leetcode.com');
  });
});
