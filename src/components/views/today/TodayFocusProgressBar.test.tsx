// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TodayFocusProgressBar } from './TodayFocusProgressBar';
import type { Task } from '../../../types/task';

const sampleTasks: Task[] = [
  {
    id: 't-1',
    title: 'Work on feature',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    createdAt: 1,
    plannedDate: '2026-10-07',
    estimatedMinutes: 60,
    subtasks: [],
  },
  {
    id: 't-2',
    title: 'Review pull request',
    status: 'done',
    priority: 'p2',
    projectId: 'inbox',
    createdAt: 2,
    plannedDate: '2026-10-07',
    estimatedMinutes: 30,
    subtasks: [],
  },
];

const mockApply = vi.fn();
const mockToast = vi.fn();
const mockUndo = vi.fn();

let mockContextData = {
  tasks: sampleTasks,
  calendarEvents: [] as any[],
  settings: { targetWorkCapacityHours: 6 } as any,
  applyTaskChanges: mockApply,
  showToast: mockToast,
  undoLastAction: mockUndo,
};

vi.mock('../../../context/TaskContext', () => ({
  useTaskContext: () => mockContextData,
}));

vi.mock('../../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-07',
}));

vi.mock('../../../hooks/useTotalFocusedTodaySeconds', () => ({
  useTotalFocusedTodaySeconds: () => 1800,
}));

describe('TodayFocusProgressBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextData = {
      tasks: sampleTasks,
      calendarEvents: [],
      settings: { targetWorkCapacityHours: 6 },
      applyTaskChanges: mockApply,
      showToast: mockToast,
      undoLastAction: mockUndo,
    };
  });

  it('renders progress bar with capacity percentage, completed count, and finish-time projection', () => {
    render(<TodayFocusProgressBar />);

    expect(screen.getByRole('progressbar', { name: 'Planning capacity used' })).toBeDefined();
    const details = screen.getByLabelText('Day capacity details').closest('details')!;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByLabelText('Day capacity details'));
    expect(screen.getByText('A DAY THAT FITS')).toBeDefined();
    expect(screen.getByText('1 completed')).toBeDefined();
    expect(screen.getByText('30m focused')).toBeDefined();
    expect(screen.getByText(/Estimated finish/i)).toBeDefined();
  });

  it('renders plan my day trigger when onPlanMyDay callback is provided', () => {
    const onPlan = vi.fn();
    render(<TodayFocusProgressBar onPlanMyDay={onPlan} />);
    fireEvent.click(screen.getByLabelText('Day capacity details'));

    const planBtn = screen.getByRole('button', { name: 'Plan my day' });
    fireEvent.click(planBtn);
    expect(onPlan).toHaveBeenCalled();
  });

  it('renders Balance Day button when overbooked and rolls over surplus tasks to tomorrow', () => {
    const overbookedTasks: Task[] = [
      {
        id: 't-heavy',
        title: 'Massive Project Task',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: 1,
        plannedDate: '2026-10-07',
        estimatedMinutes: 300,
        subtasks: [],
      },
      {
        id: 't-low',
        title: 'Low Priority Minor Chore',
        status: 'todo',
        priority: 'p4',
        projectId: 'inbox',
        createdAt: 2,
        plannedDate: '2026-10-07',
        estimatedMinutes: 60,
        subtasks: [],
      },
    ];

    mockContextData = {
      tasks: overbookedTasks,
      calendarEvents: [],
      settings: { targetWorkCapacityHours: 4 }, // 240m capacity, 360m demand -> overbooked by 120m
      applyTaskChanges: mockApply,
      showToast: mockToast,
      undoLastAction: mockUndo,
    };

    render(<TodayFocusProgressBar />);

    expect(screen.getByText(/Overbooked by/i)).toBeDefined();
    const balanceBtn = screen.getByRole('button', { name: 'Balance Day' });
    expect(balanceBtn).toBeDefined();

    fireEvent.click(balanceBtn);
    expect(mockApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Move 2 tasks to tomorrow/ }));
    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(mockApply).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 't-low', updates: expect.objectContaining({ plannedDate: '2026-10-08' }) }),
    ]), 'Balance daily plan');
    expect(mockToast).toHaveBeenCalledWith(expect.any(String), 'Undo', mockUndo);
  });
});
