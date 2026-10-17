import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { transitionView, isViewTransitionSupported } from './viewTransitions';

describe('viewTransitions', () => {
  let mockStartViewTransition: any;
  let mockMatchMedia: any;

  beforeEach(() => {
    vi.restoreAllMocks();

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
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete document.documentElement.dataset.reducedMotion;
    delete (document as any).startViewTransition;
    delete (window as any).matchMedia;
  });

  it('detects support when startViewTransition is present and reduced motion is false', () => {
    expect(isViewTransitionSupported()).toBe(true);
  });

  it('respects the in-app reduced motion preference independently of the operating system', async () => {
    document.documentElement.dataset.reducedMotion = 'true';
    const callback = vi.fn();
    await transitionView(callback);
    expect(mockStartViewTransition).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('returns false when document.startViewTransition is missing', () => {
    delete (document as any).startViewTransition;
    expect(isViewTransitionSupported()).toBe(false);
  });

  it('returns false when prefers-reduced-motion matches', () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
    }));
    expect(isViewTransitionSupported()).toBe(false);
  });

  it('uses document.startViewTransition when supported', async () => {
    const callback = vi.fn();
    await transitionView(callback);

    expect(mockStartViewTransition).toHaveBeenCalledWith(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('falls back to executing callback directly when startViewTransition is unsupported', async () => {
    delete (document as any).startViewTransition;

    const callback = vi.fn();
    await transitionView(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('falls back to executing callback directly when prefers-reduced-motion is active', async () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
    }));

    const callback = vi.fn();
    await transitionView(callback);

    expect(mockStartViewTransition).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('supports async callbacks returning promises in fallback mode', async () => {
    delete (document as any).startViewTransition;

    let resolved = false;
    await transitionView(async () => {
      await Promise.resolve();
      resolved = true;
    });

    expect(resolved).toBe(true);
  });

  it('handles rejected transition.finished gracefully without throwing', async () => {
    mockStartViewTransition.mockImplementation((cb: () => void) => {
      cb();
      return {
        finished: Promise.reject(new Error('Transition aborted')),
      };
    });

    const callback = vi.fn();
    await expect(transitionView(callback)).resolves.toBeUndefined();
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
