import { describe, expect, it } from 'vitest';
import { STUDIO_THEME_IDS, studioThemeId, studioThemeTokens, floatingThemeTokens } from './studioAppearance';
import { contrast } from './themeRegistry';

describe('Studio and floating timer appearance', () => {
  it('migrates missing and unknown theme preferences to a neutral palette', () => {
    expect(studioThemeId(undefined)).toBe('graphite');
    expect(studioThemeId('future-theme')).toBe('graphite');
    expect(studioThemeId('porcelain')).toBe('porcelain');
  });
  it.each(STUDIO_THEME_IDS)('%s keeps text, controls and floating content readable', id => {
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
});
