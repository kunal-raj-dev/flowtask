import type { AppearancePreferences } from '../types/studio';
import { isAppTheme, type AppTheme } from './themeRegistry';
import { DIURNAL_CONFIGS, type DiurnalPeriod } from './diurnalAura';

export const SCHEDULE_SLOTS = [
  { id: 'morning', label: 'Morning', time: '06:00–12:00', start: 6, theme: 'solar' },
  { id: 'midday', label: 'Day', time: '12:00–17:00', start: 12, theme: 'light' },
  { id: 'dusk', label: 'Dusk', time: '17:00–20:00', start: 17, theme: 'desert' },
  { id: 'evening', label: 'Evening', time: '20:00–00:00', start: 20, theme: 'lavender' },
  { id: 'midnight', label: 'Night', time: '00:00–06:00', start: 0, theme: 'abyss' },
] as const;
export type ScheduleSlot = typeof SCHEDULE_SLOTS[number]['id'];
export type ThemeSchedule = Record<ScheduleSlot, AppTheme>;
export const DEFAULT_SCHEDULE = Object.fromEntries(SCHEDULE_SLOTS.map(s => [s.id, s.theme])) as ThemeSchedule;
export const DEFAULT_APPEARANCE: AppearancePreferences = {
  version: 2, theme: 'light', mode: 'manual', accent: '', density: 'comfortable',
  reducedMotion: false, highContrast: false, keyboardSounds: false,
  schedule: DEFAULT_SCHEDULE, atmosphere: { preset: 'off', intensity: .35 },
};
const obj = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function normalizeAppearance(value: unknown): AppearancePreferences {
  const a = obj(value), schedule = obj(a.schedule), atmosphere = obj(a.atmosphere);
  return {
    ...DEFAULT_APPEARANCE,
    theme: isAppTheme(a.theme) ? a.theme : 'light',
    mode: a.mode === 'schedule' || a.mode === 'system' ? a.mode : 'manual',
    accent: typeof a.accent === 'string' && /^#[0-9a-f]{6}$/i.test(a.accent) ? a.accent : '',
    density: a.density === 'compact' ? 'compact' : 'comfortable',
    reducedMotion: a.reducedMotion === true, highContrast: a.highContrast === true,
    keyboardSounds: a.keyboardSounds === true,
    schedule: Object.fromEntries(SCHEDULE_SLOTS.map(s => [s.id, isAppTheme(schedule[s.id]) ? schedule[s.id] : s.theme])) as ThemeSchedule,
    atmosphere: {
      preset: typeof atmosphere.preset === 'string' && Object.hasOwn(DIURNAL_CONFIGS, atmosphere.preset) ? atmosphere.preset as DiurnalPeriod : 'off',
      intensity: typeof atmosphere.intensity === 'number' && Number.isFinite(atmosphere.intensity) ? Math.max(0, Math.min(1, atmosphere.intensity)) : .35,
    },
  };
}
/** Legacy device values may be consumed once, and only by the guest workspace. */
export function migrateAppearance(value: unknown, workspaceId: string, storage?: Pick<Storage, 'getItem'>): AppearancePreferences {
  const a = obj(value), normalized = normalizeAppearance(a);
  if (a.version === 2 || workspaceId !== 'local') return normalized;
  try {
    if (!storage || storage.getItem('flowtask_appearance_legacy_imported') === 'true') return normalized;
    const theme = storage.getItem('flowtask_theme');
    if (!isAppTheme(a.theme) && isAppTheme(theme)) normalized.theme = theme;
    const preset = storage.getItem('flowtask_diurnal_override');
    if (!a.atmosphere && preset && Object.hasOwn(DIURNAL_CONFIGS, preset)) {
      normalized.atmosphere.preset = preset as DiurnalPeriod;
      const intensity = storage.getItem('flowtask_diurnal_intensity');
      if (intensity !== null && intensity.trim() && Number.isFinite(Number(intensity))) normalized.atmosphere.intensity = Math.max(0, Math.min(1, Number(intensity)));
    }
  } catch { /* Storage can be unavailable; keep the workspace preferences. */ }
  return normalized;
}
export function scheduleStatus(date = new Date()) {
  const hour = date.getHours();
  const id: ScheduleSlot = hour >= 20 ? 'evening' : hour >= 17 ? 'dusk' : hour >= 12 ? 'midday' : hour >= 6 ? 'morning' : 'midnight';
  const slot = SCHEDULE_SLOTS.find(s => s.id === id)!;
  const next = id === 'morning' ? '12:00' : id === 'midday' ? '17:00' : id === 'dusk' ? '20:00' : id === 'evening' ? '00:00' : '06:00';
  return { slot, next };
}
export function resolveAppearanceTheme(prefs: AppearancePreferences, date = new Date(), systemDark = false): AppTheme {
  return prefs.mode === 'system' ? systemDark ? 'dark' : 'light' : prefs.mode === 'schedule' ? prefs.schedule[scheduleStatus(date).slot.id] : prefs.theme;
}
