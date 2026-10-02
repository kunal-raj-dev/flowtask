import { describe, it, expect } from 'vitest';
import { parseICSFeed } from './calendarService';

describe('calendarService - parseICSFeed', () => {
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
    expect(roadmapEvent?.startTime).toBe('10:00');
    expect(roadmapEvent?.endTime).toBe('11:00');
    expect(roadmapEvent?.location).toBe('Zoom Room #402');
    expect(roadmapEvent?.description).toContain('Quarterly review of platform architecture');

    const syncEvent = events.find((e) => e.title === '1:1 Sync with Design Lead');
    expect(syncEvent).toBeDefined();
    expect(syncEvent?.startTime).toBe('14:30');
    expect(syncEvent?.endTime).toBe('15:15');

    const holidayEvent = events.find((e) => e.title === 'Company Holiday / Focus Day');
    expect(holidayEvent).toBeDefined();
    expect(holidayEvent?.isAllDay).toBe(true);
  });

  it('handles empty or malformed ICS content gracefully', () => {
    expect(parseICSFeed('')).toEqual([]);
    expect(parseICSFeed('RANDOM STRING WITHOUT VCALENDAR')).toEqual([]);
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
