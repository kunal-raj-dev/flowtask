import * as chrono from 'chrono-node';
import type { ParsedTaskInput, Priority } from '../types/task';

/**
 * Format a Date object to local YYYY-MM-DD string
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object to local HH:mm string
 */
export function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Parses user input in real-time, extracting:
 * - Natural language dates/times via chrono-node
 * - Priority: p1, p2, p3, p4 (or !p1, !urgent)
 * - Project tag: #work, #personal, #errands
 * - Time estimates: ~15m, ~30m, ~1h, ~2h
 */
export function parseTaskInput(input: string): ParsedTaskInput {
  let workingText = input.trim();
  if (!workingText) {
    return { cleanTitle: '' };
  }

  let priority: Priority | undefined;
  let projectTag: string | undefined;
  let estimatedMinutes: number | undefined;
  let dueDate: string | undefined;
  let dueTime: string | undefined;

  // 1. Extract Priority (e.g. p1, p2, p3, p4, !p1, !urgent, !high, !med, !low)
  const priorityRegex = /(?:^|\s)(?:!?(p[1-4])|!(urgent|high|med|medium|low))(?=\s|$)/i;
  const priorityMatch = workingText.match(priorityRegex);
  if (priorityMatch) {
    const rawVal = (priorityMatch[1] || priorityMatch[2]).toLowerCase();
    if (rawVal === 'p1' || rawVal === 'urgent') priority = 'p1';
    else if (rawVal === 'p2' || rawVal === 'high') priority = 'p2';
    else if (rawVal === 'p3' || rawVal === 'med' || rawVal === 'medium') priority = 'p3';
    else if (rawVal === 'p4' || rawVal === 'low') priority = 'p4';

    workingText = workingText.replace(priorityRegex, ' ');
  }

  // 2. Extract Project Tag (e.g. #work, #personal, #reading)
  const projectRegex = /(?:^|\s)#([a-zA-Z0-9_\-]+)(?=\s|$)/;
  const projectMatch = workingText.match(projectRegex);
  if (projectMatch) {
    projectTag = projectMatch[1].toLowerCase();
    workingText = workingText.replace(projectRegex, ' ');
  }

  // 3. Extract Duration Estimate (e.g. ~15m, ~30min, ~1h, ~1.5h, ~2hrs)
  const durationRegex = /(?:^|\s)~([0-9]+(?:\.[0-9]+)?)\s*(m|min|mins|minutes|h|hr|hrs|hours)(?=\s|$)/i;
  const durationMatch = workingText.match(durationRegex);
  if (durationMatch) {
    const val = parseFloat(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();
    if (unit.startsWith('h')) {
      estimatedMinutes = Math.round(val * 60);
    } else {
      estimatedMinutes = Math.round(val);
    }
    workingText = workingText.replace(durationRegex, ' ');
  }

  // 4. Extract Date / Time using Chrono-node
  // Use forwardDate: true so "Monday" refers to the upcoming Monday, not past
  const parsedResults = chrono.parse(workingText, new Date(), { forwardDate: true });
  if (parsedResults.length > 0) {
    const primaryResult = parsedResults[0];
    const parsedDate = primaryResult.start.date();

    dueDate = formatLocalDate(parsedDate);

    // Check if a specific time component was explicitly mentioned (e.g., at 5pm)
    if (primaryResult.start.isCertain('hour')) {
      dueTime = formatLocalTime(parsedDate);
    }

    // Remove the recognized date text from the title
    workingText =
      workingText.substring(0, primaryResult.index) +
      ' ' +
      workingText.substring(primaryResult.index + primaryResult.text.length);
  }

  // Clean up any double spaces and trim
  const cleanTitle = workingText.replace(/\s+/g, ' ').trim();

  return {
    cleanTitle: cleanTitle || input.trim(), // fallback to input if everything was parsed out
    dueDate,
    dueTime,
    priority,
    projectTag,
    estimatedMinutes,
  };
}
