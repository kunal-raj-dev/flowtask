import { useEffect, useRef } from 'react';
import { useFocusStore } from '../store/useFocusStore';
import { formatTimerClock } from '../utils/focusTimeFormat';

/**
 * Renders an offscreen 32x32 canvas countdown ring into browser favicon
 * and updates document.title during active focus sessions.
 * Restores original title and favicon on exit or unmount.
 */
export function useFocusTabHUD() {
  const session = useFocusStore((s) => s.focusSession);
  const elapsed = useFocusStore((s) => s.focusElapsedSeconds);

  const initialTitleRef = useRef<string>('');
  const initialFaviconRef = useRef<string>('');

  // Capture initial title and favicon on mount, and restore on unmount
  useEffect(() => {
    if (typeof document === 'undefined') return;

    initialTitleRef.current = document.title || 'FlowTask';

    const faviconLink = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (faviconLink) {
      initialFaviconRef.current = faviconLink.href;
    }

    return () => {
      if (initialTitleRef.current && typeof document !== 'undefined') {
        document.title = initialTitleRef.current;
      }
      const link = typeof document !== 'undefined' ? document.querySelector<HTMLLinkElement>("link[rel*='icon']") : null;
      if (link && initialFaviconRef.current) {
        link.href = initialFaviconRef.current;
      }
    };
  }, []);

  // Update title and favicon dynamically as focus session runs
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // If session is active and running
    if (session && session.state === 'running') {
      const remainingSec =
        session.targetDurationSec > 0
          ? Math.max(0, session.targetDurationSec - elapsed)
          : elapsed;

      const timeStr = formatTimerClock(remainingSec);
      const taskTitle = session.taskTitle || 'Focus';
      document.title = `(${timeStr}) ${taskTitle} - FlowTask`;

      // Render 32x32 offscreen countdown ring to favicon
      if (typeof document.createElement === 'function') {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, 32, 32);

            // Background circle track
            ctx.beginPath();
            ctx.arc(16, 16, 12, 0, 2 * Math.PI);
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.stroke();

            // Progress arc
            const progress =
              session.targetDurationSec > 0
                ? Math.max(0, Math.min(1, 1 - elapsed / session.targetDurationSec))
                : 1;

            ctx.beginPath();
            ctx.arc(16, 16, 12, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress, false);
            ctx.lineWidth = 4;
            ctx.strokeStyle = remainingSec <= 60 ? '#f59e0b' : '#10b981';
            ctx.lineCap = 'round';
            ctx.stroke();

            const dataUrl = canvas.toDataURL('image/png');
            let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = dataUrl;
          }
        } catch {
          // Headless/jsdom without canvas support
        }
      }
    } else {
      // Restore when not running
      if (initialTitleRef.current && document.title !== initialTitleRef.current) {
        document.title = initialTitleRef.current;
      }
      const link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (link && initialFaviconRef.current && link.href !== initialFaviconRef.current) {
        link.href = initialFaviconRef.current;
      }
    }
  }, [session, elapsed]);
}
