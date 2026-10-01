/**
 * Web Audio API synthesized sound generator for tactile feedback and ambient focus.
 * Zero external audio assets required. 100% offline and low-latency.
 */

export type SoundProfile = 'zen' | 'mechanical' | 'bubble' | 'mute';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isSoundEnabled: boolean = true;
  private soundProfile: SoundProfile = 'zen';
  private ambientSource: AudioNode | null = null;
  private ambientGain: GainNode | null = null;

  constructor() {
    const saved = localStorage.getItem('flowtask_sound_enabled');
    if (saved !== null) {
      this.isSoundEnabled = saved === 'true';
    }
    const savedProfile = localStorage.getItem('flowtask_sound_profile') as SoundProfile;
    if (savedProfile) {
      this.soundProfile = savedProfile;
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
    localStorage.setItem('flowtask_sound_enabled', String(enabled));
    if (!enabled && this.ambientGain) {
      this.stopAmbientSound();
    }
  }

  public getSoundEnabled(): boolean {
    return this.isSoundEnabled;
  }

  public setSoundProfile(profile: SoundProfile) {
    this.soundProfile = profile;
    localStorage.setItem('flowtask_sound_profile', profile);
  }

  public getSoundProfile(): SoundProfile {
    return this.soundProfile;
  }

  /**
   * Play a pleasant two-tone celebratory chime for completed tasks.
   */
  public playCompletionChime() {
    if (!this.isSoundEnabled || this.soundProfile === 'mute') return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (this.soundProfile === 'mechanical') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
      return;
    }

    if (this.soundProfile === 'bubble') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.07);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
      return;
    }

    // Default 'zen' profile: Harmonic frequencies C5 and G5
    const playTone = (freq: number, start: number, duration: number, gainVal: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainVal, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(523.25, now, 0.35, 0.15); // C5
    playTone(783.99, now + 0.08, 0.45, 0.18); // G5
  }

  /**
   * Play a subtle click for toggling subtasks or buttons.
   */
  public playClickSound() {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.03);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }

  /**
   * Resonant Tibetan singing bowl chime when a Pomodoro completes.
   */
  public playPomodoroComplete() {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const frequencies = [440, 880, 1320]; // Fundamental + harmonics

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const amp = 0.2 / (index + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 2.5);
    });
  }

  /**
   * Synthesize real-time Brown Noise for deep focus.
   */
  public startBrownNoise(volume: number = 0.1) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.stopAmbientSound();

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; // Gain compensation
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    whiteNoise.start();

    this.ambientSource = whiteNoise;
    this.ambientGain = gain;
  }

  public stopAmbientSound() {
    if (this.ambientSource) {
      try {
        (this.ambientSource as AudioScheduledSourceNode).stop();
      } catch {
        // already stopped
      }
      this.ambientSource = null;
      this.ambientGain = null;
    }
  }
}

export const audioEngine = new AudioEngine();
