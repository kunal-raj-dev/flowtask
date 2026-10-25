import { describe, it, expect, beforeEach } from 'vitest';
import { audioEngine } from './audioEngine';

describe('audioEngine service (FM synthesizer and tactile earcons)', () => {
  beforeEach(() => {
    audioEngine.setSoundEnabled(true);
  });

  it('initializes with sound enabled and defaults', () => {
    expect(audioEngine.getSoundEnabled()).toBe(true);
    expect(audioEngine.getSoundProfile()).toBeDefined();
    expect(audioEngine.getVolume()).toBeGreaterThan(0);
  });

  it('can toggle master sound enabled/disabled', () => {
    audioEngine.setSoundEnabled(false);
    expect(audioEngine.getSoundEnabled()).toBe(false);
    audioEngine.setSoundEnabled(true);
    expect(audioEngine.getSoundEnabled()).toBe(true);
  });

  it('plays task complete arpeggio without error', () => {
    expect(() => audioEngine.playTaskComplete()).not.toThrow();
  });

  it('plays woodblock defer chime without error', () => {
    expect(() => audioEngine.playDeferWoodblock()).not.toThrow();
  });

  it('plays timer chime singing bowl without error', () => {
    expect(() => audioEngine.playTimerChime()).not.toThrow();
  });

  it('plays magnetic snap micro-haptic tick without error', () => {
    expect(() => audioEngine.playMagneticSnap()).not.toThrow();
  });

  it('honors master mute when sound is disabled', () => {
    audioEngine.setSoundEnabled(false);
    expect(() => audioEngine.playTaskComplete()).not.toThrow();
    expect(() => audioEngine.playDeferWoodblock()).not.toThrow();
    expect(() => audioEngine.playTimerChime()).not.toThrow();
    expect(() => audioEngine.playMagneticSnap()).not.toThrow();
  });
});
