import ICAL from 'ical.js';
import type { CalendarEvent } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';

/**
 * Parses raw iCalendar (.ics / RFC 5545) text using standards-compliant ical.js
 * and extracts events for a target date (including recurring instances and timezone offsets).
 */
export function parseICSFeed(
  icsContent: string,
  targetDateStr: string = formatLocalDate(new Date())
): CalendarEvent[] {
  if (!icsContent || typeof icsContent !== 'string' || !icsContent.includes('BEGIN:VCALENDAR')) {
    return [];
  }

  try {
    const jcalData = ICAL.parse(icsContent);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    const targetDateParts = targetDateStr.split('-').map(Number);
    const targetYear = targetDateParts[0];
    const targetMonth = targetDateParts[1];

    const events: CalendarEvent[] = [];

    for (const vevent of vevents) {
      try {
        const event = new ICAL.Event(vevent);
        const uid = event.uid || `ics_${Math.random().toString(36).substring(2, 9)}`;

        if (event.isRecurring()) {
          const iterator = event.iterator();
          let nextTime: ICAL.Time | null;
          // Look up to 100 occurrences or until past target date
          let count = 0;
          while ((nextTime = iterator.next()) && count < 150) {
            count++;
            const occurrenceDateStr = `${nextTime.year}-${String(nextTime.month).padStart(2, '0')}-${String(nextTime.day).padStart(2, '0')}`;
            if (occurrenceDateStr === targetDateStr) {
              const startHour = String(nextTime.hour).padStart(2, '0');
              const startMinute = String(nextTime.minute).padStart(2, '0');
              const startTime = `${startHour}:${startMinute}`;

              let endTime = '';
              if (event.duration) {
                const end = nextTime.clone();
                end.addDuration(event.duration);
                endTime = `${String(end.hour).padStart(2, '0')}:${String(end.minute).padStart(2, '0')}`;
              } else {
                const nextHour = (nextTime.hour + 1) % 24;
                endTime = `${String(nextHour).padStart(2, '0')}:${startMinute}`;
              }

              events.push({
                id: `${uid}_${occurrenceDateStr}`,
                title: event.summary || 'Untitled Event',
                startTime,
                endTime,
                description: event.description || '',
                location: event.location || '',
                isAllDay: nextTime.isDate,
              });
              break;
            }
            if (nextTime.year > targetYear || (nextTime.year === targetYear && nextTime.month > targetMonth)) {
              break;
            }
          }
        } else {
          // Single event
          const startDate = event.startDate;
          if (!startDate) continue;

          const isAllDay = startDate.isDate;
          const eventDateStr = `${startDate.year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;

          // Check if single day matches or multi-day event spans across targetDate
          let matchesDate = eventDateStr === targetDateStr;
          if (!matchesDate && event.endDate) {
            const endDate = event.endDate;
            const targetTime = ICAL.Time.fromDateString(targetDateStr);
            if (startDate.compare(targetTime) <= 0 && endDate.compare(targetTime) >= 0) {
              matchesDate = true;
            }
          }

          if (matchesDate) {
            const startHour = String(startDate.hour).padStart(2, '0');
            const startMinute = String(startDate.minute).padStart(2, '0');
            const startTime = isAllDay ? '09:00' : `${startHour}:${startMinute}`;

            let endTime = '';
            if (event.endDate && !isAllDay) {
              const endHour = String(event.endDate.hour).padStart(2, '0');
              const endMinute = String(event.endDate.minute).padStart(2, '0');
              endTime = `${endHour}:${endMinute}`;
            } else if (isAllDay) {
              endTime = '10:00';
            } else {
              const nextHour = (startDate.hour + 1) % 24;
              endTime = `${String(nextHour).padStart(2, '0')}:${startMinute}`;
            }

            events.push({
              id: uid,
              title: event.summary || 'Untitled Event',
              startTime,
              endTime,
              description: event.description || '',
              location: event.location || '',
              isAllDay,
            });
          }
        }
      } catch (err) {
        console.warn('Skipping unparseable VEVENT:', err);
      }
    }

    return events.sort((a, b) => a.startTime.localeCompare(b.startTime));
  } catch (err) {
    console.warn('Failed to parse ICS with ical.js, trying fallback:', err);
    return [];
  }
}

/**
 * Parses an uploaded local .ics file.
 */
export async function parseICSFile(
  file: File,
  targetDateStr: string = formatLocalDate(new Date())
): Promise<CalendarEvent[]> {
  try {
    const text = await file.text();
    return parseICSFeed(text, targetDateStr);
  } catch (err) {
    console.error('Failed to read local ICS file:', err);
    return [];
  }
}

/**
 * Fetches and parses an ICS feed directly from an HTTPS/Webcal URL without untrusted third-party proxies.
 */
export async function fetchICSFeed(
  feedUrl: string,
  targetDateStr: string = formatLocalDate(new Date())
): Promise<CalendarEvent[]> {
  const cleanUrl = feedUrl.trim().replace(/^webcal:\/\//i, 'https://');
  if (!cleanUrl) return [];

  // Security guard: only HTTPS or HTTP allowed
  if (!cleanUrl.startsWith('https://') && !cleanUrl.startsWith('http://')) {
    console.warn('Blocked non-http(s) calendar URL');
    return [];
  }

  // Direct fetch without public proxy to protect calendar URL privacy
  try {
    const response = await fetch(cleanUrl, {
      headers: {
        Accept: 'text/calendar, text/plain, */*',
      },
    });
    if (response.ok) {
      const text = await response.text();
      return parseICSFeed(text, targetDateStr);
    }
  } catch (err) {
    console.warn('Direct calendar fetch failed (likely CORS on remote feed):', err);
  }

  return [];
}

