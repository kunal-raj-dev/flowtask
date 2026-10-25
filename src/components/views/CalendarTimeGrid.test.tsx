// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarTimeGrid } from './CalendarTimeGrid';
import { TaskContext } from '../../context/TaskContext';
import type { Task, CalendarEvent } from '../../types/task';

describe('CalendarTimeGrid', () => {
  const mockUpdateTask = vi.fn();
  const mockSelectTask = vi.fn();
  const mockStartFocus = vi.fn();

  const testDate = '2026-10-25';

  const sampleTasks: Task[] = [
    {
      id: 'task-unscheduled',
      title: 'Brain dump item 1',
      status: 'todo',
      priority: 'p2',
      projectId: 'inbox',
      plannedDate: testDate,
      estimatedMinutes: 45,
      subtasks: [],
      createdAt: 100,
    },
    {
      id: 'task-scheduled',
      title: 'Deep Focus Morning Block',
      status: 'todo',
      priority: 'p1',
      projectId: 'inbox',
      plannedDate: testDate,
      scheduledStart: '09:00',
      scheduledEnd: '10:30',
      estimatedMinutes: 90,
      subtasks: [],
      createdAt: 200,
    },
  ];

  const sampleCalendarEvents: CalendarEvent[] = [
    {
      id: 'event-1',
      title: 'Team Sync',
      date: testDate,
      startTime: '11:00',
      endTime: '12:00',
    },
  ];

  const defaultContextValue: any = {
    tasks: sampleTasks,
    updateTask: mockUpdateTask,
    calendarEvents: sampleCalendarEvents,
    settings: {
      timelineStartHour: 7,
      timelineEndHour: 22,
      dailyBufferMinutes: 15,
    },
  };

  const renderWithContext = (contextOverrides = {}, props = {}) => {
    return render(
      <TaskContext.Provider value={{ ...defaultContextValue, ...contextOverrides }}>
        <CalendarTimeGrid
          initialDate={testDate}
          onSelectTask={mockSelectTask}
          onStartFocus={mockStartFocus}
          {...props}
        />
      </TaskContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the time grid, shelf, and hour lines', () => {
    renderWithContext();
    expect(screen.getByTestId('calendar-time-grid')).toBeDefined();
    expect(screen.getByTestId('brain-dump-shelf')).toBeDefined();
    expect(screen.getByText('Brain dump item 1')).toBeDefined();
    expect(screen.getByText('Deep Focus Morning Block')).toBeDefined();
    expect(screen.getByText('Team Sync')).toBeDefined();
  });

  it('switches between 1-day, 3-day, and 7-day views', () => {
    renderWithContext();
    const btn3Day = screen.getByRole('button', { name: /^3-day$/i });
    fireEvent.click(btn3Day);

    // Should render 3 day columns
    expect(screen.getByTestId(`calendar-column-${testDate}`)).toBeDefined();
    const nextDate = '2026-10-26';
    expect(screen.getByTestId(`calendar-column-${nextDate}`)).toBeDefined();
  });

  it('toggles snap interval between 15m and 30m', () => {
    renderWithContext();
    const snap30 = screen.getByRole('button', { name: /30m snap/i });
    fireEvent.click(snap30);
    expect(snap30.className).toContain('bg-[var(--color-brand)]');
  });

  it('handles zooming in and zooming out', () => {
    renderWithContext();
    const zoomInBtn = screen.getByRole('button', { name: /Zoom In/i });
    const zoomOutBtn = screen.getByRole('button', { name: /Zoom Out/i });

    expect(screen.getByText('100%')).toBeDefined();
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('125%')).toBeDefined();

    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('calls onSelectTask when clicking a task block', () => {
    renderWithContext();
    const block = screen.getByTestId('grid-block-task-scheduled');
    fireEvent.click(block);
    expect(mockSelectTask).toHaveBeenCalledWith('task-scheduled');
  });

  it('drops unscheduled task into column with magnetic snapping', () => {
    renderWithContext();
    const column = screen.getByTestId(`calendar-column-${testDate}`);

    // Mock getBoundingClientRect on column
    vi.spyOn(column, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 900,
      left: 200,
      right: 600,
      width: 400,
      height: 800,
      x: 200,
      y: 100,
      toJSON: () => {},
    });

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'clientY', { value: 260 });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        getData: (format: string) => (format === 'text/plain' ? 'task-unscheduled' : ''),
      },
    });
    fireEvent(column, dropEvent);

    expect(mockUpdateTask).toHaveBeenCalledWith(
      'task-unscheduled',
      expect.objectContaining({
        plannedDate: testDate,
        scheduledStart: '09:00',
        scheduledEnd: '09:45',
        isSomeday: false,
      })
    );
  });

  it('displays deficit warning banner when tasks exceed available whitespace', () => {
    // 7:00 to 22:00 = 15 hours = 900 min
    // If tasks require 1000 min, deficit banner should render
    const heavyTasks: Task[] = [
      {
        id: 'task-heavy',
        title: 'Overwhelming task',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        plannedDate: testDate,
        scheduledStart: '07:00',
        scheduledEnd: '23:30', // 16.5 hours = 990m
        estimatedMinutes: 990,
        subtasks: [],
        createdAt: 100,
      },
    ];

    renderWithContext({ tasks: heavyTasks });
    expect(screen.getByTestId('deficit-warning-banner')).toBeDefined();
    expect(screen.getByText(/Schedule Deficit/i)).toBeDefined();
  });
});
