// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PriorityPickerPopover } from './PriorityPickerPopover';
import { audioEngine } from '../../../utils/audioEngine';

describe('PriorityPickerPopover', () => {
  it('renders all 4 priority options with hotkeys', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <PriorityPickerPopover
        taskId="task-1"
        currentPriority="p3"
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Set Priority')).toBeDefined();
    expect(screen.getByText('Urgent')).toBeDefined();
    expect(screen.getByText('High')).toBeDefined();
    expect(screen.getByText('Medium')).toBeDefined();
    expect(screen.getByText('Low / None')).toBeDefined();
  });

  it('selects priority on click and calls onClose', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const popSpy = vi.spyOn(audioEngine, 'playPopSound');

    render(
      <PriorityPickerPopover
        taskId="task-1"
        currentPriority="p3"
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    const urgentBtn = screen.getByRole('menuitem', { name: /urgent/i });
    fireEvent.click(urgentBtn);

    expect(onSelect).toHaveBeenCalledWith('p1');
    expect(onClose).toHaveBeenCalled();
    expect(popSpy).toHaveBeenCalled();
    popSpy.mockRestore();
  });

  it('selects priority on pressing key 1..4', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <PriorityPickerPopover
        taskId="task-1"
        currentPriority="p3"
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: '2' });
    expect(onSelect).toHaveBeenCalledWith('p2');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <PriorityPickerPopover
        taskId="task-1"
        currentPriority="p3"
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on outside click', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <div>
        <div data-testid="outside">Outside</div>
        <PriorityPickerPopover
          taskId="task-1"
          currentPriority="p3"
          onSelect={onSelect}
          onClose={onClose}
        />
      </div>
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });

  it('auto-focuses current priority on mount and restores previous focus on unmount', () => {
    const prevButton = document.createElement('button');
    document.body.appendChild(prevButton);
    prevButton.focus();
    expect(document.activeElement).toBe(prevButton);

    const { unmount } = render(
      <PriorityPickerPopover
        taskId="task-1"
        currentPriority="p2"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const p2Button = screen.getByRole('menuitem', { name: /high/i });
    expect(document.activeElement).toBe(p2Button);

    unmount();
    expect(document.activeElement).toBe(prevButton);
    document.body.removeChild(prevButton);
  });

  it('supports ArrowDown and ArrowUp navigation across options', () => {
    render(
      <PriorityPickerPopover
        taskId="task-1"
        currentPriority="p1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const p1Button = screen.getByRole('menuitem', { name: /urgent/i });
    const p2Button = screen.getByRole('menuitem', { name: /high/i });
    const p4Button = screen.getByRole('menuitem', { name: /low/i });

    expect(document.activeElement).toBe(p1Button);

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(p2Button);

    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(p1Button);

    // ArrowUp from first wraps to last
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(p4Button);
  });

  it('traps focus with Tab and Shift+Tab', () => {
    render(
      <PriorityPickerPopover
        taskId="task-1"
        currentPriority="p1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const closeButton = screen.getByRole('button', { name: /close priority picker/i });
    const p4Button = screen.getByRole('menuitem', { name: /low/i });

    p4Button.focus();
    expect(document.activeElement).toBe(p4Button);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(p4Button);
  });
});
