import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResetConfirmationDialog } from './ResetConfirmationDialog';

describe('ResetConfirmationDialog', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ResetConfirmationDialog
        isOpen={false}
        onClose={vi.fn()}
        onConfirmSave={vi.fn()}
        onConfirmDiscard={vi.fn()}
        elapsedSeconds={120}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders reset timer dialog with elapsed time and task title', () => {
    render(
      <ResetConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirmSave={vi.fn()}
        onConfirmDiscard={vi.fn()}
        elapsedSeconds={125}
        taskTitle="Build Compiler Frontend"
        phase="focus"
      />
    );

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Reset Current Timer?')).toBeTruthy();
    expect(screen.getByText(/Build Compiler Frontend/)).toBeTruthy();
    expect(screen.getByText('Save time & reset')).toBeTruthy();
    expect(screen.getByText('Discard & reset')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel and continue timer' })).toBeTruthy();
  });

  it('renders round restart labels when isRoundRestart is true', () => {
    render(
      <ResetConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirmSave={vi.fn()}
        onConfirmDiscard={vi.fn()}
        elapsedSeconds={45}
        isRoundRestart={true}
      />
    );

    expect(screen.getByText('Restart Pomodoro Round?')).toBeTruthy();
    expect(screen.getByText('Save time & restart')).toBeTruthy();
    expect(screen.getByText('Discard & restart')).toBeTruthy();
  });

  it('calls onConfirmSave when clicking Save time action', () => {
    const onConfirmSave = vi.fn();
    render(
      <ResetConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirmSave={onConfirmSave}
        onConfirmDiscard={vi.fn()}
        elapsedSeconds={90}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save time/i }));
    expect(onConfirmSave).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirmDiscard when clicking Discard action', () => {
    const onConfirmDiscard = vi.fn();
    render(
      <ResetConfirmationDialog
        isOpen={true}
        onClose={vi.fn()}
        onConfirmSave={vi.fn()}
        onConfirmDiscard={onConfirmDiscard}
        elapsedSeconds={90}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(onConfirmDiscard).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking Cancel button or pressing Escape', () => {
    const onClose = vi.fn();
    render(
      <ResetConfirmationDialog
        isOpen={true}
        onClose={onClose}
        onConfirmSave={vi.fn()}
        onConfirmDiscard={vi.fn()}
        elapsedSeconds={90}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
