import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineCanvas } from './TimelineCanvas';
import type { Task, CalendarEvent, Project } from '../../../types/task';

describe('TimelineCanvas Drag and Resize (BUG-12)', () => {
  const mockTask: Task = {
    id: 'task-1',
    title: 'Architect Sprint Engine',
    status: 'todo',
    priority: 'p1',
    projectId: 'work',
    estimatedMinutes: 60,
    scheduledStart: '09:00',
    scheduledEnd: '10:00',
    subtasks: [],
    createdAt: Date.now(),
  };

  const mockProject: Project = {
    id: 'work',
    name: 'Work',
    color: '#3B82F6',
  };

  const defaultProps = {
    startHour: 7,
    endHour: 22,
    hourHeightPx: 80,
    isToday: true,
    calendarEvents: [] as CalendarEvent[],
    scheduledTasks: [{ task: mockTask, startMin: 9 * 60, duration: 60 }],
    todayTasks: [mockTask],
    projects: [mockProject],
    onSelectTask: vi.fn(),
    onToggleTaskStatus: vi.fn(),
    onUpdateTask: vi.fn(),
    onStartFocus: vi.fn(),
    onQuickAdd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders scheduled task block with title, duration, and resize handle', () => {
    render(<TimelineCanvas {...defaultProps} />);

    expect(screen.getByText('Architect Sprint Engine')).toBeDefined();
    expect(screen.getByText('09:00 – 10:00')).toBeDefined();
    expect(screen.getByText('(60m)')).toBeDefined();
    expect(screen.getByTestId('timeline-task-task-1')).toBeDefined();
    expect(screen.getByTestId('timeline-resize-handle-task-1')).toBeDefined();
  });

  it('clicks on a task block to select it when not dragging', () => {
    render(<TimelineCanvas {...defaultProps} />);

    const taskCard = screen.getByTestId('timeline-task-task-1');
    fireEvent.click(taskCard);

    expect(defaultProps.onSelectTask).toHaveBeenCalledWith('task-1');
  });

  it('drags task block up/down snapped to 15-minute intervals and updates scheduledStart', () => {
    render(<TimelineCanvas {...defaultProps} />);

    const taskCard = screen.getByTestId('timeline-task-task-1');

    // Hour height is 80px (80px = 60 mins -> 20px = 15 mins)
    // Moving down by 40px = +30 minutes
    fireEvent.pointerDown(taskCard, { clientY: 100, button: 0 });
    fireEvent.pointerMove(window, { clientY: 140 });
    fireEvent.pointerUp(window);

    expect(defaultProps.onUpdateTask).toHaveBeenCalledWith('task-1', {
      scheduledStart: '09:30',
      scheduledEnd: '10:30',
    });
    // Should NOT trigger onSelectTask after dragging
    fireEvent.click(taskCard);
    expect(defaultProps.onSelectTask).not.toHaveBeenCalled();
  });

  it('resizes task block duration via bottom edge handle in 15-minute increments', () => {
    render(<TimelineCanvas {...defaultProps} />);

    const resizeHandle = screen.getByTestId('timeline-resize-handle-task-1');

    // 80px = 60 mins -> 40px down = +30 minutes, increasing duration from 60m to 90m
    fireEvent.pointerDown(resizeHandle, { clientY: 200, button: 0 });
    fireEvent.pointerMove(window, { clientY: 240 });
    fireEvent.pointerUp(window);

    expect(defaultProps.onUpdateTask).toHaveBeenCalledWith('task-1', {
      estimatedMinutes: 90,
      scheduledEnd: '10:30',
    });
  });

  it('magnetically snaps dragging task to calendar event end boundary', () => {
    const calendarEvents: CalendarEvent[] = [
      {
        id: 'cal-1',
        title: 'Team Standup',
        startTime: '10:00',
        endTime: '10:25',
      },
    ];

    render(<TimelineCanvas {...defaultProps} calendarEvents={calendarEvents} />);

    const taskCard = screen.getByTestId('timeline-task-task-1');

    // Moving from 09:00 to ~10:30 (deltaY = 120px) which is within 10m of 10:25
    fireEvent.pointerDown(taskCard, { clientY: 100, button: 0 });
    fireEvent.pointerMove(window, { clientY: 220 }); // moves ~90 min to 10:30, within 5 min of 10:25
    fireEvent.pointerUp(window);

    expect(defaultProps.onUpdateTask).toHaveBeenCalledWith('task-1', {
      scheduledStart: '10:25',
      scheduledEnd: '11:25',
    });
  });
});
