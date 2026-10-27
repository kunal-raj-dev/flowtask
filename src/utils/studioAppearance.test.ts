import { describe, expect, it } from 'vitest';
import { STUDIO_THEME_IDS, resolveStudioTheme, studioThemeId, studioThemeTokens, floatingThemeTokens } from './studioAppearance';
import { contrast, THEME_IDS } from './themeRegistry';

describe('Studio and floating timer appearance', () => {
  it('migrates missing and unknown theme preferences to a neutral palette', () => {
    expect(studioThemeId(undefined)).toBe('graphite');
    expect(studioThemeId('future-theme')).toBe('graphite');
    expect(studioThemeId('porcelain')).toBe('porcelain');
  });
  it.each(THEME_IDS)('%s keeps inherited Studio, controls and floating content readable', id => {
    const studio = studioThemeTokens(id);
    for (const role of ['--studio-text','--studio-secondary','--studio-muted','--studio-accent']) {
      for (const background of ['--studio-canvas','--studio-panel','--studio-raised','--studio-hover']) {
        expect(contrast(studio[role], studio[background]), `${id}: ${role} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(contrast(studio['--studio-accent'], studio['--studio-on-accent'])).toBeGreaterThanOrEqual(4.5);
    const floating = floatingThemeTokens(id);
    expect(floating['--pip-text-primary']).toBe(studio['--studio-text']);
    expect(floating['--pip-amber']).toBe(studio['--studio-accent']);
    expect(floatingThemeTokens(id, true)['--pip-scene-opacity']).toBe('0');
  });
  it('follows the resolved app theme by default and preserves custom overrides', () => {
    expect(resolveStudioTheme({ interfaceTheme: 'plum' }, 'forest')).toBe('forest');
    expect(resolveStudioTheme({ themeMode: 'app', interfaceTheme: 'plum' }, 'tokyo')).toBe('tokyo');
    expect(resolveStudioTheme({ themeMode: 'custom', interfaceTheme: 'plum' }, 'forest')).toBe('plum');
    expect(STUDIO_THEME_IDS).toHaveLength(8);
  });
  it.each(['#ffffff', '#000000', '#ff00ff'])('shares a readable custom app accent %s with matching floating timers', accent => {
    for (const theme of THEME_IDS) {
      const studio = studioThemeTokens(theme, false, accent);
      const floating = floatingThemeTokens(theme, false, accent);
      expect(floating['--pip-amber']).toBe(studio['--studio-accent']);
      expect(contrast(studio['--studio-accent'], studio['--studio-on-accent'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(studio['--studio-accent'], studio['--studio-raised'])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
