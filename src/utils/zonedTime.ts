/** Scheduling wall times are resolved in their IANA zone, independently of the device zone. */
export interface ZonedClock { date: string; time: string }

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timezone: string) {
  let result = formatters.get(timezone);
  if (!result) {
    try {
      result = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      });
    } catch { throw new Error('Choose a valid calendar timezone.'); }
    if (formatters.size >= 32) formatters.clear();
    formatters.set(timezone, result);
  }
  return result;
}

export function clockInTimezone(instant: number, timezone: string): ZonedClock {
  if (!Number.isFinite(instant)) throw new Error('Choose a valid session time.');
  const parts = Object.fromEntries(formatter(timezone).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function isCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const instant = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === date;
}

export function shiftCalendarDate(date: string, days: number): string {
  if (!isCalendarDate(date)) throw new Error('Choose a valid calendar date.');
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Missing/ambiguous DST times require an explicit choice instead of silently moving work. */
export function wallTimeToInstant(
  date: string, time: string, timezone: string,
  ambiguity: 'reject' | 'earlier' | 'later' = 'reject',
): number {
  if (!isCalendarDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error('Choose a valid date and time.');
  }
  const wall = Date.parse(`${date}T${time}:00Z`);
  const offsets = new Set<number>();
  // Sample both sides of zone transitions, including half-hour DST and UTC+14 zones.
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const probe = wall + hours * 3_600_000;
    const local = clockInTimezone(probe, timezone);
    offsets.add(Date.parse(`${local.date}T${local.time}:00Z`) - probe);
  }
  const matches = [...offsets].map(offset => wall - offset).filter(instant => {
    const local = clockInTimezone(instant, timezone);
    return local.date === date && local.time === time;
  }).sort((a, b) => a - b);
  if (!matches.length) throw new Error('This local time does not exist because the clocks change. Choose another time.');
  if (matches.length > 1 && ambiguity === 'reject') {
    throw new Error('This local time occurs twice because the clocks change. Choose an unambiguous time.');
  }
  return ambiguity === 'later' ? matches[matches.length - 1] : matches[0];
}

export function timezoneDayBounds(date: string, timezone: string) {
  // Some zones advance the clock at midnight. A calendar boundary is the
  // first instant of the date, even when 00:00 itself does not exist.
  const boundary = (day: string) => {
    if (!isCalendarDate(day)) throw new Error('Choose a valid calendar date.');
    const wallMinute = Date.parse(`${day}T00:00:00Z`) / 60000;
    let low = wallMinute - 36 * 60, high = wallMinute + 36 * 60;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (clockInTimezone(mid * 60000, timezone).date < day) low = mid + 1;
      else high = mid;
    }
    return low * 60000;
  };
  return { start: boundary(date), end: boundary(shiftCalendarDate(date, 1)) };
}
