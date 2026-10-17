import { useEffect, useLayoutEffect, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useUIStore } from '../../store/useUIStore';
import { migrateAppearance, resolveAppearanceTheme } from '../../utils/appearance';
import { applyTheme } from '../../utils/themeRegistry';
import { DIURNAL_CONFIGS } from '../../utils/diurnalAura';

export function AppearanceRuntime() {
  const { workspacePreferences, workspaceId, setWorkspacePreference } = useTaskContext();
  const raw = workspacePreferences.appearance;
  const appearance = useMemo(() => {
    let storage: Storage | undefined;
    try { storage = localStorage; } catch { /* Guest falls back to bundled defaults. */ }
    return migrateAppearance(raw, workspaceId, storage);
  }, [raw, workspaceId]);
  useEffect(() => {
    if ((raw as { version?: number } | undefined)?.version !== 2) {
      setWorkspacePreference('appearance', appearance);
      if (workspaceId === 'local') try { localStorage.setItem('flowtask_appearance_legacy_imported', 'true'); } catch { /* Optional cache. */ }
    }
  }, [raw, appearance, workspaceId, setWorkspacePreference]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let signature = '';
    const apply = () => {
      const selected = resolveAppearanceTheme(appearance, new Date(), media.matches);
      if (signature === selected) return;
      signature = selected;
      applyTheme(selected, appearance);
      if (useUIStore.getState().theme !== selected) useUIStore.getState().setTheme(selected);
      root.dataset.appearanceMode = appearance.mode;
      root.dataset.density = appearance.density;
      root.dataset.reducedMotion = String(appearance.reducedMotion);
      root.dataset.highContrast = String(appearance.highContrast);
      const { preset, intensity } = appearance.atmosphere;
      const config = preset !== 'off' ? DIURNAL_CONFIGS[preset] : null;
      root.dataset.atmosphere = preset;
      root.style.setProperty('--diurnal-glow-1', config?.glowColor1 || 'transparent');
      root.style.setProperty('--diurnal-glow-2', config?.glowColor2 || 'transparent');
      root.style.setProperty('--diurnal-intensity', String(config && !appearance.highContrast ? intensity : 0));
    };
    apply();
    // Wall-clock checks handle sleep, DST and timezone changes without persisting automatic transitions.
    const interval = window.setInterval(apply, 1000);
    window.addEventListener('focus', apply);
    window.addEventListener('pageshow', apply);
    document.addEventListener('visibilitychange', apply);
    media.addEventListener('change', apply);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', apply);
      window.removeEventListener('pageshow', apply);
      document.removeEventListener('visibilitychange', apply);
      media.removeEventListener('change', apply);
    };
  }, [appearance]);
  return null;
}
