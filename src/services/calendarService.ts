import type { CalendarEvent } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';

/**
 * Parses raw iCalendar (.ics / RFC 5545) text and extracts events for a target date.
 */
export function parseICSFeed(
  icsContent: string,
  targetDateStr: string = formatLocalDate(new Date())
): CalendarEvent[] {
  if (!icsContent || typeof icsContent !== 'string') return [];

  const rawLines = icsContent.split(/\r\n|\n|\r/);
  const unfoldedLines: string[] = [];

  // 1. Unfold lines (RFC 5545 specifies that long lines can be split by CRLF followed by a space or tab)
  for (let i = 0; i < rawLines.length; i++) {
    const current = rawLines[i];
    if (i > 0 && (current.startsWith(' ') || current.startsWith('\t'))) {
      unfoldedLines[unfoldedLines.length - 1] += current.slice(1);
    } else {
      unfoldedLines.push(current);
    }
  }

  const events: CalendarEvent[] = [];
  let inEvent = false;
  let summary = '';
  let dtstart = '';
  let dtend = '';
  let description = '';
  let location = '';

  for (const line of unfoldedLines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      summary = '';
      dtstart = '';
      dtend = '';
      description = '';
      location = '';
    } else if (trimmed === 'END:VEVENT') {
      if (inEvent && dtstart && summary) {
        const timing = parseICSTiming(dtstart, dtend, targetDateStr);
        if (timing) {
          events.push({
            id: `ics_${Math.random().toString(36).substring(2, 9)}`,
            title: cleanICSString(summary),
            startTime: timing.startTime,
            endTime: timing.endTime,
            description: cleanICSString(description),
            location: cleanICSString(location),
            isAllDay: timing.isAllDay,
          });
        }
      }
      inEvent = false;
    } else if (inEvent) {
      if (trimmed.startsWith('SUMMARY')) {
        summary = extractPropValue(trimmed);
      } else if (trimmed.startsWith('DTSTART')) {
        dtstart = extractPropValue(trimmed);
      } else if (trimmed.startsWith('DTEND')) {
        dtend = extractPropValue(trimmed);
      } else if (trimmed.startsWith('DESCRIPTION')) {
        description = extractPropValue(trimmed);
      } else if (trimmed.startsWith('LOCATION')) {
        location = extractPropValue(trimmed);
      }
    }
  }

  // Sort events chronologically by start time
  return events.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function extractPropValue(line: string): string {
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return '';
  return line.slice(colonIndex + 1);
}

function cleanICSString(val: string): string {
  return val
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Extracts and normalizes start and end times for the target date.
 */
function parseICSTiming(
  dtstartRaw: string,
  dtendRaw: string,
  targetDateStr: string
): { startTime: string; endTime: string; isAllDay: boolean } | null {
  // Check if all-day event: YYYYMMDD
  const isAllDay = !dtstartRaw.includes('T');

  if (isAllDay) {
    if (dtstartRaw.length < 8) return null;
    const year = dtstartRaw.substring(0, 4);
    const month = dtstartRaw.substring(4, 6);
    const day = dtstartRaw.substring(6, 8);
    const eventDateStr = `${year}-${month}-${day}`;

    if (eventDateStr !== targetDateStr) return null;
    return { startTime: '09:00', endTime: '10:00', isAllDay: true };
  }

  // Format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const parts = dtstartRaw.split('T');
  if (parts.length < 2 || parts[0].length < 8) return null;

  const datePart = parts[0];
  const timePart = parts[1].replace('Z', '');

  const year = datePart.substring(0, 4);
  const month = datePart.substring(4, 6);
  const day = datePart.substring(6, 8);
  const eventDateStr = `${year}-${month}-${day}`;

  if (eventDateStr !== targetDateStr) return null;

  const startHour = timePart.substring(0, 2);
  const startMinute = timePart.substring(2, 4) || '00';
  const startTime = `${startHour}:${startMinute}`;

  let endTime = '';
  if (dtendRaw && dtendRaw.includes('T')) {
    const endParts = dtendRaw.split('T');
    const endTimePart = endParts[1].replace('Z', '');
    const endHour = endTimePart.substring(0, 2);
    const endMinute = endTimePart.substring(2, 4) || '00';
    endTime = `${endHour}:${endMinute}`;
  } else {
    // Default 45m duration if no end time
    const endH = (parseInt(startHour, 10) + 1).toString().padStart(2, '0');
    endTime = `${endH}:${startMinute}`;
  }

  return { startTime, endTime, isAllDay: false };
}

/**
 * Fetches and parses an ICS feed from a remote Webcal/HTTPS URL.
 */
export async function fetchICSFeed(
  feedUrl: string,
  targetDateStr: string = formatLocalDate(new Date())
): Promise<CalendarEvent[]> {
  const cleanUrl = feedUrl.trim().replace(/^webcal:\/\//i, 'https://');
  if (!cleanUrl) return [];

  // Try direct fetch first
  try {
    const response = await fetch(cleanUrl);
    if (response.ok) {
      const text = await response.text();
      return parseICSFeed(text, targetDateStr);
    }
  } catch {
    // If CORS or network error, attempt via lightweight CORS proxy
  }

  // Fallback via CORS proxy
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const text = await res.text();
      return parseICSFeed(text, targetDateStr);
    }
  } catch {
    // Both failed
  }

  return [];
}
