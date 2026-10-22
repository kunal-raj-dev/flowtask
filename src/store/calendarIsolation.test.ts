import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from './useTaskStore';
import { useUIStore } from './useUIStore';
import type { CalendarEvent } from '../types/task';

const { fetchFeed, parseFeed } = vi.hoisted(() => ({ fetchFeed: vi.fn(), parseFeed: vi.fn(() => []) }));
vi.mock('../services/calendarService', () => ({ fetchICSFeed: fetchFeed, parseICSFeed: parseFeed }));
const event = (id: string) => ({ id, title: id, startTime: '09:00', endTime: '10:00' }) as CalendarEvent;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const initial = useTaskStore.getState();

describe('calendar account and request boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTaskStore.setState({ store: null, workspaceId: 'account-A', preferences: {}, calendarIcsUrl: 'https://example.com/a.ics', calendarEvents: [] });
    useUIStore.setState({ toast: null });
  });
  afterEach(() => useTaskStore.setState(initial));

  it('ignores an account A feed arriving after switching to B', async () => {
    const feed = deferred<CalendarEvent[]>();
    fetchFeed.mockReturnValueOnce(feed.promise);
    const pending = useTaskStore.getState().refreshCalendarEvents();
    await vi.waitFor(() => expect(fetchFeed).toHaveBeenCalledTimes(1));
    useTaskStore.setState({ workspaceId: 'account-B', calendarIcsUrl: '', calendarEvents: [event('B')] });
    feed.resolve([event('private-A')]); await pending;
    expect(useTaskStore.getState().calendarEvents.map(value => value.id)).toEqual(['B']);
  });

  it('keeps the newest selected day when responses arrive out of order', async () => {
    const old = deferred<CalendarEvent[]>(), latest = deferred<CalendarEvent[]>();
    fetchFeed.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const first = useTaskStore.getState().refreshCalendarEvents('2026-10-20');
    await vi.waitFor(() => expect(fetchFeed).toHaveBeenCalledTimes(1));
    const second = useTaskStore.getState().refreshCalendarEvents('2026-10-21');
    await vi.waitFor(() => expect(fetchFeed).toHaveBeenCalledTimes(2));
    latest.resolve([event('new-day')]); await second;
    old.resolve([event('old-day')]); await first;
    expect(useTaskStore.getState().calendarEvents.map(value => value.id)).toEqual(['feed:new-day']);
  });

  it('does not import a file into the account selected while it was being read', async () => {
    const text = deferred<string>();
    const file = { name: 'a.ics', size: 100, text: () => text.promise } as File;
    const pending = useTaskStore.getState().importCalendarFile(file);
    const rejected = expect(pending).rejects.toThrow('Your workspace changed');
    useTaskStore.setState({ workspaceId: 'account-B', preferences: {} });
    text.resolve('BEGIN:VCALENDAR\nEND:VCALENDAR');
    await rejected;
    expect(useTaskStore.getState().preferences._calendarFile).toBeUndefined();
  });
});
