import { THEMES, type ThemeTokens } from './themeRegistry';

export const STUDIO_THEME_IDS = ['graphite', 'amoled', 'cobalt', 'espresso', 'plum', 'porcelain', 'linen', 'glacier'] as const;
export type StudioThemeId = typeof STUDIO_THEME_IDS[number];
export type FloatingThemeId = StudioThemeId | 'studio';

export function studioThemeId(value: unknown): StudioThemeId {
  return STUDIO_THEME_IDS.includes(value as StudioThemeId) ? value as StudioThemeId : 'graphite';
}

export function normalizePanelOpacity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .96;
}

/** Studio and its floating timer share the same contrast-checked palette roles. */
export function studioThemeTokens(id: StudioThemeId, highContrast = false): ThemeTokens {
  const definition = THEMES[id];
  const t = definition.tokens;
  const dark = definition.scheme === 'dark';
  return {
    '--studio-canvas': t['--bg-main'],
    '--studio-panel': t['--bg-surface-l1'],
    '--studio-raised': t['--bg-surface-l2'],
    '--studio-hover': t['--bg-surface-l3'],
    '--studio-text': highContrast ? dark ? '#ffffff' : '#111111' : t['--text-primary'],
    '--studio-secondary': highContrast ? dark ? '#eeeeee' : '#252525' : t['--text-secondary'],
    '--studio-muted': highContrast ? dark ? '#dddddd' : '#333333' : t['--text-muted'],
    '--studio-border': highContrast ? t['--border-strong'] : t['--border-color'],
    '--studio-control-border': t['--border-strong'],
    '--studio-accent': t['--color-brand'],
    '--studio-on-accent': t['--text-on-brand'],
    '--studio-accent-soft': t['--color-brand-subtle'],
    '--studio-danger': t['--pastel-coral'],
  };
}

export function floatingThemeTokens(id: StudioThemeId, highContrast = false): ThemeTokens {
  const t = studioThemeTokens(id, highContrast);
  const palette = THEMES[id].tokens;
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
