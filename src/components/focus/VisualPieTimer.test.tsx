// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VisualPieTimer } from './VisualPieTimer';

describe('VisualPieTimer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders initial countdown display in minutes and seconds', () => {
    render(<VisualPieTimer initialMinutes={25} taskTitle="Write code review" />);
    expect(screen.getByTestId('timer-display').textContent).toBe('25:00');
    expect(screen.getByText(/Write code review/i)).toBeDefined();
  });

  it('starts counting down when play button is clicked', () => {
    render(<VisualPieTimer initialMinutes={10} />);
    const startBtn = screen.getByTestId('toggle-timer-button');

    fireEvent.click(startBtn);

    act(() => {
      vi.advanceTimersByTime(3000); // 3 seconds
    });

    expect(screen.getByTestId('timer-display').textContent).toBe('09:57');
  });

  it('pauses and resumes countdown', () => {
    render(<VisualPieTimer initialMinutes={5} />);
    const toggleBtn = screen.getByTestId('toggle-timer-button');

    fireEvent.click(toggleBtn);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('timer-display').textContent).toBe('04:58');

    // Pause
    fireEvent.click(toggleBtn);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Should still be 04:58
    expect(screen.getByTestId('timer-display').textContent).toBe('04:58');
  });

  it('launches "Just 10 Minutes" mode with low-pressure timer', () => {
    render(<VisualPieTimer initialMinutes={45} />);
    const just10Btn = screen.getByTestId('just-10-minutes-button');

    fireEvent.click(just10Btn);
    expect(screen.getByTestId('timer-display').textContent).toBe('10:00');
    expect(screen.getByText(/Just 10m Sprint/i)).toBeDefined();
  });

  it('triggers onSessionComplete and shows completion prompt when timer reaches zero', () => {
    const onComplete = vi.fn();
    render(<VisualPieTimer initialMinutes={1} onSessionComplete={onComplete} />);

    fireEvent.click(screen.getByTestId('toggle-timer-button'));

    act(() => {
      vi.advanceTimersByTime(60000); // 60s
    });

    expect(screen.getByTestId('timer-display').textContent).toBe('00:00');
    expect(onComplete).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('completion-prompt')).toBeDefined();
    expect(screen.getByText(/Great start! You broke the inertia./i)).toBeDefined();
  });
});
