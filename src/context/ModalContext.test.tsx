// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ModalProvider, useModal } from './ModalContext';

describe('ModalContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ModalProvider>{children}</ModalProvider>
  );

  it('initializes with no active modals', () => {
    const { result } = renderHook(() => useModal(), { wrapper });
    expect(result.current.activeModals).toEqual([]);
    expect(result.current.hasAnyModalOpen).toBe(false);
    expect(result.current.isModalOpen('settings')).toBe(false);
  });

  it('opens and closes a modal correctly', () => {
    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openModal('settings');
    });

    expect(result.current.isModalOpen('settings')).toBe(true);
    expect(result.current.hasAnyModalOpen).toBe(true);

    act(() => {
      result.current.closeModal('settings');
    });

    expect(result.current.isModalOpen('settings')).toBe(false);
    expect(result.current.hasAnyModalOpen).toBe(false);
  });

  it('supports modal stacking without replacing existing modals', () => {
    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openModal('settings');
      result.current.openModal('commandPalette');
    });

    expect(result.current.isModalOpen('settings')).toBe(true);
    expect(result.current.isModalOpen('commandPalette')).toBe(true);
    expect(result.current.activeModals).toContain('settings');
    expect(result.current.activeModals).toContain('commandPalette');

    act(() => {
      result.current.closeModal('commandPalette');
    });

    expect(result.current.isModalOpen('settings')).toBe(true);
    expect(result.current.isModalOpen('commandPalette')).toBe(false);
  });

  it('stores and retrieves modal props', () => {
    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openModal('pomodoro', { taskId: 'task-123' });
    });

    expect(result.current.getModalProps('pomodoro')).toEqual({ taskId: 'task-123' });
  });

  it('closes all modals when closeAllModals is called', () => {
    const { result } = renderHook(() => useModal(), { wrapper });

    act(() => {
      result.current.openModal('settings');
      result.current.openModal('shortcuts');
    });

    expect(result.current.hasAnyModalOpen).toBe(true);

    act(() => {
      result.current.closeAllModals();
    });

    expect(result.current.hasAnyModalOpen).toBe(false);
    expect(result.current.activeModals).toEqual([]);
  });
});
