import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  pictureInPictureService,
  isDocumentPipSupported,
  syncStylesToPipWindow,
} from './pictureInPictureService';
import { useWakeLock } from '../hooks/useWakeLock';
import { transitionView, isViewTransitionSupported } from '../utils/viewTransitions';
import { requestPersistentStorage } from './dbService';
import { updateMediaSessionMetadata, registerMediaSessionHandlers } from './studioAudio';

describe('Milestone M2 Adversarial Stress Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ==========================================
  // 1. Picture-in-Picture Service Stress Tests
  // ==========================================
  describe('pictureInPictureService edge cases', () => {
    afterEach(() => {
      pictureInPictureService.closePipWindow();
      delete (window as any).documentPictureInPicture;
    });

    it('handles completely missing window.documentPictureInPicture', async () => {
      delete (window as any).documentPictureInPicture;

      expect(isDocumentPipSupported()).toBe(false);
      expect(pictureInPictureService.isSupported()).toBe(false);
      expect(pictureInPictureService.isOpen()).toBe(false);
      expect(pictureInPictureService.getPipWindow()).toBeNull();

      await expect(pictureInPictureService.requestPipWindow()).rejects.toThrow(
        'Document Picture-in-Picture is not supported in this browser.'
      );
    });

    it('handles malformed window.documentPictureInPicture (requestWindow is not a function)', async () => {
      (window as any).documentPictureInPicture = { requestWindow: 'not a function' };

      expect(isDocumentPipSupported()).toBe(false);
      expect(pictureInPictureService.isSupported()).toBe(false);
      await expect(pictureInPictureService.requestPipWindow()).rejects.toThrow();
    });

    it('handles requestWindow rejection with NotAllowedError (user denied permission)', async () => {
      const notAllowedErr = new Error('User dismissed picture-in-picture prompt');
      notAllowedErr.name = 'NotAllowedError';

      (window as any).documentPictureInPicture = {
        requestWindow: vi.fn().mockRejectedValue(notAllowedErr),
      };

      await expect(pictureInPictureService.requestPipWindow()).rejects.toThrow(notAllowedErr);
      expect(pictureInPictureService.isOpen()).toBe(false);
      expect(pictureInPictureService.getPipWindow()).toBeNull();
    });

    it('handles syncStylesToPipWindow with empty head and unusual attributes', () => {
      const mockWin: any = {
        document: {
          head: {
            appendChild: vi.fn(),
          },
          body: {
            className: '',
          },
          documentElement: {
            className: '',
            setAttribute: vi.fn(),
            classList: {
              add: vi.fn(),
              contains: vi.fn().mockReturnValue(false),
            },
          },
          title: '',
        },
      };

      // Ensure style syncing does not throw when main document has no stylesheets
      expect(() => syncStylesToPipWindow(mockWin)).not.toThrow();
      expect(mockWin.document.title).toBe('FlowTask Focus HUD');
    });

    it('handles syncStylesToPipWindow when DOM operations throw', () => {
      const mockWin: any = {
        document: {
          head: {
            appendChild: vi.fn().mockImplementation(() => {
              throw new Error('Blocked cross-origin style');
            }),
          },
          documentElement: {
            setAttribute: vi.fn(),
            classList: { add: vi.fn(), contains: vi.fn() },
          },
          body: {},
        },
      };

      const styleEl = document.createElement('style');
      document.head.appendChild(styleEl);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => syncStylesToPipWindow(mockWin)).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();

      document.head.removeChild(styleEl);
    });

    it('closing an already-closed or never-opened PiP window is a safe no-op', () => {
      expect(pictureInPictureService.isOpen()).toBe(false);
      expect(() => pictureInPictureService.closePipWindow()).not.toThrow();
      expect(pictureInPictureService.getPipWindow()).toBeNull();
    });
  });

  // ==========================================
  // 2. Screen Wake Lock Hook Stress Tests
  // ==========================================
  describe('useWakeLock edge cases', () => {
    let mockSentinel: any;
    let mockWakeLockApi: any;

    beforeEach(() => {
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

    it('handles unsupported environment cleanly without requesting or erroring', async () => {
      delete (navigator as any).wakeLock;

      const { result } = renderHook(() => useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isSupported).toBe(false);
      expect(result.current.isActive).toBe(false);
      expect(result.current.error).toBeNull();

      // Explicit manual request should safely no-op
      await act(async () => {
        await result.current.request();
      });
      expect(result.current.isActive).toBe(false);
    });

    it('handles wake lock request rejection with NotAllowedError without uncaught exceptions', async () => {
      const notAllowedErr = new Error('Permission denied by OS/user');
      notAllowedErr.name = 'NotAllowedError';
      mockWakeLockApi.request.mockRejectedValue(notAllowedErr);

      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      const { result } = renderHook(() => useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isSupported).toBe(true);
      expect(result.current.isActive).toBe(false);
      expect(result.current.error).toBe(notAllowedErr);
      expect(debugSpy).toHaveBeenCalledWith('[WakeLock] Request denied or failed:', notAllowedErr.message);
    });

    it('handles multi-cycle visibility changes (visible -> hidden -> visible -> hidden -> visible)', async () => {
      let sentinelReleaseCallback: (() => void) | undefined;
      mockSentinel.addEventListener.mockImplementation((event: string, handler: () => void) => {
        if (event === 'release') {
          sentinelReleaseCallback = handler;
        }
      });

      const { result } = renderHook(() => useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockWakeLockApi.request).toHaveBeenCalledTimes(1);
      expect(result.current.isActive).toBe(true);

      // Cycle 1: tab becomes hidden
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
      act(() => {
        mockSentinel.released = true;
        sentinelReleaseCallback?.();
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current.isActive).toBe(false);

      // Cycle 1: tab returns to visible
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });
      expect(mockWakeLockApi.request).toHaveBeenCalledTimes(2);
      expect(result.current.isActive).toBe(true);

      // Cycle 2: tab becomes hidden again
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
      act(() => {
        mockSentinel.released = true;
        sentinelReleaseCallback?.();
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current.isActive).toBe(false);

      // Cycle 2: tab returns to visible again
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });
      expect(mockWakeLockApi.request).toHaveBeenCalledTimes(3);
      expect(result.current.isActive).toBe(true);
    });

    it('does not attempt wake lock acquisition if initially mounted while document is hidden', async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });

      const { result } = renderHook(() => useWakeLock(true));

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockWakeLockApi.request).not.toHaveBeenCalled();
      expect(result.current.isActive).toBe(false);

      // Now becomes visible
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
      });

      expect(mockWakeLockApi.request).toHaveBeenCalledTimes(1);
      expect(result.current.isActive).toBe(true);
    });

    it('safely handles rapid enabled flapping (true -> false -> true)', async () => {
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
      expect(result.current.isActive).toBe(false);
      expect(mockSentinel.release).toHaveBeenCalled();

      rerender({ enabled: true });
      await act(async () => {
        await Promise.resolve();
      });
      expect(result.current.isActive).toBe(true);
      expect(mockWakeLockApi.request).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================
  // 3. View Transitions Utility Stress Tests
  // ==========================================
  describe('viewTransitions edge cases', () => {
    let mockStartViewTransition: any;
    let mockMatchMedia: any;

    beforeEach(() => {
      mockStartViewTransition = vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return {
          finished: Promise.resolve(),
        };
      });

      Object.defineProperty(document, 'startViewTransition', {
        value: mockStartViewTransition,
        writable: true,
        configurable: true,
      });

      mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
      }));

      Object.defineProperty(window, 'matchMedia', {
        value: mockMatchMedia,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      delete (document as any).startViewTransition;
      delete (window as any).matchMedia;
    });

    it('correctly bypasses startViewTransition when prefers-reduced-motion matches', async () => {
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
      }));

      expect(isViewTransitionSupported()).toBe(false);

      const callback = vi.fn();
      await transitionView(callback);

      expect(mockStartViewTransition).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('falls back seamlessly when window.matchMedia is undefined', async () => {
      delete (window as any).matchMedia;

      expect(isViewTransitionSupported()).toBe(false);

      const callback = vi.fn();
      await transitionView(callback);

      expect(mockStartViewTransition).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('falls back to callback execution when startViewTransition throws synchronously (e.g. InvalidStateError)', async () => {
      mockStartViewTransition.mockImplementation(() => {
        throw new Error('InvalidStateError: Transition already active');
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const callback = vi.fn();

      await transitionView(callback);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ViewTransitions] startViewTransition threw an error'),
        expect.any(Error)
      );
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('handles transition.finished rejecting asynchronously without unhandled promise rejection', async () => {
      const abortErr = new Error('Transition skipped');
      mockStartViewTransition.mockImplementation((cb: () => void) => {
        cb();
        return {
          finished: Promise.reject(abortErr),
        };
      });

      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const callback = vi.fn();

      await expect(transitionView(callback)).resolves.toBeUndefined();
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ViewTransitions] Transition aborted or rejected:'),
        abortErr
      );
    });
  });

  // ==========================================
  // 4. Persistent Storage Request Stress Tests
  // ==========================================
  describe('requestPersistentStorage edge cases', () => {
    it('returns false when navigator.storage is undefined', async () => {
      const originalStorage = navigator.storage;
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await requestPersistentStorage();
      expect(result).toBe(false);

      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        writable: true,
        configurable: true,
      });
    });

    it('returns true directly if storage is already persisted', async () => {
      const mockStorage = {
        persisted: vi.fn().mockResolvedValue(true),
        persist: vi.fn().mockResolvedValue(true),
      };
      Object.defineProperty(navigator, 'storage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const result = await requestPersistentStorage();
      expect(result).toBe(true);
      expect(mockStorage.persisted).toHaveBeenCalledTimes(1);
      expect(mockStorage.persist).not.toHaveBeenCalled();
    });

    it('handles navigator.storage.persist() rejecting with error', async () => {
      const mockStorage = {
        persisted: vi.fn().mockResolvedValue(false),
        persist: vi.fn().mockRejectedValue(new Error('Quota manager failure')),
      };
      Object.defineProperty(navigator, 'storage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await requestPersistentStorage();
      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Storage] Failed to request persistent storage:'),
        expect.any(Error)
      );
    });
  });

  // ==========================================
  // 5. Media Session API Stress Tests
  // ==========================================
  describe('studioAudio MediaSession edge cases', () => {
    it('safely handles missing navigator.mediaSession', () => {
      delete (navigator as any).mediaSession;
      expect(() =>
        updateMediaSessionMetadata({
          title: 'Deep Focus',
        })
      ).not.toThrow();

      expect(() =>
        registerMediaSessionHandlers({
          onPlay: () => {},
        })
      ).not.toThrow();
    });

    it('safely handles setActionHandler throwing for unsupported platform actions', () => {
      const mockMediaSession = {
        metadata: null,
        playbackState: 'none',
        setActionHandler: vi.fn().mockImplementation((action: string) => {
          if (action === 'nexttrack') {
            throw new Error('Unsupported action: nexttrack');
          }
        }),
      };

      Object.defineProperty(navigator, 'mediaSession', {
        value: mockMediaSession,
        writable: true,
        configurable: true,
      });

      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      expect(() =>
        registerMediaSessionHandlers({
          onPlay: vi.fn(),
          onNextTrack: vi.fn(),
        })
      ).not.toThrow();

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MediaSession] Action handler nexttrack not supported:'),
        expect.any(Error)
      );

      delete (navigator as any).mediaSession;
    });
  });
});
