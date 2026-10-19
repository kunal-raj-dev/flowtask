import { useReducedMotion } from 'framer-motion';
import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-reduced-motion'] });
  return () => observer.disconnect();
};
const snapshot = () => document.documentElement.dataset.reducedMotion === 'true';

export function useMotionPreference() {
  const os = useReducedMotion();
  const app = useSyncExternalStore(subscribe, snapshot, () => false);
  return Boolean(os || app);
}
