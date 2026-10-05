import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDiurnalPeriod,
  getDiurnalConfig,
  loadDiurnalOverride,
  saveDiurnalOverride,
  loadDiurnalIntensity,
  saveDiurnalIntensity,
  applyDiurnalToDom,
  DEFAULT_DIURNAL_INTENSITY,
  DIURNAL_CONFIGS,
  type DiurnalPeriod,
} from './diurnalAura';

describe('diurnalAura', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockStorage = {
      getItem: (key: string) => mockStore[key] || null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('determines morning period between 06:00 and 11:59', () => {
    const morning9am = new Date('2026-10-02T09:00:00');
    expect(getDiurnalPeriod('auto', morning9am)).toBe('morning');

    const morning6am = new Date('2026-10-02T06:00:00');
    expect(getDiurnalPeriod('auto', morning6am)).toBe('morning');
  });

  it('determines midday period between 12:00 and 16:59', () => {
    const midday14pm = new Date('2026-10-02T14:30:00');
    expect(getDiurnalPeriod('auto', midday14pm)).toBe('midday');

    const midday12pm = new Date('2026-10-02T12:00:00');
    expect(getDiurnalPeriod('auto', midday12pm)).toBe('midday');
  });

  it('determines golden dusk period between 17:00 and 19:59', () => {
    const dusk18pm = new Date('2026-10-02T18:30:00');
    expect(getDiurnalPeriod('auto', dusk18pm)).toBe('dusk');

    const dusk17pm = new Date('2026-10-02T17:00:00');
    expect(getDiurnalPeriod('auto', dusk17pm)).toBe('dusk');
  });

  it('determines evening period between 20:00 and 23:59', () => {
    const evening20pm = new Date('2026-10-02T20:00:00');
    expect(getDiurnalPeriod('auto', evening20pm)).toBe('evening');

    const evening22pm = new Date('2026-10-02T22:45:00');
    expect(getDiurnalPeriod('auto', evening22pm)).toBe('evening');
  });

  it('determines midnight period between 00:00 and 05:59', () => {
    const lateNight2am = new Date('2026-10-02T02:00:00');
    expect(getDiurnalPeriod('auto', lateNight2am)).toBe('midnight');

    const earlyMidnight = new Date('2026-10-02T00:30:00');
    expect(getDiurnalPeriod('auto', earlyMidnight)).toBe('midnight');
  });

  it('respects manual diurnal overrides for both circadian and thematic flow states', () => {
    const morning9am = new Date('2026-10-02T09:00:00');
    // Circadian overrides
    expect(getDiurnalPeriod('evening', morning9am)).toBe('evening');
    expect(getDiurnalPeriod('midday', morning9am)).toBe('midday');
    expect(getDiurnalPeriod('dusk', morning9am)).toBe('dusk');
    expect(getDiurnalPeriod('midnight', morning9am)).toBe('midnight');

    // Thematic Flow overrides
    expect(getDiurnalPeriod('aurora', morning9am)).toBe('aurora');
    expect(getDiurnalPeriod('solar', morning9am)).toBe('solar');
    expect(getDiurnalPeriod('forest', morning9am)).toBe('forest');
    expect(getDiurnalPeriod('synthwave', morning9am)).toBe('synthwave');
    expect(getDiurnalPeriod('abyss', morning9am)).toBe('abyss');
    expect(getDiurnalPeriod('twilight', morning9am)).toBe('twilight');
  });

  it('returns valid diurnal orb configurations for all 11 periods', () => {
    const periods: DiurnalPeriod[] = [
      'morning',
      'midday',
      'dusk',
      'evening',
      'midnight',
      'aurora',
      'solar',
      'forest',
      'synthwave',
      'abyss',
      'twilight',
    ];

    periods.forEach((period) => {
      const config = getDiurnalConfig(period);
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.subtitle).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.timeTag).toBeTruthy();
      expect(config.glowColor1).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.glowColor2).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.orb1Class).toBeTruthy();
      expect(config.orb2Class).toBeTruthy();
      expect(config.orb3Class).toBeTruthy();
      expect(config.orb4Class).toBeTruthy();
    });
  });

  it('persists and loads diurnal override from localStorage', () => {
    expect(loadDiurnalOverride()).toBe('auto');
    saveDiurnalOverride('morning');
    expect(loadDiurnalOverride()).toBe('morning');
    saveDiurnalOverride('dusk');
    expect(loadDiurnalOverride()).toBe('dusk');
    saveDiurnalOverride('midnight');
    expect(loadDiurnalOverride()).toBe('midnight');
    saveDiurnalOverride('synthwave');
    expect(loadDiurnalOverride()).toBe('synthwave');
    saveDiurnalOverride('aurora');
    expect(loadDiurnalOverride()).toBe('aurora');
    saveDiurnalOverride('auto');
    expect(loadDiurnalOverride()).toBe('auto');
  });

  it('manages diurnal atmosphere intensity with proper clamping and defaults', () => {
    expect(loadDiurnalIntensity()).toBe(DEFAULT_DIURNAL_INTENSITY);

    saveDiurnalIntensity(0.85);
    expect(loadDiurnalIntensity()).toBe(0.85);

    // Clamps below 0.1 to 0.1
    saveDiurnalIntensity(0.02);
    expect(loadDiurnalIntensity()).toBe(0.1);

    // Clamps above 1.0 to 1.0
    saveDiurnalIntensity(1.5);
    expect(loadDiurnalIntensity()).toBe(1.0);
  });

  it('applies diurnal atmosphere styles and attributes to document DOM root', () => {
    applyDiurnalToDom('aurora', 0.75);

    const root = document.documentElement;
    expect(root.getAttribute('data-diurnal')).toBe('aurora');
    expect(root.style.getPropertyValue('--diurnal-glow-1')).toBe(DIURNAL_CONFIGS.aurora.glowColor1);
    expect(root.style.getPropertyValue('--diurnal-glow-2')).toBe(DIURNAL_CONFIGS.aurora.glowColor2);
    expect(root.style.getPropertyValue('--diurnal-intensity')).toBe('0.75');
  });

  it('dispatches diurnal-change CustomEvent with override, period, and intensity details', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    saveDiurnalOverride('solar');
    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('diurnal-change');
    expect(event.detail.override).toBe('solar');
    expect(event.detail.period).toBe('solar');
  });
});
