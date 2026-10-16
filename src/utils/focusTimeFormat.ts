/**
 * Utility functions for formatting focus durations and timer clocks across FlowTask.
 */

/**
 * Formats a duration in seconds to a human-readable focus string:
 * - 5400s -> "1h 30m"
 * - 3600s -> "1h"
 * - 1500s -> "25m"
 * - 45s -> "45s"
 * - 0s -> "0m"
 */
export function formatSecondsToHumanReadable(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
  }
  if (mins > 0) return `${mins}m`;
  return `${secs}s`;
}

/**
 * Formats seconds into a standard digital clock display (MM:SS or HH:MM:SS):
 * - 1500s -> "25:00"
 * - 45s -> "00:45"
 * - 3665s -> "01:01:05"
 */
export function formatTimerClock(totalSeconds: number, forceHours = false): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;

  if (hours > 0 || forceHours) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
