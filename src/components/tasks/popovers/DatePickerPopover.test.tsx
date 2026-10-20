// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePickerPopover } from './DatePickerPopover';

describe('DatePickerPopover', () => {
  it('renders quick schedule options (Today, Tomorrow, Next Week, Someday) and custom date picker', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Schedule Date')).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('Tomorrow')).toBeDefined();
    expect(screen.getByText('Next Week')).toBeDefined();
    expect(screen.getByText('Someday')).toBeDefined();
    expect(screen.getByText('Pick specific date')).toBeDefined();
  });

  it('selects Today on pressing t', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 't' });
    expect(onSelectDate).toHaveBeenCalledWith(expect.any(String), false);
    expect(onClose).toHaveBeenCalled();
  });

  it('selects Tomorrow on pressing m', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'm' });
    expect(onSelectDate).toHaveBeenCalledWith(expect.any(String), false);
    expect(onClose).toHaveBeenCalled();
  });

  it('selects Next Week on pressing w', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'w' });
    expect(onSelectDate).toHaveBeenCalledWith(expect.any(String), false);
    expect(onClose).toHaveBeenCalled();
  });

  it('selects Someday on pressing n', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'n' });
    expect(onSelectDate).toHaveBeenCalledWith(undefined, true);
    expect(onClose).toHaveBeenCalled();
  });

  it('focuses custom date input on pressing s', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    );

    const dateInput = screen.getByLabelText('Pick specific date');
    fireEvent.keyDown(window, { key: 's' });
    expect(document.activeElement).toBe(dateInput);
  });

  it('calls onSelectDate when custom date input changes', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    );

    const dateInput = screen.getByLabelText('Pick specific date');
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } });

    expect(onSelectDate).toHaveBeenCalledWith('2026-11-15', false);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={onSelectDate}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on outside click', () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();

    render(
      <div>
        <div data-testid="outside">Outside</div>
        <DatePickerPopover
          taskId="task-1"
          onSelectDate={onSelectDate}
          onClose={onClose}
        />
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('auto-focuses first option on mount and restores previous focus on unmount', () => {
    const prevButton = document.createElement('button');
    document.body.appendChild(prevButton);
    prevButton.focus();
    expect(document.activeElement).toBe(prevButton);

    const { unmount } = render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const todayButton = screen.getByRole('menuitem', { name: /today/i });
    expect(document.activeElement).toBe(todayButton);

    unmount();
    expect(document.activeElement).toBe(prevButton);
    document.body.removeChild(prevButton);
  });

  it('supports ArrowDown and ArrowUp navigation between options and date input', () => {
    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const todayBtn = screen.getByRole('menuitem', { name: /today/i });
    const tomorrowBtn = screen.getByRole('menuitem', { name: /tomorrow/i });
    const dateInput = screen.getByLabelText('Pick specific date');

    expect(document.activeElement).toBe(todayBtn);

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tomorrowBtn);

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(todayBtn);

    // ArrowUp from first wraps to date input
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(dateInput);
  });

  it('traps focus with Tab and Shift+Tab', () => {
    render(
      <DatePickerPopover
        taskId="task-1"
        onSelectDate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close date picker/i });
    const dateInput = screen.getByLabelText('Pick specific date');

    dateInput.focus();
    expect(document.activeElement).toBe(dateInput);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(dateInput);
  });
});
