import { useEffect, useState } from 'react';
import type { Task } from '../types/task';

const EMPTY_TASKS: Task[] = [];
/** Wake eligibility consumers at the next defer boundary and after a suspended tab resumes. */
export function useTaskAvailabilityClock(tasks: Task[] = EMPTY_TASKS): number {
  const [now, setNow] = useState(() => Date.now());
  // Context adapters may return a fresh array on each render. Depend on the
  // actual boundaries so reconciling the clock cannot cause an effect loop.
  const boundaries = [...new Set(tasks.filter(t => t.deferUntil && !t.deletedAt && !t.archivedAt && t.status !== 'done')
    .map(t => Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(t.deferUntil!) ? `${t.deferUntil}T00:00:00` : t.deferUntil!))
    .filter(Number.isFinite))].sort((a, b) => a - b).join(',');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reconcile = () => {
      clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const future = boundaries.split(',').map(Number).filter(at => at > current);
      if (future.length) timer = setTimeout(reconcile, Math.min(86_400_000, future.reduce((min, at) => Math.min(min, at), Infinity) - current + 1));
    };
    const visible = () => { if (document.visibilityState === 'visible') reconcile(); };
    reconcile();
    window.addEventListener('focus', reconcile);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); window.removeEventListener('focus', reconcile); document.removeEventListener('visibilitychange', visible); };
  }, [boundaries]);
  return now;
}
