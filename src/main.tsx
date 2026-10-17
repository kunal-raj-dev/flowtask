import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/appearance.css'
import { FeatureBoundary } from './components/ui/FeatureBoundary';
const App = lazy(() => import('./App.tsx'));
const WelcomePage = lazy(() => import('./components/views/WelcomePage').then(m => ({default:m.WelcomePage})));
const welcome = window.location.pathname.replace(/\/$/, '') === '/welcome';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeatureBoundary title="FlowTask"><Suspense fallback={<div role="status" style={{padding:40}}>Opening your space…</div>}>{welcome ? <WelcomePage /> : <App />}</Suspense></FeatureBoundary>
  </StrictMode>,
)

// Updates wait for explicit user action, and never interrupt an active focus session.
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  window.dispatchEvent(new CustomEvent('flowtask:update-available'));
});
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then(registration => {
      const notify = () => { if (registration.waiting && navigator.serviceWorker.controller) window.dispatchEvent(new CustomEvent('flowtask:update-available')); };
      notify();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', notify));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void registration.update().catch(() => {}); });
    }).catch(() => {});
  });
}

// Emergency cache clearing helper for diagnostic use
if (typeof window !== 'undefined') {
  (window as unknown as { clearFlowTaskCachesAndReload?: () => Promise<void> }).clearFlowTaskCachesAndReload = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
    window.location.reload();
  };
}

