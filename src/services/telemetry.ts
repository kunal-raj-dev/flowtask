import { BUILD_ID } from '../utils/buildInfo';

type Metric = 'LCP' | 'INP' | 'CLS' | 'runtime_error' | 'unhandled_rejection';
const VIEWS = new Set(['today', 'inbox', 'timeline', 'upcoming', 'projects', 'project', 'dashboard', 'study', 'review', 'kanban', 'matrix', 'all', 'archive', 'trash', 'someday', 'smart']);
/** No messages, stacks, task IDs, user IDs, URL queries, content or replay are transmitted. */
export function startTelemetry(view: () => string, consent: () => boolean) {
  let closed = false;
  let sent = 0;
  const send = (metric: Metric, value: number) => {
    if (closed || !consent() || import.meta.env.VITE_DIAGNOSTICS_ENABLED !== 'true' || sent >= 20 || !Number.isFinite(value)) return;
    sent++;
    const route = view().split(':')[0];
    const payload = { metric, value: metric === 'CLS' ? Math.round(value * 10000) / 10000 : Math.round(value), build: BUILD_ID.slice(0, 64), view: VIEWS.has(route) ? route : 'other', device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop' };
    void fetch('/api/diagnostics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'omit', keepalive: true }).catch(() => {});
  };
  const error = () => send('runtime_error', 1);
  const rejection = () => send('unhandled_rejection', 1);
  window.addEventListener('error', error);
  window.addEventListener('unhandledrejection', rejection);
  if (consent() && import.meta.env.VITE_DIAGNOSTICS_ENABLED === 'true') {
    void import('web-vitals').then(({ onLCP, onINP, onCLS }) => {
      if (closed || !consent()) return;
      onLCP(metric => send('LCP', metric.value)); onINP(metric => send('INP', metric.value)); onCLS(metric => send('CLS', metric.value));
    }).catch(() => {});
  }
  return () => { closed = true; window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', rejection); };
}
