import { describe, it, expect, vi, afterEach } from 'vitest';
import { audioEngine } from './audioEngine';

describe('audioEngine enhancements', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes playTaskComplete as an alias for playCompletionChime', () => {
    const spy = vi.spyOn(audioEngine, 'playCompletionChime').mockImplementation(() => {});
    audioEngine.playTaskComplete();
    expect(spy).toHaveBeenCalled();
  });

  it('provides playRuleOf3Fanfare without crashing in non-audio or disabled environments', () => {
    expect(() => audioEngine.playRuleOf3Fanfare()).not.toThrow();
  });

  it('handles start and stop ambient sound gracefully including binaural beats', () => {
    expect(() => audioEngine.startAmbientSound('none')).not.toThrow();
    expect(() => audioEngine.startAmbientSound('brown')).not.toThrow();
    expect(() => audioEngine.startAmbientSound('pink')).not.toThrow();
    expect(() => audioEngine.startAmbientSound('white')).not.toThrow();
    expect(() => audioEngine.startAmbientSound('rain')).not.toThrow();
    expect(() => audioEngine.startAmbientSound('binaural')).not.toThrow();
    expect(audioEngine.getCurrentAmbientType()).toBe('binaural');
    expect(() => audioEngine.stopAmbientSound(0)).not.toThrow();
    expect(audioEngine.getCurrentAmbientType()).toBe('none');
  });

  it('manages tactile and ambient volume settings reliably', () => {
    audioEngine.setVolume(0.5);
    expect(audioEngine.getVolume()).toBe(0.5);
    audioEngine.setVolume(1.5);
    expect(audioEngine.getVolume()).toBe(1.0);
    audioEngine.setVolume(-0.2);
    expect(audioEngine.getVolume()).toBe(0.0);

    audioEngine.setAmbientVolume(0.12);
    expect(audioEngine.getAmbientVolume()).toBe(0.12);
  });

  it('plays profile-aware click/pop sounds without throwing across all profiles', () => {
    const profiles = [
      'bubble',
      'zen',
      'mechanical',
      'marimba',
      'typewriter',
      'synth',
      'velvet',
      'mute',
    ] as const;

    profiles.forEach((p) => {
      audioEngine.setSoundProfile(p);
      expect(() => audioEngine.playClickSound()).not.toThrow();
      expect(() => audioEngine.playCompletionChime()).not.toThrow();
    });
  });

  it('plays gentle toggle sound tones for on and off states across all profiles', () => {
    const profiles = [
      'bubble',
      'zen',
      'mechanical',
      'marimba',
      'typewriter',
      'synth',
      'velvet',
      'mute',
    ] as const;

    profiles.forEach((p) => {
      audioEngine.setSoundProfile(p);
      expect(() => audioEngine.playToggleSound(true)).not.toThrow();
      expect(() => audioEngine.playToggleSound(false)).not.toThrow();
    });

    expect(() => audioEngine.playToggleOn()).not.toThrow();
    expect(() => audioEngine.playToggleOff()).not.toThrow();
  });

  it('supports auditionSound even when master sound is muted', () => {
    audioEngine.setSoundEnabled(false);
    expect(audioEngine.getSoundEnabled()).toBe(false);

    expect(() => audioEngine.auditionSound('marimba', 'pop')).not.toThrow();
    expect(() => audioEngine.auditionSound('typewriter', 'toggle')).not.toThrow();
    expect(() => audioEngine.auditionSound('synth', 'chime')).not.toThrow();
    expect(() => audioEngine.auditionSound('velvet', 'chime')).not.toThrow();

    // Reset back to true for other tests
    audioEngine.setSoundEnabled(true);
  });

  it('plays subtask and task uncheck audio tones', () => {
    expect(() => audioEngine.playSubtaskToggle(true)).not.toThrow();
    expect(() => audioEngine.playSubtaskToggle(false)).not.toThrow();
    expect(() => audioEngine.playTaskUncheckSound()).not.toThrow();
  });
});
