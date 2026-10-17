import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

describe('useWakeLock', () => {
  let mockSentinel: any;
  let mockWakeLockApi: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockSentinel = {
      released: false,
      release: vi.fn().mockImplementation(async function (this: any) {
        this.released = true;
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    mockWakeLockApi = {
      request: vi.fn().mockResolvedValue(mockSentinel),
    };

    Object.defineProperty(navigator, 'wakeLock', {
      value: mockWakeLockApi,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete (navigator as any).wakeLock;
  });

  it('detects wakeLock platform support', () => {
    const { result } = renderHook(() => useWakeLock(false));
    expect(result.current.isSupported).toBe(true);

    delete (navigator as any).wakeLock;
    const { result: unsupportedResult } = renderHook(() => useWakeLock(false));
    expect(unsupportedResult.current.isSupported).toBe(false);
  });

  it('deduplicates in-flight grants and releases a grant arriving after pause', async () => {
    let grant!: (sentinel: any) => void;
    mockWakeLockApi.request.mockReturnValue(new Promise(resolve => { grant = resolve; }));
    const { result, rerender } = renderHook(({enabled}) => useWakeLock(enabled), {initialProps:{enabled:true}});
    act(() => { void result.current.request(); document.dispatchEvent(new Event('visibilitychange')); });
    expect(mockWakeLockApi.request).toHaveBeenCalledTimes(1);
    rerender({enabled:false});
    await act(async () => { grant(mockSentinel); await Promise.resolve(); });
    expect(mockSentinel.release).toHaveBeenCalledTimes(1);
    expect(result.current.isActive).toBe(false);
  });

  it('requests screen wake lock when enabled is true', async () => {
    const { result } = renderHook(() => useWakeLock(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWakeLockApi.request).toHaveBeenCalledWith('screen');
    expect(result.current.isActive).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('does not request wake lock when enabled is false', async () => {
    const { result } = renderHook(() => useWakeLock(false));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWakeLockApi.request).not.toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
  });

  it('releases wake lock when enabled changes from true to false', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useWakeLock(enabled), {
      initialProps: { enabled: true },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isActive).toBe(true);

    rerender({ enabled: false });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockSentinel.release).toHaveBeenCalled();
    expect(result.current.isActive).toBe(false);
  });

  it('releases wake lock on unmount', async () => {
    const { unmount } = renderHook(() => useWakeLock(true));

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(mockSentinel.release).toHaveBeenCalled();
  });

  it('handles visibilitychange to re-acquire wake lock when document becomes visible', async () => {
    renderHook(() => useWakeLock(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockWakeLockApi.request).toHaveBeenCalledTimes(1);

    // Document becomes hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Document becomes visible again
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    // Simulate sentinel having been released when hidden
    mockSentinel.released = true;

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(mockWakeLockApi.request).toHaveBeenCalledTimes(2);
  });

  it('handles NotAllowedError gracefully without throwing', async () => {
    const notAllowedError = new Error('Permission denied');
    notAllowedError.name = 'NotAllowedError';
    mockWakeLockApi.request.mockRejectedValueOnce(notAllowedError);

    const { result } = renderHook(() => useWakeLock(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.error).toEqual(notAllowedError);
  });

  it('handles platform-initiated release event on sentinel', async () => {
    let releaseHandler: (() => void) | undefined;
    mockSentinel.addEventListener.mockImplementation((event: string, handler: () => void) => {
      if (event === 'release') {
        releaseHandler = handler;
      }
    });

    const { result } = renderHook(() => useWakeLock(true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isActive).toBe(true);

    // Platform triggers release (e.g. low power mode)
    act(() => {
      releaseHandler?.();
    });

    expect(result.current.isActive).toBe(false);
  });
});
