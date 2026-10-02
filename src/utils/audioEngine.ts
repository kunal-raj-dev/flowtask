/**
 * Web Audio API synthesized sound generator for tactile feedback and ambient focus.
 * Zero external audio assets required. 100% offline and low-latency.
 */

export type SoundProfile = 'zen' | 'mechanical' | 'bubble' | 'mute';
export type AmbientSoundType = 'none' | 'brown' | 'pink' | 'white' | 'rain';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isSoundEnabled: boolean = true;
  private soundProfile: SoundProfile = 'zen';
  private ambientSource: AudioNode | null = null;
  private ambientGain: GainNode | null = null;
  private lastMajorSoundTime: number = 0;
  private lastClickTime: number = 0;

  public notifyMajorSound() {
    this.lastMajorSoundTime = Date.now();
  }

  constructor() {
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        const saved = localStorage.getItem('flowtask_sound_enabled');
        if (saved !== null) {
          this.isSoundEnabled = saved === 'true';
        }
        const savedProfile = localStorage.getItem('flowtask_sound_profile') as SoundProfile;
        if (savedProfile) {
          this.soundProfile = savedProfile;
        }
      }
    } catch {
      // Storage unavailable or disabled
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
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem('flowtask_sound_enabled', String(enabled));
      }
    } catch {}
    if (!enabled && this.ambientGain) {
      this.stopAmbientSound();
    }
  }

  public getSoundEnabled(): boolean {
    return this.isSoundEnabled;
  }

  public setSoundProfile(profile: SoundProfile) {
    this.soundProfile = profile;
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem('flowtask_sound_profile', profile);
      }
    } catch {}
  }

  public getSoundProfile(): SoundProfile {
    return this.soundProfile;
  }

  /**
   * Play a pleasant two-tone celebratory chime for completed tasks.
   */
  public playCompletionChime() {
    if (!this.isSoundEnabled || this.soundProfile === 'mute') return;
    this.notifyMajorSound();
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
   * Alias for playCompletionChime for completed task actions.
   */
  public playTaskComplete() {
    this.playCompletionChime();
  }

  /**
   * Play a subtle, tactile click or pop tailored to the active sound profile.
   * Suppressed if a major sound (completion chime/fanfare) just fired, and throttled to prevent audio overlap.
   */
  public playClickSound() {
    if (!this.isSoundEnabled || this.soundProfile === 'mute') return;
    const nowMs = Date.now();
    if (nowMs - this.lastMajorSoundTime < 70) return;
    if (nowMs - this.lastClickTime < 30) return;
    this.lastClickTime = nowMs;

    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (this.soundProfile === 'bubble') {
      // Soft organic water bubble pop: quick gentle upward sine sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.035);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
      return;
    }

    if (this.soundProfile === 'mechanical') {
      // Crisp mechanical key switch click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.025);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.025);
      return;
    }

    // Default 'zen': gentle crystal singing glass tap (C6)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Play gentle, pleasing harmonic sound tones for stateful toggles (on vs off).
   */
  public playToggleSound(state: boolean) {
    if (!this.isSoundEnabled || this.soundProfile === 'mute') return;
    this.notifyMajorSound();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (this.soundProfile === 'bubble') {
      // Gentle organic water bubble tones: ascending on ON, soft descending droplet on OFF
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      if (state) {
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.055);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      } else {
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.075);
      return;
    }

    if (this.soundProfile === 'mechanical') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      if (state) {
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.035);
      } else {
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.04);
      }
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
      return;
    }

    // Default 'zen': gentle harmonic intervals
    // On: C5 (523.25 Hz) -> E5 (659.25 Hz)
    // Off: E5 (659.25 Hz) -> C5 (523.25 Hz)
    const startFreq = state ? 523.25 : 659.25;
    const endFreq = state ? 659.25 : 523.25;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playToggleOn() {
    this.playToggleSound(true);
  }

  public playToggleOff() {
    this.playToggleSound(false);
  }

  /**
   * Gentle micro-tone for checking / unchecking a subtask.
   */
  public playSubtaskToggle(completed: boolean) {
    this.playToggleSound(completed);
  }

  /**
   * Gentle pleasing tone for reopening / uncompleting a parent task.
   */
  public playTaskUncheckSound() {
    this.playToggleSound(false);
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
   * Universal ambient soundscape player.
   */
  public startAmbientSound(type: AmbientSoundType, volume: number = 0.08) {
    if (type === 'none') {
      this.stopAmbientSound();
      return;
    }
    if (type === 'brown') {
      this.startBrownNoise(volume);
    } else if (type === 'pink') {
      this.startPinkNoise(volume);
    } else if (type === 'white') {
      this.startWhiteNoise(volume * 0.6);
    } else if (type === 'rain') {
      this.startRainSound(volume);
    }
  }

  /**
   * Synthesize real-time Brown Noise for deep rumble focus.
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

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + 1.2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();

    this.ambientSource = source;
    this.ambientGain = gain;
  }

  /**
   * Synthesize real-time Pink Noise (1/f equal energy per octave) via Paul Kellet filter.
   */
  public startPinkNoise(volume: number = 0.08) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.stopAmbientSound();

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + 1.2);

    source.connect(gain);
    gain.connect(ctx.destination);

    source.start();

    this.ambientSource = source;
    this.ambientGain = gain;
  }

  /**
   * Synthesize real-time White Noise with gentle top-end rolloff.
   */
  public startWhiteNoise(volume: number = 0.05) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.stopAmbientSound();

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(6000, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + 1.2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();

    this.ambientSource = source;
    this.ambientGain = gain;
  }

  /**
   * Synthesize gentle Rain Sound using band-filtered pink noise with subtle wave ripples.
   */
  public startRainSound(volume: number = 0.08) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.stopAmbientSound();

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.998 * b0 + white * 0.06;
      b1 = 0.99 * b1 + white * 0.08;
      b2 = 0.95 * b2 + white * 0.16;
      output[i] = (b0 + b1 + b2) * 0.2;
    }

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.Q.setValueAtTime(0.8, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), ctx.currentTime + 1.2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start();

    this.ambientSource = source;
    this.ambientGain = gain;
  }

  /**
   * Harmonic Tibetan singing bowl chord (528 Hz Solfeggio frequency + harmonic overtones)
   * celebrating complete execution of all 3 MITs.
   */
  public playRuleOf3Fanfare() {
    if (!this.isSoundEnabled) return;
    this.notifyMajorSound();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const frequencies = [528, 792, 1056]; // 528 Hz fundamental, fifth, octave

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const amp = 0.16 / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.04);
      osc.stop(now + 3.0);
    });
  }

  public stopAmbientSound(fadeDuration: number = 0.8) {
    if (this.ambientSource && this.ambientGain && this.ctx) {
      const source = this.ambientSource;
      const gain = this.ambientGain;
      const now = this.ctx.currentTime;
      try {
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
        setTimeout(() => {
          try {
            (source as AudioScheduledSourceNode).stop();
          } catch {}
        }, fadeDuration * 1000);
      } catch {
        try {
          (source as AudioScheduledSourceNode).stop();
        } catch {}
      }
      this.ambientSource = null;
      this.ambientGain = null;
    } else if (this.ambientSource) {
      try {
        (this.ambientSource as AudioScheduledSourceNode).stop();
      } catch {}
      this.ambientSource = null;
      this.ambientGain = null;
    }
  }
}

export const audioEngine = new AudioEngine();
