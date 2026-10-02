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

  it('handles start and stop ambient sound gracefully', () => {
    expect(() => audioEngine.startAmbientSound('none')).not.toThrow();
    expect(() => audioEngine.stopAmbientSound(0)).not.toThrow();
  });

  it('plays profile-aware click/pop sounds without throwing', () => {
    audioEngine.setSoundProfile('bubble');
    expect(() => audioEngine.playClickSound()).not.toThrow();

    audioEngine.setSoundProfile('zen');
    expect(() => audioEngine.playClickSound()).not.toThrow();

    audioEngine.setSoundProfile('mechanical');
    expect(() => audioEngine.playClickSound()).not.toThrow();

    audioEngine.setSoundProfile('mute');
    expect(() => audioEngine.playClickSound()).not.toThrow();
  });

  it('plays gentle toggle sound tones for on and off states', () => {
    audioEngine.setSoundProfile('bubble');
    expect(() => audioEngine.playToggleSound(true)).not.toThrow();
    expect(() => audioEngine.playToggleSound(false)).not.toThrow();
    expect(() => audioEngine.playToggleOn()).not.toThrow();
    expect(() => audioEngine.playToggleOff()).not.toThrow();

    audioEngine.setSoundProfile('zen');
    expect(() => audioEngine.playToggleSound(true)).not.toThrow();
    expect(() => audioEngine.playToggleSound(false)).not.toThrow();
  });

  it('plays subtask and task uncheck audio tones', () => {
    expect(() => audioEngine.playSubtaskToggle(true)).not.toThrow();
    expect(() => audioEngine.playSubtaskToggle(false)).not.toThrow();
    expect(() => audioEngine.playTaskUncheckSound()).not.toThrow();
  });
});
