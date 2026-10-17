import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineCanvas } from './TimelineCanvas';
import type { Task, CalendarEvent, Project } from '../../../types/task';

describe('TimelineCanvas Drag Drop and Rest Buffer Rails (Phase 3)', () => {
  const mockTask1: Task = {
    id: 'task-1',
    title: 'Deep Engineering Work',
    status: 'todo',
    priority: 'p1',
    projectId: 'work',
    estimatedMinutes: 60,
    scheduledStart: '10:00',
    scheduledEnd: '11:00',
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
    scheduledTasks: [{ task: mockTask1, startMin: 10 * 60, duration: 60 }],
    todayTasks: [mockTask1],
    projects: [mockProject],
    onSelectTask: vi.fn(),
    onToggleTaskStatus: vi.fn(),
    onUpdateTask: vi.fn(),
    onApplyBatchChanges: vi.fn(),
    onStartFocus: vi.fn(),
    onQuickAdd: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders rest buffer rail for deep tasks (>= 45m)', () => {
    render(<TimelineCanvas {...defaultProps} />);

    const bufferRail = screen.getByTestId('timeline-buffer-task-1');
    expect(bufferRail).toBeDefined();
    expect(screen.getByText(/Rest Buffer \(\+15m\)/i)).toBeDefined();
  });

  it('handles HTML5 task drop from unscheduled sidebar with collision rippling', () => {
    render(<TimelineCanvas {...defaultProps} />);

    const canvasGrid = screen.getByTestId('timeline-canvas-grid');

    // Mock getBoundingClientRect
    vi.spyOn(canvasGrid, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      bottom: 1200,
      right: 800,
      width: 800,
      height: 1200,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Drop task-2 at 10:00 (which collides with task-1 at 10:00-11:00 + 15m buffer)
    // 10:00 is (10 - 7) * 80px = 240px from top
    fireEvent.dragOver(canvasGrid, {
      dataTransfer: {
        types: ['application/json'],
      },
    });

    const dropEvent = new Event('drop', { bubbles: true });
    Object.defineProperty(dropEvent, 'clientY', { value: 240 });
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: {
        types: ['application/json'],
        getData: (format: string) => {
          if (format === 'application/json') {
            return JSON.stringify({ taskId: 'task-2', duration: 45 });
          }
          return '';
        },
      },
    });

    fireEvent(canvasGrid, dropEvent);

    expect(defaultProps.onApplyBatchChanges).toHaveBeenCalled();
    const calls = defaultProps.onApplyBatchChanges.mock.calls[0];
    const updates = calls[0];

    // task-2 should be scheduled at 10:00 - 10:45
    const droppedUpdate = updates.find((u: { id: string }) => u.id === 'task-2');
    expect(droppedUpdate).toBeDefined();
    expect(droppedUpdate.updates.scheduledStart).toBe('10:00');
    expect(droppedUpdate.updates.scheduledEnd).toBe('10:45');

    // task-1 should be rippled down past task-2 + 15m buffer (10:45 + 15m = 11:00)
    const rippledUpdate = updates.find((u: { id: string }) => u.id === 'task-1');
    expect(rippledUpdate).toBeDefined();
    expect(rippledUpdate.updates.scheduledStart).toBe('11:00');
  });
});
