import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDiurnalPeriod,
  getDiurnalConfig,
  loadDiurnalOverride,
  saveDiurnalOverride,
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

  it('determines midday period between 12:00 and 17:59', () => {
    const midday14pm = new Date('2026-10-02T14:30:00');
    expect(getDiurnalPeriod('auto', midday14pm)).toBe('midday');

    const midday12pm = new Date('2026-10-02T12:00:00');
    expect(getDiurnalPeriod('auto', midday12pm)).toBe('midday');
  });

  it('determines evening period between 18:00 and 05:59', () => {
    const evening20pm = new Date('2026-10-02T20:00:00');
    expect(getDiurnalPeriod('auto', evening20pm)).toBe('evening');

    const lateNight2am = new Date('2026-10-02T02:00:00');
    expect(getDiurnalPeriod('auto', lateNight2am)).toBe('evening');
  });

  it('respects manual diurnal overrides', () => {
    const morning9am = new Date('2026-10-02T09:00:00');
    expect(getDiurnalPeriod('evening', morning9am)).toBe('evening');
    expect(getDiurnalPeriod('midday', morning9am)).toBe('midday');
  });

  it('returns valid diurnal orb configurations for each period', () => {
    const morningConfig = getDiurnalConfig('morning');
    expect(morningConfig.label).toBe('Morning Dawn');
    expect(morningConfig.orb1Class).toContain('amber');

    const middayConfig = getDiurnalConfig('midday');
    expect(middayConfig.label).toBe('Midday Zenith');
    expect(middayConfig.orb1Class).toContain('indigo');

    const eveningConfig = getDiurnalConfig('evening');
    expect(eveningConfig.label).toBe('Evening Cosmic');
    expect(eveningConfig.orb1Class).toContain('violet');
  });

  it('persists and loads diurnal override from localStorage', () => {
    expect(loadDiurnalOverride()).toBe('auto');
    saveDiurnalOverride('morning');
    expect(loadDiurnalOverride()).toBe('morning');
  });
});
