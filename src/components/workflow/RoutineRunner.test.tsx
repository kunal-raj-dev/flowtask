// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoutineRunner } from './RoutineRunner';
import type { Routine } from '../../types/routine';

describe('RoutineRunner', () => {
  const sampleRoutine: Routine = {
    id: 'routine-morning',
    title: 'Morning Launch Sequence',
    cadence: 'morning',
    steps: [
      { id: 'step-1', title: 'Hydrate & 5 deep breaths', durationMinutes: 2 },
      { id: 'step-2', title: 'Review Top 3 Focus priorities', durationMinutes: 3 },
      { id: 'step-3', title: 'Clear clutter from workspace', durationMinutes: 5 },
    ],
  };

  const mockOnClose = vi.fn();
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders routine runner with first step and non-punitive messaging', () => {
    render(
      <RoutineRunner
        routine={sampleRoutine}
        isOpen={true}
        onClose={mockOnClose}
        onCompleteRoutine={mockOnComplete}
      />
    );

    expect(screen.getByTestId('routine-runner-modal')).toBeDefined();
    expect(screen.getByText('Morning Launch Sequence')).toBeDefined();
    expect(screen.getByText('Hydrate & 5 deep breaths')).toBeDefined();
    expect(screen.getByText(/Ready when you are/i)).toBeDefined();
    expect(screen.getByTestId('routine-step-timer').textContent).toBe('02:00');
  });

  it('progresses through steps and completes routine with celebration', () => {
    render(
      <RoutineRunner
        routine={sampleRoutine}
        isOpen={true}
        onClose={mockOnClose}
        onCompleteRoutine={mockOnComplete}
      />
    );

    const nextBtn = screen.getByTestId('routine-next-btn');

    // Step 1 -> Step 2
    fireEvent.click(nextBtn);
    expect(screen.getByText('Review Top 3 Focus priorities')).toBeDefined();

    // Step 2 -> Step 3
    fireEvent.click(nextBtn);
    expect(screen.getByText('Clear clutter from workspace')).toBeDefined();

    // Step 3 -> Finish
    fireEvent.click(nextBtn);
    expect(screen.getByTestId('routine-completion-view')).toBeDefined();
    expect(screen.getByText(/Routine Complete!/i)).toBeDefined();
    expect(mockOnComplete).toHaveBeenCalledWith('routine-morning');
  });
});
