import { accentTokens, isAppTheme, THEMES, type AppTheme, type ThemeTokens } from './themeRegistry';

export const STUDIO_THEME_IDS = ['graphite', 'amoled', 'cobalt', 'espresso', 'plum', 'porcelain', 'linen', 'glacier'] as const;
export type StudioThemeId = typeof STUDIO_THEME_IDS[number];
export type FloatingThemeId = StudioThemeId | 'studio';

/** Resolve appearance only; switching palettes must never touch the session or scene. */
export function resolveStudioTheme(preferences: { themeMode?: 'app' | 'custom'; interfaceTheme?: unknown }, appTheme: unknown): AppTheme {
  return preferences.themeMode === 'custom' ? studioThemeId(preferences.interfaceTheme) : isAppTheme(appTheme) ? appTheme : 'light';
}

export function studioThemeId(value: unknown): StudioThemeId {
  return STUDIO_THEME_IDS.includes(value as StudioThemeId) ? value as StudioThemeId : 'graphite';
}

export function normalizePanelOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .96;
}

/** Studio and its floating timer share the same contrast-checked palette roles. */
export function studioThemeTokens(id: AppTheme, highContrast = false, accent = ''): ThemeTokens {
  const definition = THEMES[id];
  const dark = definition.scheme === 'dark';
  const t = { ...definition.tokens };
  if (/^#[0-9a-f]{6}$/i.test(accent)) Object.assign(t, accentTokens(accent, [t['--bg-main'], ...[1, 2, 3, 4].map(i => t[`--bg-surface-l${i}`])], dark));
  return {
    '--studio-canvas': t['--bg-main'],
    '--studio-panel': t['--bg-surface-l1'],
    '--studio-raised': t['--bg-surface-l2'],
    '--studio-hover': t['--bg-surface-l3'],
    '--studio-text': highContrast ? dark ? '#ffffff' : '#111111' : t['--text-primary'],
    '--studio-secondary': highContrast ? dark ? '#eeeeee' : '#252525' : t['--text-secondary'],
    '--studio-muted': highContrast ? dark ? '#dddddd' : '#333333' : t['--text-muted'],
    '--studio-border': highContrast ? dark ? '#aaaaaa' : '#666666' : t['--border-color'],
    '--studio-control-border': highContrast ? dark ? '#d4d4d4' : '#444444' : t['--border-strong'],
    '--studio-accent': t['--color-brand'],
    '--studio-on-accent': t['--text-on-brand'],
    '--studio-accent-soft': t['--color-brand-subtle'],
    '--studio-danger': t['--pastel-coral'],
  };
}

export function floatingThemeTokens(id: AppTheme, highContrast = false, accent = ''): ThemeTokens {
  const t = studioThemeTokens(id, highContrast, accent);
  const palette = { ...THEMES[id].tokens };
  if (/^#[0-9a-f]{6}$/i.test(accent)) Object.assign(palette, accentTokens(accent, [palette['--bg-main'], ...[1, 2, 3, 4].map(i => palette[`--bg-surface-l${i}`])], THEMES[id].scheme === 'dark'));
  return {
    '--pip-bg': t['--studio-canvas'], '--pip-surface': t['--studio-raised'],
    '--pip-surface-hover': t['--studio-hover'], '--pip-text-primary': t['--studio-text'],
    '--pip-text-secondary': t['--studio-secondary'], '--pip-text-muted': t['--studio-muted'],
    '--pip-border': t['--studio-border'], '--pip-amber': t['--studio-accent'],
    '--pip-on-accent': t['--studio-on-accent'], '--pip-amber-hover': palette['--color-brand-hover'],
    '--pip-amber-surface': t['--studio-accent-soft'], '--pip-amber-border': palette['--color-brand-border'],
    '--pip-rose': t['--studio-danger'], '--pip-emerald': palette['--pastel-sage'],
    '--pip-scene-opacity': highContrast ? '0' : '.24',
  };
}
