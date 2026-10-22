import { useCallback, useSyncExternalStore } from 'react';
const subscribe = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener('flowtask:consent-changed', callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener('flowtask:consent-changed', callback); };
};
export function useTelemetryConsent(workspaceId: string) {
  const read = useCallback(() => {
    try { return localStorage.getItem(`flowtask-telemetry-consent:${workspaceId}`) === 'yes'; } catch { return false; }
  }, [workspaceId]);
  return useSyncExternalStore(subscribe, read, () => false);
}
export function setTelemetryConsent(workspaceId: string, enabled: boolean) {
  if (enabled) localStorage.setItem(`flowtask-telemetry-consent:${workspaceId}`, 'yes');
  else localStorage.removeItem(`flowtask-telemetry-consent:${workspaceId}`);
  window.dispatchEvent(new Event('flowtask:consent-changed'));
}
