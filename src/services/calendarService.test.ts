import { describe, it, expect } from 'vitest';
import { parseICSFeed, fetchICSFeed } from './calendarService';

describe('calendarService - parseICSFeed', () => {
  const localTime = (iso: string) => { const date = new Date(iso); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; };
  const sampleICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VEVENT
DTSTART:20261002T100000Z
DTEND:20261002T110000Z
SUMMARY:Q4 Engineering Roadmap Review
DESCRIPTION:Quarterly review of platform architecture\\nand milestones.
LOCATION:Zoom Room #402
END:VEVENT
BEGIN:VEVENT
DTSTART:20261002T143000Z
DTEND:20261002T151500Z
SUMMARY:1:1 Sync with Design Lead
DESCRIPTION:Review Figma tokens and dark mode.
END:VEVENT
BEGIN:VEVENT
DTSTART:20261003T090000Z
DTEND:20261003T100000Z
SUMMARY:Tomorrow Standup
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261002
SUMMARY:Company Holiday / Focus Day
END:VEVENT
END:VCALENDAR`;

  it('filters and parses events specifically for the target date', () => {
    const events = parseICSFeed(sampleICS, '2026-10-02');

    // Should include the two timed events + all day event for 2026-10-02, excluding 2026-10-03
    expect(events.length).toBe(3);

    const roadmapEvent = events.find((e) => e.title === 'Q4 Engineering Roadmap Review');
    expect(roadmapEvent).toBeDefined();
    expect(roadmapEvent?.startTime).toBe(localTime('2026-10-02T10:00:00Z'));
    expect(roadmapEvent?.endTime).toBe(localTime('2026-10-02T11:00:00Z'));
    expect(roadmapEvent?.location).toBe('Zoom Room #402');
    expect(roadmapEvent?.description).toContain('Quarterly review of platform architecture');

    const syncEvent = events.find((e) => e.title === '1:1 Sync with Design Lead');
    expect(syncEvent).toBeDefined();
    expect(syncEvent?.startTime).toBe(localTime('2026-10-02T14:30:00Z'));
    expect(syncEvent?.endTime).toBe(localTime('2026-10-02T15:15:00Z'));

    const holidayEvent = events.find((e) => e.title === 'Company Holiday / Focus Day');
    expect(holidayEvent).toBeDefined();
    expect(holidayEvent?.isAllDay).toBe(true);
  });

  it('handles empty or malformed ICS content gracefully', () => {
    expect(parseICSFeed('')).toEqual([]);
    expect(parseICSFeed('RANDOM STRING WITHOUT VCALENDAR')).toEqual([]);
  });
  it('expands a long-running recurring feed beyond the former 150-occurrence cutoff', () => {
    const events = parseICSFeed('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:daily\nDTSTART:20200101T100000\nDTEND:20200101T110000\nRRULE:FREQ=DAILY\nSUMMARY:Daily practice\nEND:VEVENT\nEND:VCALENDAR', '2026-10-02');
    expect(events).toHaveLength(1); expect(events[0].startTime).toBe('10:00');
  });
  it('clips overnight meetings to the selected local day and treats all-day end dates as exclusive', () => {
    const overnight = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261001T230000\nDTEND:20261002T010000\nSUMMARY:Overnight\nEND:VEVENT\nEND:VCALENDAR';
    expect(parseICSFeed(overnight,'2026-10-02')[0]).toMatchObject({startTime:'00:00',endTime:'01:00'});
    const allDay = 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261002\nDTEND;VALUE=DATE:20261004\nSUMMARY:Two days\nEND:VEVENT\nEND:VCALENDAR';
    expect(parseICSFeed(allDay,'2026-10-03')).toHaveLength(1); expect(parseICSFeed(allDay,'2026-10-04')).toHaveLength(0);
  });

  it('unfolds multi-line ICS headers properly', () => {
    const foldedICS = `BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20261002T090000Z
DTEND:20261002T100000Z
SUMMARY:Long title that has been folded
 across multiple lines in RFC 5545
DESCRIPTION:Description that also spans
 across multiple lines with notes.
END:VEVENT
END:VCALENDAR`;

    const events = parseICSFeed(foldedICS, '2026-10-02');
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Long title that has been foldedacross multiple lines in RFC 5545');
    expect(events[0].description).toBe('Description that also spansacross multiple lines with notes.');
  });
});

describe('calendarService - fetchICSFeed', () => {
  it('returns empty array when feedUrl is empty', async () => {
    const result = await fetchICSFeed('   ');
    expect(result).toEqual([]);
  });

  it('rejects invalid non-http protocols', async () => {
    await expect(fetchICSFeed('ftp://calendar.example.com/feed.ics')).rejects.toThrow(
      'Use an HTTP or HTTPS calendar URL.'
    );
  });

  it('skips disabled calendar sources in fetchMultipleCalendarFeeds', async () => {
    const { fetchMultipleCalendarFeeds } = await import('./calendarService');
    const result = await fetchMultipleCalendarFeeds([
      {
        id: 'cal-1',
        name: 'Work',
        url: 'https://example.com/cal.ics',
        enabled: false,
      },
    ]);
    expect(result.events).toEqual([]);
    expect(result.updatedSources[0].enabled).toBe(false);
  });
});

describe('calendarService - Privacy Shield', () => {
  it('masks confidential details and anonymizes title to Busy', async () => {
    const { createPrivacyShieldEvent } = await import('./calendarService');
    const privateTask = {
      id: 'task-medical',
      title: 'Therapy Appointment with Dr. Stone',
      date: '2026-10-25',
      scheduledStart: '14:00',
      scheduledEnd: '15:00',
      description: 'Confidential therapy session notes',
      location: '123 Health Ave, Suite 400',
    };

    const shielded = createPrivacyShieldEvent(privateTask, { accountType: 'work' });
    expect(shielded.id).toBe('shield-task-medical');
    expect(shielded.title).toBe('Busy');
    expect(shielded.startTime).toBe('14:00');
    expect(shielded.endTime).toBe('15:00');
    expect(shielded.description).toBe('[Shielded work block]');
    expect(shielded.location).toBeUndefined();
  });

  it('supports custom maskTitle and preserves location if requested', async () => {
    const { createPrivacyShieldEvent } = await import('./calendarService');
    const shielded = createPrivacyShieldEvent(
      {
        id: 'ev-1',
        title: 'Confidential Client Architecture Review',
        date: '2026-10-25',
        startTime: '10:00',
        endTime: '11:30',
        location: 'Virtual Room A',
      },
      { maskTitle: 'Focus Time (Hold)', keepLocation: true }
    );

    expect(shielded.title).toBe('Focus Time (Hold)');
    expect(shielded.location).toBe('Virtual Room A');
  });

  it('batch shields events with shieldEventsForExport', async () => {
    const { shieldEventsForExport } = await import('./calendarService');
    const events = [
      { id: '1', title: 'Public Sync', date: '2026-10-25', startTime: '09:00', endTime: '10:00' },
      { id: '2', title: 'Private Doctor', date: '2026-10-25', startTime: '11:00', endTime: '12:00' },
    ];

    const result = shieldEventsForExport(events, (ev) => ev.id === '2');
    expect(result[0].title).toBe('Public Sync');
    expect(result[1].title).toBe('Busy');
  });
});

