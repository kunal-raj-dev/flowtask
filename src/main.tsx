import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './index.css'
import { isLandingLocation } from './utils/entryRoute';
import { FeatureBoundary } from './components/ui/FeatureBoundary';
const App = lazy(() => import('./App.tsx'));
const WelcomePage = lazy(() => import('./components/views/WelcomePage').then(m => ({default:m.WelcomePage})));
const welcome = isLandingLocation(window.location);
const help = ['/help', '/privacy', '/data-retention'].includes(window.location.pathname);
const HelpPage = lazy(() => import('./components/views/HelpPage'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeatureBoundary title="FlowTask"><Suspense fallback={<div role="status" style={{padding:40}}>Opening your space…</div>}>{help ? <HelpPage /> : welcome ? <WelcomePage /> : <App />}</Suspense></FeatureBoundary>
  </StrictMode>,
)

// Clean reload on deployment chunk hash mismatch while guarding against infinite loops
window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  window.dispatchEvent(new CustomEvent('flowtask:update-available'));
  try {
    const lastRetry = Number(sessionStorage.getItem('flowtask:preload-retry') || 0);
    const now = Date.now();
    if (now - lastRetry > 15000) {
      sessionStorage.setItem('flowtask:preload-retry', String(now));
      window.location.reload();
      return;
    }
  } catch {
    // sessionStorage may be restricted in sandboxes
  }
});
setTimeout(() => {
  try { sessionStorage.removeItem('flowtask:preload-retry'); } catch {}
}, 5000);
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

