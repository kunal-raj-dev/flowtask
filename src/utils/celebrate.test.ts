import { afterEach, expect, it, vi } from 'vitest';
import confetti from 'canvas-confetti';
import celebrate from './celebrate';
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));
afterEach(() => { delete document.documentElement.dataset.reducedMotion; vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('suppresses canvas motion when the app preference is enabled', () => {
  document.documentElement.dataset.reducedMotion = 'true'; celebrate({ particleCount: 40 }); expect(confetti).not.toHaveBeenCalled();
});
it('suppresses canvas motion when the operating system preference is enabled', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true })); celebrate({ particleCount: 40 }); expect(confetti).not.toHaveBeenCalled();
});
it('keeps celebration feedback when motion is allowed', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false })); celebrate({ particleCount: 40 }); expect(confetti).toHaveBeenCalledWith({ particleCount: 40, disableForReducedMotion: true });
});
