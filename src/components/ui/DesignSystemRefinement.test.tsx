import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MorphCheckbox } from './MorphCheckbox';
import { FocusTimerRing } from './FocusTimerRing';
import { EmptyState } from './EmptyState';
import { audioEngine } from '../../utils/audioEngine';

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    playCompletionChime: vi.fn(),
    playClickSound: vi.fn(),
  },
}));

describe('Design System Refinements (Phase 5)', () => {
  describe('MorphCheckbox', () => {
    it('renders with role="checkbox" and handles toggle click', () => {
      const onChange = vi.fn();
      render(<MorphCheckbox checked={false} onChange={onChange} ariaLabel="Task test" />);

      const checkbox = screen.getByRole('checkbox', { name: 'Task test' });
      expect(checkbox.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(checkbox);
      expect(onChange).toHaveBeenCalledWith(true);
      expect(audioEngine.playCompletionChime).toHaveBeenCalled();
    });

    it('triggers toggle on Space and Enter keydown', () => {
      const onChange = vi.fn();
      render(<MorphCheckbox checked={true} onChange={onChange} ariaLabel="Key test" />);

      const checkbox = screen.getByRole('checkbox', { name: 'Key test' });
      expect(checkbox.getAttribute('aria-checked')).toBe('true');

      fireEvent.keyDown(checkbox, { key: ' ' });
      expect(onChange).toHaveBeenCalledWith(false);

      fireEvent.keyDown(checkbox, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('FocusTimerRing', () => {
    it('renders SVG progress ring and centered children', () => {
      render(
        <FocusTimerRing progressPercent={75} size={100} strokeWidth={8}>
          <span data-testid="ring-clock">15:00</span>
        </FocusTimerRing>
      );

      expect(screen.getByTestId('ring-clock')).toBeDefined();
      expect(screen.getByText('15:00')).toBeDefined();
    });
  });

  describe('EmptyState vector illustrations', () => {
    it('renders zero-inbox vector variant', () => {
      render(
        <EmptyState
          variant="zero-inbox"
          title="All clear for now"
          description="Your inbox is sparkling clean."
        />
      );

      expect(screen.getByTestId('empty-state-zero-inbox')).toBeDefined();
      expect(screen.getByText('All clear for now')).toBeDefined();
      expect(screen.getByText('Your inbox is sparkling clean.')).toBeDefined();
    });

    it('renders day-complete vector variant', () => {
      render(
        <EmptyState
          variant="day-complete"
          title="Day Complete"
          description="You finished all your planned objectives."
        />
      );

      expect(screen.getByTestId('empty-state-day-complete')).toBeDefined();
      expect(screen.getByText('Day Complete')).toBeDefined();
    });

    it('renders no-analytics vector variant', () => {
      render(
        <EmptyState
          variant="no-analytics"
          title="No Analytics Yet"
          description="Start completing tasks to generate velocity telemetry."
        />
      );

      expect(screen.getByTestId('empty-state-no-analytics')).toBeDefined();
      expect(screen.getByText('No Analytics Yet')).toBeDefined();
    });
  });
});
