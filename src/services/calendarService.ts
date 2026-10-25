import ICAL from 'ical.js';
import type { CalendarEvent } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';

export function parseICSFeed(content: string, targetDateStr = formatLocalDate(new Date())): CalendarEvent[] {
  if (!content || !content.includes('BEGIN:VCALENDAR')) return [];
  if (content.length > 2 * 1024 * 1024) throw new Error('Calendar exceeds 2 MB.');
  const calendar = new ICAL.Component(ICAL.parse(content));
  for (const zone of calendar.getAllSubcomponents('vtimezone')) ICAL.TimezoneService.register(zone);
  const startOfDay = new Date(`${targetDateStr}T00:00:00`), endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const items = calendar.getAllSubcomponents('vevent');
  const events: CalendarEvent[] = [];
  const formatTime = (t: ICAL.Time) => { const d = t.toJSDate(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function include(event: ICAL.Event, start: ICAL.Time, end: ICAL.Time, suffix = '') {
    if (event.component.getFirstPropertyValue('status') === 'CANCELLED') return;
    const startDate = start.toJSDate(), endDate = end?.toJSDate() || startDate;
    const occurrenceDateStr = start.isDate ? `${start.year}-${String(start.month).padStart(2, '0')}-${String(start.day).padStart(2, '0')}` : formatLocalDate(startDate);
    const matches = start.isDate ? occurrenceDateStr <= targetDateStr && (!end || end.compare(start) === 0 ? occurrenceDateStr === targetDateStr : `${end.year}-${String(end.month).padStart(2, '0')}-${String(end.day).padStart(2, '0')}` > targetDateStr) : startDate < endOfDay && (endDate > startOfDay || +endDate === +startDate && startDate >= startOfDay);
    if (!matches) return;
    events.push({
      id: `${event.uid || 'event'}${suffix}`,
      title: event.summary || 'Untitled event',
      date: targetDateStr,
      startTime: start.isDate ? '09:00' : startDate < startOfDay ? '00:00' : formatTime(start),
      endTime: start.isDate ? '10:00' : endDate >= endOfDay ? '24:00' : formatTime(end),
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
      if (++count > 100000) throw new Error('Calendar recurrence is too large to expand safely.');
      if (next.toJSDate() >= endOfDay) break;
      const occurrence = event.getOccurrenceDetails(next);
      include(occurrence.item, occurrence.startDate, occurrence.endDate, `_${next.toString()}`);
    }
  }
  return events.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
export async function parseICSFile(file: File, targetDateStr = formatLocalDate(new Date())) { return parseICSFeed(await file.text(), targetDateStr); }
export async function fetchICSFeed(
  feedUrl: string,
  targetDateStr = formatLocalDate(new Date()),
  customProxyUrl?: string
): Promise<CalendarEvent[]> {
  const cleanUrl = feedUrl.trim().replace(/^webcal:\/\//i, 'https://');
  if (!cleanUrl) return [];
  const parsed = new URL(cleanUrl);
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Use an HTTP or HTTPS calendar URL.');

  let response: Response | null = null;


  // 1. Direct fetch attempt
  try {
    response = await fetch(cleanUrl, {
      headers: { Accept: 'text/calendar, text/plain' },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    void err;
  }

  // 2. Fallback via CORS proxy if direct fetch is blocked by browser CORS
  if (!response || !response.ok) {
    const proxiesToTry = [customProxyUrl || import.meta.env.VITE_CALENDAR_PROXY_URL].filter(Boolean) as string[];
    for (const proxy of proxiesToTry) {
      try {
        const proxied = await fetch(proxy, {
          method: 'POST',
          headers: { Accept: 'text/calendar', 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
          signal: AbortSignal.timeout(12000),
        });
        if (proxied.ok) {
          response = proxied;
          break;
        }
      } catch (err) {
        void err;
      }
    }
  }

  if (!response || !response.ok) {
    throw new Error(
      'Calendar could not be loaded directly. Configure your private calendar proxy or import an ICS file.'
    );
  }

  const content = await response.text();
  if (!content.includes('BEGIN:VCALENDAR')) throw new Error('The URL did not return an iCalendar feed.');
  return parseICSFeed(content, targetDateStr);
}

export interface CalendarSource {
  id: string;
  name: string;
  url: string;
  color?: string;
  enabled?: boolean;
  lastSyncedAt?: number;
  error?: string;
}

export async function fetchMultipleCalendarFeeds(
  sources: CalendarSource[],
  targetDateStr = formatLocalDate(new Date()),
  customProxyUrl?: string
): Promise<{
  events: CalendarEvent[];
  updatedSources: CalendarSource[];
}> {
  const allEvents: CalendarEvent[] = [];
  const updatedSources: CalendarSource[] = [];

  for (const source of sources) {
    if (source.enabled === false) {
      updatedSources.push(source);
      continue;
    }

    try {
      const events = await fetchICSFeed(source.url, targetDateStr, customProxyUrl);
      const tagged = events.map((ev) => ({
        ...ev,
        sourceId: source.id,
        sourceName: source.name,
        color: source.color || '#6366f1',
      }));
      allEvents.push(...tagged);
      updatedSources.push({
        ...source,
        lastSyncedAt: Date.now(),
        error: undefined,
      });
    } catch (err) {
      updatedSources.push({
        ...source,
        error: (err as Error).message,
      });
    }
  }

  return {
    events: allEvents.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    updatedSources,
  };
}

export interface PrivacyShieldOptions {
  maskTitle?: string;
  keepLocation?: boolean;
  accountType?: 'work' | 'personal' | 'client';
}

export function createPrivacyShieldEvent(
  eventOrTask: {
    id: string;
    title: string;
    date?: string;
    plannedDate?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    startTime?: string;
    endTime?: string;
    description?: string;
    notes?: string;
    location?: string;
    isPrivate?: boolean;
  },
  options: PrivacyShieldOptions = {}
): CalendarEvent {
  const maskTitle = options.maskTitle || 'Busy';
  const startTime = eventOrTask.startTime || eventOrTask.scheduledStart || '09:00';
  const endTime = eventOrTask.endTime || eventOrTask.scheduledEnd || '10:00';
  const date = eventOrTask.date || eventOrTask.plannedDate || formatLocalDate(new Date());

  return {
    id: `shield-${eventOrTask.id}`,
    title: maskTitle,
    date,
    startTime,
    endTime,
    isAllDay: false,
    description: options.accountType ? `[Shielded ${options.accountType} block]` : '[Shielded calendar block]',
    location: options.keepLocation ? eventOrTask.location : undefined,
  };
}

export function shieldEventsForExport(
  events: CalendarEvent[],
  filterPrivate: (ev: CalendarEvent) => boolean = () => true,
  options: PrivacyShieldOptions = {}
): CalendarEvent[] {
  return events.map((ev) => {
    if (filterPrivate(ev)) {
      return createPrivacyShieldEvent(ev, options);
    }
    return ev;
  });
}

