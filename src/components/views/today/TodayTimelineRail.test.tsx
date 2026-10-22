// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TodayTimelineRail } from './TodayTimelineRail';
import type { Task } from '../../../types/task';

const mockUpdateTask = vi.fn();
const mockApplyChanges = vi.fn();

const scheduledTask: Task = {
  id: 'sched-1',
  title: 'Architecture Review',
  status: 'todo',
  priority: 'p1',
  projectId: 'inbox',
  createdAt: 1,
  plannedDate: '2026-10-07',
  scheduledStart: '10:00',
  scheduledEnd: '11:00',
  estimatedMinutes: 60,
  subtasks: [],
};

const unscheduledTask: Task = {
  id: 'unsched-1',
  title: 'Write Docs',
  status: 'todo',
  priority: 'p2',
  projectId: 'inbox',
  createdAt: 2,
  plannedDate: '2026-10-07',
  estimatedMinutes: 30,
  subtasks: [],
};

vi.mock('../../../context/TaskContext', () => ({
  useTaskContext: () => ({
    updateTask: mockUpdateTask, tasks: [scheduledTask, unscheduledTask], calendarEvents: [], settings: { timelineStartHour: 7, timelineEndHour: 22, defaultTaskDuration: 30 }, applyTaskChanges: mockApplyChanges, showToast: vi.fn(), undoLastAction: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-07',
}));

describe('TodayTimelineRail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T08:00:00'));
  });

  afterEach(() => vi.useRealTimers());

  it('renders collapsed state toggle when isOpen is false', () => {
    const onToggle = vi.fn();
    render(
      <TodayTimelineRail
        isOpen={false}
        onToggleCollapse={onToggle}
        tasks={[scheduledTask]}
      />
    );

    const expandBtn = screen.getByRole('button', { name: 'Expand 24h timeline rail' });
    expect(expandBtn).toBeDefined();
    fireEvent.click(expandBtn);
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders 24-hour visual schedule and scheduled task blocks when isOpen is true', () => {
    render(
      <TodayTimelineRail
        isOpen={true}
        onToggleCollapse={vi.fn()}
        tasks={[scheduledTask]}
        calendarEvents={[
          { id: 'cal-1', title: 'Sprint Retrospective', startTime: '14:00', endTime: '15:00', date: '2026-10-07' },
        ]}
      />
    );

    expect(screen.getByText('Today Timeline')).toBeDefined();
    expect(screen.getByText('00:00')).toBeDefined();
    expect(screen.getByText('10:00')).toBeDefined();
    expect(screen.getByText('Architecture Review')).toBeDefined();
    expect(screen.getByText('Sprint Retrospective')).toBeDefined();
  });

  it('handles HTML5 drag and drop snapping to 15-minute grid intervals', () => {
    const { container } = render(
      <TodayTimelineRail
        isOpen={true}
        onToggleCollapse={vi.fn()}
        tasks={[scheduledTask]}
        hourHeightPx={60}
      />
    );

    const canvas = container.querySelector('.overscroll-contain')!;
    expect(canvas).toBeDefined();
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(canvas.getAttribute('aria-label')).toBe('Day timeline schedule');

    // Mock drop event at y = 600px (10:00 AM)
    const dropEvent = {
      preventDefault: vi.fn(),
      currentTarget: {
        getBoundingClientRect: () => ({ top: 0, left: 0, width: 340, height: 1440 }),
      },
      clientY: 610, // 610 / 60 * 60 = 610m -> snaps to 600m (10:00) or 615m (10:15)
      dataTransfer: {
        types: ['application/json'],
        getData: (format: string) => {
          if (format === 'application/json') {
            return JSON.stringify({ taskId: 'dropped-task', duration: 45 });
          }
          return '';
        },
      },
    };

    fireEvent.drop(canvas, dropEvent);

    expect(mockUpdateTask).toHaveBeenCalledWith('dropped-task', expect.objectContaining({
      plannedDate: '2026-10-07',
    }));
  });

  it('previews auto-slot changes and applies one undoable transaction only after review', () => {
    render(
      <TodayTimelineRail
        isOpen={true}
        onToggleCollapse={vi.fn()}
        tasks={[scheduledTask, unscheduledTask]}
      />
    );

    const autoSlotBtn = screen.getByRole('button', { name: 'Auto-Slot Day' });
    fireEvent.click(autoSlotBtn);

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(mockApplyChanges).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Preview schedule' }));
    expect(screen.getByRole('region', { name: 'Schedule preview' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Apply schedule' }));
    expect(mockApplyChanges).toHaveBeenCalledTimes(1);
    expect(mockApplyChanges).toHaveBeenCalledWith([
      { id: 'unsched-1', updates: expect.objectContaining({ plannedDate: '2026-10-07', scheduledStart: '08:15' }) },
    ], 'Apply schedule plan');
  });
});
