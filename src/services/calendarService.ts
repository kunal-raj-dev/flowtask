import ICAL from 'ical.js';
import type { CalendarEvent } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';

export function parseICSFeed(content: string, targetDateStr = formatLocalDate(new Date())): CalendarEvent[] {
  if (!content || !content.includes('BEGIN:VCALENDAR')) return [];
  const calendar = new ICAL.Component(ICAL.parse(content));
  for (const zone of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(zone);
  const startOfDay = new Date(`${targetDateStr}T00:00:00`), endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const items = calendar.getAllSubcomponents('vevent');
  const events: CalendarEvent[] = [];
  const formatTime = (t: ICAL.Time) => `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  function include(event: ICAL.Event, start: ICAL.Time, end: ICAL.Time, suffix = '') {
    if (event.component.getFirstPropertyValue('status') === 'CANCELLED') return;
    const occurrenceDateStr = `${start.year}-${String(start.month).padStart(2, '0')}-${String(start.day).padStart(2, '0')}`;
    let matches = occurrenceDateStr === targetDateStr;
    if (!matches && end) {
      const targetTime = ICAL.Time.fromDateString(targetDateStr);
      if (start.compare(targetTime) <= 0 && end.compare(targetTime) >= 0) {
        matches = true;
      }
    }
    if (!matches) return;
    events.push({
      id: `${event.uid || 'event'}${suffix}`,
      title: event.summary || 'Untitled event',
      date: targetDateStr,
      startTime: start.isDate ? '09:00' : formatTime(start),
      endTime: start.isDate ? '10:00' : formatTime(end),
      isAllDay: start.isDate,
      description: event.description || '',
      location: event.location || '',
    });
  }
  for (const component of items.filter(item => !item.hasProperty('recurrence-id'))) {
    const event = new ICAL.Event(component);
    if (!event.startDate) continue;
    for (const exception of items.filter(item => item.hasProperty('recurrence-id') && item.getFirstPropertyValue('uid') === event.uid)) event.relateException(exception);
    if (!event.isRecurring()) { include(event, event.startDate, event.endDate); continue; }
    const iterator = event.iterator();
    let count = 0;
    let next: ICAL.Time | null;
    while ((next = iterator.next())) {
      if (++count > 150) break;
      const occurrence = event.getOccurrenceDetails(next);
      include(occurrence.item, occurrence.startDate, occurrence.endDate, `_${next.toString()}`);
    }
  }
  return events.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
export async function parseICSFile(file: File, targetDateStr = formatLocalDate(new Date())) { return parseICSFeed(await file.text(), targetDateStr); }
export async function fetchICSFeed(feedUrl: string, targetDateStr = formatLocalDate(new Date())): Promise<CalendarEvent[]> {
  const cleanUrl = feedUrl.trim().replace(/^webcal:\/\//i, 'https://');
  if (!cleanUrl) return [];
  const parsed = new URL(cleanUrl);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Use an HTTP or HTTPS calendar URL.');
  const response = await fetch(cleanUrl, { headers: { Accept: 'text/calendar, text/plain' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Calendar server returned ${response.status}.`);
  const content = await response.text();
  if (!content.includes('BEGIN:VCALENDAR')) throw new Error('The URL did not return an iCalendar feed.');
  return parseICSFeed(content, targetDateStr);
}
