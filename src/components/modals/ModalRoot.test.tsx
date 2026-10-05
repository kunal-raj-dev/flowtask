// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ModalRoot } from './ModalRoot';
import { ModalProvider, useModal } from '../../context/ModalContext';

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    isAuthModalOpen: false,
    setIsAuthModalOpen: vi.fn(),
    isSmartFilterModalOpen: false,
    setIsSmartFilterModalOpen: vi.fn(),
    isEveningShutdownOpen: false,
    setIsEveningShutdownOpen: vi.fn(),
    isWeeklyReviewOpen: false,
    setIsWeeklyReviewOpen: vi.fn(),
    setSelectedTaskId: vi.fn(),
  }),
}));

const TestTrigger = () => {
  const { openModal } = useModal();
  return (
    <button onClick={() => openModal('shortcuts')}>
      Open Shortcuts
    </button>
  );
};

describe('ModalRoot Component', () => {
  it('closes active modal when Escape key is pressed', async () => {
    render(
      <ModalProvider>
        <TestTrigger />
        <ModalRoot />
      </ModalProvider>
    );

    // Open modal
    await act(async () => {
      fireEvent.click(screen.getByText('Open Shortcuts'));
    });

    // Verify Shortcuts modal rendered (lazy loaded)
    const shortcutsHeading = await screen.findByRole('heading', { name: /keyboard shortcuts/i }, { timeout: 5000 });
    expect(shortcutsHeading).toBeDefined();

    // Press Escape
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    // Should now be closed
    expect(screen.queryByRole('heading', { name: /keyboard shortcuts/i })).toBeNull();
  });
});
