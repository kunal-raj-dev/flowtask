// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  CircadianEnergyCurve,
  calculateCircadianEnergy,
  getCircadianPhase,
  checkCircadianMismatch,
} from './CircadianEnergyCurve';
import type { Task } from '../../types/task';

describe('CircadianEnergyCurve calculations', () => {
  it('calculates expected energy levels across phases of the day', () => {
    // 7:00 morning rise
    const morningEnergy = calculateCircadianEnergy(7);
    expect(morningEnergy).toBeGreaterThanOrEqual(0.35);
    expect(morningEnergy).toBeLessThan(0.7);

    // 10:30 morning peak focus
    const peakEnergy = calculateCircadianEnergy(10.5);
    expect(peakEnergy).toBeGreaterThanOrEqual(0.9);

    // 14:00 afternoon lull
    const lullEnergy = calculateCircadianEnergy(14);
    expect(lullEnergy).toBeLessThan(0.5);

    // 17:30 evening rebound
    const reboundEnergy = calculateCircadianEnergy(17.5);
    expect(reboundEnergy).toBeGreaterThan(0.7);

    // 23:00 wind-down
    const nightEnergy = calculateCircadianEnergy(23);
    expect(nightEnergy).toBeLessThan(0.35);
  });

  it('determines circadian phases correctly', () => {
    expect(getCircadianPhase(8).phase).toBe('wakeup');
    expect(getCircadianPhase(10).phase).toBe('peak');
    expect(getCircadianPhase(10).recommendedLoad).toBe('deep_work');
    expect(getCircadianPhase(14).phase).toBe('lull');
    expect(getCircadianPhase(17).phase).toBe('rebound');
    expect(getCircadianPhase(23).phase).toBe('winddown');
  });

  it('flags deep_work tasks scheduled during afternoon lull', () => {
    // Deep work during 14:00 lull
    const mismatch = checkCircadianMismatch('14:00', 'deep_work');
    expect(mismatch.hasMismatch).toBe(true);
    expect(mismatch.message).toContain('afternoon circadian dip');

    // Deep work during 10:00 peak
    const okDeep = checkCircadianMismatch('10:00', 'deep_work');
    expect(okDeep.hasMismatch).toBe(false);

    // Shallow task during 14:00 lull is totally fine
    const okShallow = checkCircadianMismatch('14:00', 'shallow');
    expect(okShallow.hasMismatch).toBe(false);
  });
});

describe('CircadianEnergyCurve component', () => {
  it('renders SVG curve path', () => {
    render(<CircadianEnergyCurve startHour={7} endHour={22} hourHeight={60} />);
    expect(screen.getByTestId('circadian-energy-curve')).toBeDefined();
  });

  it('shows advisory warning and reschedule button when deep work task is in lull', () => {
    const mockReschedule = vi.fn();
    const tasks: Task[] = [
      {
        id: 'task-deep-1',
        title: 'Compiler Rewrite',
        status: 'todo',
        priority: 'p1',
        projectId: 'work',
        scheduledStart: '14:00',
        cognitiveLoad: 'deep_work',
        subtasks: [],
        createdAt: 100,
      },
    ];

    render(
      <CircadianEnergyCurve
        startHour={7}
        endHour={22}
        tasks={tasks}
        onRescheduleTask={mockReschedule}
      />
    );

    expect(screen.getByTestId('circadian-mismatch-warning')).toBeDefined();
    expect(screen.getByText(/Circadian Lull Alert/i)).toBeDefined();

    const shiftBtn = screen.getByText('Shift to 9:30 AM');
    fireEvent.click(shiftBtn);
    expect(mockReschedule).toHaveBeenCalledWith('task-deep-1', '09:30');
  });
});
