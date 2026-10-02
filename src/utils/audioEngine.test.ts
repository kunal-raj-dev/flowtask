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
});
