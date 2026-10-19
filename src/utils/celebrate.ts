import confetti from 'canvas-confetti';

/** Canvas effects must respect both motion preferences, just like DOM transitions. */
export default function celebrate(options: Parameters<typeof confetti>[0]) {
  if (typeof window === 'undefined' || document.documentElement.dataset.reducedMotion === 'true' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  return confetti({ ...options, disableForReducedMotion: true });
}
