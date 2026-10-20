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

vi.mock('../../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: sampleTasks,
    calendarEvents: [],
    settings: { targetWorkCapacityHours: 6 },
  }),
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
  });

  it('renders progress bar with capacity percentage and completed count', () => {
    render(<TodayFocusProgressBar />);

    expect(screen.getByRole('progressbar', { name: 'Planning capacity used' })).toBeDefined();
    expect(screen.getByText('A DAY THAT FITS')).toBeDefined();
    expect(screen.getByText('1 completed')).toBeDefined();
    expect(screen.getByText('30m focused')).toBeDefined();
  });

  it('renders plan my day trigger when onPlanMyDay callback is provided', () => {
    const onPlan = vi.fn();
    render(<TodayFocusProgressBar onPlanMyDay={onPlan} />);

    const planBtn = screen.getByRole('button', { name: 'Plan my day' });
    fireEvent.click(planBtn);
    expect(onPlan).toHaveBeenCalled();
  });
});
