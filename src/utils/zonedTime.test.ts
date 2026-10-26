import { describe, expect, it } from 'vitest';
import { clockInTimezone, wallTimeToInstant, timezoneDayBounds } from './zonedTime';

describe('zoned scheduling times', () => {
  it.each([
    ['Asia/Kolkata', '2026-10-25', '09:00', '2026-10-25T03:30:00.000Z'],
    ['Asia/Kathmandu', '2026-10-25', '09:00', '2026-10-25T03:15:00.000Z'],
    ['Pacific/Kiritimati', '2026-10-25', '00:15', '2026-10-24T10:15:00.000Z'],
    ['UTC', '2026-10-25', '09:00', '2026-10-25T09:00:00.000Z'],
  ])('round-trips %s independently of the device timezone', (zone, date, time, expected) => {
    const instant = wallTimeToInstant(date, time, zone);
    expect(new Date(instant).toISOString()).toBe(expected);
    expect(clockInTimezone(instant, zone)).toEqual({ date, time });
  });
  it('rejects invalid dates, zones, times and a DST gap', () => {
    expect(() => wallTimeToInstant('2026-02-30', '09:00', 'UTC')).toThrow(/valid/);
    expect(() => wallTimeToInstant('2026-10-25', '24:00', 'UTC')).toThrow(/valid/);
    expect(() => wallTimeToInstant('2026-10-25', '09:00', 'Invalid/Zone')).toThrow(/timezone/);
    expect(() => wallTimeToInstant('2026-03-08', '02:30', 'America/New_York')).toThrow(/does not exist/);
  });
  it('requires an explicit choice for the repeated hour', () => {
    expect(() => wallTimeToInstant('2026-11-01', '01:30', 'America/New_York')).toThrow(/twice/);
    expect(new Date(wallTimeToInstant('2026-11-01', '01:30', 'America/New_York', 'earlier')).toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(new Date(wallTimeToInstant('2026-11-01', '01:30', 'America/New_York', 'later')).toISOString()).toBe('2026-11-01T06:30:00.000Z');
  });
  it('measures calendar days over DST changes as 23/25 hours', () => {
    for (const [date, hours] of [['2026-03-08', 23], ['2026-11-01', 25]] as const) {
      const { start, end } = timezoneDayBounds(date, 'America/New_York');
      expect((end - start) / 3_600_000).toBe(hours);
    }
  });
  it('uses the first valid instant when daylight saving skips local midnight', () => {
    const { start, end } = timezoneDayBounds('2026-09-06', 'America/Santiago');
    expect(clockInTimezone(start, 'America/Santiago')).toEqual({ date: '2026-09-06', time: '01:00' });
    expect((end - start) / 3_600_000).toBe(23);
  });
});
