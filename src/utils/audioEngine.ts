/**
 * Web Audio API synthesized sound generator for tactile feedback and ambient focus.
 * Zero external audio assets required. 100% offline and low-latency.
 */

export type SoundProfile =
  | 'zen'
  | 'mechanical'
  | 'bubble'
  | 'marimba'
  | 'typewriter'
  | 'synth'
  | 'velvet'
  | 'mute';

export type AmbientSoundType = 'none' | 'brown' | 'pink' | 'white' | 'rain' | 'binaural';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private isSoundEnabled: boolean = true;
  private soundProfile: SoundProfile = 'zen';
  private tactileVolume: number = 0.8;
  private ambientVolume: number = 0.08;
  private currentAmbientType: AmbientSoundType = 'none';
  private ambientSource: AudioNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOscillators: OscillatorNode[] = [];
  public ambientTracks: Map<AmbientSoundType, { source: AudioNode | AudioNode[]; gain: GainNode }> = new Map();
  public trackVolumes: Map<AmbientSoundType, number> = new Map();
  private lastMajorSoundTime: number = 0;
  private lastClickTime: number = 0;
  private lastCompletionChimeTime: number = 0;

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
        const savedVolume = localStorage.getItem('flowtask_tactile_volume');
        if (savedVolume !== null) {
          const parsed = parseFloat(savedVolume);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            this.tactileVolume = parsed;
          }
        }
        const savedAmbientVol = localStorage.getItem('flowtask_ambient_volume');
        if (savedAmbientVol !== null) {
          const parsed = parseFloat(savedAmbientVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            this.ambientVolume = parsed;
          }
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
        try { this.ctx = new AudioCtx(); } catch { return null; }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => { /* Browser may require another user gesture. */ });
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

  public setEnabled(enabled: boolean) {
    this.setSoundEnabled(enabled);
  }

  public getEnabled(): boolean {
    return this.getSoundEnabled();
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

  public setVolume(vol: number) {
    this.tactileVolume = Math.max(0, Math.min(1, vol));
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem('flowtask_tactile_volume', String(this.tactileVolume));
      }
    } catch {}
  }

  public getVolume(): number {
    return this.tactileVolume;
  }

  public setAmbientVolume(vol: number) {
    this.ambientVolume = Math.max(0, Math.min(1, vol));
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem('flowtask_ambient_volume', String(this.ambientVolume));
      }
    } catch {}
    if (this.ambientGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.ambientGain.gain.setValueAtTime(this.ambientGain.gain.value, now);
        this.ambientGain.gain.linearRampToValueAtTime(this.ambientVolume, now + 0.1);
      } catch {}
    }
  }

  public getAmbientVolume(): number {
    return this.ambientVolume;
  }

  public getCurrentAmbientType(): AmbientSoundType {
    return this.currentAmbientType;
  }

  /**
   * Play a celebratory chime for completed tasks.
   * Supports profile overriding and forcePlay for live audition previews.
   */
  public playCompletionChime(profileOverride?: SoundProfile, forcePlay: boolean = false) {
    const profile = profileOverride || this.soundProfile;
    if ((!this.isSoundEnabled && !forcePlay) || profile === 'mute') return;
    const nowMs = Date.now();
    if (!forcePlay && nowMs - this.lastCompletionChimeTime < 50) return;
    this.lastCompletionChimeTime = nowMs;
    this.notifyMajorSound();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.tactileVolume;

    if (profile === 'mechanical') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.04);
      gain.gain.setValueAtTime(0.12 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
      return;
    }

    if (profile === 'bubble') {
      // True dual-operator FM synthesis: 520Hz carrier modulated by 260Hz with exponential gain decay
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(520, now);
      carrier.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(260, now);

      modGain.gain.setValueAtTime(350, now);
      modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      gain.gain.setValueAtTime(0.16 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

      carrier.connect(gain);
      gain.connect(ctx.destination);

      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + 0.1);
      carrier.stop(now + 0.1);
      return;
    }

    if (profile === 'marimba') {
      // True dual-operator FM synthesis: 520Hz carrier modulated by 260Hz with exponential gain decay
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(520, now);
      carrier.frequency.exponentialRampToValueAtTime(880, now + 0.07);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(260, now);

      modGain.gain.setValueAtTime(400, now);
      modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      gain.gain.setValueAtTime(0.18 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      carrier.connect(gain);
      gain.connect(ctx.destination);

      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + 0.35);
      carrier.stop(now + 0.35);
      return;
    }

    if (profile === 'typewriter') {
      // Vintage carriage return bell (C7 - 2093 Hz) + mechanical catch
      const bell = ctx.createOscillator();
      const bellGain = ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(2093, now);
      bellGain.gain.setValueAtTime(0.18 * vol, now);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      bell.connect(bellGain);
      bellGain.connect(ctx.destination);
      bell.start(now);
      bell.stop(now + 0.55);

      // Carriage thud
      const latch = ctx.createOscillator();
      const latchGain = ctx.createGain();
      latch.type = 'triangle';
      latch.frequency.setValueAtTime(240, now + 0.06);
      latch.frequency.exponentialRampToValueAtTime(60, now + 0.1);
      latchGain.gain.setValueAtTime(0.1 * vol, now + 0.06);
      latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      latch.connect(latchGain);
      latchGain.connect(ctx.destination);
      latch.start(now + 0.06);
      latch.stop(now + 0.1);
      return;
    }

    if (profile === 'synth') {
      // 80s analog FM arpeggio: C5 (523), E5 (659), G5 (784), B5 (987)
      const notes = [523.25, 659.25, 783.99, 987.77];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now + i * 0.04);

        gain.gain.setValueAtTime(0.09 * vol, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 0.35);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.35);
      });
      return;
    }

    if (profile === 'velvet') {
      // Warm felt-damped Rhodes interval: A3 (220 Hz) and E4 (330 Hz)
      const playFeltTone = (freq: number, start: number) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, start);
        gain.gain.setValueAtTime(0.18 * vol, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.42);
      };
      playFeltTone(220, now);
      playFeltTone(330, now + 0.05);
      return;
    }

    // Default 'zen' profile: Harmonic frequencies C5 and G5
    const playTone = (freq: number, start: number, duration: number, gainVal: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(gainVal * vol, start + 0.02);
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

  public playNotification() {
    this.playClickSound();
  }

  /**
   * Soft felt mallet chime (D5 -> B4) with 750Hz bandpass filter.
   */
  public playDeferWoodblock(forcePlay = false) {
    if ((!this.isSoundEnabled && !forcePlay) || this.soundProfile === 'mute') return;
    this.notifyMajorSound();
    const ctx = this.getContext();
    if (!ctx) return;
    const startTime = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, startTime); // D5
    osc.frequency.exponentialRampToValueAtTime(493.88, startTime + 0.08); // B4

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750, startTime);
    filter.Q.setValueAtTime(1.4, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.22 * this.tactileVolume, startTime + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.19);
  }

  /**
   * Tibetan singing bowl fundamental mode (F#4, 369.99Hz) with tau = 2.4s resonance tail.
   */
  public playTimerChime(forcePlay = false) {
    if ((!this.isSoundEnabled && !forcePlay) || this.soundProfile === 'mute') return;
    this.notifyMajorSound();
    const ctx = this.getContext();
    if (!ctx) return;
    const startTime = ctx.currentTime;
    const vol = this.tactileVolume;
    const frequencies = [369.99, 739.98, 1109.97];

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      const amp = (0.2 / (idx + 1)) * vol;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(amp, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 2.45);
    });
  }

  /**
   * 800 Hz micro-haptic tick (30ms) on calendar grid slot alignment.
   */
  public playMagneticSnap(forcePlay = false) {
    if ((!this.isSoundEnabled && !forcePlay) || this.soundProfile === 'mute') return;
    const ctx = this.getContext();
    if (!ctx) return;
    const startTime = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, startTime);
    osc.frequency.exponentialRampToValueAtTime(400, startTime + 0.03);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.08 * this.tactileVolume, startTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.031);
  }

  /**
   * Play an immediate tactile pop sound.
   */
  public playPopSound(profileOverride?: SoundProfile, forcePlay: boolean = false) {
    this.playClickSound(profileOverride, forcePlay);
  }

  /**
   * Play a subtle, tactile click or pop tailored to the active sound profile.
   * Suppressed if a major sound just fired, and throttled to prevent audio overlap.
   */
  public playClickSound(profileOverride?: SoundProfile, forcePlay: boolean = false) {
    const profile = profileOverride || this.soundProfile;
    if ((!this.isSoundEnabled && !forcePlay) || profile === 'mute') return;

    const nowMs = Date.now();
    if (!forcePlay) {
      if (nowMs - this.lastMajorSoundTime < 70) return;
      if (nowMs - this.lastClickTime < 30) return;
    }
    this.lastClickTime = nowMs;

    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.tactileVolume;

    if (profile === 'bubble') {
      // Dual-operator FM synthesis: 520Hz carrier modulated by 260Hz with exponential gain decay
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(520, now);
      carrier.frequency.exponentialRampToValueAtTime(780, now + 0.04);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(260, now);

      modGain.gain.setValueAtTime(280, now);
      modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.045);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      gain.gain.setValueAtTime(0.12 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      carrier.connect(gain);
      gain.connect(ctx.destination);

      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + 0.045);
      carrier.stop(now + 0.045);
      return;
    }

    if (profile === 'mechanical') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.025);

      gain.gain.setValueAtTime(0.09 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.025);
      return;
    }

    if (profile === 'marimba') {
      // True dual-operator FM synthesis: 520Hz carrier modulated by 260Hz with exponential gain decay
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.setValueAtTime(520, now);
      carrier.frequency.exponentialRampToValueAtTime(880, now + 0.04);

      modulator.type = 'sine';
      modulator.frequency.setValueAtTime(260, now);

      modGain.gain.setValueAtTime(320, now);
      modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      gain.gain.setValueAtTime(0.14 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      carrier.connect(gain);
      gain.connect(ctx.destination);

      modulator.start(now);
      carrier.start(now);
      modulator.stop(now + 0.045);
      carrier.stop(now + 0.045);
      return;
    }

    if (profile === 'typewriter') {
      // Crisp mechanical typewriter strike
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(350, now + 0.022);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      gain.gain.setValueAtTime(0.14 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.022);
      return;
    }

    if (profile === 'synth') {
      // 80s analog synthesizer pulse blip
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.03);
      gain.gain.setValueAtTime(0.08 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
      return;
    }

    if (profile === 'velvet') {
      // Whisper-quiet low frequency felt thud
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.035);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.12 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.035);
      return;
    }

    // Default 'zen': gentle crystal singing glass tap (C6)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, now);

    gain.gain.setValueAtTime(0.05 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Play harmonic sound tones for stateful toggles (on vs off).
   */
  public playToggleSound(state: boolean, profileOverride?: SoundProfile, forcePlay: boolean = false) {
    const profile = profileOverride || this.soundProfile;
    if ((!this.isSoundEnabled && !forcePlay) || profile === 'mute') return;

    this.notifyMajorSound();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.tactileVolume;

    if (profile === 'bubble') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      if (state) {
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.055);
        gain.gain.setValueAtTime(0.09 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      } else {
        osc.frequency.setValueAtTime(620, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);
        gain.gain.setValueAtTime(0.07 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.075);
      return;
    }

    if (profile === 'mechanical') {
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
      gain.gain.setValueAtTime(0.09 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
      return;
    }

    if (profile === 'marimba') {
      const startFreq = state ? 440 : 660;
      const endFreq = state ? 660 : 440;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);
      gain.gain.setValueAtTime(0.12 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.065);
      return;
    }

    if (profile === 'typewriter') {
      // Rapid double click
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(state ? 1600 : 1300, now);
      gain1.gain.setValueAtTime(0.1 * vol, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.02);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(state ? 2100 : 1000, now + 0.025);
      gain2.gain.setValueAtTime(0.11 * vol, now + 0.025);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.025);
      osc2.stop(now + 0.045);
      return;
    }

    if (profile === 'synth') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const startFreq = state ? 440 : 880;
      const endFreq = state ? 880 : 440;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);
      gain.gain.setValueAtTime(0.08 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      return;
    }

    if (profile === 'velvet') {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const startFreq = state ? 120 : 190;
      const endFreq = state ? 190 : 120;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, now);
      gain.gain.setValueAtTime(0.11 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      return;
    }

    // Default 'zen': gentle harmonic intervals
    const startFreq = state ? 523.25 : 659.25;
    const endFreq = state ? 659.25 : 523.25;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.05);

    gain.gain.setValueAtTime(0.08 * vol, now);
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

  public playSubtaskToggle(completed: boolean) {
    this.playToggleSound(completed);
  }

  public playTaskUncheckSound() {
    this.playToggleSound(false);
  }

  /**
   * Audition a specific sound profile directly without modifying global selection.
   * Plays cleanly even if master sound is muted.
   */
  public auditionSound(profile: SoundProfile, type: 'pop' | 'toggle' | 'chime' = 'chime') {
    if (profile === 'mute') return;
    if (type === 'pop') {
      this.playClickSound(profile, true);
    } else if (type === 'toggle') {
      this.playToggleSound(true, profile, true);
    } else {
      this.playCompletionChime(profile, true);
    }
  }

  /**
   * Resonant Tibetan singing bowl chime when a Pomodoro completes.
   */
  public playPomodoroComplete() {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.tactileVolume;
    const frequencies = [440, 880, 1320];

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const amp = (0.2 / (index + 1)) * vol;
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
  public startAmbientSound(type: AmbientSoundType, volume: number = this.ambientVolume) {
    if (type === 'none') {
      this.stopAmbientSound();
      return;
    }
    this.ambientVolume = volume;
    this.currentAmbientType = type;
    if (type === 'brown') {
      this.startBrownNoise(volume, false);
    } else if (type === 'pink') {
      this.startPinkNoise(volume, false);
    } else if (type === 'white') {
      this.startWhiteNoise(volume * 0.6, false);
    } else if (type === 'rain') {
      this.startRainSound(volume, false);
    } else if (type === 'binaural') {
      this.startBinauralTone(volume, false);
    }
  }

  /**
   * Start a concurrent ambient track in the multi-track mixer without cancelling others.
   */
  public startTrack(type: AmbientSoundType, volume: number = 0.08) {
    if (!this.isSoundEnabled || type === 'none') return;
    this.trackVolumes.set(type, volume);
    const ctx = this.getContext();
    if (!ctx) {
      this.ambientTracks.set(type, { source: null as unknown as AudioNode, gain: null as unknown as GainNode });
      return;
    }
    // Clean up any existing instance of this track immediately to prevent audio leaks
    if (this.ambientTracks.has(type)) {
      this.stopTrack(type, 0);
    }
    if (type === 'brown') this.startBrownNoise(volume, true);
    else if (type === 'pink') this.startPinkNoise(volume, true);
    else if (type === 'white') this.startWhiteNoise(volume, true);
    else if (type === 'rain') this.startRainSound(volume, true);
    else if (type === 'binaural') this.startBinauralTone(volume, true);
  }

  /**
   * Stop a single concurrent ambient track in the multi-track mixer.
   */
  public stopTrack(type: AmbientSoundType, fadeDuration: number = 0.8) {
    const track = this.ambientTracks.get(type);
    if (!track) return;
    const now = this.ctx?.currentTime || 0;
    try {
      if (track.gain) {
        track.gain.gain.setValueAtTime(track.gain.gain.value, now);
        track.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
      }
    } catch {}
    if (fadeDuration <= 0) {
      try {
        if (Array.isArray(track.source)) {
          track.source.forEach((s) => (s as AudioScheduledSourceNode)?.stop?.());
        } else if (track.source) {
          (track.source as AudioScheduledSourceNode)?.stop?.();
        }
      } catch {}
      if (this.ambientTracks.get(type) === track) {
        this.ambientTracks.delete(type);
        if (this.currentAmbientType === type) {
          const remaining = Array.from(this.ambientTracks.keys());
          this.currentAmbientType = remaining.length > 0 ? remaining[0] : 'none';
        }
      }
      return;
    }
    setTimeout(() => {
      try {
        if (Array.isArray(track.source)) {
          track.source.forEach((s) => (s as AudioScheduledSourceNode)?.stop?.());
        } else if (track.source) {
          (track.source as AudioScheduledSourceNode)?.stop?.();
        }
      } catch {}
      if (this.ambientTracks.get(type) === track) {
        this.ambientTracks.delete(type);
        if (this.currentAmbientType === type) {
          const remaining = Array.from(this.ambientTracks.keys());
          this.currentAmbientType = remaining.length > 0 ? remaining[0] : 'none';
        }
      }
    }, fadeDuration * 1000);
  }

  /**
   * Adjust the volume of an individual concurrent track in the multi-track mixer.
   */
  public setTrackVolume(type: AmbientSoundType, volume: number) {
    this.trackVolumes.set(type, volume);
    const track = this.ambientTracks.get(type);
    if (track && track.gain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        track.gain.gain.setValueAtTime(track.gain.gain.value, now);
        track.gain.gain.linearRampToValueAtTime(volume, now + 0.1);
      } catch {}
    }
  }

  public getTrackVolume(type: AmbientSoundType): number {
    return this.trackVolumes.get(type) ?? this.ambientVolume;
  }

  public isTrackPlaying(type: AmbientSoundType): boolean {
    return this.ambientTracks.has(type);
  }

  /**
   * Synthesize real-time Brown Noise for deep rumble focus.
   */
  public startBrownNoise(volume: number = 0.1, multiTrack: boolean = false) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (!multiTrack) {
      this.stopAmbientSound();
    }
    this.currentAmbientType = 'brown';

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
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
    this.ambientTracks.set('brown', { source, gain });
    this.trackVolumes.set('brown', volume);
  }

  /**
   * Synthesize real-time Pink Noise via Paul Kellet filter.
   */
  public startPinkNoise(volume: number = 0.08, multiTrack: boolean = false) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (!multiTrack) {
      this.stopAmbientSound();
    }
    this.currentAmbientType = 'pink';

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
    this.ambientTracks.set('pink', { source, gain });
    this.trackVolumes.set('pink', volume);
  }

  /**
   * Synthesize real-time White Noise with gentle top-end rolloff.
   */
  public startWhiteNoise(volume: number = 0.05, multiTrack: boolean = false) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (!multiTrack) {
      this.stopAmbientSound();
    }
    this.currentAmbientType = 'white';

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
    this.ambientTracks.set('white', { source, gain });
    this.trackVolumes.set('white', volume);
  }

  /**
   * Synthesize gentle Rain Sound using band-filtered pink noise with subtle wave ripples.
   */
  public startRainSound(volume: number = 0.08, multiTrack: boolean = false) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (!multiTrack) {
      this.stopAmbientSound();
    }
    this.currentAmbientType = 'rain';

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
    this.ambientTracks.set('rain', { source, gain });
    this.trackVolumes.set('rain', volume);
  }

  /**
   * Experimental stereo tones. Headphones required; no cognitive benefit is implied.
   */
  public startBinauralTone(volume: number = 0.08, multiTrack: boolean = false) {
    if (!this.isSoundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (!multiTrack) {
      this.stopAmbientSound();
    }
    this.currentAmbientType = 'binaural';

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    // 190 Hz and 230 Hz create a 40 Hz difference binaural frequency
    osc1.frequency.setValueAtTime(190, ctx.currentTime);
    osc2.frequency.setValueAtTime(230, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.65), ctx.currentTime + 1.5);

    const left = ctx.createStereoPanner(); left.pan.value = -1;
    const right = ctx.createStereoPanner(); right.pan.value = 1;
    osc1.connect(left); left.connect(gain);
    osc2.connect(right); right.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    this.ambientOscillators = [osc1, osc2];
    this.ambientGain = gain;
    this.ambientTracks.set('binaural', { source: [osc1, osc2], gain });
    this.trackVolumes.set('binaural', volume);
  }

  /**
   * Harmonic Tibetan singing bowl chord (528 Hz Solfeggio frequency + harmonic overtones).
   */
  public playRuleOf3Fanfare() {
    if (!this.isSoundEnabled) return;
    this.notifyMajorSound();
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const vol = this.tactileVolume;
    const frequencies = [528, 792, 1056];

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const amp = (0.16 / (idx + 1)) * vol;
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
    this.currentAmbientType = 'none';

    // Stop all multi-track ambient streams
    for (const [, track] of this.ambientTracks.entries()) {
      try {
        const now = this.ctx?.currentTime || 0;
        track.gain.gain.setValueAtTime(track.gain.gain.value, now);
        track.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
      } catch {}
      setTimeout(() => {
        try {
          if (Array.isArray(track.source)) {
            track.source.forEach((s) => (s as AudioScheduledSourceNode).stop?.());
          } else {
            (track.source as AudioScheduledSourceNode).stop?.();
          }
        } catch {}
      }, fadeDuration * 1000);
    }
    this.ambientTracks.clear();

    // Stop multi-oscillator setups (e.g. binaural beats)
    if (this.ambientOscillators.length > 0) {
      const oscs = [...this.ambientOscillators];
      this.ambientOscillators = [];
      setTimeout(() => {
        oscs.forEach((osc) => {
          try {
            osc.stop();
          } catch {}
        });
      }, fadeDuration * 1000);
    }

    if ((this.ambientSource || this.ambientGain) && this.ambientGain && this.ctx) {
      const source = this.ambientSource;
      const gain = this.ambientGain;
      const now = this.ctx.currentTime;
      try {
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeDuration);
        setTimeout(() => {
          try {
            (source as AudioScheduledSourceNode | null)?.stop();
          } catch {}
        }, fadeDuration * 1000);
      } catch {
        try {
          (source as AudioScheduledSourceNode | null)?.stop();
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
