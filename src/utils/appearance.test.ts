// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { THEMES, THEME_IDS, contrast, applyTheme, accentTokens } from './themeRegistry';
import { normalizeAppearance, migrateAppearance, resolveAppearanceTheme, DEFAULT_APPEARANCE, scheduleStatus } from './appearance';
import { safePreference, replaceEntities } from '../services/workspaceEntities';
import { createWorkspaceBackup, validateBackupExtras } from './workspaceBackup';
import type { WorkspaceRecord } from '../types/workspace';

const storage = (data: Record<string, string>) => ({ getItem: (key: string) => data[key] ?? null });
describe('complete workspace appearance', () => {
  it.each(THEME_IDS)('%s has complete readable surfaces, semantic states and button foregrounds', id => {
    const t = THEMES[id].tokens;
    for (const surface of ['--bg-main', '--bg-surface-l1', '--bg-surface-l2', '--bg-surface-l3', '--bg-surface-l4']) {
      for (const text of ['--text-primary', '--text-secondary', '--text-muted', '--color-brand', '--pastel-amber', '--pastel-sage', '--pastel-coral', '--pastel-sky', '--pastel-lavender']) expect(contrast(t[text], t[surface]), `${id}: ${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t['--border-strong'], t[surface])).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(t['--text-on-brand'], t['--color-brand'])).toBeGreaterThanOrEqual(4.5);
    expect(t['--bg-surface-l3']).not.toBe(t['--bg-surface-l4']);
  });
  it('removes stale classes, accents and contrast overrides across switches', () => {
    applyTheme('aurora', { accent: '#ff00ff', highContrast: true });
    applyTheme('solar');
    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.classList.contains('theme-aurora')).toBe(false);
    expect(root.dataset.theme).toBe('solar');
    expect(root.style.getPropertyValue('--color-brand')).toBe(THEMES.solar.tokens['--color-brand']);
    expect(root.style.getPropertyValue('--text-primary')).toBe(THEMES.solar.tokens['--text-primary']);
  });
  it('derives coherent readable custom accents including white, black and saturated colors', () => {
    for (const id of THEME_IDS) {
      const t = THEMES[id].tokens, surfaces = ['--bg-main', ...[1,2,3,4].map(i => `--bg-surface-l${i}`)].map(k => t[k]);
      for (const accent of ['#ffffff', '#000000', '#ffff00', '#ff00ff', '#00ff00']) {
        const a = accentTokens(accent, surfaces, THEMES[id].scheme === 'dark');
        expect(surfaces.every(bg => contrast(a['--color-brand'], bg) >= 4.5)).toBe(true);
        expect(contrast(a['--color-brand'], a['--text-on-brand'])).toBeGreaterThanOrEqual(4.5);
        expect(a['--color-focus-ring']).toBe(a['--color-brand']);
      }
    }
  });
  it.each([[0,'abyss'],[5,'abyss'],[6,'solar'],[11,'solar'],[12,'light'],[16,'light'],[17,'desert'],[19,'desert'],[20,'lavender'],[23,'lavender']] as const)('resolves the schedule at local hour %s', (hour, theme) => {
    const prefs = normalizeAppearance({ mode: 'schedule' });
    expect(resolveAppearanceTheme(prefs, new Date(2026, 9, 17, hour, 0))).toBe(theme);
  });
  it('honors manual choice and editable slots over automatic light/dark', () => {
    const date = new Date(2026,9,17,23);
    const prefs = normalizeAppearance({ theme: 'forest', mode: 'manual', schedule: { evening: 'mocha' } });
    expect(resolveAppearanceTheme(prefs, date, true)).toBe('forest');
    expect(resolveAppearanceTheme({ ...prefs, mode: 'schedule' }, date, false)).toBe('mocha');
    expect(resolveAppearanceTheme({ ...prefs, mode: 'system' }, date, false)).toBe('light');
    expect(scheduleStatus(date).next).toBe('00:00');
  });
  it('imports legacy guest values once without enabling a schedule or changing a saved theme', () => {
    const legacy = storage({ flowtask_theme: 'matcha', flowtask_diurnal_override: 'midnight', flowtask_diurnal_intensity: '0' });
    const migrated = migrateAppearance({ theme: 'nord' }, 'local', legacy);
    expect(migrated.theme).toBe('nord');
    expect(migrated.mode).toBe('manual');
    expect(migrated.atmosphere).toEqual({ preset: 'midnight', intensity: 0 });
    expect(migrateAppearance(migrated, 'local', legacy)).toEqual(migrated);
    expect(migrateAppearance(undefined, 'local', storage({ flowtask_diurnal_override: 'auto' })).atmosphere.preset).toBe('off');
    expect(migrateAppearance(undefined, 'account-B', legacy)).toEqual(DEFAULT_APPEARANCE);
    expect(migrateAppearance(undefined, 'local', storage({ flowtask_appearance_legacy_imported: 'true', flowtask_theme: 'matcha' })).theme).toBe('light');
  });
  it('normalizes malformed imports and retains other valid appearance and workspace data', () => {
    const result = validateBackupExtras({ preferences: { appearance: { theme: 'future-theme', mode: 'schedule', schedule: { morning: 'mocha', midnight: '__proto__' }, atmosphere: { preset: '<invalid>', intensity: Infinity }, density: 'compact', accent: '#abcdef' }, otherData: ['retained'] } })!;
    expect(result.preferences.otherData).toEqual(['retained']);
    expect(result.preferences.appearance).toMatchObject({ theme: 'light', mode: 'schedule', density: 'compact', accent: '#abcdef', schedule: { morning: 'mocha', midnight: 'abyss' }, atmosphere: { preset: 'off', intensity: .35 } });
    expect(normalizeAppearance({ atmosphere: { preset: 'aurora', intensity: -2 } }).atmosphere.intensity).toBe(0);
  });
  it('roundtrips appearance through the existing safe sync and backup interfaces', () => {
    const a = normalizeAppearance({ theme: 'aurora', mode: 'schedule', atmosphere: { preset: 'forest', intensity: .7 } });
    expect(safePreference('appearance', a)).toEqual(a);
    const record = { preferences: { appearance: a }, tasks: [], projects: [], customViews: [], dashboards: [] } as unknown as WorkspaceRecord;
    const restored = validateBackupExtras(createWorkspaceBackup(record))!;
    expect(restored.preferences.appearance).toEqual(a);
    const synced = replaceEntities(record, 'preferences', [{ id: 'appearance', value: a }]);
    expect(synced.preferences.appearance).toEqual(a);
  });
});
