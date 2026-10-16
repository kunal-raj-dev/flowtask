import { describe, it, expect } from 'vitest';
import { formatSecondsToHumanReadable, formatTimerClock } from './focusTimeFormat';

describe('focusTimeFormat', () => {
  describe('formatSecondsToHumanReadable', () => {
    it('returns "0m" for non-positive values', () => {
      expect(formatSecondsToHumanReadable(0)).toBe('0m');
      expect(formatSecondsToHumanReadable(-10)).toBe('0m');
    });

    it('formats seconds only when under one minute', () => {
      expect(formatSecondsToHumanReadable(45)).toBe('45s');
      expect(formatSecondsToHumanReadable(1)).toBe('1s');
    });

    it('formats minutes when under one hour', () => {
      expect(formatSecondsToHumanReadable(60)).toBe('1m');
      expect(formatSecondsToHumanReadable(1500)).toBe('25m');
      expect(formatSecondsToHumanReadable(3599)).toBe('59m');
    });

    it('formats hours and minutes when over one hour', () => {
      expect(formatSecondsToHumanReadable(3600)).toBe('1h');
      expect(formatSecondsToHumanReadable(5400)).toBe('1h 30m');
      expect(formatSecondsToHumanReadable(7260)).toBe('2h 1m');
    });
  });

  describe('formatTimerClock', () => {
    it('formats MM:SS correctly when under one hour', () => {
      expect(formatTimerClock(0)).toBe('00:00');
      expect(formatTimerClock(45)).toBe('00:45');
      expect(formatTimerClock(1500)).toBe('25:00');
      expect(formatTimerClock(3599)).toBe('59:59');
    });

    it('formats HH:MM:SS correctly when one hour or greater', () => {
      expect(formatTimerClock(3600)).toBe('01:00:00');
      expect(formatTimerClock(3665)).toBe('01:01:05');
      expect(formatTimerClock(86399)).toBe('23:59:59');
    });

    it('forces hours when forceHours is true', () => {
      expect(formatTimerClock(1500, true)).toBe('00:25:00');
      expect(formatTimerClock(45, true)).toBe('00:00:45');
    });

    it('handles negative or floating values gracefully', () => {
      expect(formatTimerClock(-5)).toBe('00:00');
      expect(formatTimerClock(1500.8)).toBe('25:00');
    });
  });
});
