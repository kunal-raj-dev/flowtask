/**
 * View Transitions Utility
 *
 * Provides a safe, progressive-enhancement wrapper around the Document View Transitions API.
 * Automatically respects `prefers-reduced-motion: reduce` and falls back gracefully
 * in unsupported browsers or non-browser environments.
 */

export function isViewTransitionSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.dataset.reducedMotion !== 'true' &&
    'startViewTransition' in document &&
    typeof document.startViewTransition === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function transitionView(updateCallback: () => void | Promise<void>): Promise<void> {
  if (isViewTransitionSupported()) {
    try {
      const transition = document.startViewTransition(updateCallback);
      return transition.finished.catch((err) => {
        // Silently handle cancelled or aborted view transitions
        console.debug('[ViewTransitions] Transition aborted or rejected:', err);
      });
    } catch (err) {
      console.warn('[ViewTransitions] startViewTransition threw an error, falling back:', err);
    }
  }

  const result = updateCallback();
  return result instanceof Promise ? result : Promise.resolve();
}
